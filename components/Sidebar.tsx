'use client';

import { TOP_LEAGUES, REGIONS } from '@/lib/config';
import { Trophy, Calendar, CheckSquare, LayoutDashboard, Sparkles, RefreshCw, Gem, TrendingUp } from 'lucide-react';

import { refreshData } from '@/app/actions';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils'; // Need to create helper or import standard clsx
import { useState, useEffect } from 'react';

// Simple clsx utility if lib/utils doesn't exist yet
function classNames(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export default function Sidebar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Extract selected leagues from URL or default to all
    const selectedLeaguesParam = searchParams.get('leagues');
    const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);

    useEffect(() => {
        if (selectedLeaguesParam) {
            setSelectedLeagues(selectedLeaguesParam.split(',').map(Number));
        } else {
            setSelectedLeagues(TOP_LEAGUES.map(l => l.id)); // Default all
        }
    }, [selectedLeaguesParam]);

    const toggleLeague = (id: number) => {
        let newSelected = selectedLeagues.includes(id)
            ? selectedLeagues.filter(l => l !== id)
            : [...selectedLeagues, id];

        // If empty, select all (or handle empty state)
        if (newSelected.length === 0) newSelected = [];

        setSelectedLeagues(newSelected);

        // Update URL
        const params = new URLSearchParams(searchParams.toString());
        if (newSelected.length === TOP_LEAGUES.length || newSelected.length === 0) {
            params.delete('leagues');
        } else {
            params.set('leagues', newSelected.join(','));
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col h-full overflow-hidden">
            <div className="p-6">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-blue-400" />
                    BetPredict
                </h1>
                <p className="text-xs text-slate-400 mt-1">Predicciones Deportivas IA</p>
            </div>

            <nav className="px-4 space-y-1 mb-6">
                <Link href="/" className={classNames(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === '/' ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}>
                    <Calendar className="w-5 h-5" />
                    Próximos Partidos
                </Link>
                <Link href="/dashboard" className={classNames(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === '/dashboard' ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}>
                    <LayoutDashboard className="w-5 h-5" />
                    Mi Bankroll
                </Link>
                <Link href="/parlay" className={classNames(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === '/parlay' ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}>
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent font-bold">Parlay Diario</span>
                </Link>
                <Link href="/value-bets" className={classNames(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === '/value-bets' ? "bg-blue-600/10 text-blue-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}>
                    <Gem className="w-5 h-5 text-blue-400" />
                    Cuotas de Valor
                </Link>
            </nav>


            <div className="px-6 pb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ligas y Países</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
                {REGIONS.map(region => {
                    const regionLeagues = TOP_LEAGUES.filter(l => l.region === region);
                    if (regionLeagues.length === 0) return null;

                    return (
                        <div key={region}>
                            <h4 className="text-xs font-medium text-slate-600 mb-2 px-1">{region}</h4>
                            <div className="space-y-1">
                                {regionLeagues.map(league => (
                                    <button
                                        key={league.id}
                                        onClick={() => toggleLeague(league.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-slate-800 text-slate-300"
                                    >
                                        <div className={classNames(
                                            "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                            selectedLeagues.includes(league.id) ? "bg-blue-500 border-blue-500" : "border-slate-600"
                                        )}>
                                            {selectedLeagues.includes(league.id) && <CheckSquare className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="text-lg">{league.flag}</span>
                                        <span className="truncate">{league.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                })}
                {/* Refresh Button */}
                <div className="mt-8 pt-6 border-t border-slate-800">
                    <form action={async () => {
                        await refreshData();
                    }}>
                        <button type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                            <RefreshCw className="w-3 h-3" /> ACTUALIZAR DATOS
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}
