import { calculatePoissonPrediction, calculateWeightedStats, getRecommendedBet } from "@/lib/predictions";
import { calibrateProbability } from "@/lib/analysis/calibration";
import { analyzeRisk } from "@/lib/analysis/risk-model";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import Link from "next/link";
import { ArrowLeft, TrendingUp, AlertCircle, Calculator, History, Activity, Flame, Snowflake, Clock, User } from "lucide-react";
import { getFixtureById, getLeagueStandings, getLeagueHistory } from "@/lib/api-client";
import { getMatchOdds } from "@/lib/odds";
import ValueBetCalculator from "@/components/ValueBetCalculator";
import BettingStrategyCard from "@/components/BettingStrategyCard";
import { calculateTeamForm, FormStats } from "@/lib/analytics";
import { generateExpertAnalysis } from "@/lib/analysis-text";
import { calculateValue } from "@/lib/value-bet";
import { Gem } from "lucide-react";


// Helper for form badges
const FormBadge = ({ result }: { result: string }) => {
    const colors = {
        'W': 'bg-emerald-500 text-emerald-950',
        'D': 'bg-slate-500 text-slate-100',
        'L': 'bg-red-500 text-red-950'
    };
    return (
        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${colors[result as keyof typeof colors] || 'bg-slate-700'}`}>
            {result}
        </span>
    );
};

// Helper for form section
const TeamFormSection = ({ name, stats }: { name: string, stats: FormStats }) => (
    <div className="space-y-3">
        <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-300">{name}</span>
            <div className="flex gap-1">
                {stats.last5.map((res, i) => <FormBadge key={i} result={res} />)}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                <p className="text-slate-500">Scored (Avg)</p>
                <p className="font-bold text-emerald-400">{stats.avgGoalsScored.toFixed(1)}</p>
            </div>
            <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                <p className="text-slate-500">Conceded (Avg)</p>
                <p className="font-bold text-red-400">{stats.avgGoalsConceded.toFixed(1)}</p>
            </div>
        </div>

        {/* Streak & Fatigue Indicators */}
        <div className="flex flex-wrap gap-2 text-xs font-bold">
            {stats.streak.type === 'WIN' && (
                <span className="flex items-center gap-1 text-orange-400 bg-orange-950/30 px-2 py-1 rounded-full border border-orange-500/20">
                    <Flame className="w-3 h-3" /> {stats.streak.count} Win Streak
                </span>
            )}
            {stats.streak.type === 'UNBEATEN' && (
                <span className="flex items-center gap-1 text-blue-400 bg-blue-950/30 px-2 py-1 rounded-full border border-blue-500/20">
                    <Activity className="w-3 h-3" /> {stats.streak.count} Match Unbeaten
                </span>
            )}
            {stats.streak.type === 'LOSS' && (
                <span className="flex items-center gap-1 text-blue-300 bg-blue-900/20 px-2 py-1 rounded-full">
                    <Snowflake className="w-3 h-3" /> {stats.streak.count} Loss Streak
                </span>
            )}
            {stats.fatigueLevel === 'Critical' && (
                <span className="flex items-center gap-1 text-red-400 bg-red-950/30 px-2 py-1 rounded-full border border-red-500/20">
                    <AlertCircle className="w-3 h-3" /> Critical Fatigue ({stats.daysSinceLastMatch}d Rest)
                </span>
            )}
            {(stats.fatigueLevel === 'High') && (
                <span className="flex items-center gap-1 text-yellow-500 bg-yellow-950/30 px-2 py-1 rounded-full border border-yellow-500/20">
                    <Clock className="w-3 h-3" /> High Fatigue ({stats.daysSinceLastMatch}d Rest)
                </span>
            )}
        </div>
    </div>
);


export default async function FixturePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const fixture = await getFixtureById(parseInt(id));

    if (!fixture) {
        return <div className="p-10 text-center text-slate-500">Match not found or API error.</div>
    }

    const matchDate = new Date(fixture.fixture.date);

    // Fetch Data Parallelisation
    const [standings, history, realOdds] = await Promise.all([
        getLeagueStandings(fixture.league.id, fixture.league.season),
        getLeagueHistory(fixture.league.id, fixture.league.season),
        getMatchOdds(fixture.fixture.id)
    ]);

    // Calculate Advanced Form
    const homeForm = calculateTeamForm(fixture.teams.home.id, history);
    // ... (existing code) ...

    const awayForm = calculateTeamForm(fixture.teams.away.id, history);

    // H2H Logic (Filter history for matches between distinct home/away pair)
    // Note: In a full app we'd fetch ALL history across seasons, but here we check current season encounters
    const h2hMatches = history.filter((m: any) =>
        (m.teams.home.id === fixture.teams.home.id && m.teams.away.id === fixture.teams.away.id) ||
        (m.teams.home.id === fixture.teams.away.id && m.teams.away.id === fixture.teams.home.id)
    ).slice(0, 3);

    // Standings Stats Fallback (Venue Specific Model)
    const getStats = (teamId: number, venue: 'home' | 'away') => {
        const teamData = standings.find((s: any) => s.team.id === teamId);
        if (!teamData) {
            return { played: 5, scored: 5, conceded: 5 };
        }
        // Use strict HOME stats for home team, AWAY stats for away team
        const stats = teamData[venue];
        return {
            played: stats.played,
            scored: stats.goals.for,
            conceded: stats.goals.against
        };
    };

    const homeStats = getStats(fixture.teams.home.id, 'home');
    const awayStats = getStats(fixture.teams.away.id, 'away');

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


    // --- NEW: Weighted Prediction Logic ---
    // Convert 5-game form to TeamStats format for the weight function
    const homeRecentStats = { played: 1, scored: homeForm.avgGoalsScored, conceded: homeForm.avgGoalsConceded };
    const awayRecentStats = { played: 1, scored: awayForm.avgGoalsScored, conceded: awayForm.avgGoalsConceded };

    // Apply 70% Season / 30% Form weighting
    const homeWeighted = calculateWeightedStats(homeStats, homeRecentStats, 0.3);
    const awayWeighted = calculateWeightedStats(awayStats, awayRecentStats, 0.3);


    // Poisson Prediction
    const prediction = calculatePoissonPrediction(homeWeighted, awayWeighted, leagueAvgHome, leagueAvgAway);

    // Calibrate Probabilities
    if (prediction) {
        prediction.homeWinProb = await calibrateProbability(fixture.league.id, prediction.homeWinProb);
        prediction.drawProb = await calibrateProbability(fixture.league.id, prediction.drawProb);
        prediction.awayWinProb = await calibrateProbability(fixture.league.id, prediction.awayWinProb);
    }

    // Calculate Probs for Display
    const winProb = (prediction.homeWinProb * 100).toFixed(0);
    const drawProb = (prediction.drawProb * 100).toFixed(0);
    const lossProb = (prediction.awayWinProb * 100).toFixed(0);

    // Value Bet Analysis
    const valueAnalysis = realOdds ? calculateValue(
        { home: prediction.homeWinProb, draw: prediction.drawProb, away: prediction.awayWinProb },
        realOdds
    ) : null;

    // Generate Expert Analysis
    const expertAnalysis = generateExpertAnalysis({
        homeName: fixture.teams.home.name,
        awayName: fixture.teams.away.name,
        homeForm,
        awayForm,
        prediction,
        homeStats: homeWeighted, // Passing weighted stats as team stats context
        awayStats: awayWeighted,
        valueAnalysis: valueAnalysis || undefined
    });

    // v2.1 RISK ANALYSIS (Meta-Model)
    const riskAnalysis = analyzeRisk(
        prediction.homeWinProb, // Uses calibrated probs now
        prediction.awayWinProb,
        homeWeighted, // Stats normalized
        awayWeighted
    );

    const recommendedBet = getRecommendedBet(prediction, fixture.teams.home.name, fixture.teams.away.name);

    // ... EXPERT ANALYSIS SECTION (Modified) ...
    return (
        <div className="space-y-8 pb-20">
            <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-20 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <User className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Análisis del Experto</h3>

                        {/* Risk Flags or Value Badge */}
                        <div className="ml-auto flex gap-2">
                            {riskAnalysis.riskLevel === 'CRITICAL' || riskAnalysis.riskLevel === 'HIGH' ? (
                                <span className="bg-red-500/90 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 shadow-lg shadow-red-500/20">
                                    <AlertCircle className="w-3 h-3" /> HIGH RISK
                                </span>
                            ) : valueAnalysis?.isValue ? (
                                <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 animate-bounce shadow-lg shadow-emerald-500/50">
                                    <Gem className="w-3 h-3" /> VALUE BET
                                </span>
                            ) : null}
                        </div>

                    </div>

                    {/* Risk Warnings (Banner) */}
                    {riskAnalysis.flags.length > 0 && (
                        <div className="mb-4 bg-red-950/30 border border-red-500/20 rounded p-3">
                            <p className="text-xs text-red-200 font-bold mb-1 uppercase tracking-wider">⚠️ Riesgos Detectados (Meta-Model)</p>
                            <ul className="text-xs text-red-300 space-y-1">
                                {riskAnalysis.flags.map((f, i) => (
                                    <li key={i} className="flex gap-2">
                                        <span className="font-bold">• {f.label}:</span> {f.description}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="prose prose-invert max-w-none">
                        <p className="text-blue-100 text-lg leading-relaxed whitespace-pre-line">
                            {expertAnalysis}
                        </p>
                    </div>
                </div>
            </div>


            {/* Match Header */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 py-12 text-center relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                    <div className="text-right flex-1">
                        <h2 className="text-2xl md:text-4xl font-black text-white">{fixture.teams.home.name}</h2>
                        <p className="text-slate-500 mt-2">Home</p>
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="bg-slate-800 px-4 py-1 rounded-full text-xs font-mono text-slate-400 mb-4">
                            {format(matchDate, "d MMMM yyyy • HH:mm", { locale: es })}
                        </div>
                        <div className="text-5xl font-black text-slate-700 tracking-tighter">VS</div>
                        <div className="mt-4 text-emerald-400 font-bold text-sm tracking-widest uppercase">
                            {fixture.league.name}
                        </div>
                    </div>

                    <div className="text-left flex-1">
                        <h2 className="text-2xl md:text-4xl font-black text-white">{fixture.teams.away.name}</h2>
                        <p className="text-slate-500 mt-2">Away</p>
                    </div>
                </div>
            </div>

            {/* Recent Form Analysis (NEW PHASE 2) */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                    <History className="w-5 h-5 text-orange-400" />
                    <h3 className="font-bold text-lg text-slate-200">Recent Form (Last 5)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <TeamFormSection name={fixture.teams.home.name} stats={homeForm} />
                    <TeamFormSection name={fixture.teams.away.name} stats={awayForm} />
                </div>
            </div>

            {/* Head to Head (Strategies #4) */}
            {
                h2hMatches.length > 0 && (
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-slate-400" />
                            <h3 className="font-bold text-lg text-slate-200">Head-to-Head (This Season)</h3>
                        </div>
                        <div className="space-y-2">
                            {h2hMatches.map((match: any) => (
                                <div key={match.fixture.id} className="flex justify-between items-center bg-slate-950 p-3 rounded text-sm">
                                    <span className="text-slate-400">{format(new Date(match.fixture.date), "dd MMM")}</span>
                                    <div className="font-bold text-white">
                                        {match.teams.home.name} <span className="text-emerald-400 mx-2">{match.goals.home} - {match.goals.away}</span> {match.teams.away.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* AI Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Probabilities */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-lg text-slate-200">Win Probability</h3>
                        <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                            Calibrated v2.1
                        </span>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">{fixture.teams.home.name}</span>
                                <span className="font-bold text-blue-400">{winProb}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${winProb}% ` }}></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Draw</span>
                                <span className="font-bold text-slate-400">{drawProb}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-600" style={{ width: `${drawProb}% ` }}></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">{fixture.teams.away.name}</span>
                                <span className="font-bold text-purple-400">{lossProb}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${lossProb}% ` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Insights and XG */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-blue-900/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

                        <div className="flex items-center gap-2 mb-6">
                            <AlertCircle className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-bold text-lg text-slate-200">AI Insights</h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Expected Goals (xG)</p>
                                <div className="flex justify-between items-end">
                                    <span className="text-2xl font-bold text-white">{prediction.expectedGoalsHome.toFixed(2)}</span>
                                    <span className="text-slate-600 mb-1">vs</span>
                                    <span className="text-2xl font-bold text-white">{prediction.expectedGoalsAway.toFixed(2)}</span>
                                </div>
                            </div>

                        </div>

                        {/* NEW: Interactive Strategy Card */}
                        <div className="mt-6">
                            <BettingStrategyCard
                                fixtureId={fixture.fixture.id}
                                homeName={fixture.teams.home.name}
                                awayName={fixture.teams.away.name}
                                prediction={{
                                    homeProb: prediction.homeWinProb,
                                    awayProb: prediction.awayWinProb,
                                    expectedGoals: prediction.expectedGoalsHome + prediction.expectedGoalsAway
                                }}
                                recommendedBet={recommendedBet}
                            />
                        </div>

                        {/* Value Calculator Client Component */}

                        {/* Value Calculator Client Component */}
                        <ValueBetCalculator
                            winProb={Number(winProb)}
                            drawProb={Number(drawProb)}
                            lossProb={Number(lossProb)}
                            homeName={fixture.teams.home.name}
                            awayName={fixture.teams.away.name}
                        />
                    </div>
                </div>
            </div>

            {/* PLAYER PROPS SECTION (NEW PHASE 3) */}
            <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                    <History className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-lg text-slate-200">Player Props (Anytime Goalscorer)</h3>
                </div>

                <div className="p-10 text-center bg-slate-950/50 rounded-lg border border-slate-800 border-dashed">
                    <p className="text-slate-400 mb-2">🚀 Coming Soon via API Expansion</p>
                    <p className="text-sm text-slate-500">
                        Player probability models and specific goalscorer markets are being integrated.
                        Check back in the next update.
                    </p>
                </div>
            </div>
        </div>
    );
}
