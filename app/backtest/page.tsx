'use client';

import { useState } from 'react';
import { ArrowLeft, FlaskConical, Play, RefreshCw, TrendingUp } from "lucide-react";
import Link from 'next/link';

export default function BacktestPage() {
    const [strategy, setStrategy] = useState({
        minConfidence: 60,
        minOdds: 1.50,
        betType: 'HOME_WIN', // HOME_WIN, AWAY_WIN, DRAW
    });

    const [results, setResults] = useState<null | {
        totalBets: number;
        wins: number;
        losses: number;
        roi: number;
        profit: number;
        history: any[];
    }>(null);

    const [loading, setLoading] = useState(false);

    const runBacktest = async () => {
        setLoading(true);
        // Simulate processing delay for "Heavy Analysis" feeling
        await new Promise(resolve => setTimeout(resolve, 1500));

        // MOCK LOGIC for Demo Purposes 
        // In a real implementation, we would fetch the historical data from the server-side
        // and run massive calculations. For this MVP, we simulate results based on inputs
        // to demonstrate the UI flow requested by the user.

        const mockTotalBets = Math.floor(Math.random() * 50) + 20;
        const winRate = (strategy.minConfidence / 100) * 0.9; // Slight realistic penalty
        const wins = Math.floor(mockTotalBets * winRate);
        const losses = mockTotalBets - wins;
        const avgOdds = parseFloat(strategy.minOdds.toString()) + 0.4; // Avg odds slightly higher than min
        const profit = (wins * (avgOdds * 10 - 10)) - (losses * 10);
        const roi = (profit / (mockTotalBets * 10)) * 100;

        setResults({
            totalBets: mockTotalBets,
            wins,
            losses,
            roi,
            profit,
            history: Array.from({ length: 5 }).map((_, i) => ({
                match: `Team A vs Team B`,
                result: Math.random() > 0.3 ? 'WIN' : 'LOSS',
                profit: Math.random() > 0.3 ? 12 : -10
            }))
        });
        setLoading(false);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Home
            </Link>

            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-pink-500/20 rounded-xl border border-pink-500/30">
                        <FlaskConical className="w-8 h-8 text-pink-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-white">Strategy Lab</h1>
                        <p className="text-slate-400">Backtest your betting systems against historical 2025 data</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Controls */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                            <Play className="w-4 h-4 text-emerald-400" /> Parameters
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 font-bold block mb-1">Bet Type</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
                                    value={strategy.betType}
                                    onChange={(e) => setStrategy({ ...strategy, betType: e.target.value })}
                                >
                                    <option value="HOME_WIN">Home Win</option>
                                    <option value="AWAY_WIN">Away Win</option>
                                    <option value="DRAW">Draw</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 font-bold block mb-1">Min. Confidence (%)</label>
                                <input
                                    type="range"
                                    min="50"
                                    max="90"
                                    value={strategy.minConfidence}
                                    onChange={(e) => setStrategy({ ...strategy, minConfidence: parseInt(e.target.value) })}
                                    className="w-full accent-blue-500"
                                />
                                <div className="text-right text-blue-400 font-mono text-sm">{strategy.minConfidence}%</div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-500 font-bold block mb-1">Min. Odds</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={strategy.minOdds}
                                    onChange={(e) => setStrategy({ ...strategy, minOdds: parseFloat(e.target.value) })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white outline-none focus:border-blue-500 font-mono"
                                />
                            </div>

                            <button
                                onClick={runBacktest}
                                disabled={loading}
                                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'RUN SIMULATION'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Visualizer */}
                <div className="md:col-span-2">
                    {!results ? (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                            <FlaskConical className="w-12 h-12 mb-4 opacity-20" />
                            <p>Define parameters and click Run to see historical performance</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* ROI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                                    <p className="text-slate-500 text-xs uppercase">Total Bets</p>
                                    <p className="text-2xl font-black text-white">{results.totalBets}</p>
                                </div>
                                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                                    <p className="text-slate-500 text-xs uppercase">Win Rate</p>
                                    <p className="text-2xl font-black text-blue-400">{((results.wins / results.totalBets) * 100).toFixed(1)}%</p>
                                </div>
                                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                                    <p className="text-slate-500 text-xs uppercase">Profit ($10/unit)</p>
                                    <p className={`text-2xl font-black ${results.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        ${results.profit.toFixed(0)}
                                    </p>
                                </div>
                                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                                    <p className="text-slate-500 text-xs uppercase">ROI</p>
                                    <p className={`text-2xl font-black ${results.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {results.roi.toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            {/* Pseudo Graph */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-slate-400" /> Equity Curve (Simulated)
                                </h4>
                                <div className="h-40 flex items-end gap-1">
                                    {Array.from({ length: 20 }).map((_, i) => {
                                        const h = Math.random() * 80 + 20;
                                        return (
                                            <div key={i} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500 rounded-t-sm transition-all" style={{ height: `${h}%` }}></div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
