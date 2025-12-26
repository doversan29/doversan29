
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
 * POISSON ENGINE (v2.6 - FINE TUNED)
 * Objective: Find the balance between Over/Under by adjusting baselines and sample weights.
 */
export function calculatePoissonPrediction(
    homeStats: TeamStats,
    awayStats: TeamStats,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15
): PredictionResult {

    // 1. Adjusted Baseline Defaults (v2.6)
    // If league data is garbage or too low, enforce 1.35 per side (~2.7 match avg)
    const safeAvgHome = (leagueAvgHomeGoals && leagueAvgHomeGoals > 0.5) ? leagueAvgHomeGoals : 1.35;
    const safeAvgAway = (leagueAvgAwayGoals && leagueAvgAwayGoals > 0.5) ? leagueAvgAwayGoals : 1.35;

    const homeMatches = Math.max(homeStats.played, 1);
    const awayMatches = Math.max(awayStats.played, 1);

    // 2. Strength Normalization
    // If games < 5, we regress partially to the mean (0.5 weight for mean)
    const getStrength = (goals: number, games: number, leagueAvg: number) => {
        const raw = (goals / games) / leagueAvg;
        if (games < 5) return (raw + 1.0) / 2; // Soft regression
        return raw;
    };

    const homeAttack = getStrength(homeStats.scored, homeStats.played, safeAvgHome);
    const homeDefense = getStrength(homeStats.conceded, homeStats.played, safeAvgAway);

    const awayAttack = getStrength(awayStats.scored, awayStats.played, safeAvgAway);
    const awayDefense = getStrength(awayStats.conceded, awayStats.played, safeAvgHome);

    // 3. Projected Goals Calculation with SOFT CAP
    let expectedHome = homeAttack * awayDefense * safeAvgHome;
    let expectedAway = awayAttack * homeDefense * safeAvgAway;

    // SOFT CAP (Limit variance, but allow high-scoring logic up to 3.5 per team)
    expectedHome = Math.min(Math.max(expectedHome, 0.2), 3.5);
    expectedAway = Math.min(Math.max(expectedAway, 0.2), 3.5);

    // 4. Score Matrix & Winning Probabilities
    const scoreMatrix: number[][] = [];
    let homeWinProb = 0;
    let drawProb = 0;
    let awayWinProb = 0;

    for (let h = 0; h <= 5; h++) {
        const row: number[] = [];
        const probH = poissonProb(h, expectedHome);

        for (let a = 0; a <= 5; a++) {
            const probA = poissonProb(a, expectedAway);
            const probScore = probH * probA;
            row.push(probScore);

            if (h > a) homeWinProb += probScore;
            else if (h === a) drawProb += probScore;
            else awayWinProb += probScore;
        }
        scoreMatrix.push(row);
    }

    const totalProb = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= totalProb;
    drawProb /= totalProb;
    awayWinProb /= totalProb;

    return {
        homeWinProb,
        drawProb,
        awayWinProb,
        scoreMatrix,
        expectedGoalsHome: expectedHome,
        expectedGoalsAway: expectedAway
    };
}

/**
 * TRAP DETECTION (v2.5)
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
            reasoning: `Market odds (${marketOdds}) are ${((deviation - 1) * 100).toFixed(0)}% higher than statistical fair odds (${fairOdds.toFixed(2)}). Possible missing players or lineup rotation.`
        };
    }

    return { isTrap: false, reasoning: "" };
}

/**
 * WEIGHTED STATS (v2.6)
 * Moved to 60% Season / 40% Recent Form for better streak tracking.
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
 * RECOMMENDATION ENGINE (v2.6)
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, expectedGoalsHome, expectedGoalsAway } = prediction;

    // CALIBRATION LOGS (v2.6)
    console.log(`[CALIBRATION] Match: ${homeName} vs ${awayName}`);
    console.log(` - FINAL xG: ${expectedGoalsHome.toFixed(2)} - ${expectedGoalsAway.toFixed(2)} (Total: ${(expectedGoalsHome + expectedGoalsAway).toFixed(2)})`);

    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    // Check for Traps
    if (marketOdds) {
        const homeTrap = detectMarketTrap(homeWinProb, marketOdds.home);
        const awayTrap = detectMarketTrap(awayWinProb, marketOdds.away);
        if (homeTrap.isTrap || awayTrap.isTrap) {
            return `⚠️ TRAP ALERT: Market odds are suspiciously high. SKIP.`;
        }
    }

    // 1. Clear Winner (Threshold 55%)
    if (homeWinProb > 0.55) return `${homeName} to Win`;
    if (awayWinProb > 0.55) return `${awayName} to Win`;

    // 2. Goal Recommendation (Value Thresholds v2.6)
    // Under: Requires > 55% Prob
    if (probUnder25 >= 0.55) return "Under 2.5 Goals";
    // Over: Requires > 50% Prob (More aggressive)
    if (probOver25 >= 0.50) return "Over 2.5 Goals";

    // 3. Fallback
    return "Double Chance / BTTS";
}
