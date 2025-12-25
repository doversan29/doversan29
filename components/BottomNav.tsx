"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Wallet, TrendingUp } from "lucide-react";

export function BottomNav() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 pb-safe md:hidden">
            <div className="flex justify-around items-center h-16 px-2">
                <Link
                    href="/"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/') ? 'text-blue-400' : 'text-slate-500'}`}
                >
                    <Home size={20} />
                    <span className="text-[10px] font-medium">Inicio</span>
                </Link>

                {/* Placeholder for Search - could go to a search page or focus input */}
                <Link
                    href="/value-bets"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/value-bets') ? 'text-blue-400' : 'text-slate-500'}`}
                >
                    <TrendingUp size={20} />
                    <span className="text-[10px] font-medium">Value</span>
                </Link>

                <Link
                    href="/parlay"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/parlay') ? 'text-blue-400' : 'text-slate-500'}`}
                >
                    {/* Custom Icon for Parlay if needed, or just standard */}
                    <div className="bg-blue-600 rounded-full p-2 mb-3 shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400">
                        <span className="text-white font-bold text-xs">🚀</span>
                    </div>
                    {/* Absolute positioning makes the center button float */}
                </Link>

                <Link
                    href="/dashboard"
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive('/dashboard') ? 'text-blue-400' : 'text-slate-500'}`}
                >
                    <Wallet size={20} />
                    <span className="text-[10px] font-medium">Bankroll</span>
                </Link>

                {/* More Menu could go here */}
            </div>
        </div>
    );
}
