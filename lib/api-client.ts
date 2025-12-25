import { UPCOMING_DAYS, CACHE_DURATION_FIXTURES } from './config';
import { format, addDays } from 'date-fns';

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

if (!API_KEY) {
    console.error("API_FOOTBALL_KEY is not set in environment variables");
}

type Fixture = any; // We'll refine types as we go

interface ApiOptions {
    revalidate?: number;
    tags?: string[];
    forceRefresh?: boolean;
}

export async function fetchApi(endpoint: string, params: Record<string, any> = {}, options: ApiOptions = {}) {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, String(params[key]));
        }
    });

    console.log(`[API REQUEST] ${url.toString()} (Key: ${API_KEY ? 'Set' : 'Missing'})`);

    const res = await fetch(url.toString(), {
        headers: {
            'x-rapidapi-key': API_KEY || '',
            'x-rapidapi-host': 'v3.football.api-sports.io'
        },
        next: {
            revalidate: options.revalidate ?? 3600, // Keep Next.js cache
            tags: options.tags
        }
    });

    console.log(`[API RESPONSE] Status: ${res.status}`);

    if (!res.ok) {
        const text = await res.text();
        console.error(`[API ERROR] ${res.status} - ${text}`);
        // Handle common API errors gracefully
        if (res.status === 429) {
            console.warn("API Rate Limit Exceeded");
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
