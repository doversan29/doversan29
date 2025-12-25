
import { db } from '../db/client';
import { modelCalibration, betOutcome, matchAnalysis } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * CALIBRATION SYSTEM (v2.1)
 * 
 * Objective: Ensure "70% confidence" actually means "wins 70% of the time".
 * Method: Binning/Bucketing predictions into 5% intervals.
 */

const BUCKET_SIZE = 0.05; // 5% buckets

/**
 * Calculate the bucket for a given probability (e.g., 0.73 -> 0.70)
 */
export function getProbabilityBucket(probability: number): number {
    // Floor to nearest 0.05
    return Math.floor(probability / BUCKET_SIZE) * BUCKET_SIZE;
}

/**
 * Update calibration tables based on a settled bet result
 */
export async function updateCalibration(
    leagueId: number,
    predictedProb: number,
    wasCorrect: boolean
) {
    const bucket = getProbabilityBucket(predictedProb);

    // Check if bucket exists for this league
    const existing = await db.select()
        .from(modelCalibration)
        .where(and(
            eq(modelCalibration.leagueId, leagueId),
            // Floating point comparison in SQL can be tricky, but usually exact bin matching works if generated consistently
            // Ideally we use a range or integer IDs for buckets, but for now we try exact match on the float
            sql`ABS(${modelCalibration.probabilityBucket} - ${bucket}) < 0.001`
        ))
        .limit(1);

    if (existing.length === 0) {
        // Create new bucket entry
        await db.insert(modelCalibration).values({
            leagueId,
            probabilityBucket: bucket,
            totalPredictions: 1,
            correctPredictions: wasCorrect ? 1 : 0,
            actualAccuracy: wasCorrect ? 1.0 : 0.0
        });
    } else {
        // Update existing entry
        const record = existing[0];
        const newTotal = (record.totalPredictions || 0) + 1;
        const newCorrect = (record.correctPredictions || 0) + (wasCorrect ? 1 : 0);
        const newAccuracy = newCorrect / newTotal;

        await db.update(modelCalibration)
            .set({
                totalPredictions: newTotal,
                correctPredictions: newCorrect,
                actualAccuracy: newAccuracy,
                lastUpdated: new Date()
            })
            .where(eq(modelCalibration.id, record.id));
    }
}

/**
 * Get the calibration factor for a given probability
 * Returns a multiplier. If model says 0.70 but accuracy is 0.60, factor is 0.85 (penalty).
 */
export async function getCalibrationFactor(leagueId: number, rawProb: number): Promise<number> {
    const bucket = getProbabilityBucket(rawProb);

    const record = await db.select()
        .from(modelCalibration)
        .where(and(
            eq(modelCalibration.leagueId, leagueId),
            sql`ABS(${modelCalibration.probabilityBucket} - ${bucket}) < 0.001`
        ))
        .limit(1);

    if (record.length === 0 || (record[0].totalPredictions || 0) < 10) {
        return 1.0; // Not enough data to calibrate
    }

    const actual = record[0].actualAccuracy || 0;
    const expected = record[0].probabilityBucket; // e.g. 0.70 (representing 0.70-0.75 range)

    // Avoid division by zero
    if (expected === 0) return 1.0;

    // Calculate Factor
    // Example: Expected 0.70, Actual 0.50 -> Factor = 0.71 (Penalize)
    // Example: Expected 0.70, Actual 0.80 -> Factor = 1.14 (Boost)
    return actual / (expected + (BUCKET_SIZE / 2)); // Compare to mid-point of bucket
}

/**
 * Apply calibration to a raw probability
 */
export async function calibrateProbability(leagueId: number, rawProb: number): Promise<number> {
    const factor = await getCalibrationFactor(leagueId, rawProb);
    let calibrated = rawProb * factor;

    // Clamp between 0 and 1
    return Math.min(Math.max(calibrated, 0), 0.99);
}
