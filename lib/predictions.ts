
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
 * POISSON ENGINE (v3.1 - DYNAMIC COMPATIBILITY)
 * Objective: Handle both Premium API stats (/teams/statistics) and Legacy stats (Standings).
 */
export function calculatePoissonPrediction(
    homeData: any,
    awayData: any,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15,
    isNeutral: boolean = false,
    seasonYear: number = new Date().getFullYear()
): PredictionResult {

    // 1. DATA DETECTION & NORMALIZATION
    // Detect if we are receiving the rich Premium object or the simple Legacy object
    const isPremium = (data: any) => data?.goals?.for?.total !== undefined;

    let homeS: TeamStats;
    let awayS: TeamStats;

    if (isPremium(homeData)) {
        // Premium Path: Uses venue-specific totals (home for home, away for away)
        homeS = {
            played: Math.max(homeData.fixtures.played.home, 1),
            scored: homeData.goals.for.total.home,
            conceded: homeData.goals.against.total.home
        };
    } else {
        // Legacy Path: Fallback for list views (Parlay, Value Bets)
        homeS = {
            played: Math.max(homeData.played, 1),
            scored: homeData.scored,
            conceded: homeData.conceded
        };
    }

    if (isPremium(awayData)) {
        awayS = {
            played: Math.max(awayData.fixtures.played.away, 1),
            scored: awayData.goals.for.total.away,
            conceded: awayData.goals.against.total.away
        };
    } else {
        awayS = {
            played: Math.max(awayData.played, 1),
            scored: awayData.scored,
            conceded: awayData.conceded
        };
    }

    // AUDIT LOG (v3.1)
    if (isPremium(homeData)) {
        console.log(`[PREMIUM] Match analysis for season ${seasonYear}`);
    } else {
        console.log(`[LEGACY] Match analysis (Standings-based)`);
    }

    // 2. Strength Calculation (Restored Sensitivity)
    const getStrength = (scored: number, conceded: number, games: number, avgScored: number, avgConceded: number) => {
        const attack = (scored / games) / avgScored;
        const defense = (conceded / games) / avgConceded;
        return {
            attack: Math.min(attack, 2.5),
            defense: Math.min(defense, 2.5)
        };
    };

    const hStrength = getStrength(homeS.scored, homeS.conceded, homeS.played, leagueAvgHomeGoals, leagueAvgAwayGoals);
    const aStrength = getStrength(awayS.scored, awayS.conceded, awayS.played, leagueAvgAwayGoals, leagueAvgHomeGoals);

    // 3. FORCE HOME ADVANTAGE (HFA)
    let expectedHome = hStrength.attack * aStrength.defense * leagueAvgHomeGoals;
    let expectedAway = aStrength.attack * hStrength.defense * leagueAvgAwayGoals;

    if (!isNeutral) {
        expectedHome *= 1.15; // Home teams score 15% more
    }

    // Sanity Clamps
    expectedHome = Math.min(Math.max(expectedHome, 0.1), 3.8);
    expectedAway = Math.min(Math.max(expectedAway, 0.1), 3.5);

    // 4. Matrix & Winning Probabilities
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

    // 5. DRAW DAMPENER (v2.7)
    let finalDraw = rawDrawProb;
    let finalHome = homeWinProb;
    let finalAway = awayWinProb;

    if (finalDraw > 0.35) {
        const excess = finalDraw - 0.35;
        finalDraw = 0.35;
        finalHome += excess / 2;
        finalAway += excess / 2;
    }

    const total = finalHome + finalDraw + finalAway;

    // FINAL LOG (Combined Fix)
    console.log("PROB FIX:", {
        H_xG: expectedHome.toFixed(2),
        A_xG: expectedAway.toFixed(2),
        AdjustedDraw: finalDraw.toFixed(2)
    });

    return {
        homeWinProb: finalHome / total,
        drawProb: finalDraw / total,
        awayWinProb: finalAway / total,
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
            reasoning: `Market odds (${marketOdds}) are ${((deviation - 1) * 100).toFixed(0)}% higher than fair odds (${fairOdds.toFixed(2)}). Possible missing players.`
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
 * RECOMMENDATION ENGINE
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway } = prediction;

    if (marketOdds) {
        const homeTrap = detectMarketTrap(homeWinProb, marketOdds.home);
        const awayTrap = detectMarketTrap(awayWinProb, marketOdds.away);
        if (homeTrap.isTrap || awayTrap.isTrap) {
            return `⚠️ TRAP ALERT: Market odds are suspiciously high. SKIP.`;
        }
    }

    if (homeWinProb > 0.52) return `${homeName} to Win`;
    if (awayWinProb > 0.52) return `${awayName} to Win`;

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

    if (drawProb > 0.30) return "Double Chance / Draw Predicted";
    return "BTTS / Both to Score";
}
