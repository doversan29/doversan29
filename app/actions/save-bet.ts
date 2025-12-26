'use server';

import { db } from '@/lib/db/client';
import { matchAnalysis, betOutcome, NewBetOutcome, NewMatchAnalysis } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

export interface BetSelection {
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    leagueName?: string;
    matchDate?: string;
    prediction?: {
        outcome: string;
        probability: number;
        xgHome: number;
        xgAway: number;
    };
    selections: {
        type: 'MONEYLINE' | 'GOALS' | 'CORNERS' | 'PARLAY';
        label: string;
        odds: number;
    }[];
}

export async function saveUserSelection(data: BetSelection) {
    try {
        const tables = await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
        const tableList = (tables as any).map((t: any) => t.table_name).join(', ');
        throw new Error(`DEBUG_PROBE: Tables: [${tableList}]`);

        console.log('Saving bet selection (v3.6):', data);

        // 1. Find or Auto-Create Match Analysis Record
        let analysis = await db.select({ id: matchAnalysis.id })
            .from(matchAnalysis)
            .where(eq(matchAnalysis.fixtureId, data.fixtureId))
            .limit(1);

        let analysisId: number;

        if (!analysis.length) {
            console.log('Analysis not found, creating record on-the-fly for fixture', data.fixtureId);

            const newAnalysis: NewMatchAnalysis = {
                fixtureId: data.fixtureId,
                homeTeam: data.homeTeam,
                awayTeam: data.awayTeam,
                leagueName: data.leagueName || 'Unknown League',
                matchDate: data.matchDate ? new Date(data.matchDate) : new Date(),
                predictedOutcome: data.prediction?.outcome || 'UNKNOWN',
                aiProbability: data.prediction?.probability || 0,
                expectedGoalsHome: data.prediction?.xgHome || 0,
                expectedGoalsAway: data.prediction?.xgAway || 0,
                // strategyUsed: 'user_interactive_v3.6' // Removed for compatibility
            } as any;

            const inserted = await db.insert(matchAnalysis).values(newAnalysis).returning({ id: matchAnalysis.id });
            analysisId = inserted[0].id;
        } else {
            analysisId = analysis[0].id;
        }

        // 2. Insert Outcomes
        const records: NewBetOutcome[] = data.selections.map(sel => ({
            analysisId,
            status: 'pending',
            stakeAmount: 10, // Default unit
            oddsRecommended: sel.odds,
            selectedOdds: sel.odds,
            betType: sel.type,
        }));

        await db.insert(betOutcome).values(records);

        revalidatePath(`/fixture/${data.fixtureId}`);
        revalidatePath('/dashboard');
        return { success: true, message: 'Jugada guardada correctamente' };
    } catch (error) {
        console.error('CRITICAL ERROR saving bet:', error);
        return { success: false, message: `Error al guardar jugada (v3.6): ${error instanceof Error ? error.message : String(error)}` };
    }
}
