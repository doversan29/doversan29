
import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingFixtures, getFixtureById, getLeagueStandings } from '@/lib/api-client';
import { TeamStats, calculatePoissonPrediction } from '@/lib/predictions';
import { db } from '@/lib/db/client';
import { matchAnalysis } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { analyzeRisk } from '@/lib/analysis/risk-model';
import { TOP_LEAGUES } from '@/lib/config';
import { sendSniperAlert } from '@/lib/telegram-notifier';
import { calculateKellyStake } from '@/lib/betting/kelly-criterion';

// Verify Vercel Cron signature if needed, but for now simple checking is fine
// or check for a secret query param ?key=MY_CRON_SECRET

export async function GET(request: NextRequest) {
    console.log('[Cron] Starting Sniper Mode Check...');
    const leagueIds = TOP_LEAGUES.map(l => l.id);

    // 1. Fetch upcoming fixtures
    const allFixtures = await getUpcomingFixtures(leagueIds);

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h window

    // 2. Filter relevant fixtures
    const relevantFixtures = allFixtures.filter(f => {
        const matchDate = new Date(f.fixture.date);
        return matchDate > now && matchDate < next24h;
    });

    console.log(`[Cron] Analyzing ${relevantFixtures.length} matches within 24h window...`);
    let alertsSent = 0;

    // 3. Group by League to minimize API calls for Standings
    const fixturesByLeague: Record<number, typeof relevantFixtures> = {};
    for (const f of relevantFixtures) {
        const lid = f.league.id;
        if (!fixturesByLeague[lid]) fixturesByLeague[lid] = [];
        fixturesByLeague[lid].push(f);
    }

    // 4. Analyze each league
    for (const [leagueIdStr, fixtures] of Object.entries(fixturesByLeague)) {
        const leagueId = parseInt(leagueIdStr);
        try {
            // Fetch standings ONCE per league
            const standings = await getLeagueStandings(leagueId);

            // Helper to extract basic stats from standings
            const getStats = (teamId: number): TeamStats => {
                const teamData = standings.find((s: any) => s.team.id === teamId);
                // Fallback if not found (start of season?)
                if (!teamData) return { played: 5, scored: 5, conceded: 5 };
                return {
                    played: teamData.all.played,
                    scored: teamData.all.goals.for,
                    conceded: teamData.all.goals.against
                };
            };

            // Calculate League Averages
            let leagueAvgHome = 1.5;
            let leagueAvgAway = 1.2;
            if (standings.length > 0) {
                const totalGoals = standings.reduce((acc: number, curr: any) => acc + curr.all.goals.for, 0);
                const totalMatches = standings.reduce((acc: number, curr: any) => acc + curr.all.played, 0);
                if (totalMatches > 0) {
                    const avgGoalsPerMatch = totalGoals / totalMatches;
                    leagueAvgHome = avgGoalsPerMatch * 0.55;
                    leagueAvgAway = avgGoalsPerMatch * 0.45;
                }
            }

            // Analyze matches in this league
            for (const fixture of fixtures) {
                const homeStats = getStats(fixture.teams.home.id);
                const awayStats = getStats(fixture.teams.away.id);

                const prediction = calculatePoissonPrediction(homeStats, awayStats, leagueAvgHome, leagueAvgAway);

                // v2.1 META-MODEL CHECK (Risk Filter)
                const risk = analyzeRisk(
                    prediction.homeWinProb,
                    prediction.awayWinProb,
                    { ...homeStats }, // Ensure clean object
                    { ...awayStats }
                );

                // Identify Potential Value (Simplified Logic for Cron)
                // We use "High Confidence" model detection because we might not have real-time odds here
                let prob = 0;
                let pick = '';
                let bestOdds = 0; // Hypothetical odds if we don't have them

                if (prediction.homeWinProb > 0.65) {
                    prob = prediction.homeWinProb;
                    pick = 'HOME WIN';
                    // Conservatively estimate market odds for a 65% fav are around 1.40-1.50
                    // If we model 65% (1.53 fair), and we find edges...
                    // Let's assume we alert if model is very confident (>65%)
                    bestOdds = 1.60; // Mock odds to trigger calculation
                } else if (prediction.awayWinProb > 0.65) {
                    prob = prediction.awayWinProb;
                    pick = 'AWAY WIN';
                    bestOdds = 1.60;
                }

                if (prob > 0) {
                    // Check Risk Model BEFORE calculating financial stakes
                    if (!risk.shouldBet) {
                        console.log(`[Sniper] Skipped ${fixture.teams.home.name} due to Risk: ${risk.flags[0]?.label}`);
                        continue;
                    }

                    // Fix: Pass object to calculateKellyStake
                    const kellyResult = calculateKellyStake({
                        bankroll: 1000,
                        probability: prob * 100, // It expects 0-100
                        odds: bestOdds
                    });

                    // Only alert if Kelly recommends a bet
                    if (kellyResult.recommendation === 'BET' || kellyResult.recommendation === 'CAUTION') {
                        // Double check edge is sufficient
                        const edge = kellyResult.expectedValue; // This is %

                        // v2.1 PERSISTENCE CHECK (Anti-Noise)
                        // This section is removed as per instruction.
                        // The original code had logic for `existingAnalysis`, `shouldSendAlert`, and `db` operations.
                        // Now, we directly send the alert if Kelly recommends a bet.
                        await sendSniperAlert({
                            fixtureId: fixture.fixture.id,
                            homeTeam: fixture.teams.home.name,
                            awayTeam: fixture.teams.away.name,
                            matchDate: fixture.fixture.date,
                            recommendedBet: pick,
                            edge: edge,
                            odds: bestOdds,
                            kellyStake: kellyResult.stakeAmount
                        });
                        alertsSent++;
                    }
                }
            }

        } catch (err) {
            console.error(`[Cron] Error processing league ${leagueId}`, err);
        }
    }

    return NextResponse.json({
        success: true,
        analyzed: relevantFixtures.length,
        alertsSent
    });
}
