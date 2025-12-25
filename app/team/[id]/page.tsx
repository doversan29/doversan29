import { getTeamDetails, getTeamFixtures, getLeagueHistory } from "@/lib/api-client";
import { calculateTeamForm, FormStats } from "@/lib/analytics";
import Link from "next/link";
import { ArrowLeft, Calendar, TrendingUp, Activity, Flame, Snowflake, Clock, Shield, Target } from "lucide-react";
import { format } from "date-fns";
import { es } from 'date-fns/locale';

// Helper for form badges (Duplicated for standalone page)
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

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const teamId = parseInt(id);

    // parallel fetch
    const [teamData, upcoming] = await Promise.all([
        getTeamDetails(teamId),
        getTeamFixtures(teamId, 5)
    ]);

    if (!teamData) {
        return <div className="p-10 text-center text-slate-500">Team not found.</div>;
    }

    const { team, venue } = teamData;

    // Calculate Form (Needs League History of their primary league)
    // We try to guess the league from the upcoming fixtures or use a default?
    // If no upcoming, we can't easily guess.
    let formStats: FormStats | null = null;
    if (upcoming.length > 0) {
        const leagueId = upcoming[0].league.id;
        const season = upcoming[0].league.season;
        const history = await getLeagueHistory(leagueId, season);
        formStats = calculateTeamForm(teamId, history);
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver al Inicio
            </Link>

            {/* Header */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-blue-900/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

                <div className="relative z-10 bg-white/5 p-4 rounded-xl border border-white/10">
                    <img src={team.logo} alt={team.name} className="w-24 h-24 object-contain" />
                </div>

                <div className="text-center md:text-left relative z-10">
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{team.name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> {team.country}</span>
                        <span className="flex items-center gap-1"><Target className="w-4 h-4" /> {venue.name}</span>
                        <span className="flex items-center gap-1">Fundado: {team.founded}</span>
                    </div>
                </div>
            </div>

            {/* Form Section */}
            {formStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-500" /> Forma Reciente
                            </h3>
                            <div className="flex gap-1">
                                {formStats.last5.map((res, i) => <FormBadge key={i} result={res} />)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                <p className="text-slate-500 mb-1">Goles A Favor (Avg)</p>
                                <p className="text-xl font-bold text-emerald-400">{formStats.avgGoalsScored.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-950 p-3 rounded border border-slate-800">
                                <p className="text-slate-500 mb-1">Goles En Contra (Avg)</p>
                                <p className="text-xl font-bold text-red-400">{formStats.avgGoalsConceded.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Streak Badges */}
                        <div className="flex flex-wrap gap-2 mt-4 text-xs font-bold">
                            {formStats.streak.type === 'WIN' && (
                                <span className="flex items-center gap-1 text-orange-400 bg-orange-950/30 px-2 py-1 rounded-full border border-orange-500/20">
                                    <Flame className="w-3 h-3" /> Racha de {formStats.streak.count} Victorias
                                </span>
                            )}
                            {formStats.streak.type === 'LOSS' && (
                                <span className="flex items-center gap-1 text-blue-300 bg-blue-900/20 px-2 py-1 rounded-full border border-blue-500/20">
                                    <Snowflake className="w-3 h-3" /> Racha de {formStats.streak.count} Derrotas
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Key Stats Placeholder */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-center items-center text-center">
                        <TrendingUp className="w-10 h-10 text-slate-700 mb-3" />
                        <p className="text-slate-500 text-sm">Más estadísticas detalladas próximamente...</p>
                    </div>
                </div>
            )}

            {/* Upcoming Fixtures */}
            <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-200 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" /> Próximos Partidos
                </h3>

                {upcoming.length === 0 ? (
                    <div className="bg-slate-900/50 p-8 rounded-xl text-center text-slate-500">
                        No hay partidos programados próximamente.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {upcoming.map((fixture: any) => (
                            <Link
                                key={fixture.fixture.id}
                                href={`/fixture/${fixture.fixture.id}`}
                                className="block bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all rounded-xl p-4 group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="text-center w-12 text-xs text-slate-500">
                                            <div className="font-bold text-slate-400">{format(new Date(fixture.fixture.date), "dd MMM", { locale: es })}</div>
                                            <div>{format(new Date(fixture.fixture.date), "HH:mm")}</div>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <img src={fixture.teams.home.logo} className="w-6 h-6 object-contain" />
                                                    <span className={`font-bold ${fixture.teams.home.id === teamId ? 'text-white' : 'text-slate-400'}`}>
                                                        {fixture.teams.home.name}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <img src={fixture.teams.away.logo} className="w-6 h-6 object-contain" />
                                                    <span className={`font-bold ${fixture.teams.away.id === teamId ? 'text-white' : 'text-slate-400'}`}>
                                                        {fixture.teams.away.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ml-4">
                                        <div className="px-3 py-1 bg-blue-600/10 text-blue-400 text-xs font-bold rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            VER ANÁLISIS
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
