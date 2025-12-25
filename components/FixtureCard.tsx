'use client';

import { motion } from 'framer-motion';
import { format, differenceInHours, differenceInMinutes, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Share2, BarChart2, Gem } from 'lucide-react';

import Link from 'next/link';

interface FixtureCardProps {
    fixture: any;
    index: number;
    hasValue?: boolean;
    recommendedBet?: string;
}

export default function FixtureCard({ fixture, index, hasValue, recommendedBet }: FixtureCardProps) {

    const matchDate = new Date(fixture.fixture.date);
    const now = new Date();

    // Custom countdown logic or use date-fns
    const hoursAway = differenceInHours(matchDate, now);
    const minutesAway = differenceInMinutes(matchDate, now) % 60;

    let timeStatus = '';
    if (hoursAway > 24) {
        const days = Math.floor(hoursAway / 24);
        timeStatus = `⏰ ${days}d ${hoursAway % 24}h`;
    } else if (hoursAway > 0) {
        timeStatus = `⏰ ${hoursAway}h ${minutesAway}m`;
    } else if (minutesAway > 0) {
        timeStatus = `⏰ ${minutesAway}m`;
    } else {
        timeStatus = '🔴 LIVE';
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative"
        >
            <Link href={`/fixture/${fixture.fixture.id}`} className="block h-full">
                {/* Hover Glow Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500 group-hover:duration-200"></div>

                <div className="relative glass-card rounded-2xl p-5 h-full transition-transform duration-300 group-hover:-translate-y-1 flex flex-col justify-between">
                    {/* Header: Date + Status */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-xl filter drop-shadow-md">{fixture._flag || '🏴'}</span>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{fixture.league.name}</p>
                                <p className={`text-xs font-mono font-medium ${timeStatus.includes('LIVE') ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                                    {timeStatus}
                                </p>
                            </div>
                        </div>

                        {timeStatus.includes('LIVE') && (
                            <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                        )}
                        {!timeStatus.includes('LIVE') && hasValue && (
                            <div className="flex items-center gap-1 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg shadow-blue-500/30 animate-pulse">
                                <Gem className="w-3 h-3" /> VALUE
                            </div>
                        )}
                    </div>

                    {/* Teams */}

                    <div className="space-y-4 mb-4">
                        <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform">
                            <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors truncate pr-2">
                                {fixture.teams.home.name}
                            </span>
                            {fixture.goals.home !== null && (
                                <span className="text-2xl font-black text-white text-shadow">{fixture.goals.home}</span>
                            )}
                        </div>

                        <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform delay-75">
                            <span className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors truncate pr-2">
                                {fixture.teams.away.name}
                            </span>
                            {fixture.goals.away !== null && (
                                <span className="text-2xl font-black text-white text-shadow">{fixture.goals.away}</span>
                            )}
                        </div>
                    </div>

                    {/* Footer / CTA */}
                    <div className="pt-4 border-t border-slate-700/30 flex justify-between items-center">
                        <div className="flex -space-x-2">
                            {/* Fake avatars for social proof effect */}
                            <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-800"></div>
                            <div className="w-6 h-6 rounded-full bg-slate-600 border border-slate-800"></div>
                            <div className="w-6 h-6 rounded-full bg-slate-500 border border-slate-800 flex items-center justify-center text-[8px] text-white font-bold">+52</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-blue-400 font-bold opacity-80 group-hover:opacity-100 group-hover:gap-2 transition-all">
                            PREDICCIÓN <BarChart2 className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
