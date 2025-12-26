'use client';

import { useState } from 'react';
import { Save, CheckCircle, AlertCircle, TrendingUp, Calculator } from 'lucide-react';
import { saveUserSelection } from '@/app/actions/save-bet';

interface StrategyProps {
    fixtureId: number;
    homeName: string;
    awayName: string;
    prediction: {
        homeProb: number;
        awayProb: number;
        expectedGoals: number;
    };
    recommendedBet: string;
}

export default function BettingStrategyCard({ fixtureId, homeName, awayName, prediction, recommendedBet }: StrategyProps) {
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    // Default Odds (Simulated)
    const [odds, setOdds] = useState({
        winner: 1.75,
        goals: 1.85,
        corners: 1.50,
        parlay: 4.85 // 1.75 * 1.85 * 1.50 approx
    });

    const [selected, setSelected] = useState({
        winner: false,
        goals: false,
        corners: false,
        parlay: false
    });

    // Dynamic Labels based on prediction
    const winnerLabel = prediction.homeProb > prediction.awayProb ? `Winner: ${homeName}` : `Winner: ${awayName}`;
    const goalsLabel = prediction.expectedGoals > 2.6 ? "Goals: Over 2.5" : "Goals: Under 2.5";
    const cornersLabel = "Corners: Over 9.5"; // Placeholder

    const handleSave = async () => {
        setLoading(true);

        const selections = [];
        if (selected.parlay) {
            selections.push({ type: 'PARLAY' as const, label: 'Combined', odds: odds.parlay });
        } else {
            if (selected.winner) selections.push({ type: 'MONEYLINE' as const, label: winnerLabel, odds: odds.winner });
            if (selected.goals) selections.push({ type: 'GOALS' as const, label: goalsLabel, odds: odds.goals });
            if (selected.corners) selections.push({ type: 'CORNERS' as const, label: cornersLabel, odds: odds.corners });
        }

        if (selections.length === 0) {
            alert("Selecciona al menos una opción");
            setLoading(false);
            return;
        }

        const result = await saveUserSelection({
            fixtureId,
            homeTeam: homeName,
            awayTeam: awayName,
            selections
        });

        if (result.success) {
            setSaved(true);
        } else {
            alert(result.message);
        }
        setLoading(false);
    };

    const toggle = (key: keyof typeof selected) => {
        if (key === 'parlay') {
            // Exclusive logic: Parlay unchecks others
            setSelected({ winner: false, goals: false, corners: false, parlay: !selected.parlay });
        } else {
            // Individual check unchecks Parlay
            setSelected({ ...selected, parlay: false, [key]: !selected[key] });
        }
    };

    return (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="bg-indigo-950/50 p-4 border-b border-indigo-500/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-500 p-1.5 rounded text-white">
                        <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Estrategia Recomendada</h3>
                        <p className="text-xs text-indigo-300">{homeName} vs {awayName}</p>
                    </div>
                </div>
                {saved && <span className="text-emerald-400 text-xs flex items-center gap-1 font-bold"><CheckCircle className="w-3 h-3" /> GUARDADO</span>}
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">

                {/* Row 1: Winner */}
                <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected.winner ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selected.winner}
                            onChange={() => toggle('winner')}
                            className="w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <label className="text-sm font-medium text-slate-200 cursor-pointer" onClick={() => toggle('winner')}>
                            {winnerLabel}
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Odds</span>
                        <input
                            type="number"
                            value={odds.winner}
                            onChange={(e) => setOdds({ ...odds, winner: parseFloat(e.target.value) })}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white focus:border-indigo-500 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Row 2: Goals */}
                <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected.goals ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selected.goals}
                            onChange={() => toggle('goals')}
                            className="w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <label className="text-sm font-medium text-slate-200 cursor-pointer" onClick={() => toggle('goals')}>
                            {goalsLabel}
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Odds</span>
                        <input
                            type="number"
                            value={odds.goals}
                            onChange={(e) => setOdds({ ...odds, goals: parseFloat(e.target.value) })}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white focus:border-indigo-500 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Row 3: Corners */}
                <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected.corners ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selected.corners}
                            onChange={() => toggle('corners')}
                            className="w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <label className="text-sm font-medium text-slate-200 cursor-pointer" onClick={() => toggle('corners')}>
                            {cornersLabel}
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Odds</span>
                        <input
                            type="number"
                            value={odds.corners}
                            onChange={(e) => setOdds({ ...odds, corners: parseFloat(e.target.value) })}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-center text-white focus:border-indigo-500 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Divider & Parlay */}
                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase tracking-widest">Combinada</span>
                    </div>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${selected.parlay ? 'bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-950 border-dashed border-slate-700'}`}>
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={selected.parlay}
                            onChange={() => toggle('parlay')}
                            className="w-5 h-5 rounded-full border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                        />
                        <div onClick={() => toggle('parlay')} className="cursor-pointer">
                            <label className="text-sm font-bold text-white block">
                                🚀 PARLAY / COMBINADA
                            </label>
                            <p className="text-[10px] text-indigo-300">Apuesta a todo lo anterior</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Total</span>
                        <input
                            type="number"
                            value={odds.parlay}
                            onChange={(e) => setOdds({ ...odds, parlay: parseFloat(e.target.value) })}
                            className="w-16 bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-xs text-center text-emerald-400 font-bold focus:border-indigo-500 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleSave}
                    disabled={loading || saved}
                    className={`w-full py-3 rounded-lg font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2
                        ${saved
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/20'
                        }
                    `}
                >
                    {loading ? (
                        <>Guardando...</>
                    ) : saved ? (
                        <>
                            <CheckCircle className="w-5 h-5" /> Jugada Guardada
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" /> GUARDAR JUGADA
                        </>
                    )}
                </button>

            </div>
        </div>
    );
}
