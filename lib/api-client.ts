import { UPCOMING_DAYS, CACHE_DURATION_FIXTURES } from './config';
import { format, addDays } from 'date-fns';
import { fetchWithRetry } from './fetch-robust';

const API_KEY = process.env.API_FOOTBALL_KEY || "5ffa52153e4dbe8ee79e4b4bad4e532f";
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

    const res = await fetchWithRetry(url.toString(), {
        headers: {
            'x-rapidapi-key': API_KEY || '',
            'x-rapidapi-host': 'v3.football.api-sports.io'
        },
        next: {
            revalidate: options.revalidate ?? 3600, // Keep Next.js cache
            tags: options.tags
        }
    } as any); // Type cast for Next.js fetch options compatibility

    console.log(`[API RESPONSE] Status: ${res.status}`);

    if (!res.ok) {
        const text = await res.text();
        console.error(`[API ERROR] ${res.status} - ${text}`);
        // Handle common API errors gracefully
        if (res.status === 429) {
            console.warn("API Rate Limit Exceeded");
            throw new Error("RateLimitExceeded");
        }
        return null; // Return null instead of throwing to prevent fatal crashes
    }

    const data = await res.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
        console.error(`API Error for ${endpoint}:`, JSON.stringify(data.errors, null, 2));
        return null;
    }

    return data.response;
}

/**
 * Fetch real-time odds for a specific fixture and bookmaker (Default: Bet365 ID 1)
 */
export async function getMarketOdds(fixtureId: number, bookmakerId: number = 1) {
    try {
        const data = await fetchApi('odds', {
            fixture: fixtureId,
            bookmaker: bookmakerId
        });

        if (data && data.length > 0 && data[0].bookmakers) {
            const bets = data[0].bookmakers[0].bets;
            const matchWinner = bets.find((b: any) => b.name === "Match Winner" || b.id === 1);

            if (matchWinner) {
                const values = matchWinner.values;
                return {
                    home: parseFloat(values.find((v: any) => v.value === "Home")?.odd || "0"),
                    draw: parseFloat(values.find((v: any) => v.value === "Draw")?.odd || "0"),
                    away: parseFloat(values.find((v: any) => v.value === "Away")?.odd || "0"),
                    source: data[0].bookmakers[0].name
                };
            }
        }
        return null;
    } catch (error) {
        console.error(`Error fetching market odds for fixture ${fixtureId}:`, error);
        return null;
    }
}

/**
 * Discover the current active season for a league (Premium API-Football)
 */
export async function getCurrentSeason(leagueId: number): Promise<number> {
    try {
        const data = await fetchApi('leagues', { id: leagueId });

        if (data && data.length > 0 && data[0].seasons) {
            const seasons = data[0].seasons;
            // Find the one marked as 'current'
            const currentSeason = seasons.find((s: any) => s.current === true);

            if (currentSeason) {
                // Verify if it has statistics coverage
                const hasStats = currentSeason.coverage?.fixtures?.statistics_fixtures || false;
                if (!hasStats) {
                    console.warn(`[SEASON] Current season ${currentSeason.year} has no stats coverage yet. Falling back to previous.`);
                    return currentSeason.year - 1;
                }
                return currentSeason.year;
            }
        }
        return new Date().getFullYear(); // Absolute fallback
    } catch (error) {
        console.error(`Error discovering season for league ${leagueId}:`, error);
        return new Date().getFullYear();
    }
}

/**
 * Fetch detailed team statistics (Premium /teams/statistics endpoint)
 */
export async function getTeamStatsPremium(teamId: number, leagueId: number, season: number) {
    try {
        const data = await fetchApi('teams/statistics', {
            league: leagueId,
            season: season,
            team: teamId
        }, { revalidate: CACHE_DURATION_FIXTURES });

        if (!data) {
            throw new Error(`No statistics found for Team: ${teamId}, League: ${leagueId}, Season: ${season}`);
        }

        return data; // Returns the full object with goals.for.total.home, etc.
    } catch (error) {
        console.error(`Error fetching premium stats for team ${teamId}:`, error);
        throw error; // Rethrow to let caller handle critical data absence
    }
}

export async function getUpcomingFixtures(leagueIds: number[], forceEmptyRefresh: boolean = false): Promise<any[]> {
    const allFixtures: any[] = [];
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const nextWeek = format(addDays(now, UPCOMING_DAYS), 'yyyy-MM-dd');

    console.log(`[INTERNAL] Fetching fixtures from ${today} to ${nextWeek}`);

    console.log(`[API] Fetching fixtures from ${today} to ${nextWeek} for ${leagueIds.length} leagues`);

    for (const leagueId of leagueIds) {
        try {
            const params = {
                league: leagueId.toString(),
                season: (new Date().getFullYear()).toString(), // Try current year first
                from: today,
                to: nextWeek,
                timezone: 'America/Chicago'
            };

            const data = await fetchApi('fixtures', params, { revalidate: CACHE_DURATION_FIXTURES });

            if (Array.isArray(data) && data.length > 0) {
                allFixtures.push(...data);
                console.log(`[API SUCCESS] League ${leagueId}: Found ${data.length} upcoming matches`);
            } else {
                console.log(`[API EMPTY] League ${leagueId}: No matches found for period ${today} - ${nextWeek}`);
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

export async function getTopScorers(leagueId: number, season: number = 2025) {
    try {
        const data = await fetchApi('players/topscorers', {
            league: leagueId,
            season: season
        }, { revalidate: 86400 }); // Cache for 24 hours

        return data || [];
    } catch (error) {
        console.error(`Error fetching top scorers for league ${leagueId}:`, error);
        return [];
    }
}


export async function getLiveFixtures() {
    try {
        const data = await fetchApi('fixtures', {
            live: 'all',
            timezone: 'America/Chicago'
        }, { revalidate: 30 });

        return data || [];
    } catch (error) {
        console.error("Error fetching live fixtures:", error);
        return [];
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
