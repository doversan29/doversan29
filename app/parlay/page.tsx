import { getUpcomingFixtures, getLeagueStandings, getLeagueHistory } from "@/lib/api-client";
import { calculatePoissonPrediction } from "@/lib/predictions";
import { TOP_LEAGUES } from "@/lib/config";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import Link from "next/link";
import { ArrowLeft, Ticket, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

export default async function ParlayPage() {
    // 1. Fetch upcoming matches from all Top Leagues
    const leagueIds = TOP_LEAGUES.map(l => l.id);
    const fixtures = await getUpcomingFixtures(leagueIds); // fetches next 7 days by default

    // 2. Analyze matches to find "Safe Bets"
    const analyzedMatches = [];

    // Parallelize detailed data fetching for top 10 promising matches to save time? 
    // For now, let's do a basic scan. Poisson needs stats.
    // We can't fetch standings for EVERY league efficiently in one go without causing delay.
    // Optimization: We already cached standings in previous steps if visited. 
    // We will fetch standings for the specific leagues of the fixtures we find.

    // Group fixtures by league to minimize requests
    const fixturesByLeague: Record<number, any[]> = {};
    fixtures.forEach(f => {
        if (!fixturesByLeague[f.league.id]) fixturesByLeague[f.league.id] = [];
        fixturesByLeague[f.league.id].push(f);
    });

    const predictions = [];

    for (const leagueId of Object.keys(fixturesByLeague)) {
        const lid = parseInt(leagueId);
        const leagueFixtures = fixturesByLeague[lid];

        // Get stats for this league
        const standings = await getLeagueStandings(lid, 2025);
        if (!standings || standings.length === 0) continue;

        // Calculate League Averages
        const totalGoals = standings.reduce((acc: any, curr: any) => acc + curr.all.goals.for, 0);
        const totalMatches = standings.reduce((acc: any, curr: any) => acc + curr.all.played, 0);
        const avgGoalsPerMatch = totalMatches > 0 ? totalGoals / totalMatches : 2.5;
        const leagueAvgHome = avgGoalsPerMatch * 0.55;
        const leagueAvgAway = avgGoalsPerMatch * 0.45;

        for (const fixture of leagueFixtures) {
            const homeTeam = standings.find((s: any) => s.team.id === fixture.teams.home.id);
            const awayTeam = standings.find((s: any) => s.team.id === fixture.teams.away.id);

            if (!homeTeam || !awayTeam) continue;

            const homeStats = {
                played: homeTeam.all.played,
                scored: homeTeam.all.goals.for,
                conceded: homeTeam.all.goals.against
            };
            const awayStats = {
                played: awayTeam.all.played,
                scored: awayTeam.all.goals.for,
                conceded: awayTeam.all.goals.against
            };

            const pred = calculatePoissonPrediction(homeStats, awayStats, leagueAvgHome, leagueAvgAway);

            // Find the safest outcome
            let safePick = '';
            let confidence = 0;
            let type = '';
            let odds = 0; // Mock odds estimation based on probability

            if (pred.homeWinProb > 0.60) {
                safePick = `${fixture.teams.home.name} to Win`;
                confidence = pred.homeWinProb;
                type = 'HOME_WIN';
                odds = 1 / pred.homeWinProb;
            } else if (pred.awayWinProb > 0.60) {
                safePick = `${fixture.teams.away.name} to Win`;
                confidence = pred.awayWinProb;
                type = 'AWAY_WIN';
                odds = 1 / pred.awayWinProb;
            } else if (pred.homeWinProb + pred.drawProb > 0.80) {
                safePick = `${fixture.teams.home.name} Double Chance`;
                confidence = pred.homeWinProb + pred.drawProb;
                type = 'HOME_DC';
                odds = 1.30;
            }

            if (safePick) {
                predictions.push({
                    fixture,
                    pick: safePick,
                    confidence,
                    type,
                    estOdds: odds < 1.01 ? 1.01 : odds
                });
            }
        }
    }

    // Sort by confidence (highest first) and take top 3
    predictions.sort((a, b) => b.confidence - a.confidence);
    const parlay = predictions.slice(0, 3);

    const totalOdds = parlay.reduce((acc, curr) => acc * curr.estOdds, 1);
    const potentialReturn = 10 * totalOdds; // $10 stake example mechanism

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Matches
            </Link>

            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold mb-4 animate-pulse">
                    <Sparkles className="w-3 h-3" /> AI GENERATED
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-white mb-2">Daily Parlay</h1>
                <p className="text-slate-400">High-confidence accumulator derived from Poisson Analysis</p>
            </div>

            {parlay.length < 3 ? (
                <div className="p-10 border border-slate-800 rounded-xl bg-slate-900/50 text-center">
                    <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-white font-bold text-xl">Not enough safe matches</h3>
                    <p className="text-slate-500 mt-2">The AI couldn&apos;t find 3 matches with &gt;60% confidence today. Try again closer to the weekend.</p>
                </div>
            ) : (
                <div className="grid gap-8 md:grid-cols-3 relative">
                    {/* The Ticket Visual */}
                    <div className="md:col-span-2 space-y-4">
                        {parlay.map((leg, i) => (
                            <Link href={`/fixture/${leg.fixture.fixture.id}`} key={leg.fixture.fixture.id} className="block group">
                                <div className="bg-slate-900/80 border border-slate-700 hover:border-emerald-500/50 p-4 rounded-xl flex items-center justify-between transition-all group-hover:bg-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-800 w-8 h-8 flex items-center justify-center rounded-full font-bold text-slate-500 text-xs border border-slate-700">
                                            {i + 1}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-sm">
                                                {leg.fixture.teams.home.name} vs {leg.fixture.teams.away.name}
                                            </h4>
                                            <p className="text-emerald-400 font-bold text-lg mt-1">{leg.pick}</p>
                                            <p className="text-xs text-slate-500">{format(new Date(leg.fixture.fixture.date), "EEE HH:mm", { locale: es })} • {leg.fixture.league.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-slate-700 group-hover:text-slate-600">{(leg.confidence * 100).toFixed(0)}%</div>
                                        <div className="text-xs text-slate-500">Confidence</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Summary Card */}
                    <div className="md:col-span-1">
                        <div className="bg-gradient-to-br from-emerald-900/90 to-slate-900 border border-emerald-500/30 p-6 rounded-2xl sticky top-24 shadow-2xl shadow-emerald-900/20">
                            <div className="flex flex-col gap-1 mb-6 text-center">
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Total Odds</span>
                                <span className="text-4xl font-black text-white">{totalOdds.toFixed(2)}</span>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-white/10">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Stake Example</span>
                                    <span className="text-white font-mono">$10.00</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-emerald-400 font-bold">Potential Return</span>
                                    <span className="text-emerald-400 font-bold font-mono">${potentialReturn.toFixed(2)}</span>
                                </div>
                            </div>

                            <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-4 rounded-xl mt-8 transition-colors flex items-center justify-center gap-2">
                                <Ticket className="w-5 h-5" />
                                SAVE TICKET
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
