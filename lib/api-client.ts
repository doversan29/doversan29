import { UPCOMING_DAYS, CACHE_DURATION_FIXTURES } from './config';
import fs from 'fs';
import path from 'path';
import { format, addDays } from 'date-fns';

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const CACHE_DIR = path.join(process.cwd(), 'data', 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

if (!API_KEY) {
    console.error("API_FOOTBALL_KEY is not set in environment variables");
} else {
    // console.log("API Key loaded:", API_KEY.substring(0, 5) + "...");
}

type Fixture = any; // We'll refine types as we go

interface ApiOptions {
    revalidate?: number;
    tags?: string[];
    forceRefresh?: boolean;
}

// Helper to get/set cache
function getFromCache(key: string): any | null {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
        try {
            const stats = fs.statSync(filePath);
            const now = new Date().getTime();
            const age = (now - stats.mtimeMs) / 1000;

            if (age < CACHE_DURATION_FIXTURES) {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (e) {
            console.warn(`Failed to read cache for ${key}`, e);
        }
    }
    return null;
}

function saveToCache(key: string, data: any) {
    try {
        const filePath = path.join(CACHE_DIR, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn(`Failed to save cache for ${key}`, e);
    }
}

export async function fetchApi(endpoint: string, params: Record<string, any> = {}, options: ApiOptions = {}) {
    // Generate cache key based on params
    const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, val]) => `${key}-${val}`)
        .join('_');
    const cacheKey = `${endpoint}_${paramString}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check FS Cache
    if (!options.forceRefresh) {
        const cached = getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
    }

    const url = new URL(`${BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, String(params[key]));
        }
    });

    const res = await fetch(url.toString(), {
        headers: {
            'x-rapidapi-key': API_KEY || '',
            'x-rapidapi-host': 'v3.football.api-sports.io'
        },
        next: {
            revalidate: options.revalidate ?? 3600, // Keep Next.js cache as backup
            tags: options.tags
        }
    });

    if (!res.ok) {
        // Handle common API errors gracefully
        if (res.status === 429) {
            throw new Error("RateLimitExceeded");
        }
        throw new Error(`API Error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`API Error for ${endpoint}:`, JSON.stringify(data.errors, null, 2));
        // Throwing error to be caught by caller
        throw new Error(JSON.stringify(data.errors));
    }

    // Save to FS Cache only if successful response
    if (data.response) {
        saveToCache(cacheKey, data.response);
    }

    return data.response;
}

export async function getUpcomingFixtures(leagueIds: number[]): Promise<any[]> {
    const allFixtures: any[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');
    const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

    console.log(`[API] Fetching fixtures from ${today} to ${nextWeek} for ${leagueIds.length} leagues`);

    for (const leagueId of leagueIds) {
        try {
            const params = {
                league: leagueId.toString(),
                season: new Date().getFullYear().toString(),
                from: today,
                to: nextWeek,
                timezone: 'America/Chicago'
            };

            const data = await fetchApi('fixtures', params, { revalidate: CACHE_DURATION_FIXTURES });

            if (Array.isArray(data) && data.length > 0) {
                allFixtures.push(...data);
                console.log(`[API] League ${leagueId}: ${data.length} fixtures found`);
            }

            // Rate limiting: small pause between requests
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
            if (error.message !== "RateLimitExceeded") {
                console.error(`Error fetching fixtures for league ${leagueId}:`, error);
            }
        }
    }

    return allFixtures;
}

export async function getFixtureById(id: number) {
    try {
        const fixtures = await fetchApi('fixtures', {
            id: id,
            timezone: 'America/Chicago'
        }, { revalidate: CACHE_DURATION_FIXTURES });

        return fixtures && fixtures.length > 0 ? fixtures[0] : null;
    } catch (error) {
        console.error(`Error fetching fixture ${id}:`, error);
        return null;
    }
}

export async function getLeagueStandings(leagueId: number, season: number = 2025) {
    try {
        const data = await fetchApi('standings', {
            league: leagueId,
            season: season
        }, { revalidate: CACHE_DURATION_FIXTURES });

        if (data && data.length > 0 && data[0].league && data[0].league.standings) {
            // Standings are often a 2D array (groups), we usually want the first group/table
            return data[0].league.standings[0];
        }
        return [];
    } catch (error) {
        console.error(`Error fetching standings for league ${leagueId}:`, error);
        return [];
    }
}

export async function searchTeams(query: string) {
    if (query.length < 3) return [];

    return fetchApi('teams', {
        search: query
    }, { revalidate: 86400 }); // Cache search results for 24h
}

export async function getLeagueHistory(leagueId: number, season: number = 2025) {
    // Fetch ALL finished matches for the league to calculate form manually
    // This bypasses the restricted 'last=5' endpoint
    const currentSeason = new Date().getFullYear();
    const seasonToFetch = season || currentSeason;

    try {
        const fixtures = await fetchApi('fixtures', {
            league: leagueId,
            season: seasonToFetch,
            status: 'FT', // Finished matches only
            timezone: 'America/Chicago'
        }, { revalidate: CACHE_DURATION_FIXTURES }); // Cache for 1 hour

        return fixtures || [];
    } catch (error) {
        console.error(`Error fetching history for league ${leagueId}:`, error);
        return [];
    }
}

export async function getTeamFixtures(teamId: number, next: number = 5) {
    try {
        const fixtures = await fetchApi('fixtures', {
            team: teamId,
            next: next,
            timezone: 'America/Chicago'
        }, { revalidate: CACHE_DURATION_FIXTURES });

        return fixtures || [];
    } catch (error) {
        console.error(`Error fetching fixtures for team ${teamId}:`, error);
        return [];
    }
}

export async function getTeamDetails(teamId: number) {
    try {
        const data = await fetchApi('teams', {
            id: teamId
        }, { revalidate: 86400 * 7 }); // Cache strictly for a week

        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error(`Error fetching team details ${teamId}:`, error);
        return null;
    }
}

export async function getOddsByDate(date: string) {
    try {
        const data = await fetchApi('odds', {
            date: date
        }, { revalidate: CACHE_DURATION_FIXTURES });

        return data || [];
    } catch (error) {
        console.error(`Error fetching odds for date ${date}:`, error);
        return [];
    }
}
