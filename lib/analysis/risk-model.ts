
import { TeamStats } from '@/lib/predictions';

/**
 * META-MODEL RISK FILTER (v2.1)
 * 
 * "The logical layer that overrides the mathematical layer."
 * 
 * Objective: Detect scenarios where the Poisson model is known to fail or be unreliable.
 */

export interface RiskAnalysis {
    shouldBet: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    flags: RiskFlag[];
}

export interface RiskFlag {
    code: 'COIN_FLIP' | 'HIGH_VARIANCE' | 'LOW_CONFIDENCE' | 'ODDS_MISMATCH' | 'DERBY_MATCH';
    label: string;
    description: string;
    severity: 'WARNING' | 'BLOCKER';
}

/**
 * Analyze a fixture for structural risks
 */
export function analyzeRisk(
    homeProb: number,
    awayProb: number,
    homeStats: TeamStats,
    awayStats: TeamStats
): RiskAnalysis {
    const flags: RiskFlag[] = [];

    // 1. COIN FLIP DETECTOR
    // If the difference between Home and Away prob is < 10%, it's too close to call reliably.
    const probDiff = Math.abs(homeProb - awayProb);
    if (probDiff < 0.10) {
        flags.push({
            code: 'COIN_FLIP',
            label: 'Coin Flip Match',
            description: 'Win probability difference is less than 10%. Outcome is highly volatile.',
            severity: 'WARNING'
        });
    }

    // 2. HIGH VARIANCE DETECTOR
    // If a team scores AND concedes a lot (Avg > 2.0 each), outcomes are chaotic (e.g. 4-3, 2-2).
    // Poisson struggles with "Chaos Teams".
    // We infer Avg from stats (assuming ~5 games normalized in prediction logic, stats.played usually 1 there? 
    // Actually in predictions.ts we normalized weighted stats to played=1).

    const isHighVar = (stats: TeamStats) => (stats.scored > 2.0 && stats.conceded > 1.5);

    if (isHighVar(homeStats) || isHighVar(awayStats)) {
        flags.push({
            code: 'HIGH_VARIANCE',
            label: 'Chaos Team Alert',
            description: 'One or both teams have extremely high goal variance. Poisson reliability drops.',
            severity: 'WARNING'
        });
    }

    // 3. LOW CONFIDENCE BLOCKER
    // If the highest probability is < 38% (typical Draw zone), we shouldn't force a Winner pick.
    const maxProb = Math.max(homeProb, awayProb, 1 - (homeProb + awayProb)); // 1-sum is Draw
    if (maxProb < 0.40) {
        flags.push({
            code: 'LOW_CONFIDENCE',
            label: 'Low Model Confidence',
            description: 'No outcome exceeds 40% probability. Value is thin.',
            severity: 'BLOCKER'
        });
    }

    // Determine Overall Risk & Verdict
    const hasBlocker = flags.some(f => f.severity === 'BLOCKER');
    const warningCount = flags.filter(f => f.severity === 'WARNING').length;

    let riskLevel: RiskAnalysis['riskLevel'] = 'LOW';
    if (hasBlocker) riskLevel = 'CRITICAL';
    else if (warningCount >= 2) riskLevel = 'HIGH';
    else if (warningCount === 1) riskLevel = 'MEDIUM';

    return {
        shouldBet: !hasBlocker && riskLevel !== 'HIGH', // We skip High Risk too for "Professional" mode
        riskLevel,
        flags
    };
}
