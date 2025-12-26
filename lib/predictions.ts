
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
    expectedCardsHome?: number;
    expectedCardsAway?: number;
    cornerProb: {
        over85: number;
        over95: number;
        over105: number;
    };
    cardProb?: {
        over35: number;
        over45: number;
        over55: number;
    };
    tactical?: {
        attack: number;
        defense: number;
        possession: number;
        corners: number;
        cards: number;
        form: number;
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

export function poissonProb(k: number, lambda: number): number {
    return (Math.pow(Math.exp(1), -lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * POISSON ENGINE (v4.5 - FULL MARKET & TACTICAL INTEGRATION)
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
    let hCornersAvg: number = 4.8, aCornersAvg: number = 4.2;
    let hCardsAvg: number | undefined, aCardsAvg: number | undefined;
    let usesVenueSpecificAvg = false;

    if (isPremium(homeData) && isPremium(awayData)) {
        hAttack = parseFloat(homeData.goals.for.average?.home) || 1.20;
        hDefense = parseFloat(homeData.goals.against.average?.home) || 1.20;
        aAttack = parseFloat(awayData.goals.for.average?.away) || 1.10;
        aDefense = parseFloat(awayData.goals.against.average?.away) || 1.10;

        hCornersAvg = parseFloat(homeData.corners?.average?.home) || 4.8;
        aCornersAvg = parseFloat(awayData.corners?.average?.away) || 4.2;

        // safe extraction for cards
        const getCardAvg = (data: any, type: 'home' | 'away') => {
            if (!data?.cards) return undefined;
            const yellow = parseFloat(data.cards.yellow?.average?.[type]) || 0;
            const red = parseFloat(data.cards.red?.average?.[type]) || 0;
            return yellow + (red * 2);
        };

        hCardsAvg = getCardAvg(homeData, 'home');
        aCardsAvg = getCardAvg(awayData, 'away');

        usesVenueSpecificAvg = true;
    } else {
        const getRate = (data: any, type: 'scored' | 'conceded') => (type === 'scored' ? data.scored : data.conceded) / Math.max(data.played, 1);
        hAttack = getRate(homeData, 'scored');
        hDefense = getRate(homeData, 'conceded');
        aAttack = getRate(awayData, 'scored');
        aDefense = getRate(awayData, 'conceded');
    }

    // 2. STRENGTH NORMALIZATION
    const normalize = (val: number, avg: number) => Math.min(val / avg, 2.0);
    const hStrAttack = normalize(hAttack, leagueAvgHomeGoals);
    const hStrDefense = normalize(hDefense, leagueAvgAwayGoals);
    const aStrAttack = normalize(aAttack, leagueAvgAwayGoals);
    const aStrDefense = normalize(aDefense, leagueAvgHomeGoals);

    // 3. PROJECTED xG & Reality Dampener
    const DAMPENER = 0.90;
    let eHome = hStrAttack * aStrDefense * leagueAvgHomeGoals * DAMPENER;
    let eAway = aStrAttack * hStrDefense * leagueAvgAwayGoals * DAMPENER;

    if (!isNeutral && !usesVenueSpecificAvg) eHome *= 1.15;

    const TOTAL_CAP = 2.90;
    const totalXG = eHome + eAway;
    if (totalXG > TOTAL_CAP) {
        const ratio = TOTAL_CAP / totalXG;
        eHome *= ratio;
        eAway *= ratio;
    }

    eHome = Math.max(eHome, 0.1);
    eAway = Math.max(eAway, 0.1);

    // 4. CORNER PROJECTION
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

    // 5. CARD PROJECTION (v4.0)
    let expectedCardsHome, expectedCardsAway, cardProb;
    if (hCardsAvg !== undefined && aCardsAvg !== undefined) {
        // Cards are highly volatile, use a stronger dampener (0.85)
        expectedCardsHome = hCardsAvg * 0.85;
        expectedCardsAway = aCardsAvg * 0.85;
        const totalExpectedCards = expectedCardsHome + expectedCardsAway;
        cardProb = {
            over35: getProbOver(totalExpectedCards, 3),
            over45: getProbOver(totalExpectedCards, 4),
            over55: getProbOver(totalExpectedCards, 5),
        };
    }

    // 5.1 TACTICAL RADAR METRICS (v4.5)
    // Scale 0-100 for Radar Component
    const tactical = {
        attack: Math.min(hStrAttack * 50, 100),
        defense: Math.min((1 / Math.max(hStrDefense, 0.5)) * 50, 100),
        possession: parseFloat(homeData?.clean_sheets?.percentage || "50"), // Proxy if direct possession missing
        corners: Math.min((hCornersAvg / 6) * 100, 100),
        cards: hCardsAvg ? Math.min((hCardsAvg / 4) * 100, 100) : 50,
        form: 75 // Mock until integrated
    };

    // 6. Matrix & Winning Probabilities
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
        expectedCardsHome,
        expectedCardsAway,
        cornerProb,
        cardProb,
        tactical
    };
}

/**
 * RECOMMENDATION ENGINE (v4.5)
 */
export function getRecommendedBet(
    prediction: PredictionResult,
    homeName: string,
    awayName: string,
    marketOdds?: { home: number, draw: number, away: number; opening?: { home: number, draw: number, away: number } }
): string {
    const { homeWinProb, awayWinProb, drawProb, expectedGoalsHome, expectedGoalsAway, cornerProb, cardProb } = prediction;

    // SENTINEL: Steam Move Detection (v4.5)
    if (marketOdds?.opening) {
        const dropThreshold = 0.10; // 10% drop
        if ((marketOdds.opening.home - marketOdds.home) / marketOdds.opening.home > dropThreshold) {
            if (homeWinProb > 0.55) return `🚨 STEAM MOVE: ${homeName}`;
        }
    }

    if (homeWinProb > 0.65) return `${homeName} Gana`;
    if (awayWinProb > 0.65) return `${awayName} Gana`;

    const probUnder25 =
        (poissonProb(0, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(1, expectedGoalsHome) * poissonProb(1, expectedGoalsAway)) +
        (poissonProb(2, expectedGoalsHome) * poissonProb(0, expectedGoalsAway)) +
        (poissonProb(0, expectedGoalsHome) * poissonProb(2, expectedGoalsAway));

    const probOver25 = 1 - probUnder25;

    if (probOver25 >= 0.68) return "Más de 2.5 Goles"; // Ultra high for v4.0
    if (probUnder25 >= 0.68) return "Menos de 2.5 Goles";

    if (cornerProb.over95 > 0.68) return "Más de 9.5 Córners";

    // Cards recommendation (New in v4.0)
    if (cardProb && cardProb.over45 > 0.65) return "Más de 4.5 Tarjetas";

    if (drawProb > 0.38) return "Doble Oportunidad / Empate";
    return "Ambos Anotan (BTTS)";
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
