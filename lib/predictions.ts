
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
 * POISSON ENGINE (v3.4 - BIAS REMOVAL)
 */
export function calculatePoissonPrediction(
    homeData: any,
    awayData: any,
    leagueAvgHomeGoals: number = 1.35,
    leagueAvgAwayGoals: number = 1.15,
    isNeutral: boolean = false,
    seasonYear: number = new Date().getFullYear()
): PredictionResult {

    // 1. DATA DETECTION
    const isPremium = (data: any) => data?.goals?.for?.average?.home !== undefined;

    let hAttack: number;
    let hDefense: number;
    let aAttack: number;
    let aDefense: number;
    let usesVenueSpecificAvg = false;

    if (isPremium(homeData) && isPremium(awayData)) {
        // PREMIUM MODE: Use Averaged Stats (Specific to Venue)
        // If team plays at Home, use their Home Average.
        hAttack = parseFloat(homeData.goals.for.average.home) || 1.25;
        hDefense = parseFloat(homeData.goals.against.average.home) || 1.25;
        aAttack = parseFloat(awayData.goals.for.average.away) || 1.15;
        aDefense = parseFloat(awayData.goals.against.average.away) || 1.15;
        usesVenueSpecificAvg = true;

        console.log(`[PREMIUM v3.4] Analyzing with Venue-Specific Averages`);
    } else {
        // LEGACY MODE: Fallback to global season averages from Standings
        console.log(`[LEGACY v3.4] Analyzing with Season Global Averages`);
        const getRate = (data: any, type: 'scored' | 'conceded') => {
            const val = type === 'scored' ? data.scored : data.conceded;
            return val / Math.max(data.played, 1);
        };
        hAttack = getRate(homeData, 'scored');
        hDefense = getRate(homeData, 'conceded');
        aAttack = getRate(awayData, 'scored');
        aDefense = getRate(awayData, 'conceded');
        usesVenueSpecificAvg = false;
    }

    // 2. STRENGTH NORMALIZATION relative to League
    const hStrAttack = hAttack / leagueAvgHomeGoals;
    const hStrDefense = hDefense / leagueAvgAwayGoals;
    const aStrAttack = aAttack / leagueAvgAwayGoals;
    const aStrDefense = aDefense / leagueAvgHomeGoals;

    // 3. PROJECTED xG
    let expectedHome = hStrAttack * aStrDefense * leagueAvgHomeGoals;
    let expectedAway = aStrAttack * hStrDefense * leagueAvgAwayGoals;

    // 4. SMART HOME ADVANTAGE (HFA)
    // IMPORTANT: If we are using hAttack/aAttack which are ALREADY "Home" and "Away" averages,
    // the HFA is already baked in. Do NOT multiply by 1.15 again or we inflate the score.
    if (!isNeutral && !usesVenueSpecificAvg) {
        expectedHome *= 1.15; // Only apply if using neutral/global season stats
    }

    // MANDATORY SAFETY CAP (v3.4)
    expectedHome = Math.min(Math.max(expectedHome, 0.1), 3.40);
    expectedAway = Math.min(Math.max(expectedAway, 0.1), 3.20);

    console.log("🎯 CALIBRATED xG (v3.4):", { home: expectedHome.toFixed(2), away: expectedAway.toFixed(2) });

    // 5. Matrix calculation
    let hWin = 0;
    let draw = 0;
    let aWin = 0;
    const scoreMatrix: number[][] = [];

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

    // 6. DRAW DAMPENER (v2.7)
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
 * RECOMMENDATION ENGINE (v3.4)
 * Selectivity increase to avoid "All Overs" bias.
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway } = prediction;

    // 1. Trap Detection
    if (marketOdds) {
        const homeTrap = detectMarketTrap(homeWinProb, marketOdds.home);
        if (homeTrap.isTrap) return `⚠️ TRAP ALERT: Market odds are suspiciously high. SKIP.`;
    }

    // 2. High Confidence Winners (>55%)
    if (homeWinProb > 0.55) return `${homeName} to Win`;
    if (awayWinProb > 0.55) return `${awayName} to Win`;

    // 3. Goal Analysis (More Selective v3.4)
    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    // We only recommend Over 2.5 if probability is > 58% (High Selectivity)
    if (probOver25 >= 0.58) return "Over 2.5 Goals";
    if (probUnder25 >= 0.58) return "Under 2.5 Goals";

    // 4. Defaults
    if (drawProb > 0.32) return "Double Chance / Draw Predicted";
    return "BTTS / Both to Score";
}

export function detectMarketTrap(prob: number, odds: number) {
    if (!odds || odds <= 1) return { isTrap: false };
    const fair = 1 / prob;
    return { isTrap: odds > fair * 1.35 };
}

export function calculateWeightedStats(season: TeamStats, recent: TeamStats, weight: number) {
    // Legacy support
    return {
        played: season.played,
        scored: (season.scored / season.played * (1 - weight)) + (recent.scored * weight),
        conceded: (season.conceded / season.played * (1 - weight)) + (recent.conceded * weight),
    };
}
