/**
 * KELLY CRITERION CALCULATOR
 * 
 * El Criterio de Kelly es una fórmula matemática que determina
 * el tamaño óptimo de apuesta para maximizar el crecimiento
 * del bankroll a largo plazo, basándose en:
 * - La probabilidad estimada de ganar
 * - Las cuotas ofrecidas por el bookmaker
 * 
 * Fórmula:
 * f* = (bp - q) / b
 * 
 * Donde:
 * - f* = Fracción del bankroll a apostar
 * - b = Cuota decimal - 1 (ej: 2.5 -> 1.5)
 * - p = Probabilidad de ganar (0-1)
 * - q = Probabilidad de perder (1 - p)
 * 
 * FRACTIONAL KELLY:
 * Para reducir la volatilidad, se usa una fracción del resultado
 * (típicamente 1/4 o 1/2 del Kelly completo).
 */

interface KellyInput {
    bankroll: number;        // Bankroll actual
    probability: number;     // Probabilidad de ganar (0-100)
    odds: number;            // Cuota decimal
    fraction?: number;       // Fracción del Kelly (default: 0.25 = 1/4)
}

interface KellyOutput {
    fullKelly: number;       // % del bankroll (Kelly completo)
    fractionalKelly: number; // % del bankroll (Kelly fraccionado)
    stakeAmount: number;     // Monto exacto a apostar ($)
    expectedValue: number;   // EV de la apuesta (%)
    recommendation: 'BET' | 'SKIP' | 'CAUTION';
    reasoning: string;
}

export function calculateKellyStake(input: KellyInput): KellyOutput {
    const { bankroll, probability, odds, fraction = 0.25 } = input;

    // Convertir probabilidad a decimal
    const p = probability / 100;
    const q = 1 - p;

    // Ganancia neta por cada unidad apostada
    const b = odds - 1;

    // Fórmula de Kelly: f* = (bp - q) / b
    const fullKelly = (b * p - q) / b;

    // Aplicar fracción (1/4 Kelly por defecto)
    const fractionalKelly = fullKelly * fraction;

    // Calcular stake en dinero real
    let stakeAmount = bankroll * Math.max(0, fractionalKelly);

    // Expected Value: EV = (p * ganancia) - (q * pérdida)
    const expectedValue = (p * b - q) * 100;

    // Determinación de recomendación
    let recommendation: 'BET' | 'SKIP' | 'CAUTION' = 'SKIP';
    let reasoning = '';

    if (fullKelly <= 0) {
        recommendation = 'SKIP';
        reasoning = 'EV negativo. No hay ventaja matemática.';
        stakeAmount = 0;
    } else if (fullKelly > 0.15) {
        recommendation = 'CAUTION';
        reasoning = 'Edge muy alto (>15%). Verificar datos antes de apostar.';
    } else if (fullKelly > 0.02) {
        recommendation = 'BET';
        reasoning = `Edge positivo del ${(fullKelly * 100).toFixed(1)}%. Apuesta recomendada.`;
    } else {
        recommendation = 'SKIP';
        reasoning = 'Edge demasiado pequeño (<2%). Costos/comisión pueden eliminarlo.';
        stakeAmount = 0;
    }

    // Redondear stake a 2 decimales
    stakeAmount = Math.round(stakeAmount * 100) / 100;

    return {
        fullKelly: fullKelly * 100,
        fractionalKelly: fractionalKelly * 100,
        stakeAmount,
        expectedValue,
        recommendation,
        reasoning
    };
}

/**
 * Ejemplo de uso integrado con Monte Carlo:
 * 
 * const simulation = runMonteCarloSimulation(homeTeam, awayTeam);
 * const edge = calculateEdge(simulation, marketOdds);
 * 
 * if (edge.recommendedBet !== 'NONE') {
 *   const kellyResult = calculateKellyStake({
 *     bankroll: 500,
 *     probability: simulation.probabilities.homeWin,
 *     odds: marketOdds.home,
 *     fraction: 0.25
 *   });
 *   
 *   if (kellyResult.recommendation === 'BET') {
 *     console.log(`💰 Apostar: $${kellyResult.stakeAmount}`);
 *     console.log(`📊 EV: ${kellyResult.expectedValue.toFixed(2)}%`);
 *   }
 * }
 */

/**
 * UTILITY: Calculadora de "Safe Bankroll"
 * 
 * Estima cuánto bankroll se necesita para sobrevivir
 * una racha de mala suerte (drawdown) sin quebrar.
 */
export function calculateRequiredBankroll(
    avgStake: number,
    winRate: number,
    avgOdds: number,
    riskOfRuin: number = 0.01 // 1% de probabilidad de ruina
): number {
    // Fórmula simplificada: Bankroll ≈ 20-25 x Stake promedio
    // Para win rate del 55% con cuotas ~2.0
    const conservativeFactor = 25;
    return avgStake * conservativeFactor;
}
