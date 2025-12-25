import { db } from './client';
import { userBankroll, matchAnalysis, betOutcome, systemWeights } from './schema';
import { eq } from 'drizzle-orm';

/**
 * BANKROLL OPERATIONS
 */
export async function getBankroll(userId: string = 'default') {
    const result = await db.select()
        .from(userBankroll)
        .where(eq(userBankroll.userId, userId))
        .limit(1);

    return result[0] || null;
}

export async function initializeBankroll(userId: string = 'default', initialAmount: number = 100) {
    const existing = await getBankroll(userId);
    if (existing) return existing;

    const [newBankroll] = await db.insert(userBankroll).values({
        userId,
        currentBalance: initialAmount,
        initialInvestment: initialAmount,
        totalProfit: 0,
        roi: 0
    }).returning();

    return newBankroll;
}

export async function updateBankroll(userId: string, profitLoss: number) {
    const current = await getBankroll(userId);
    if (!current) throw new Error('Bankroll not found');

    const newBalance = current.currentBalance + profitLoss;
    const newProfit = current.totalProfit + profitLoss;
    const newROI = ((newBalance - current.initialInvestment) / current.initialInvestment) * 100;

    const [updated] = await db.update(userBankroll)
        .set({
            currentBalance: newBalance,
            totalProfit: newProfit,
            roi: newROI,
            updatedAt: new Date()
        })
        .where(eq(userBankroll.userId, userId))
        .returning();

    return updated;
}

/**
 * MATCH ANALYSIS OPERATIONS
 */
export async function saveMatchAnalysis(data: {
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    leagueName: string;
    matchDate: Date;
    predictedOutcome: string;
    aiProbability: number;
    expectedGoalsHome: number;
    expectedGoalsAway: number;
    oddsHome?: number;
    oddsDraw?: number;
    oddsAway?: number;
    bookmaker?: string;
    analysisReasoning?: string;
    valueEdge?: number;
    strategyUsed?: string;
}) {
    const [analysis] = await db.insert(matchAnalysis)
        .values(data)
        .onConflictDoUpdate({
            target: matchAnalysis.fixtureId,
            set: {
                predictedOutcome: data.predictedOutcome,
                aiProbability: data.aiProbability,
                valueEdge: data.valueEdge
            }
        })
        .returning();

    return analysis;
}

export async function getMatchAnalysis(fixtureId: number) {
    const result = await db.select()
        .from(matchAnalysis)
        .where(eq(matchAnalysis.fixtureId, fixtureId))
        .limit(1);

    return result[0] || null;
}

/**
 * BET OUTCOME OPERATIONS
 */
export async function placeBet(data: {
    analysisId: number;
    stakeAmount: number;
    potentialReturn: number;
    userId?: string;
}) {
    // Deducir del bankroll
    await updateBankroll(data.userId || 'default', -data.stakeAmount);

    const [bet] = await db.insert(betOutcome).values({
        analysisId: data.analysisId,
        stakeAmount: data.stakeAmount,
        potentialReturn: data.potentialReturn,
        status: 'pending'
    }).returning();

    return bet;
}

export async function settleBet(betId: number, result: {
    actualResult: string;
    actualScore: string;
    won: boolean;
    closingOdds?: number;
    expectedGoalsActual?: number;
}) {
    const [bet] = await db.select()
        .from(betOutcome)
        .where(eq(betOutcome.id, betId))
        .limit(1);

    if (!bet) throw new Error('Bet not found');

    const actualReturn = result.won ? bet.potentialReturn! : 0;
    const profitLoss = actualReturn - bet.stakeAmount;

    // Actualizar apuesta
    const [settled] = await db.update(betOutcome)
        .set({
            status: result.won ? 'won' : 'lost',
            actualResult: result.actualResult,
            actualScore: result.actualScore,
            actualReturn,
            profitLoss,
            closingOdds: result.closingOdds,
            expectedGoalsActual: result.expectedGoalsActual,
            settledAt: new Date()
        })
        .where(eq(betOutcome.id, betId))
        .returning();

    // Actualizar bankroll
    await updateBankroll('default', actualReturn);

    return settled;
}

/**
 * SYSTEM WEIGHTS OPERATIONS
 */
export async function getSystemWeight(strategyName: string) {
    const result = await db.select()
        .from(systemWeights)
        .where(eq(systemWeights.strategyName, strategyName))
        .limit(1);

    return result[0] || null;
}

export async function initializeSystemWeights() {
    const strategies = [
        'poisson_basic',
        'monte_carlo',
        'home_advantage',
        'recent_form',
        'h2h_history'
    ];

    for (const strategy of strategies) {
        const existing = await getSystemWeight(strategy);
        if (!existing) {
            await db.insert(systemWeights).values({
                strategyName: strategy,
                currentWeight: 1.0,
                totalBets: 0,
                winRate: 0,
                avgEdge: 0,
                roi: 0
            });
        }
    }
}

export async function adjustSystemWeight(strategyName: string, adjustment: number, reason: string) {
    const current = await getSystemWeight(strategyName);
    if (!current) throw new Error('Strategy not found');

    const newWeight = Math.max(0.1, Math.min(1.0, current.currentWeight + adjustment));

    await db.update(systemWeights)
        .set({
            currentWeight: newWeight,
            lastAdjustment: new Date(),
            adjustmentReason: reason,
            updatedAt: new Date()
        })
        .where(eq(systemWeights.strategyName, strategyName));
}
