import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { fetchApi } from './lib/api-client';
import { calculatePoissonPrediction, calculateWeightedStats } from './lib/predictions';
import { calculateTeamForm } from './lib/analytics';
import { calculateValue } from './lib/value-bet';

async function runBacktest(leagueId: number, season: number) {
    console.log(`🚀 Starting Backtest for League ${leagueId}, Season ${season}...`);

    try {
        // 1. Fetch ALL fixtures for the season
        const allFixtures = await fetchApi('fixtures', { league: leagueId, season: season });
        if (!allFixtures || allFixtures.length === 0) {
            console.log("No fixtures found.");
            return;
        }

        const finishedFixtures = allFixtures.filter((f: any) => f.fixture.status.short === 'FT');
        console.log(`Found ${finishedFixtures.length} finished matches.`);

        // 2. Fetch ALL odds for the season (bulk if possible, but the API might require per fixture or date)
        // For backtesting, we'll fetch them per fixture for now (slow but thorough)
        // Optimization: Use a local cache file for backtest odds to avoid repeating calls

        let initialBankroll = 100;
        let bankroll = initialBankroll;
        let totalBets = 0;
        let wins = 0;
        let losses = 0;

        // Sorting fixtures by date to simulate real-time
        finishedFixtures.sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

        for (let i = 20; i < finishedFixtures.length; i++) { // Start after week ~3 to have some history
            const fixture = finishedFixtures[i];
            const historyBefore = finishedFixtures.slice(0, i);

            // Calculate stats based ONLY on historyBefore
            // (Re-using our existing logic but passing the historical subset)
            const homeForm = calculateTeamForm(fixture.teams.home.id, historyBefore);
            const awayForm = calculateTeamForm(fixture.teams.away.id, historyBefore);

            // Simple Stat generation for Poisson (using historyBefore)
            const getHistoricalStats = (teamId: number) => {
                const teamMatches = historyBefore.filter((m: any) => m.teams.home.id === teamId || m.teams.away.id === teamId);
                let scored = 0, conceded = 0, played = teamMatches.length;
                teamMatches.forEach((m: any) => {
                    if (m.teams.home.id === teamId) {
                        scored += m.goals.home;
                        conceded += m.goals.away;
                    } else {
                        scored += m.goals.away;
                        conceded += m.goals.home;
                    }
                });
                return { played, scored, conceded };
            };

            const homeStats = getHistoricalStats(fixture.teams.home.id);
            const awayStats = getHistoricalStats(fixture.teams.away.id);

            if (homeStats.played < 3 || awayStats.played < 3) continue;

            const prediction = calculatePoissonPrediction(
                calculateWeightedStats(homeStats, { played: 1, scored: homeForm.avgGoalsScored, conceded: homeForm.avgGoalsConceded }, 0.3),
                calculateWeightedStats(awayStats, { played: 1, scored: awayForm.avgGoalsScored, conceded: awayForm.avgGoalsConceded }, 0.3),
                1.5, // Approx league averages
                1.2
            );

            // Fetch Odds for this fixture
            const oddsData = await fetchApi('odds', { fixture: fixture.fixture.id });
            const bookie = oddsData && oddsData[0]?.bookmakers[0];
            const winnerBet = bookie?.bets.find((b: any) => b.id === 1);

            if (!winnerBet) continue;

            const odds = {
                home: parseFloat(winnerBet.values.find((v: any) => v.value === 'Home')?.odd || '0'),
                draw: parseFloat(winnerBet.values.find((v: any) => v.value === 'Draw')?.odd || '0'),
                away: parseFloat(winnerBet.values.find((v: any) => v.value === 'Away')?.odd || '0')
            };

            if (!odds.home || !odds.draw || !odds.away) continue;

            const valueAnalysis = calculateValue(
                { home: prediction.homeWinProb * 100, draw: prediction.drawProb * 100, away: prediction.awayWinProb * 100 },
                odds
            );

            if (valueAnalysis.isValue) {
                totalBets++;
                const actualResult = fixture.goals.home > fixture.goals.away ? 'HOME' : (fixture.goals.home === fixture.goals.away ? 'DRAW' : 'AWAY');

                let win = false;
                let payout = 0;
                if (valueAnalysis.recommendedBet === actualResult) {
                    win = true;
                    payout = odds[actualResult.toLowerCase() as keyof typeof odds];
                    wins++;
                    bankroll += (payout - 1);
                } else {
                    losses++;
                    bankroll -= 1;
                }

                console.log(`[MATCH ${i}] ${fixture.teams.home.name} vs ${fixture.teams.away.name} | Bet: ${valueAnalysis.recommendedBet} | Win: ${win} | Bankroll: ${bankroll.toFixed(2)}`);
            }
        }

        console.log("\n--- BACKTEST RESULTS ---");
        console.log(`Total Bets: ${totalBets}`);
        console.log(`Wins: ${wins} | Losses: ${losses}`);
        console.log(`Win Rate: ${((wins / totalBets) * 100).toFixed(2)}%`);
        console.log(`Initial Bankroll: ${initialBankroll}`);
        console.log(`Final Bankroll: ${bankroll.toFixed(2)}`);
        console.log(`ROI: ${(((bankroll - initialBankroll) / totalBets) * 100).toFixed(2)}%`);

    } catch (e) {
        console.error("Backtest failed:", e);
    }
}

// Run for Premier League 2023
runBacktest(39, 2023);
