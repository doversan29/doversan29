'use client';

import { useState, useMemo } from 'react';
import { Wallet, ShieldAlert, TrendingUp, Info } from 'lucide-react';
import { calculateOptimalStake, RiskContext } from '@/lib/analysis/risk-management';

interface StakingProps {
    initialBankroll: number;
    probability: number;
    odds: number;
    confidence: number;
}

export default function StakingCard({ initialBankroll, probability, odds, confidence }: StakingProps) {
    const [customBankroll, setCustomBankroll] = useState(initialBankroll);

    // Mock context (In a real app, retrieve from user session/db)
    const riskContext: RiskContext = {
        confidence,
        winningStreak: 0,
        currentDrawdown: 0.02, // 2%
        kellyFraction: 0.25 // Quarter Kelly
    };

    const stakeResult = useMemo(() => {
        return calculateOptimalStake(customBankroll, odds, probability, riskContext);
    }, [customBankroll, odds, probability, confidence]);

    const isRisky = stakeResult.amount === 0;

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-4">
            <div className="bg-indigo-600/10 p-3 border-b border-indigo-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Gestión de Riesgo</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Banca Actual:</span>
                    <input
                        type="number"
                        value={customBankroll}
                        onChange={(e) => setCustomBankroll(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-indigo-400 font-bold outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            <div className="p-4">
                {isRisky ? (
                    <div className="flex items-center gap-3 bg-red-950/20 border border-red-900/50 p-3 rounded-lg">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        <div>
                            <p className="text-sm font-bold text-red-200">SIN VALOR DETECTADO</p>
                            <p className="text-[10px] text-red-400 uppercase">La cuota no compensa el riesgo estadístico.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Monto Sugerido</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-emerald-400">${stakeResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-xs text-slate-600 font-bold">MXN</span>
                            </div>
                        </div>

                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">% de Banca</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-white">{stakeResult.percentage.toFixed(2)}%</span>
                            </div>
                        </div>

                        <div className="col-span-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                            <div className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-emerald-500" />
                                <span>Edge Detectado: <span className="text-slate-200 font-bold">{stakeResult.edge.toFixed(1)}%</span></span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Info className="w-3 h-3 text-indigo-400" />
                                <span title="Kelly Fraccional (0.25) aplicado con límites de seguridad">Modo: Conservador (v2.1)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
