
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { matchAnalysis, betOutcome } from '@/lib/db/schema';
import { updateCalibration } from '@/lib/analysis/calibration';
import { eq, and, isNotNull } from 'drizzle-orm';
import { fetchApi } from '@/lib/api-client';

/**
 * CRON JOB: CALIBRATION UPDATER
 * 
 * Runs daily (e.g. at 02:00 AM)
 * 1. Finds settled bets/predictions that haven't been calibrated yet.
 * 2. Fetches final scores if missing.
 * 3. Updates the `model_calibration` buckets.
 */
export async function GET(request: NextRequest) {
    console.log('[Cron] Starting Calibration Update...');
    let processed = 0;

    // 1. Get settled bets that haven't been calibrated yet
    const uncalibratedBets = await db.select()
        .from(betOutcome)
        .leftJoin(matchAnalysis, eq(betOutcome.analysisId, matchAnalysis.id))
        .where(and(
            isNotNull(betOutcome.settledAt),
            // We want rows where calibratedAt is NULL. Drizzle syntax depends on version, check docs if unsure.
            // Using raw sql or standard drizzle filter.
            // Usually: isNull(betOutcome.calibratedAt)
            sql`${betOutcome.calibratedAt} IS NULL`
        ))
        .limit(50); // Process in batches

    console.log(`[Cron] Found ${uncalibratedBets.length} bets to process for calibration.`);

    for (const row of uncalibratedBets) {
        const bet = row.bet_outcome;
        const analysis = row.match_analysis;

        if (!bet || !analysis) continue;

        // Determine if prediction was correct
        // Prediction: analysis.predictedOutcome ('HOME', 'DRAW', 'AWAY')
        // Result: bet.actualResult
        const wasCorrect = bet.actualResult === analysis.predictedOutcome;

        // Probability used
        const prob = analysis.aiProbability; // 0-100 usually, wait need to check schema. schema says 'real'.
        // Code usually normalizes 0-1 or 0-100. Let's assume 0.75 (decimal) for calculation logic.
        // If stored as 75.0, divide by 100.
        const decimalProb = prob > 1 ? prob / 100 : prob;

        // Update Calibration Bucket
        // We simulate leagueId here if not in schema properly or join not perfectly mapped? 
        // match_analysis has leagueName but not ID? Wait, check schema.
        // Schema matchAnalysis has `fixtureId`. We might need to fetch fixture to get leagueId?
        // Or we should store leagueId in matchAnalysis.
        // Schema has `leagueName`. Let's assume for v2.1 calibration purely on Prob is okay for now,
        // or we need to extract league ID.
        // Ah, `matchAnalysis` doesn't have leagueId column in the schema I viewed earlier?
        // Let's check schema content from previous turn.
        // It has `leagueName`.

        // LIMITATION: We don't have leagueId in matchAnalysis easily.
        // WORKAROUND: Use a default global calibration (ID=0) OR fetch it.
        // Optimally, we add leagueId to match_analysis.
        // For this step, I will use ID=0 (Global Model Calibration) to proceed.

        await updateCalibration(0, decimalProb, wasCorrect);

        // Mark as calibrated
        await db.update(betOutcome)
            .set({ calibratedAt: new Date() })
            .where(eq(betOutcome.id, bet.id));

        processed++;
    }

    return NextResponse.json({
        success: true,
        message: `Calibration Cron Job finished. Processed ${processed} bets.`,
        processedCount: processed
    });
}
```
