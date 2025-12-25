
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { matchAnalysis, betOutcome } from '@/lib/db/schema';
import { getMatchOdds } from '@/lib/odds'; // We need a way to fetch odds for specific fixture
import { eq, and, gt, lt, isNotNull } from 'drizzle-orm';

/**
 * CRON JOB: CLV TRACKER (v2.1)
 * 
 * Runs hourly.
 * 1. Checks matches starting soon (e.g. within 1 hour).
 * 2. Fetches current "Closing" odds.
 * 3. Updates `bet_outcome.oddsClosing` and calculates `clvPercentage`.
 * 
 * CLV Formula: (Recommended Odds / Closing Odds) - 1
 * Positive CLV = Beating the market.
 */

export async function GET(request: NextRequest) {
    console.log('[Cron] Starting CLV Tracking...');
    let processed = 0;

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // 1. Find active predictions for matches starting soon (or recently started)
    // We look at `match_analysis` because that's where we stored `oddsRecommended`.
    // We join with `bet_outcome` if it exists, or create it?
    // CLV is property of the RECOMMENDATION/BET, not just the analysis.
    // Ideally we update `match_analysis` or `bet_outcome`.
    // Schema says `bet_outcome` has `oddsClosing`.
    // But `bet_outcome` is usually created when a user places a bet OR when we settle a system pick.
    // For "System CLV", we might want to store it in `bet_outcome` even if no user took it, 
    // treating it as a "Paper Bet".

    // For now, let's look for matchAnalysis records that are starting soon.
    const upcomingMatches = await db.select()
        .from(matchAnalysis)
        .where(and(
            gt(matchAnalysis.matchDate, now),
            lt(matchAnalysis.matchDate, oneHourFromNow)
        ));

    console.log(`[Cron] Checking Closing Lines for ${upcomingMatches.length} imminent matches...`);

    for (const match of upcomingMatches) {
        // Fetch real odds 
        const odds = await getMatchOdds(match.fixtureId);

        if (!odds) {
            console.log(`[Cron] No odds found for fixture ${match.fixtureId}`);
            continue;
        }

        // Determine which side we picked
        let closingPrice = 0;
        if (match.predictedOutcome === 'HOME') closingPrice = odds.home;
        else if (match.predictedOutcome === 'AWAY') closingPrice = odds.away;
        else if (match.predictedOutcome === 'DRAW') closingPrice = odds.draw;

        if (closingPrice > 0 && match.oddsRecommended) {
            // Upsert into bet_outcome as a "System record" if not exists?
            // Or just update if exists. 
            // Simpler: Let's assume we created a bet_outcome record when we made the prediction?
            // We didn't. 
            // Todo: We should probably create a "Paper Bet" record when Sniper Mode fires.

            // For now, let's just log it or update `matchAnalysis`? 
            // Wait, schema `bet_outcome` has the CLV fields.
            // Let's CREATE a bet_outcome record "System Tracking"

            const clv = (match.oddsRecommended / closingPrice) - 1;

            // Check if analysis already has a bet_outcome linked
            const existing = await db.select().from(betOutcome).where(eq(betOutcome.analysisId, match.id));

            if (existing.length === 0) {
                await db.insert(betOutcome).values({
                    analysisId: match.id,
                    status: 'pending',
                    stakeAmount: 100, // Hypothetical unit
                    oddsClosing: closingPrice,
                    oddsRecommended: match.oddsRecommended,
                    clvPercentage: clv,
                    closingLineValue: clv, // Legacy support
                    createdAt: new Date()
                });
            } else {
                await db.update(betOutcome).set({
                    oddsClosing: closingPrice,
                    clvPercentage: clv,
                    closingLineValue: clv
                }).where(eq(betOutcome.analysisId, match.id));
            }

            processed++;
            console.log(`[CLV] Fixture ${match.fixtureId}: Rec ${match.oddsRecommended} vs Close ${closingPrice} -> CLV ${(clv * 100).toFixed(2)}%`);
        }
    }

    return NextResponse.json({
        success: true,
        processed
    });
}
