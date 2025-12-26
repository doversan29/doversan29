
export interface TeamStats {
    played: number;
    scored: number;
    conceded: number;
}

export interface PredictionResult {
    homeWinProb: number;
    drawProb: number;
    awayWinProb: number;
    scoreMatrix: number[][]; // 6x6 matrix (0-5 goals)
    expectedGoalsHome: number;
    expectedGoalsAway: number;
    isTrap?: boolean;
}

/**
 * MATH CORE
 */
function factorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function poissonProb(k: number, lambda: number): number {
    return (Math.pow(Math.exp(1), -lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * POISSON ENGINE (v3.0 - PREMIUM UPGRADE)
 * Consume detailed statistics from /teams/statistics endpoint.
 */
export function calculatePoissonPrediction(
    homeRawStats: any,
    awayRawStats: any,
    seasonYear: number,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15,
    isNeutral: boolean = false
): PredictionResult {

    // 1. Mandatory Data Audit & Logging
    console.log("📅 Using Season:", seasonYear);

    if (!homeRawStats?.goals?.for || !awayRawStats?.goals?.for) {
        console.error("❌ CRITICAL: Missing Premium Stats Data", { homeRawStats, awayRawStats });
        throw new Error("Missing mandatory statistics for prediction calculation.");
    }

    console.log("📊 Raw Stats Home (Total/Home):", { for: homeRawStats.goals.for.total.home, against: homeRawStats.goals.against.total.home });
    console.log("📊 Raw Stats Away (Total/Away):", { for: awayRawStats.goals.for.total.away, against: awayRawStats.goals.against.total.away });

    // 2. Exact Normalization (using premium precise totals)
    const homeMatches = Math.max(homeRawStats.fixtures.played.home, 1);
    const awayMatches = Math.max(awayRawStats.fixtures.played.away, 1);

    const getStrength = (scored: number, conceded: number, games: number, avgScored: number, avgConceded: number) => {
        const attack = (scored / games) / avgScored;
        const defense = (conceded / games) / avgConceded;
        return { attack, defense };
    };

    const hStats = getStrength(
        homeRawStats.goals.for.total.home,
        homeRawStats.goals.against.total.home,
        homeMatches,
        leagueAvgHomeGoals,
        leagueAvgAwayGoals
    );

    const aStats = getStrength(
        awayRawStats.goals.for.total.away,
        awayRawStats.goals.against.total.away,
        awayMatches,
        leagueAvgAwayGoals,
        leagueAvgHomeGoals
    );

    // 3. FORCE HOME ADVANTAGE (HFA) Logic
    let expectedHome = hStats.attack * aStats.defense * leagueAvgHomeGoals;
    let expectedAway = aStats.attack * hStats.defense * leagueAvgAwayGoals;

    if (!isNeutral) {
        expectedHome *= 1.15; // Standard 15% HFA
    }

    // Sanity Clamps
    expectedHome = Math.min(Math.max(expectedHome, 0.1), 3.8);
    expectedAway = Math.min(Math.max(expectedAway, 0.1), 3.5);

    console.log("🎯 CALIBRATED xG:", { home: expectedHome.toFixed(2), away: expectedAway.toFixed(2) });

    // 4. Matrix calculation
    const scoreMatrix: number[][] = [];
    let homeWinProb = 0;
    let rawDrawProb = 0;
    let awayWinProb = 0;

    for (let h = 0; h <= 5; h++) {
        const row: number[] = [];
        const probH = poissonProb(h, expectedHome);

        for (let a = 0; a <= 5; a++) {
            const probA = poissonProb(a, expectedAway);
            const probScore = probH * probA;
            row.push(probScore);

            if (h > a) homeWinProb += probScore;
            else if (h === a) rawDrawProb += probScore;
            else awayWinProb += probScore;
        }
        scoreMatrix.push(row);
    }

    // 5. THE "DRAW DAMPENER" (Anti-70% Fix)
    // Poisson often overestimates draws in low-scoring parity.
    let finalHomeProb = homeWinProb;
    let finalDrawProb = rawDrawProb;
    let finalAwayProb = awayWinProb;

    if (finalDrawProb > 0.35) {
        const excess = finalDrawProb - 0.35;
        finalDrawProb = 0.35;
        finalHomeProb += excess / 2;
        finalAwayProb += excess / 2;
    }

    // Final Normalization
    const totalProb = finalHomeProb + finalDrawProb + finalAwayProb;
    finalHomeProb /= totalProb;
    finalDrawProb /= totalProb;
    finalAwayProb /= totalProb;

    // DEBUG LOG (Requested by Lead Mathematician)
    console.log("PROB FIX:", {
        H_xG: expectedHome.toFixed(2),
        A_xG: expectedAway.toFixed(2),
        RawDraw: rawDrawProb.toFixed(2),
        AdjustedDraw: finalDrawProb.toFixed(2)
    });

    return {
        homeWinProb: finalHomeProb,
        drawProb: finalDrawProb,
        awayWinProb: finalAwayProb,
        scoreMatrix,
        expectedGoalsHome: expectedHome,
        expectedGoalsAway: expectedAway
    };
}

/**
 * TRAP DETECTION
 */
export function detectMarketTrap(
    modelProb: number,
    marketOdds: number
): { isTrap: boolean; reasoning: string } {
    if (!marketOdds || marketOdds <= 1) return { isTrap: false, reasoning: "" };

    const fairOdds = 1 / modelProb;
    const deviation = marketOdds / fairOdds;

    if (deviation > 1.35) {
        return {
            isTrap: true,
            reasoning: `Market odds (${marketOdds}) are ${((deviation - 1) * 100).toFixed(0)}% higher than fair odds (${fairOdds.toFixed(2)}). Possible missing players or lineup rotation.`
        };
    }

    return { isTrap: false, reasoning: "" };
}

/**
 * WEIGHTED STATS
 */
export function calculateWeightedStats(seasonStats: TeamStats, recentStats: TeamStats, recentWeight: number = 0.4): TeamStats {
    const seasonWeight = 1 - recentWeight;
    const sPlayed = Math.max(seasonStats.played, 1);
    const rPlayed = Math.max(recentStats.played, 1);

    return {
        played: Math.max(seasonStats.played, 1),
        scored: (seasonStats.scored / sPlayed * seasonWeight) + (recentStats.scored / rPlayed * recentWeight),
        conceded: (seasonStats.conceded / sPlayed * seasonWeight) + (recentStats.conceded / rPlayed * recentWeight)
    };
}

/**
 * RECOMMENDATION ENGINE (v2.7)
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway } = prediction;

    // Check for Traps first
    if (marketOdds) {
        const homeTrap = detectMarketTrap(homeWinProb, marketOdds.home);
        const awayTrap = detectMarketTrap(awayWinProb, marketOdds.away);
        if (homeTrap.isTrap || awayTrap.isTrap) {
            return `⚠️ TRAP ALERT: Market odds are suspiciously high. SKIP.`;
        }
    }

    // 1. Clear Winner (Restored Sensivity check)
    if (homeWinProb > 0.52) return `${homeName} to Win`;
    if (awayWinProb > 0.52) return `${awayName} to Win`;

    // 2. Goal Analysis
    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    if (probOver25 >= 0.50) return "Over 2.5 Goals";
    if (probUnder25 >= 0.55) return "Under 2.5 Goals";

    // 3. Fallback
    if (drawProb > 0.30) return "Double Chance / Draw Predicted";
    return "BTTS / Both to Score";
}
