/**
 * MONTE CARLO SIMULATION ENGINE
 * 
 * En lugar de calcular una sola probabilidad estática con Poisson,
 * este motor simula el partido N veces (usualmente 1,000 o 10,000)
 * para obtener una distribución empírica de resultados.
 * 
 * Ventajas:
 * - Captura la varianza real del fútbol
 * - Permite identificar "outliers" (ej: probabilidad baja de goleada)
 * - Más preciso para mercados Over/Under y Handicaps
 */

interface TeamStrength {
    attackRating: number;  // Goles esperados por partido
    defenseRating: number; // Goles concedidos esperados
}

interface SimulationResult {
    homeWins: number;
    draws: number;
    awayWins: number;
    avgGoalsHome: number;
    avgGoalsAway: number;
    totalSimulations: number;

    // Distribución de probabilidades
    probabilities: {
        homeWin: number;
        draw: number;
        awayWin: number;
    };

    // Estadísticas adicionales
    over25Goals: number; // % de simulaciones con > 2.5 goles
    btts: number;        // % Both Teams To Score
}

/**
 * Genera un número aleatorio siguiendo la distribución de Poisson
 */
function poissonRandom(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;

    do {
        k++;
        p *= Math.random();
    } while (p > L);

    return k - 1;
}

/**
 * Simula un solo partido usando las fortalezas de ataque/defensa
 */
function simulateSingleMatch(home: TeamStrength, away: TeamStrength): { homeGoals: number, awayGoals: number } {
    // Expected Goals basados en el modelo estándar:
    // xG_Home = (Attack_Home * Defense_Away) / League_Avg
    // Para simplificar, usamos directamente los ratings ajustados

    const homeExpectedGoals = home.attackRating * away.defenseRating;
    const awayExpectedGoals = away.attackRating * home.defenseRating;

    return {
        homeGoals: poissonRandom(homeExpectedGoals),
        awayGoals: poissonRandom(awayExpectedGoals)
    };
}

/**
 * Motor principal: Ejecuta N simulaciones del partido
 */
export function runMonteCarloSimulation(
    home: TeamStrength,
    away: TeamStrength,
    iterations: number = 1000
): SimulationResult {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalGoalsHome = 0;
    let totalGoalsAway = 0;
    let over25Count = 0;
    let bttsCount = 0;

    for (let i = 0; i < iterations; i++) {
        const match = simulateSingleMatch(home, away);

        totalGoalsHome += match.homeGoals;
        totalGoalsAway += match.awayGoals;

        // Clasificar resultado
        if (match.homeGoals > match.awayGoals) homeWins++;
        else if (match.homeGoals === match.awayGoals) draws++;
        else awayWins++;

        // Mercados adicionales
        if (match.homeGoals + match.awayGoals > 2.5) over25Count++;
        if (match.homeGoals > 0 && match.awayGoals > 0) bttsCount++;
    }

    return {
        homeWins,
        draws,
        awayWins,
        avgGoalsHome: totalGoalsHome / iterations,
        avgGoalsAway: totalGoalsAway / iterations,
        totalSimulations: iterations,
        probabilities: {
            homeWin: (homeWins / iterations) * 100,
            draw: (draws / iterations) * 100,
            awayWin: (awayWins / iterations) * 100
        },
        over25Goals: (over25Count / iterations) * 100,
        btts: (bttsCount / iterations) * 100
    };
}

/**
 * Comparador de Edge vs Mercado
 * 
 * Detecta si nuestra simulación encuentra una ventaja significativa
 * sobre las cuotas del bookmaker.
 */
export function calculateEdge(
    simulation: SimulationResult,
    marketOdds: { home: number, draw: number, away: number }
): {
    recommendedBet: 'HOME' | 'DRAW' | 'AWAY' | 'NONE';
    edge: number;
    expectedValue: number;
} {
    // Probabilidades implícitas del mercado
    const impliedProbs = {
        home: 100 / marketOdds.home,
        draw: 100 / marketOdds.draw,
        away: 100 / marketOdds.away
    };

    // Calcular edges
    const edges = {
        home: simulation.probabilities.homeWin - impliedProbs.home,
        draw: simulation.probabilities.draw - impliedProbs.draw,
        away: simulation.probabilities.awayWin - impliedProbs.away
    };

    // Encontrar el mayor edge
    let maxEdge = -Infinity;
    let recommendedBet: 'HOME' | 'DRAW' | 'AWAY' | 'NONE' = 'NONE';
    let selectedOdds = 1.0;
    let selectedProb = 0;

    if (edges.home > maxEdge) {
        maxEdge = edges.home;
        recommendedBet = 'HOME';
        selectedOdds = marketOdds.home;
        selectedProb = simulation.probabilities.homeWin;
    }
    if (edges.draw > maxEdge) {
        maxEdge = edges.draw;
        recommendedBet = 'DRAW';
        selectedOdds = marketOdds.draw;
        selectedProb = simulation.probabilities.draw;
    }
    if (edges.away > maxEdge) {
        maxEdge = edges.away;
        recommendedBet = 'AWAY';
        selectedOdds = marketOdds.away;
        selectedProb = simulation.probabilities.awayWin;
    }

    // Umbral mínimo de edge: 10%
    if (maxEdge < 10) {
        recommendedBet = 'NONE';
    }

    // Expected Value (EV) = (Probabilidad * Cuota) - 1
    const expectedValue = ((selectedProb / 100) * selectedOdds) - 1;

    return {
        recommendedBet,
        edge: maxEdge,
        expectedValue: expectedValue * 100 // En porcentaje
    };
}

/**
 * Ejemplo de uso:
 * 
 * const homeTeam = { attackRating: 1.8, defenseRating: 0.7 };
 * const awayTeam = { attackRating: 1.2, defenseRating: 1.1 };
 * 
 * const result = runMonteCarloSimulation(homeTeam, awayTeam, 10000);
 * console.log(`En 10,000 simulaciones:`);
 * console.log(`- Local gana: ${result.probabilities.homeWin.toFixed(1)}%`);
 * console.log(`- Empate: ${result.probabilities.draw.toFixed(1)}%`);
 * console.log(`- Visitante gana: ${result.probabilities.awayWin.toFixed(1)}%`);
 * 
 * const edge = calculateEdge(result, { home: 1.50, draw: 4.0, away: 6.0 });
 * if (edge.recommendedBet !== 'NONE') {
 *   console.log(`🚨 VALUE BET: ${edge.recommendedBet} - Edge: ${edge.edge.toFixed(1)}%`);
 * }
 */
