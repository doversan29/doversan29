'use server';

import { db } from '@/lib/db/client';
import { matchAnalysis, betOutcome, NewBetOutcome } from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

export interface BetSelection {
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    selections: {
        type: 'MONEYLINE' | 'GOALS' | 'CORNERS' | 'PARLAY';
        label: string;
        odds: number;
    }[];
}

export async function saveUserSelection(data: BetSelection) {
    try {
        console.log('Saving bet selection:', data);

        // 1. Find or Create Match Analysis Record (simplified for this demo, usually exists)
        // We assume analysis exists because the page loaded. 
        // We need the ID from match_analysis table.
        // For now, let's look it up by fixture_id
        const analysis = await db.select().from(matchAnalysis).where(eq(matchAnalysis.fixtureId, data.fixtureId)).limit(1);

        if (!analysis.length) {
            // In a real app we might create it here, but for now throw
            console.error('Analysis not found for fixture', data.fixtureId);
            return { success: false, message: 'Analysis not found' };
        }

        const analysisId = analysis[0].id;

        // 2. Insert Outcomes
        const records: NewBetOutcome[] = data.selections.map(sel => ({
            analysisId,
            status: 'pending',
            stakeAmount: 10, // Default unit
            oddsRecommended: sel.odds, // Mapping to existing column
            selectedOdds: sel.odds, // New column
            betType: sel.type, // New column
            // We could store the specific label in 'actualResult' or a new 'notes' column if needed
        }));

        await db.insert(betOutcome).values(records);

        revalidatePath(`/fixture/${data.fixtureId}`);
        return { success: true, message: 'Jugada guardada correctamente' };
    } catch (error) {
        console.error('Error saving bet:', error);
        return { success: false, message: 'Error al guardar jugada' };
    }
}
