import { NextRequest, NextResponse } from 'next/server';
import { searchTeams } from '@/lib/api-client';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    try {
        const teams = await searchTeams(query);
        return NextResponse.json({ teams });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to search teams' }, { status: 500 });
    }
}
