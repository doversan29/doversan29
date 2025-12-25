'use client';

import { useState, useEffect } from 'react';
import { Calculator, CheckCircle, XCircle } from 'lucide-react';

interface ValueBetCalculatorProps {
    winProb: number;
    drawProb: number;
    lossProb: number;
    homeName: string;
    awayName: string;
    initialOdds?: {
        home: number;
        draw: number;
        away: number;
        bookmaker: string;
    } | null;
}

export default function ValueBetCalculator({
    winProb,
    drawProb,
    lossProb,
    homeName,
    awayName,
    initialOdds
}: ValueBetCalculatorProps) {

    const [selectedOption, setSelectedOption] = useState<'HOME' | 'DRAW' | 'AWAY'>('HOME');
    const [odds, setOdds] = useState<string>(
        initialOdds ? initialOdds.home.toString() : '2.00'
    );

    // Auto-update odds when selection changes if we have real data
    useEffect(() => {
        if (initialOdds) {
            if (selectedOption === 'HOME') setOdds(initialOdds.home.toString());
            if (selectedOption === 'DRAW') setOdds(initialOdds.draw.toString());
            if (selectedOption === 'AWAY') setOdds(initialOdds.away.toString());
        }
    }, [selectedOption, initialOdds]);

    // Calculate Edge
    const getMyProb = () => {
        if (selectedOption === 'HOME') return winProb;
        if (selectedOption === 'DRAW') return drawProb;
        return lossProb;
    };

    const myProb = getMyProb();
    const impliedProb = odds ? (1 / parseFloat(odds)) * 100 : 0;
    const edge = odds ? (parseFloat(odds) * (myProb / 100)) - 1 : -1;
    const ev = edge * 100;

    // Value is positive if Edge > 0
    const isValue = edge > 0;

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-500" />
                    <h3 className="font-bold text-lg text-slate-200">Calculadora de Valor</h3>
                </div>
                {initialOdds && (
                    <span className="text-xs text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        Odds by {initialOdds.bookmaker}
                    </span>
                )}
            </div>

            <div className="space-y-6">
                {/* Selection Toggles */}
                <div className="flex bg-slate-950 p-1 rounded-lg">
                    <button
                        onClick={() => setSelectedOption('HOME')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${selectedOption === 'HOME' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}
                    >
                        LOCAL
                    </button>
                    <button
                        onClick={() => setSelectedOption('DRAW')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${selectedOption === 'DRAW' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
                    >
                        EMPATE
                    </button>
                    <button
                        onClick={() => setSelectedOption('AWAY')}
                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${selectedOption === 'AWAY' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}
                    >
                        VISITA
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Probabilidad IA</label>
                        <div className="text-xl font-bold text-white">{myProb}%</div>
                        <div className="text-xs text-slate-600">Cuota Justa: {(100 / myProb).toFixed(2)}</div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Cuota Casa de Apuestas</label>
                        <input
                            type="number"
                            value={odds}
                            onChange={(e) => setOdds(e.target.value)}
                            step="0.01"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1 text-white font-mono focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* Result */}
                <div className={`col-span-2 p-4 rounded-lg flex items-center justify-between border ${isValue ? 'bg-emerald-900/20 border-emerald-900/50' : 'bg-red-900/10 border-red-900/30'}`}>
                    <div>
                        <p className={`font-bold ${isValue ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isValue ? 'VALOR ENCONTRADO' : 'SIN VALOR'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Valor Esperado (EV): <span className={isValue ? 'text-emerald-400' : 'text-red-400'}>{ev > 0 ? '+' : ''}{ev.toFixed(1)}%</span>
                        </p>
                    </div>
                    {isValue ? <CheckCircle className="w-8 h-8 text-emerald-500" /> : <XCircle className="w-8 h-8 text-red-500" />}
                </div>
            </div>
        </div>
    );
}

