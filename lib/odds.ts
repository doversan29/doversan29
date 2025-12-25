import { fetchApi } from './api-client';

export interface MatchOdds {
    home: number;
    draw: number;
    away: number;
    bookmaker: string;
}

export async function getMatchOdds(fixtureId: number): Promise<MatchOdds | null> {
    try {
        const data = await fetchApi('odds', { fixture: fixtureId });

        if (!data || data.length === 0 || !data[0].bookmakers || data[0].bookmakers.length === 0) {
            return null;
        }

        // Get the first available bookmaker (usually standard ones like Bet365)
        const bookmaker = data[0].bookmakers[0];
        const bets = bookmaker.bets;

        // ID 1 is usually "Match Winner" (Home, Draw, Away)
        const matchWinnerBet = bets.find((b: any) => b.id === 1);

        if (!matchWinnerBet) {
            return null;
        }

        const values = matchWinnerBet.values;
        const home = values.find((v: any) => v.value === 'Home')?.odd;
        const draw = values.find((v: any) => v.value === 'Draw')?.odd;
        const away = values.find((v: any) => v.value === 'Away')?.odd;

        if (!home || !draw || !away) {
            return null;
        }

        return {
            home: parseFloat(home),
            draw: parseFloat(draw),
            away: parseFloat(away),
            bookmaker: bookmaker.name
        };

    } catch (e) {
        console.error(`Failed to fetch odds for fixture ${fixtureId}`, e);
        return null;
    }
}
