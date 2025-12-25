
import { PredictionResult, TeamStats } from './predictions';
import { FormStats } from './analytics';
import { ValueAnalysis } from './value-bet';

interface AnalysisContext {
    homeName: string;
    awayName: string;
    prediction: PredictionResult;
    homeForm: FormStats;
    awayForm: FormStats;
    homeStats: TeamStats;
    awayStats: TeamStats;
    referee?: string;
    venue?: string;
    valueAnalysis?: ValueAnalysis;
}

export function generateExpertAnalysis(ctx: AnalysisContext): string {
    const { homeName, awayName, prediction, homeForm, awayForm, referee, venue, valueAnalysis } = ctx;

    const winProb = Math.max(prediction.homeWinProb, prediction.awayWinProb);
    const favorite = prediction.homeWinProb > prediction.awayWinProb ? homeName : awayName;
    const isDrawLikely = prediction.drawProb > 0.30;

    // 1. Introduction based on Probability
    let intro = "";
    if (winProb > 0.60) {
        intro = `Considero que **${favorite}** tiene una clara ventaja en este encuentro con un **${(winProb * 100).toFixed(0)}% de probabilidad** de victoria.`;
    } else if (winProb > 0.45) {
        intro = `El partido se inclina ligeramente hacia **${favorite}** (${(winProb * 100).toFixed(0)}%), aunque será un duelo disputado.`;
    } else {
        intro = `Se espera un partido muy reñido entre ambos equipos, donde cualquier detalle podría definir el resultado.`;
    }

    // 2. Form Analysis
    let formAnalysis = "";
    if (favorite === homeName) {
        if (homeForm.streak.type === 'WIN' && homeForm.streak.count >= 2) {
            formAnalysis += ` ${homeName} viene de una excelente racha de ${homeForm.streak.count} victorias consecutivas, lo que aumenta su confianza.`;
        } else if (homeForm.pointsLast5 >= 10) {
            formAnalysis += ` ${homeName} ha estado muy sólido recientemente, sumando ${homeForm.pointsLast5} de los últimos 15 puntos.`;
        }

        if (awayForm.streak.type === 'LOSS') {
            formAnalysis += ` Por otro lado, ${awayName} atraviesa un mal momento con ${awayForm.streak.count} derrotas seguidas.`;
        }
    } else {
        // Away favorite logic
        if (awayForm.pointsLast5 >= 10) {
            formAnalysis += ` A pesar de ser visitante, ${awayName} llega en gran forma con ${awayForm.pointsLast5} puntos en sus últimos 5 juegos.`;
        }
    }

    // 3. Goal Analysis & Context (Referee/Venue)
    let goalAnalysis = "";
    const expectedTotal = prediction.expectedGoalsHome + prediction.expectedGoalsAway;

    if (expectedTotal > 2.8) {
        goalAnalysis += `\n\nMi modelo proyecta un partido abierto y con goles (más de 2.5), ya que ambos equipos promedian ataques efectivos.`;
    } else if (expectedTotal < 2.0) {
        goalAnalysis += `\n\nEs probable que veamos un marcador bajo (menos de 2.5 goles), dado que las defensas han estado imponiéndose.`;
    }

    if (referee) {
        goalAnalysis += `\n\n**Factor Arbitral:** El encuentro será dirigido por **${referee}**. Es importante considerar su estilo de arbitraje al evaluar apuestas de tarjetas o penales.`;
    }
    if (venue) {
        goalAnalysis += ` El partido se jugará en **${venue}**, lo cual podría influir en el ambiente.`;
    }

    // 3.5 Value Analysis (NEW)
    let valueText = "";
    if (valueAnalysis && valueAnalysis.isValue) {
        const betMap = { HOME: homeName, DRAW: 'Empate', AWAY: awayName, NONE: '' };
        const recommendedName = betMap[valueAnalysis.recommendedBet];
        valueText = `\n\n**💎 Oportunidad de Valor Detectada:** Mi sistema ha identificado una ventaja matemática. Nuestra IA estima una probabilidad del **${valueAnalysis.aiProbability.toFixed(0)}%** para el **${recommendedName}**, mientras que la casa de apuestas solo le asigna un **${valueAnalysis.impliedProbability.toFixed(0)}%**. Esto representa una ventaja real del **${valueAnalysis.difference.toFixed(0)}%**.`;
    }

    // 4. Recommendation
    let recommendation = "";
    if (isDrawLikely && winProb < 0.50) {
        recommendation = `Dado el equilibrio, el valor podría estar en el **Empate** o en la **Doble Oportunidad**.`;
    } else if (winProb > 0.65) {
        recommendation = `Recomiendo la **Victoria Directa de ${favorite}** como la opción más segura.`;
    } else {
        recommendation = `La apuesta más sensata sería **${favorite} (Sin Empate)** o **Doble Oportunidad** para reducir riesgo.`;
    }

    return `${intro}${formAnalysis}${goalAnalysis}${valueText}\n\n**Conclusión del Experto:** ${recommendation}`;
}

