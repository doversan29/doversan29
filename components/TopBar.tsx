'use client';

import { Search, Bell, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TopBar() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = async (val: string) => {
        setQuery(val);
        if (val.length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsOpen(true);
        setIsSearching(true);

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.teams || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    const selectTeam = (teamId: number) => {
        router.push(`/team/${teamId}`);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
            <div ref={wrapperRef} className="relative w-96">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Buscar equipos..."
                        className="w-full bg-slate-800 border-none rounded-full pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                {/* Search Results Dropdown */}
                {isOpen && (
                    <div className="absolute top-full mt-2 left-0 w-full bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden max-h-96 overflow-y-auto">
                        {isSearching ? (
                            <div className="p-4 text-center text-xs text-slate-500">Buscando...</div>
                        ) : results.length > 0 ? (
                            <ul className="py-2">
                                {results.map((item: any) => (
                                    <li key={item.team.id}>
                                        <button
                                            onClick={() => selectTeam(item.team.id)}
                                            className="w-full px-4 py-2 hover:bg-slate-700 flex items-center gap-3 text-left transition-colors"
                                        >
                                            <img src={item.team.logo} alt={item.team.name} className="w-6 h-6 object-contain" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-200">{item.team.name}</p>
                                                <p className="text-xs text-slate-500">{item.team.country}</p>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 text-center text-xs text-slate-500">No se encontraron equipos</div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <button className="p-2 rounded-full hover:bg-slate-800 text-slate-400 transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    U
                </div>
            </div>
        </header>
    );
}
