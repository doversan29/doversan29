
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
 * POISSON ENGINE (v3.0 - STRICT RESET)
 * Objective: Eliminate systematically high xG and Over 2.5 bias.
 */
export function calculatePoissonPrediction(
    homeStats: TeamStats,
    awayStats: TeamStats,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15
): PredictionResult {

    // 1. Strict Normalization Logic
    // Formula: (Goals / Games) / (LeagueAvg)

    const getStrength = (goals: number, games: number, leagueAvg: number) => {
        if (games < 5) return 1.0; // Regression to the mean for small samples
        return (goals / games) / leagueAvg;
    };

    const homeAttack = getStrength(homeStats.scored, homeStats.played, leagueAvgHomeGoals);
    const homeDefense = getStrength(homeStats.conceded, homeStats.played, leagueAvgAwayGoals);

    const awayAttack = getStrength(awayStats.scored, awayStats.played, leagueAvgAwayGoals);
    const awayDefense = getStrength(awayStats.conceded, awayStats.played, leagueAvgHomeGoals);

    // 2. Projected Goals Calculation with HARD CAP
    let expectedHome = homeAttack * awayDefense * leagueAvgHomeGoals;
    let expectedAway = awayAttack * homeDefense * leagueAvgAwayGoals;

    // THE SAFETY VALVE (Hard Cap at 3.5 per team)
    expectedHome = Math.min(expectedHome, 3.5);
    expectedAway = Math.min(expectedAway, 3.5);

    // 3. Score Matrix & Winning Probabilities
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

    // Normalize probabilities
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

export function calculateWeightedStats(seasonStats: TeamStats, recentStats: TeamStats, recentWeight: number = 0.3): TeamStats {
    const seasonWeight = 1 - recentWeight;
    return {
        played: Math.max(seasonStats.played, 1),
        scored: (seasonStats.scored / Math.max(seasonStats.played, 1) * seasonWeight) + (recentStats.scored / Math.max(recentStats.played, 1) * recentWeight),
        conceded: (seasonStats.conceded / Math.max(seasonStats.played, 1) * seasonWeight) + (recentStats.conceded / Math.max(recentStats.played, 1) * recentWeight)
    };
}

/**
 * RECOMMENDATION ENGINE (v3.0)
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, expectedGoalsHome, expectedGoalsAway } = prediction;

    // DEBUG LOGS (Requested by QA)
    console.log("DEBUG CALCS:", {
        match: `${homeName} vs ${awayName}`,
        calculatedHomeXG: expectedGoalsHome.toFixed(2),
        calculatedAwayXG: expectedGoalsAway.toFixed(2)
    });

    // 0. Cumulative Poisson for Goals
    const p0h = poissonProb(0, expectedGoalsHome);
    const p1h = poissonProb(1, expectedGoalsHome);
    const p2h = poissonProb(2, expectedGoalsHome);

    const p0a = poissonProb(0, expectedGoalsAway);
    const p1a = poissonProb(1, expectedGoalsAway);
    const p2a = poissonProb(2, expectedGoalsAway);

    // This is a simplified cumulative check for total goals Under 2.5
    // Actually should be sum of matrix cells (0,0), (0,1), (0,2), (1,0), (1,1), (2,0)
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

    // 2. Goal Recommendation (Threshold 55%)
    if (probOver25 >= 0.55) return "Over 2.5 Goals";
    if (probUnder25 >= 0.55) return "Under 2.5 Goals";

    // 3. Fallback
    return "Double Chance / Tight Game";
}
