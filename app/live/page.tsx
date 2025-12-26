'use client';

import { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { getLiveFixtures } from '@/lib/api-client';

interface LiveFixture {
    id: number;
    home: string;
    away: string;
    score: string;
    time: string;
    status: string;
    league: string;
}

export default function LiveScannerPage() {
    const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getLiveFixtures();
                if (data && Array.isArray(data)) {
                    const formatted = data.map((f: any) => ({
                        id: f.fixture.id,
                        home: f.teams.home.name,
                        away: f.teams.away.name,
                        score: `${f.goals.home}-${f.goals.away}`,
                        time: `${f.fixture.status.elapsed}'`,
                        status: f.fixture.status.short,
                        league: f.league.name
                    }));
                    setFixtures(formatted);
                }
            } catch (e) {
                console.error("Live fetch error:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Activity className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-slate-400 animate-pulse">Scanning live matches...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-emerald-400 animate-pulse" />
                        Live Value Scanner
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Escaneando valor en tiempo real (Predicción IA vs Cuotas en Vivo)</p>
                </div>
                <div className="bg-slate-900 px-4 py-2 rounded-full border border-emerald-500/30 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live Scanner Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fixtures.map((f) => (
                    <div key={f.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all group">
                        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {f.time} ({f.status})
                            </span>
                            <span className="text-xl font-black text-white">{f.score}</span>
                        </div>

                        <div className="p-5">
                            <div className="text-center mb-4">
                                <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 uppercase font-bold tracking-tighter">
                                    {f.league}
                                </span>
                            </div>

                            <div className="flex justify-between items-center mb-6">
                                <div className="text-center flex-1">
                                    <p className="text-xs font-bold text-white truncate px-2">{f.home}</p>
                                </div>
                                <div className="text-[10px] text-slate-600 font-bold px-4">VS</div>
                                <div className="text-center flex-1">
                                    <p className="text-xs font-bold text-white truncate px-2">{f.away}</p>
                                </div>
                            </div>

                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-slate-600 uppercase italic">Monitoring Momentum...</span>
                            </div>

                            <Link
                                href={`/fixture/${f.id}`}
                                className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Activity className="w-4 h-4" /> Go to Analysis
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {fixtures.length === 0 && (
                <div className="p-20 text-center flex flex-col items-center gap-4 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
                    <div className="relative">
                        <Activity className="w-16 h-16 text-slate-800" />
                        <div className="absolute top-0 right-0 w-3 h-3 bg-slate-700 rounded-full animate-pulse"></div>
                    </div>
                    <div>
                        <p className="text-slate-400 font-bold text-lg">No hay partidos en vivo ahora mismo</p>
                        <p className="text-slate-600 text-sm">Vuelve en unos minutos para ver la acción en tiempo real.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
