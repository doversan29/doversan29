
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
 * POISSON ENGINE (v3.6 - REALITY DAMPENER & ULTRA-CONSERVATISM)
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
    let hCornersAvg: number = 4.8, aCornersAvg: number = 4.2; // Slightly more conservative defaults
    let usesVenueSpecificAvg = false;

    if (isPremium(homeData) && isPremium(awayData)) {
        hAttack = parseFloat(homeData.goals.for.average.home) || 1.20;
        hDefense = parseFloat(homeData.goals.against.average.home) || 1.20;
        aAttack = parseFloat(awayData.goals.for.average.away) || 1.10;
        aDefense = parseFloat(awayData.goals.against.average.away) || 1.10;

        hCornersAvg = parseFloat(homeData.corners?.average?.home) || 4.8;
        aCornersAvg = parseFloat(awayData.corners?.average?.away) || 4.2;

        usesVenueSpecificAvg = true;
    } else {
        const getRate = (data: any, type: 'scored' | 'conceded') => (type === 'scored' ? data.scored : data.conceded) / Math.max(data.played, 1);
        hAttack = getRate(homeData, 'scored');
        hDefense = getRate(homeData, 'conceded');
        aAttack = getRate(awayData, 'scored');
        aDefense = getRate(awayData, 'conceded');
    }

    // 2. STRENGTH NORMALIZATION (Stricter v3.6)
    const normalize = (val: number, avg: number) => Math.min(val / avg, 2.0); // Capped at 2.0x league strength
    const hStrAttack = normalize(hAttack, leagueAvgHomeGoals);
    const hStrDefense = normalize(hDefense, leagueAvgAwayGoals);
    const aStrAttack = normalize(aAttack, leagueAvgAwayGoals);
    const aStrDefense = normalize(aDefense, leagueAvgHomeGoals);

    // 3. PROJECTED xG
    let eHome = hStrAttack * aStrDefense * leagueAvgHomeGoals;
    let eAway = aStrAttack * hStrDefense * leagueAvgAwayGoals;

    // REALITY DAMPENER (v3.6): 
    // Models often overestimate "Over" scenarios. Applying a 10% reduction to projections 
    // to account for tactical cancellations, red cards, and defensive pivots.
    const DAMPENER = 0.90;
    eHome *= DAMPENER;
    eAway *= DAMPENER;

    if (!isNeutral && !usesVenueSpecificAvg) eHome *= 1.15;

    // ULTRA-CONSERVATIVE CAPS (v3.6)
    // No match can have more than 2.9 total projected xG in the initial model pass.
    // This forces the "Over 2.5" recommendation to be much harder to trigger.
    const TOTAL_CAP = 2.90;
    const totalXG = eHome + eAway;
    if (totalXG > TOTAL_CAP) {
        const ratio = TOTAL_CAP / totalXG;
        eHome *= ratio;
        eAway *= ratio;
    }

    eHome = Math.max(eHome, 0.1);
    eAway = Math.max(eAway, 0.1);

    // 4. CORNER PROJECTION (Dampened v3.6)
    const expectedCornersHome = hCornersAvg * DAMPENER;
    const expectedCornersAway = aCornersAvg * DAMPENER;
    const totalExpectedCorners = expectedCornersHome + expectedCornersAway;

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

    console.log("🎯 V3.6 BIAS FIX PROJECTION:", { totalXG: (eHome + eAway).toFixed(2), totalCorners: totalExpectedCorners.toFixed(1) });

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

    // Draw Dampener (Stricter v3.6)
    if (draw > 0.38) {
        const excess = draw - 0.38;
        draw = 0.38;
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
 * RECOMMENDATION ENGINE (v3.6) - ULTRA SELECTIVITY
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway, cornerProb } = prediction;

    // 1. Confidence Win (Raised to 62%)
    if (homeWinProb > 0.62) return `${homeName} to Win`;
    if (awayWinProb > 0.62) return `${awayName} to Win`;

    // 2. Goal Analysis (Now requiring 65% confidence - Ultra Selective)
    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    if (probOver25 >= 0.65) return "Over 2.5 Goals";
    if (probUnder25 >= 0.65) return "Under 2.5 Goals";

    // 3. Corners (High Selectivity v3.6)
    if (cornerProb.over95 > 0.65) return "Over 9.5 Corners";
    if (cornerProb.over85 < 0.30) return "Under 8.5 Corners";

    if (drawProb > 0.35) return "Double Chance / Draw";
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
