
/**
 * MONEY MANAGEMENT MODULE (v2.1)
 * 
 * Objective: Protect bankroll and calculate optimal stakes using 
 * Fractional Kelly Criterion and Stress indicators.
 */

export interface RiskContext {
    confidence: number;
    winningStreak: number;
    currentDrawdown: number; // e.g. 0.05 for 5%
    kellyFraction?: number; // default 0.25 (Quarter Kelly)
}

export interface RiskStatus {
    level: 'NORMAL' | 'YELLOW' | 'RED' | 'STOP';
    message: string;
    stakeMultiplier: number;
}

/**
 * Calculate the optimal stake based on fractional kelly
 */
export function calculateOptimalStake(
    bankroll: number,
    odds: number,
    probability: number,
    context: RiskContext
): { amount: number; percentage: number; edge: number } {

    const { confidence, winningStreak, currentDrawdown, kellyFraction = 0.25 } = context;

    // 1. Calculate the Edge (Prob * Odds - 1)
    const edge = (probability * odds) - 1;

    if (edge <= 0) {
        return { amount: 0, percentage: 0, edge };
    }

    // 2. Full Kelly = Edge / (Odds - 1)
    const fullKelly = edge / (odds - 1);

    // 3. Apply Fractional Kelly
    let optimalPercentage = fullKelly * kellyFraction;

    // 4. Apply Risk Modifiers
    let multiplier = 1.0;

    // Low Confidence Penalty
    if (confidence < 0.60) multiplier *= 0.5;

    // High Drawdown Penalty
    if (currentDrawdown > 0.10) multiplier *= 0.5;

    // Winning Streak Booster (Conservative)
    if (winningStreak > 3) multiplier *= 1.2;

    optimalPercentage *= multiplier;

    // 5. Hard Caps (Protect against ruin)
    // Never exceed 2.5% per bet
    const MAX_STAKE_PERCENT = 0.025;
    optimalPercentage = Math.min(optimalPercentage, MAX_STAKE_PERCENT);

    const amount = bankroll * optimalPercentage;

    return {
        amount,
        percentage: optimalPercentage * 100,
        edge: edge * 100
    };
}

/**
 * Check the overall risk status of the bankroll
 */
export function checkRiskStatus(current: number, initial: number): RiskStatus {
    const ratio = current / initial;
    const loss = 1 - ratio;

    if (loss >= 0.30) {
        return {
            level: 'STOP',
            message: '🛑 STOP TRADING: 30% Bankroll depletion. Strategy review required.',
            stakeMultiplier: 0
        };
    }

    if (loss >= 0.20) {
        return {
            level: 'RED',
            message: '🔴 RED ALERT: 20% Drawdown. Only High Confidence (75%+) allowed.',
            stakeMultiplier: 0.25
        };
    }

    if (loss >= 0.10) {
        return {
            level: 'YELLOW',
            message: '🟡 YELLOW ALERT: 10% Drawdown. Stakes halved for protection.',
            stakeMultiplier: 0.5
        };
    }

    return {
        level: 'NORMAL',
        message: '🟢 NORMAL: Bankroll healthy.',
        stakeMultiplier: 1.0
    };
}
