
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
    expectedCornersHome: number;
    expectedCornersAway: number;
    cornerProb: {
        over85: number;
        over95: number;
        over105: number;
    };
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
 * POISSON ENGINE (v3.5 - ANTI-BIAS & CORNER QUANT)
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

    let hAttack: number, hDefense: number;
    let aAttack: number, aDefense: number;
    let hCornersAvg: number = 5.0, aCornersAvg: number = 4.5;
    let usesVenueSpecificAvg = false;

    if (isPremium(homeData) && isPremium(awayData)) {
        // PREMIUM MODE: Use Averaged Stats (Specific to Venue)
        hAttack = parseFloat(homeData.goals.for.average.home) || 1.25;
        hDefense = parseFloat(homeData.goals.against.average.home) || 1.25;
        aAttack = parseFloat(awayData.goals.for.average.away) || 1.15;
        aDefense = parseFloat(awayData.goals.against.average.away) || 1.15;

        // CORNER DATA (From Premium API)
        hCornersAvg = parseFloat(homeData.corners?.average?.home) || 5.0;
        aCornersAvg = parseFloat(awayData.corners?.average?.away) || 4.5;

        usesVenueSpecificAvg = true;
        console.log(`[PREMIUM v3.5] Engine running with Real Corner Data: H=${hCornersAvg}, A=${aCornersAvg}`);
    } else {
        // LEGACY MODE
        const getRate = (data: any, type: 'scored' | 'conceded') => (type === 'scored' ? data.scored : data.conceded) / Math.max(data.played, 1);
        hAttack = getRate(homeData, 'scored');
        hDefense = getRate(homeData, 'conceded');
        aAttack = getRate(awayData, 'scored');
        aDefense = getRate(awayData, 'conceded');
    }

    // 2. STRENGTH NORMALIZATION
    // We strictly limit max strength to avoid "All Overs"
    const normalize = (val: number, avg: number) => Math.min(val / avg, 2.2);
    const hStrAttack = normalize(hAttack, leagueAvgHomeGoals);
    const hStrDefense = normalize(hDefense, leagueAvgAwayGoals);
    const aStrAttack = normalize(aAttack, leagueAvgAwayGoals);
    const aStrDefense = normalize(aDefense, leagueAvgHomeGoals);

    // 3. PROJECTED xG
    let eHome = hStrAttack * aStrDefense * leagueAvgHomeGoals;
    let eAway = aStrAttack * hStrDefense * leagueAvgAwayGoals;

    // No HFA on Premium (already included in home-specific average)
    if (!isNeutral && !usesVenueSpecificAvg) eHome *= 1.15;

    // MANDATORY SAFETY CAPS
    eHome = Math.min(Math.max(eHome, 0.1), 3.20);
    eAway = Math.min(Math.max(eAway, 0.1), 3.00);

    // 4. CORNER PROJECTION (Poisson)
    const expectedCornersHome = hCornersAvg;
    const expectedCornersAway = aCornersAvg;
    const totalExpectedCorners = expectedCornersHome + expectedCornersAway;

    // Calculate Corner Probabilities using Cumulative Poisson
    const getProbOver = (lambda: number, threshold: number) => {
        let probUnderOrEqual = 0;
        for (let i = 0; i <= threshold; i++) {
            probUnderOrEqual += poissonProb(i, lambda);
        }
        return 1 - probUnderOrEqual;
    };

    const cornerProb = {
        over85: getProbOver(totalExpectedCorners, 8),
        over95: getProbOver(totalExpectedCorners, 9),
        over105: getProbOver(totalExpectedCorners, 10),
    };

    console.log("🎯 CALIBRATED xG (v3.5):", { goals: (eHome + eAway).toFixed(2), corners: totalExpectedCorners.toFixed(1) });

    // 5. Matrix & Winning Probabilities
    let hWin = 0, draw = 0, aWin = 0;
    const scoreMatrix: number[][] = [];
    for (let h = 0; h <= 5; h++) {
        const row: number[] = [];
        const pH = poissonProb(h, eHome);
        for (let a = 0; a <= 5; a++) {
            const pA = poissonProb(a, eAway);
            const pScore = pH * pA;
            row.push(pScore);
            if (h > a) hWin += pScore;
            else if (h === a) draw += pScore;
            else aWin += pScore;
        }
        scoreMatrix.push(row);
    }

    // Draw Dampener
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
        expectedGoalsHome: eHome,
        expectedGoalsAway: eAway,
        expectedCornersHome,
        expectedCornersAway,
        cornerProb
    };
}

/**
 * RECOMMENDATION ENGINE (v3.5) - HIGH SELECTIVITY
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway, cornerProb } = prediction;

    // 1. Trap / Confidence Win
    if (homeWinProb > 0.60) return `${homeName} to Win`;
    if (awayWinProb > 0.60) return `${awayName} to Win`;

    // 2. Goal Analysis (Now requiring 60% confidence)
    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    if (probOver25 >= 0.60) return "Over 2.5 Goals";
    if (probUnder25 >= 0.60) return "Under 2.5 Goals";

    // 3. Corners (New logic)
    if (cornerProb.over95 > 0.62) return "Over 9.5 Corners";
    if (cornerProb.over85 < 0.35) return "Under 8.5 Corners";

    if (drawProb > 0.32) return "Double Chance / Draw";
    return "BTTS (Both Teams to Score)";
}

export function detectMarketTrap(prob: number, odds: number) {
    if (!odds || odds <= 1) return { isTrap: false };
    return { isTrap: odds > (1 / prob) * 1.35 };
}

export function calculateWeightedStats(season: TeamStats, recent: TeamStats, weight: number) {
    return {
        played: season.played,
        scored: (season.scored / season.played * (1 - weight)) + (recent.scored * weight),
        conceded: (season.conceded / season.played * (1 - weight)) + (recent.conceded * weight),
    };
}
