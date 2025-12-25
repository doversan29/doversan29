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
}

function factorial(n: number): number {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function poisson(k: number, lambda: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function calculatePoissonPrediction(
    homeStats: TeamStats,
    awayStats: TeamStats,
    leagueAvgHome: number = 1.5,
    leagueAvgAway: number = 1.2
): PredictionResult {

    // Calculate Attack and Defense Strengths
    // Avoid division by zero
    const safeStats = (val: number) => val === 0 ? 1 : val;

    const homeAttack = (homeStats.scored / safeStats(homeStats.played)) / leagueAvgHome;
    const homeDefense = (homeStats.conceded / safeStats(homeStats.played)) / leagueAvgAway;

    const awayAttack = (awayStats.scored / safeStats(awayStats.played)) / leagueAvgAway;
    const awayDefense = (awayStats.conceded / safeStats(awayStats.played)) / leagueAvgHome;

    // Expected Goals
    const expectedHome = homeAttack * awayDefense * leagueAvgHome;
    const expectedAway = awayAttack * homeDefense * leagueAvgAway;

    const scoreMatrix: number[][] = [];
    let homeWinProb = 0;
    let drawProb = 0;
    let awayWinProb = 0;

    // Calculate matrix for scores 0-5
    for (let h = 0; h <= 5; h++) {
        const row: number[] = [];
        const probH = poisson(h, expectedHome);

        for (let a = 0; a <= 5; a++) {
            const probA = poisson(a, expectedAway);
            const probScore = probH * probA;

            row.push(probScore);

            if (h > a) homeWinProb += probScore;
            else if (h === a) drawProb += probScore;
            else awayWinProb += probScore;
        }
        scoreMatrix.push(row);
    }

    // Normalize probabilities if they don't sum to exactly 1 (infinite tail)
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

export function calculateWeightedStats(seasonStats: TeamStats, recentStats: TeamStats, recentWeight: number = 0.3): TeamStats {
    const seasonWeight = 1 - recentWeight;
    return {
        played: 1, // Normalized
        scored: (seasonStats.scored / seasonStats.played * seasonWeight) + (recentStats.scored / recentStats.played * recentWeight),
        conceded: (seasonStats.conceded / seasonStats.played * seasonWeight) + (recentStats.conceded / recentStats.played * recentWeight)
    };
}
