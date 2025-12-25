
import { db } from '@/lib/db/client';
import { betOutcome, matchAnalysis, modelCalibration } from '@/lib/db/schema';
import { eq, desc, isNotNull, sql } from 'drizzle-orm';

/**
 * DASHBOARD ANALYTICS (v2.1)
 * 
 * Aggregates advanced metrics for the "Quant Dashboard":
 * 1. Calibration Accuracy (Expected vs Actual).
 * 2. CLV Performance (Buying vs Closing).
 * 3. Bankroll Health (Drawdown, Risk of Ruin).
 */

export interface DashboardMetrics {
    calibration: {
        bucket: number;
        expected: number;
        actual: number;
        count: number;
    }[];
    clv: {
        avgClv: number;
        beatingMarketRate: number; // % of bets with positive CLV
    };
    risk: {
        maxDrawdown: number; // Max percentage drop from peak
        riskOfRuin: number; // Theoretical prob of losing it all
        currentRun: number; // Current W/L streak
    };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
    // 1. FETCH CALIBRATION DATA
    // We aggregate by bucket from the `model_calibration` table
    // (Assuming we populate it via Cron. If empty, we simulate common buckets for UI dev)
    const calibrationData = await db.select().from(modelCalibration).orderBy(modelCalibration.probabilityBucket);

    const calibrationMetrics = calibrationData.map(c => ({
        bucket: c.probabilityBucket,
        expected: c.probabilityBucket,
        actual: c.actualAccuracy || 0,
        count: c.totalPredictions || 0
    }));

    // 2. FETCH CLV DATA from `bet_outcome`
    const bets = await db.select().from(betOutcome).where(isNotNull(betOutcome.clvPercentage));

    let totalClv = 0;
    let positiveClvCount = 0;

    bets.forEach(b => {
        const clv = b.clvPercentage || 0;
        totalClv += clv;
        if (clv > 0) positiveClvCount++;
    });

    const avgClv = bets.length > 0 ? (totalClv / bets.length) * 100 : 0;
    const beatingMarketRate = bets.length > 0 ? (positiveClvCount / bets.length) * 100 : 0;

    // 3. RISK & DRAWDOWN
    // We need the sequence of P&L to calculate Max Drawdown
    const history = await db.select({
        profitLoss: betOutcome.profitLoss,
        status: betOutcome.status
    })
        .from(betOutcome)
        .where(eq(betOutcome.status, 'settled')) // Assuming 'settled' or 'won'/'lost' logic
        .orderBy(desc(betOutcome.settledAt))
        .limit(100);

    // Calculate Max Drawdown
    // To do this right, we need chronological order (ASC), so reverse the limit 100 result
    const chronoHistory = history.reverse();

    let peak = 0;
    let current = 0; // Cumulative P&L relative to start of period
    let maxDrawdown = 0;

    for (const h of chronoHistory) {
        current += (h.profitLoss || 0);
        if (current > peak) peak = current;

        const drawdown = peak - current;
        // If we want % drawdown, we need base bankroll.
        // Let's assume absolute unit drawdown for now, or % relative to peak if peak > 0
        // A simple simplification: Max Drawdown in Units.
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Risk of Ruin (Kelly Formula Approximation)
    // Needs Win Rate and Odds.
    // Simplified: If avg edge is positive and sizing is Kelly, RoR is low. 
    // If sizing is bad, RoR is high.
    // We return a "Score" 0-100 where 100 is Safe, 0 is Ruined.
    // Placeholder logic for v2.1:
    const riskOfRuin = maxDrawdown > 200 ? 50 : 1; // Arbitrary metric for UI demo

    return {
        calibration: calibrationMetrics,
        clv: {
            avgClv,
            beatingMarketRate
        },
        risk: {
            maxDrawdown, // In currency units
            riskOfRuin,
            currentRun: 0 // Todo: calculate streak
        }
    };
}
