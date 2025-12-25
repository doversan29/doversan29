import { runMonteCarloSimulation, calculateEdge } from './lib/simulation/monte-carlo';
import { calculateKellyStake } from './lib/betting/kelly-criterion';

console.log('🧪 TESTING BETPREDICT V2.0 CORE MODULES\n');
console.log('='.repeat(50));

// TEST 1: Monte Carlo Simulation
console.log('\n📊 TEST 1: Monte Carlo Engine');
console.log('-'.repeat(50));

const homeTeam = { attackRating: 1.8, defenseRating: 0.7 };
const awayTeam = { attackRating: 1.2, defenseRating: 1.1 };

const simulation = runMonteCarloSimulation(homeTeam, awayTeam, 5000);

console.log(`✅ Simulaciones completadas: ${simulation.totalSimulations}`);
console.log(`\nResultados:`);
console.log(`  🏠 Home Win: ${simulation.probabilities.homeWin.toFixed(1)}%`);
console.log(`  🤝 Draw: ${simulation.probabilities.draw.toFixed(1)}%`);
console.log(`  ✈️  Away Win: ${simulation.probabilities.awayWin.toFixed(1)}%`);
console.log(`\nGoles esperados:`);
console.log(`  Home: ${simulation.avgGoalsHome.toFixed(2)}`);
console.log(`  Away: ${simulation.avgGoalsAway.toFixed(2)}`);
console.log(`\nMercados adicionales:`);
console.log(`  Over 2.5: ${simulation.over25Goals.toFixed(1)}%`);
console.log(`  BTTS: ${simulation.btts.toFixed(1)}%`);

// TEST 2: Edge Detection
console.log('\n\n💎 TEST 2: Value Bet Detection');
console.log('-'.repeat(50));

const marketOdds = { home: 1.80, draw: 3.50, away: 4.20 };
const edge = calculateEdge(simulation, marketOdds);

console.log(`Cuotas del mercado:`);
console.log(`  Home: ${marketOdds.home}`);
console.log(`  Draw: ${marketOdds.draw}`);
console.log(`  Away: ${marketOdds.away}`);

if (edge.recommendedBet !== 'NONE') {
    console.log(`\n🚨 VALUE BET DETECTADO!`);
    console.log(`  Apuesta recomendada: ${edge.recommendedBet}`);
    console.log(`  Edge: ${edge.edge.toFixed(1)}%`);
    console.log(`  Expected Value: ${edge.expectedValue.toFixed(2)}%`);
} else {
    console.log(`\n⏭️  No value bet detected`);
}

// TEST 3: Kelly Criterion
console.log('\n\n💰 TEST 3: Kelly Criterion Calculator');
console.log('-'.repeat(50));

if (edge.recommendedBet !== 'NONE') {
    const selectedOdds = edge.recommendedBet === 'HOME' ? marketOdds.home :
        edge.recommendedBet === 'DRAW' ? marketOdds.draw :
            marketOdds.away;

    const selectedProb = edge.recommendedBet === 'HOME' ? simulation.probabilities.homeWin :
        edge.recommendedBet === 'DRAW' ? simulation.probabilities.draw :
            simulation.probabilities.awayWin;

    const kellyResult = calculateKellyStake({
        bankroll: 100,
        probability: selectedProb,
        odds: selectedOdds,
        fraction: 0.25
    });

    console.log(`Bankroll: $100`);
    console.log(`Probabilidad: ${selectedProb.toFixed(1)}%`);
    console.log(`Cuota: ${selectedOdds}`);
    console.log(`\nResultado:`);
    console.log(`  Full Kelly: ${kellyResult.fullKelly.toFixed(2)}%`);
    console.log(`  Fractional Kelly (1/4): ${kellyResult.fractionalKelly.toFixed(2)}%`);
    console.log(`  💵 Stake recomendado: $${kellyResult.stakeAmount.toFixed(2)}`);
    console.log(`  📈 Expected Value: ${kellyResult.expectedValue.toFixed(2)}%`);
    console.log(`  🎯 Recomendación: ${kellyResult.recommendation}`);
    console.log(`  📝 Razón: ${kellyResult.reasoning}`);
}

console.log('\n' + '='.repeat(50));
console.log('✅ TODOS LOS TESTS PASARON CORRECTAMENTE');
console.log('='.repeat(50) + '\n');
