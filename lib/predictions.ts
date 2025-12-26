
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
 * POISSON ENGINE (v3.3 - CRITICAL MATH FIX)
 * Objective: Use AVERAGES instead of TOTALS to avoid Over 2.5 bias.
 * Handles Premium API stats (/teams/statistics) and Legacy stats (Standings).
 */
export function calculatePoissonPrediction(
    homeData: any,
    awayData: any,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15,
    isNeutral: boolean = false,
    seasonYear: number = new Date().getFullYear()
): PredictionResult {

    // 1. DATA DETECTION & PARSING
    const isPremium = (data: any) => data?.goals?.for?.average !== undefined;

    let homeAttack: number;
    let homeDefense: number;
    let awayAttack: number;
    let awayDefense: number;

    if (isPremium(homeData)) {
        // v3.3: API-Football Premium returns averages as strings (e.g. "1.5")
        // We MUST use Averages, not Totals.
        const rawHomeScored = homeData.goals.for.average.home;
        const rawHomeConceded = homeData.goals.against.average.home;

        homeAttack = parseFloat(rawHomeScored) || 1.25;
        homeDefense = parseFloat(rawHomeConceded) || 1.25;

        console.log("STATS DEBUG (HOME):", {
            raw_avg_scored: rawHomeScored,
            parsed: homeAttack,
            raw_avg_conceded: rawHomeConceded,
            parsed_def: homeDefense
        });
    } else {
        // Legacy path (Standings-based)
        homeAttack = homeData.scored / Math.max(homeData.played, 1);
        homeDefense = homeData.conceded / Math.max(homeData.played, 1);
    }

    if (isPremium(awayData)) {
        const rawAwayScored = awayData.goals.for.average.away;
        const rawAwayConceded = awayData.goals.against.average.away;

        awayAttack = parseFloat(rawAwayScored) || 1.25;
        awayDefense = parseFloat(rawAwayConceded) || 1.25;

        console.log("STATS DEBUG (AWAY):", {
            raw_avg_scored: rawAwayScored,
            parsed: awayAttack,
            raw_avg_conceded: rawAwayConceded,
            parsed_def: awayDefense
        });
    } else {
        awayAttack = awayData.scored / Math.max(awayData.played, 1);
        awayDefense = awayData.conceded / Math.max(awayData.played, 1);
    }

    // 2. STRENGTH NORMALIZATION relative to League
    const hStrAttack = homeAttack / leagueAvgHomeGoals;
    const hStrDefense = homeDefense / leagueAvgAwayGoals;
    const aStrAttack = awayAttack / leagueAvgAwayGoals;
    const aStrDefense = awayDefense / leagueAvgHomeGoals;

    // 3. PROJECTED xG WITH HFA & SAFETY CAP
    let expectedHome = hStrAttack * aStrDefense * leagueAvgHomeGoals;
    let expectedAway = aStrAttack * hStrDefense * leagueAvgAwayGoals;

    // Force Home Advantage
    if (!isNeutral) {
        expectedHome *= 1.15;
    }

    // MANDATORY SAFETY CAP (v3.3) - Prevent "Collapse to Overs"
    expectedHome = Math.min(Math.max(expectedHome, 0.1), 3.50);
    expectedAway = Math.min(Math.max(expectedAway, 0.1), 3.50);

    console.log("🎯 CALIBRATED xG (v3.3):", { home: expectedHome.toFixed(2), away: expectedAway.toFixed(2) });

    // 4. Matrix & Winning Probabilities
    const scoreMatrix: number[][] = [];
    let hWin = 0;
    let draw = 0;
    let aWin = 0;

    for (let h = 0; h <= 5; h++) {
        const row: number[] = [];
        const probH = poissonProb(h, expectedHome);

        for (let a = 0; a <= 5; a++) {
            const probA = poissonProb(a, expectedAway);
            const probScore = probH * probA;
            row.push(probScore);

            if (h > a) hWin += probScore;
            else if (h === a) draw += probScore;
            else aWin += probScore;
        }
        scoreMatrix.push(row);
    }

    // 5. DRAW DAMPENER (v2.7)
    if (draw > 0.35) {
        const excess = draw - 0.35;
        draw = 0.35;
        hWin += excess / 2;
        aWin += excess / 2;
    }

    const total = hWin + draw + aWin;

    return {
        homeWinProb: hWin / total,
        drawProb: draw / total,
        awayWinProb: aWin / total,
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
            reasoning: `Market odds (${marketOdds}) are ${((deviation - 1) * 100).toFixed(0)}% higher than fair odds (${fairOdds.toFixed(2)}).`
        };
    }
    return { isTrap: false, reasoning: "" };
}

/**
 * WEIGHTED STATS (Legacy support)
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
