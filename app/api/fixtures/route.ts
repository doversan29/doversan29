import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingFixtures } from '@/lib/api-client';
import { TOP_LEAGUES } from '@/lib/config';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const leagueId = searchParams.get('league');

        let leaguesToFetch = TOP_LEAGUES.map(l => l.id);
        if (leagueId) {
            leaguesToFetch = [parseInt(leagueId)];
        }

        const fixtures = await getUpcomingFixtures(leaguesToFetch);

        return NextResponse.json({
            count: fixtures.length,
            fixtures: fixtures
        });
    } catch (error: any) {
        console.error("API Route Error (/api/fixtures):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
