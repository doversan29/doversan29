import { NextRequest, NextResponse } from 'next/server';
import { getBankrollStats, addBet, updateBetStatus } from '@/lib/bankroll';

export async function GET() {
    const stats = await getBankrollStats();
    return NextResponse.json(stats);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const bet = await addBet(body);
    return NextResponse.json(bet);
}

export async function PATCH(req: NextRequest) {
    const body = await req.json();
    await updateBetStatus(body.id, body.status);
    return NextResponse.json({ success: true });
}
