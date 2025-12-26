import { getUpcomingFixtures, getLeagueStandings, getLeagueHistory, getOddsByDate } from "@/lib/api-client";
import { TOP_LEAGUES } from "@/lib/config";
import FixtureCard from "@/components/FixtureCard";
import { calculatePoissonPrediction, calculateWeightedStats } from "@/lib/predictions";
import { calculateTeamForm } from "@/lib/analytics";
import { calculateValue } from "@/lib/value-bet";
import { Gem, TrendingUp, AlertTriangle } from "lucide-react";

export default async function ValueBetsPage() {
    console.log("Generating Value Bets Report...");

    // 1. Fetch Today's Fixtures for Top Leagues
    const leagueIds = TOP_LEAGUES.map(l => l.id);
    const fixtures = await getUpcomingFixtures(leagueIds); // Fetches next 7 days by default

    // 2. Fetch Odds for Today
    const today = new Date().toISOString().split('T')[0];
    const oddsList = await getOddsByDate(today);

    // 3. Match Fixtures with Odds and calculate Value
    const valueBets = [];

    // Process more matches for better coverage
    const fixturesToProcess = fixtures.slice(0, 30);

    for (const fixture of fixturesToProcess) {
        const fixtureOdds = oddsList.find((o: any) => o.fixture.id === fixture.fixture.id);
        if (!fixtureOdds || !fixtureOdds.bookmakers || fixtureOdds.bookmakers.length === 0) continue;

        const bookmaker = fixtureOdds.bookmakers[0];
        const winnerBet = bookmaker.bets.find((b: any) => b.id === 1);
        if (!winnerBet) continue;

        const odds = {
            home: parseFloat(winnerBet.values.find((v: any) => v.value === 'Home')?.odd || '0'),
            draw: parseFloat(winnerBet.values.find((v: any) => v.value === 'Draw')?.odd || '0'),
            away: parseFloat(winnerBet.values.find((v: any) => v.value === 'Away')?.odd || '0')
        };

        if (!odds.home || !odds.draw || !odds.away) {
            console.log(`Missing odds for ${fixture.fixture.id}`);
            continue;
        }

        // Fetch Stats (Cached)
        const [standings, history] = await Promise.all([
            getLeagueStandings(fixture.league.id, fixture.league.season),
            getLeagueHistory(fixture.league.id, fixture.league.season)
        ]);

        if (!standings || standings.length === 0) continue;

        const homeForm = calculateTeamForm(fixture.teams.home.id, history);
        const awayForm = calculateTeamForm(fixture.teams.away.id, history);

        const getStats = (teamId: number, venue: 'home' | 'away') => {
            const teamData = standings.find((s: any) => s.team.id === teamId);
            if (!teamData) return { played: 5, scored: 5, conceded: 5 };
            const stats = teamData[venue];
            return { played: stats.played, scored: stats.goals.for, conceded: stats.goals.against };
        };

        const homeStats = getStats(fixture.teams.home.id, 'home');
        const awayStats = getStats(fixture.teams.away.id, 'away');

        const prediction = calculatePoissonPrediction(
            calculateWeightedStats(homeStats, { played: 1, scored: homeForm.avgGoalsScored, conceded: homeForm.avgGoalsConceded }, 0.4),
            calculateWeightedStats(awayStats, { played: 1, scored: awayForm.avgGoalsScored, conceded: awayForm.avgGoalsConceded }, 0.4),
            1.35, 1.15
        );

        const analysis = calculateValue(
            { home: prediction.homeWinProb * 100, draw: prediction.drawProb * 100, away: prediction.awayWinProb * 100 },
            odds
        );

        if (analysis.isValue) {
            valueBets.push({
                fixture,
                analysis
            });
        }
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    <Gem className="text-blue-500 w-8 h-8" />
                    <span className="gradient-text">Oportunidades de Valor</span>
                </h1>
                <p className="text-slate-400">
                    Partidos donde nuestra IA detecta una probabilidad al menos un 8% mayor que la estimada por las casas de apuestas.
                </p>
            </div>

            {valueBets.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
                    <AlertTriangle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-300">No se encontraron Value Bets hoy</h3>
                    <p className="text-slate-500 mt-2">Vuelve a consultar más tarde o revisa otras ligas.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {valueBets.map((item, idx) => (
                        <div key={item.fixture.fixture.id} className="relative">
                            <FixtureCard
                                fixture={item.fixture}
                                index={idx}
                                hasValue={true}
                                recommendedBet={item.analysis.recommendedBet}
                            />
                            <div className="absolute -top-3 -right-3 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-xl">
                                +{item.analysis.difference.toFixed(0)}% EDGE
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-blue-900/20 border border-blue-500/20 rounded-xl p-6">
                <h3 className="font-bold text-blue-400 flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4" /> ¿Cómo funciona?
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                    Comparamos la **Probabilidad Implícita** de las cuotas (ej. cuota 2.00 = 50%) con la probabilidad proyectada por nuestro modelo **Poisson Dist** ajustado por forma reciente. Si la diferencia es positiva (al menos 8%), existe una "ventaja matemática" a largo plazo.
                </p>
            </div>
        </div>
    );
}
