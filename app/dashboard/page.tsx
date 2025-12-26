'use client';

import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, History } from 'lucide-react';
import { format } from 'date-fns';
import { getHistoryAction, verifyPredictionsAction } from '@/app/actions';

interface Bet {
    id: string;
    date: string;
    match: string;
    selection: string;
    stake: number;
    odds: number;
    status: 'PENDING' | 'WON' | 'LOST' | 'VOID';
    profit: number;
}

interface Stats {
    currentBalance: number;
    roi: number;
    wins: number;
    losses: number;
    history: Bet[];
}

interface ModelHistoryItem {
    id: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
    prediction: {
        pick: string;
        confidence: number;
    };
    result?: string;
    matchScore?: string;
}

interface ModelStats {
    total: number;
    won: number;
    rate: number;
    history: ModelHistoryItem[];
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [newBet, setNewBet] = useState({
        match: '',
        selection: '',
        stake: 10,
        odds: 2.0
    });

    // Model Stats State
    const [modelStats, setModelStats] = useState<ModelStats | null>(null);
    const [verifying, setVerifying] = useState(false);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/bankroll', { next: { revalidate: 0 } }); // No cache fetching
            if (res.ok) setStats(await res.json());

            // Fetch Model Stats
            const history = await getHistoryAction();
            setModelStats(history);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleAddBet = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('/api/bankroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBet)
            });
            setShowForm(false);
            fetchStats(); // Refresh
            setNewBet({ match: '', selection: '', stake: 10, odds: 2.0 });
        } catch (e) {
            console.error(e);
        }
    };

    const updateStatus = async (id: string, status: 'WON' | 'LOST') => {
        try {
            await fetch('/api/bankroll', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            fetchStats();
        } catch (e) {
            console.error(e);
        }
    };

    const handleVerifyModel = async () => {
        setVerifying(true);
        await verifyPredictionsAction();
        await fetchStats();
        setVerifying(false);
    };

    if (loading) return <div className="p-10 text-center">Cargando bankroll...</div>;
    if (!stats) return <div className="p-10">Error al cargar estadísticas</div>;

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    💰 Bankroll Dashboard
                </h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" /> Registrar Apuesta
                </button>
            </div>

            {/* Model Stats Section (NEW) */}
            {modelStats && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-300">🤖 Desempeño del Modelo IA</h2>
                            <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 animate-pulse">
                                MODE: ULTRA-CONSERVATIVE v3.7
                            </span>
                        </div>
                        <button
                            onClick={handleVerifyModel}
                            disabled={verifying}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1 rounded border border-slate-700 disabled:opacity-50"
                        >
                            {verifying ? 'Verificando...' : 'Verificar Resultados'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Precisión General</p>
                            <p className={`text-3xl font-black ${modelStats.rate >= 50 ? 'text-emerald-400' : 'text-orange-400'}`}>
                                {modelStats.rate.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Aciertos / Total</p>
                            <p className="text-3xl font-black text-white">
                                {modelStats.won} <span className="text-lg text-slate-500 font-normal">/ {modelStats.total}</span>
                            </p>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Dampener de Realidad</p>
                            <p className="text-3xl font-black text-blue-400">-10%</p>
                        </div>
                    </div>

                    {/* Model History Table */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden mt-4">
                        <div className="p-4 border-b border-slate-800">
                            <h3 className="font-bold text-sm text-slate-300">Historial Reciente del Modelo</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left text-slate-400">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                                    <tr>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2">Partido</th>
                                        <th className="px-4 py-2">Predicción</th>
                                        <th className="px-4 py-2 text-center">Resultado</th>
                                        <th className="px-4 py-2 text-right">Marcador</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {modelStats.history.slice(0, 5).map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-800/20">
                                            <td className="px-4 py-2">{format(new Date(item.date), 'dd/MM HH:mm')}</td>
                                            <td className="px-4 py-2 text-white">{item.homeTeam} vs {item.awayTeam}</td>
                                            <td className="px-4 py-2">
                                                <span className={`font-bold ${item.prediction.pick === 'HOME' ? 'text-blue-400' :
                                                    item.prediction.pick === 'AWAY' ? 'text-purple-400' : 'text-slate-400'}`}>
                                                    {item.prediction.pick === 'HOME' ? 'LOCAL' : item.prediction.pick === 'AWAY' ? 'VISITA' : 'EMPATE'}
                                                </span>
                                                <span className="text-xs text-slate-600 ml-1">({(item.prediction.confidence * 100).toFixed(0)}%)</span>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.result === 'WON' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    item.result === 'LOST' ? 'bg-red-500/10 text-red-500' : 'bg-slate-700 text-slate-300'
                                                    }`}>
                                                    {item.result === 'WON' ? 'ACIERTO' : item.result === 'LOST' ? 'FALLO' : 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-white">
                                                {item.matchScore || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Bet Form */}
            {showForm && (
                <form onSubmit={handleAddBet} className="bg-slate-800/50 p-6 rounded-xl border border-blue-900/50 animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 text-white">Nueva Apuesta</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            type="text"
                            required
                            placeholder="Partido (ej. Real Madrid vs Barcelona)"
                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            value={newBet.match}
                            onChange={e => setNewBet({ ...newBet, match: e.target.value })}
                        />
                        <input
                            type="text"
                            required
                            placeholder="Selección (ej. Local Gana)"
                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
                            value={newBet.selection}
                            onChange={e => setNewBet({ ...newBet, selection: e.target.value })}
                        />
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-xs text-slate-500 block mb-1">Monto ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    value={newBet.stake}
                                    onChange={e => setNewBet({ ...newBet, stake: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-slate-500 block mb-1">Cuota</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    value={newBet.odds}
                                    onChange={e => setNewBet({ ...newBet, odds: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold">Guardar</button>
                    </div>
                </form>
            )}

            {/* History Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" /> Actividad Reciente
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-950/50">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Partido</th>
                                <th className="px-6 py-3">Selección</th>
                                <th className="px-6 py-3 text-right">Monto/Cuota</th>
                                <th className="px-6 py-3 text-center">Estado</th>
                                <th className="px-6 py-3 text-right">P/L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {stats.history.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-600">No hay apuestas registradas.</td></tr>
                            ) : stats.history.map(bet => (
                                <tr key={bet.id} className="hover:bg-slate-800/20">
                                    <td className="px-6 py-4">{format(new Date(bet.date), 'MMM d, HH:mm')}</td>
                                    <td className="px-6 py-4 font-medium text-white">{bet.match}</td>
                                    <td className="px-6 py-4 text-blue-400">{bet.selection}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div>${bet.stake}</div>
                                        <div className="text-xs text-slate-500">@{bet.odds.toFixed(2)}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {bet.status === 'PENDING' ? (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => updateStatus(bet.id, 'WON')} className="bg-emerald-500/10 text-emerald-500 p-1 rounded hover:bg-emerald-500/20 text-xs font-bold">GANADA</button>
                                                <button onClick={() => updateStatus(bet.id, 'LOST')} className="bg-red-500/10 text-red-500 p-1 rounded hover:bg-red-500/20 text-xs font-bold">PERDIDA</button>
                                            </div>
                                        ) : (
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${bet.status === 'WON' ? 'bg-emerald-500/10 text-emerald-500' :
                                                bet.status === 'LOST' ? 'bg-red-500/10 text-red-500' : 'bg-slate-700 text-slate-300'
                                                }`}>
                                                {bet.status}
                                            </span>
                                        )}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${bet.profit > 0 ? 'text-emerald-400' : bet.profit < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                        {bet.status === 'PENDING' ? '-' : `$${Math.abs(bet.profit).toFixed(2)}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
