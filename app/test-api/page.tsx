import { getUpcomingFixtures, fetchApi } from "@/lib/api-client";
import { TOP_LEAGUES } from "@/lib/config";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TestApiPage() {
    const apiKey = process.env.API_FOOTBALL_KEY || "5ffa52153e4dbe8ee79e4b4bad4e532f"; // Fallback also here for diagnostic
    const isKeySet = !!apiKey;
    const maskedKey = apiKey ? `${apiKey.substring(0, 5)}...` : 'MISSING';

    const today = new Date().toISOString().split('T')[0];
    const leagueId = 39; // Premier League

    // OVERRIDE FOR TEST
    const headers = {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io'
    };

    let apiResponse = null;
    let error = null;
    let upcoming = null;

    try {
        // 1. Test Raw API Call
        const params = {
            league: leagueId,
            season: 2025,
            from: today,
            to: '2025-12-31',
            timezone: 'America/Chicago'
        };

        // We can't access private function fetchApi if it's not exported, 
        // but I think I exported it. Let's check api-client.ts. 
        // Yes, fetchApi is exported.
        // 1. Test Raw API Call (Manual Fetch to bypass api-client env check)
        const urlRaw = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=2025&from=${today}&to=2025-12-31&timezone=America/Chicago`;
        const res = await fetch(urlRaw, { headers, cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}: ${res.statusText}`);
        const dataRaw = await res.json();
        apiResponse = dataRaw.response;

        // 2. Test Helper Function
        upcoming = await getUpcomingFixtures([39]);

    } catch (e: any) {
        error = e.message || JSON.stringify(e);
    }

    return (
        <div className="p-8 font-mono text-sm bg-slate-900 text-slate-200 min-h-screen">
            <h1 className="text-2xl font-bold mb-4 text-white">API Diagnostics</h1>

            <div className="space-y-6">
                <div className="p-4 rounded bg-slate-800 border border-slate-700">
                    <h2 className="text-blue-400 font-bold mb-2">Environment</h2>
                    <p>Node Env: {process.env.NODE_ENV}</p>
                    <p>API Key Configured: <span className={isKeySet ? "text-green-400" : "text-red-400"}>{isKeySet ? 'YES' : 'NO'}</span></p>
                    <p>Key Prefix: {maskedKey}</p>
                    <p>Date Used: {today}</p>

                    <div className="mt-4 border-t border-slate-700 pt-2">
                        <p className="text-xs text-slate-400 mb-1">Available Keys (Safe List):</p>
                        <div className="text-xs font-mono text-slate-500 break-all">
                            {Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')).join(', ')}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Does 'API_FOOTBALL_KEY' exist in raw process.env?</p>
                        <p className="text-yellow-400">{Object.keys(process.env).includes('API_FOOTBALL_KEY') ? 'YES' : 'NO'}</p>
                    </div>
                </div>

                <div className="p-4 rounded bg-slate-800 border border-slate-700">
                    <h2 className="text-blue-400 font-bold mb-2">Raw API Test (Premier League)</h2>
                    {error ? (
                        <p className="text-red-400">Error: {error}</p>
                    ) : (
                        <>
                            <p>Fixtures Found: {Array.isArray(apiResponse) ? apiResponse.length : 'Not Array'}</p>
                            <pre className="mt-2 p-2 bg-black rounded overflow-auto max-h-60 text-xs">
                                {JSON.stringify(apiResponse?.slice(0, 2), null, 2)}
                            </pre>
                        </>
                    )}
                </div>

                <div className="p-4 rounded bg-slate-800 border border-slate-700">
                    <h2 className="text-blue-400 font-bold mb-2">Helper Function Test (getUpcomingFixtures)</h2>
                    <p>Total Fixtures Found: {Array.isArray(upcoming) ? upcoming.length : 'Not Array'}</p>
                </div>
            </div>
        </div>
    );
}
