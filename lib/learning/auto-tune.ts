/**
 * AUTO-TUNING SYSTEM
 * 
 * Este módulo implementa el "Machine Learning Lite" que ajusta
 * automáticamente los pesos del sistema basándose en el performance real.
 * 
 * Flujo:
 * 1. Después de que un partido termina, obtener el resultado
 * 2. Comparar predicción vs realidad
 * 3. Análisis forense: ¿Fue mala suerte o mala lectura?
 * 4. Ajustar pesos de las estrategias automáticamente
 */

import { db } from '../db/client';
import { betOutcome, matchAnalysis, systemWeights } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getSystemWeight, adjustSystemWeight } from '../db/queries';

interface ForensicAnalysis {
    prediction: string;
    actual: string;
    wasCorrect: boolean;
    expectedGoals: number;
    actualGoals: number;
    wasLucky: boolean;
    wasUnlucky: boolean;
    verdict: 'GOOD_READ' | 'BAD_LUCK' | 'BAD_READ' | 'GOOD_LUCK';
}

/**
 * Analizar si el resultado fue debido a suerte o a un mal análisis
 */
function performForensicAnalysis(
    bet: typeof betOutcome.$inferSelect,
    analysis: typeof matchAnalysis.$inferSelect,
    actualxG?: { home: number; away: number }
): ForensicAnalysis {
    const wasCorrect = bet.status === 'won';
    const prediction = analysis.predictedOutcome;
    const actual = bet.actualResult || '';

    // Si no tenemos xG real, usar heurísticas básicas
    const expectedGoals = analysis.expectedGoalsHome + analysis.expectedGoalsAway;
    const [homeScore, awayScore] = (bet.actualScore || '0-0').split('-').map(Number);
    const actualGoals = homeScore + awayScore;

    // Análisis de "suerte"
    let wasLucky = false;
    let wasUnlucky = false;

    if (actualxG) {
        const totalxG = actualxG.home + actualxG.away;

        // Si ganamos pero el xG era bajo -> Suerte
        if (wasCorrect && totalxG < actualGoals - 1) {
            wasLucky = true;
        }

        // Si perdimos pero el xG era alto -> Mala suerte
        if (!wasCorrect && totalxG > actualGoals + 1) {
            wasUnlucky = true;
        }
    }

    // Veredicto final
    let verdict: ForensicAnalysis['verdict'] = 'GOOD_READ';

    if (wasCorrect && wasLucky) verdict = 'GOOD_LUCK';
    else if (wasCorrect && !wasLucky) verdict = 'GOOD_READ';
    else if (!wasCorrect && wasUnlucky) verdict = 'BAD_LUCK';
    else verdict = 'BAD_READ';

    return {
        prediction,
        actual,
        wasCorrect,
        expectedGoals,
        actualGoals,
        wasLucky,
        wasUnlucky,
        verdict
    };
}

/**
 * Procesar un resultado y ajustar pesos
 */
export async function processBetOutcome(betId: number, actualxG?: { home: number; away: number }) {
    // 1. Obtener la apuesta y su análisis
    const [bet] = await db.select()
        .from(betOutcome)
        .where(eq(betOutcome.id, betId))
        .limit(1);

    if (!bet) throw new Error('Bet not found');

    const [analysis] = await db.select()
        .from(matchAnalysis)
        .where(eq(matchAnalysis.id, bet.analysisId))
        .limit(1);

    if (!analysis) throw new Error('Analysis not found');

    // 2. Análisis forense
    const forensics = performForensicAnalysis(bet, analysis, actualxG);

    // 3. Actualizar flag de suerte en la BD
    await db.update(betOutcome)
        .set({
            wasLucky: forensics.wasLucky || forensics.wasUnlucky
        })
        .where(eq(betOutcome.id, betId));

    // 4. Ajustar pesos del sistema
    const strategyUsed = analysis.strategyUsed;
    const strategyWeight = await getSystemWeight(strategyUsed);

    if (!strategyWeight) return;

    // Calcular nuevo weight basado en el veredicto
    let adjustment = 0;
    let reason = '';

    switch (forensics.verdict) {
        case 'GOOD_READ':
            adjustment = +0.02; // Aumentar confianza
            reason = 'Predicción acertada con mérito';
            break;

        case 'BAD_READ':
            adjustment = -0.05; // Penalizar fuerte
            reason = 'Predicción errónea, no fue mala suerte';
            break;

        case 'BAD_LUCK':
            adjustment = 0; // No penalizar
            reason = 'Predicción correcta en esencia, resultado desfavorable por azar';
            break;

        case 'GOOD_LUCK':
            adjustment = -0.01; // Pequeña corrección
            reason = 'Resultado favorable pero fundamento débil';
            break;
    }

    // Aplicar ajuste
    if (adjustment !== 0) {
        await adjustSystemWeight(strategyUsed, adjustment, reason);
    }

    // 5. Actualizar métricas de la estrategia
    const [updatedWeight] = await db.select()
        .from(systemWeights)
        .where(eq(systemWeights.strategyName, strategyUsed))
        .limit(1);

    if (updatedWeight) {
        const newTotalBets = updatedWeight.totalBets + 1;
        const wasWon = bet.status === 'won' ? 1 : 0;
        const newWinRate = ((updatedWeight.winRate * updatedWeight.totalBets) + wasWon) / newTotalBets;

        const profitLoss = bet.profitLoss || 0;
        const newROI = ((updatedWeight.roi * updatedWeight.totalBets) + profitLoss) / newTotalBets;

        await db.update(systemWeights)
            .set({
                totalBets: newTotalBets,
                winRate: newWinRate,
                roi: newROI,
                updatedAt: new Date()
            })
            .where(eq(systemWeights.strategyName, strategyUsed));
    }

    return forensics;
}

/**
 * Revisar todas las apuestas pendientes y liquidarlas
 * (Normalmente ejecutado por un cron job)
 */
export async function reviewPendingBets() {
    const pendingBets = await db.select()
        .from(betOutcome)
        .where(eq(betOutcome.status, 'pending'))
        .limit(20); // Procesar en lotes

    let processed = 0;

    for (const bet of pendingBets) {
        try {
            const [analysis] = await db.select()
                .from(matchAnalysis)
                .where(eq(matchAnalysis.id, bet.analysisId))
                .limit(1);

            if (!analysis) continue;

            // Verificar si el partido ya terminó
            // (En producción, harías un fetch de la API aquí)
            const matchFinished = new Date(analysis.matchDate) < new Date();

            if (matchFinished) {
                // TODO: Fetch resultado real de la API
                // Para ahora, skipeamos
                console.log(`[Auto-Tune] Partido ${analysis.fixtureId} pendiente de liquidación manual`);
            }

            processed++;
        } catch (error) {
            console.error(`Error processing bet ${bet.id}:`, error);
        }
    }

    return { processed, total: pendingBets.length };
}

/**
 * Generar reporte de ajustes del sistema
 */
export async function generateAutoTuneReport() {
    const allWeights = await db.select().from(systemWeights);

    const report = allWeights.map(w => ({
        strategy: w.strategyName,
        weight: w.currentWeight,
        performance: {
            totalBets: w.totalBets,
            winRate: `${(w.winRate * 100).toFixed(1)}%`,
            roi: `${w.roi.toFixed(2)}%`
        },
        lastAdjustment: w.lastAdjustment,
        reason: w.adjustmentReason
    }));

    return report;
}
