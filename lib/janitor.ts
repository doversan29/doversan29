
import { db } from './db/client';
import { matchAnalysis } from './db/schema';
import { lt, sql } from 'drizzle-orm';

/**
 * DATABASE JANITOR (v2.5)
 * 
 * Objective: Keep the database lightweight by cleaning old data.
 */

export async function cleanOldData() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        console.log(`[JANITOR] Cleaning match_analysis rows older than ${sevenDaysAgo.toISOString()}`);

        const result = await db.delete(matchAnalysis)
            .where(lt(matchAnalysis.matchDate, sevenDaysAgo));

        // Note: bet_outcome is NOT deleted as it contains ROI history.

        console.log(`[JANITOR] Cleanup complete.`);
        return { success: true, timestamp: new Date() };
    } catch (error) {
        console.error(`[JANITOR ERROR] Failed to clean old data:`, error);
        return { success: false, error };
    }
}
