export interface ValueAnalysis {
    isValue: boolean;
    difference: number; // Positive means value (AI prob > Implied prob)
    impliedProbability: number;
    aiProbability: number;
    recommendedBet: 'HOME' | 'DRAW' | 'AWAY' | 'NONE';
}

export function calculateValue(aiProbs: { home: number, draw: number, away: number }, bookieOdds: { home: number, draw: number, away: number }): ValueAnalysis {
    const impliedProbs = {
        home: 100 / bookieOdds.home,
        draw: 100 / bookieOdds.draw,
        away: 100 / bookieOdds.away
    };

    const diffs = {
        home: aiProbs.home - impliedProbs.home,
        draw: aiProbs.draw - impliedProbs.draw,
        away: aiProbs.away - impliedProbs.away
    };

    // Find the biggest difference
    let maxDiff = -Infinity;
    let recommended: ValueAnalysis['recommendedBet'] = 'NONE';

    if (diffs.home > maxDiff) {
        maxDiff = diffs.home;
        recommended = 'HOME';
    }
    if (diffs.draw > maxDiff) {
        maxDiff = diffs.draw;
        recommended = 'DRAW';
    }
    if (diffs.away > maxDiff) {
        maxDiff = diffs.away;
        recommended = 'AWAY';
    }

    const THRESHOLD = 10; // 10% difference as requested

    return {
        isValue: maxDiff >= THRESHOLD,
        difference: maxDiff,
        impliedProbability: impliedProbs[recommended.toLowerCase() as keyof typeof impliedProbs] || 0,
        aiProbability: aiProbs[recommended.toLowerCase() as keyof typeof aiProbs] || 0,
        recommendedBet: maxDiff >= THRESHOLD ? recommended : 'NONE'
    };
}
