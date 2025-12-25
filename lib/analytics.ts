import { differenceInDays, parseISO } from 'date-fns';

export interface FormStats {
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsScored: number;
    goalsConceded: number;
    last5: string[]; // "W", "D", "L"
    pointsLast5: number;
    avgGoalsScored: number;
    avgGoalsConceded: number;
    daysSinceLastMatch: number;
    fatigueLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    streak: {
        type: 'WIN' | 'LOSS' | 'DRAW' | 'UNBEATEN' | 'NONE';
        count: number;
    };
}

export function calculateTeamForm(teamId: number, allMatches: any[], currentDate: Date = new Date()): FormStats {
    // 1. Filter matches for this team
    const teamMatches = allMatches.filter(m =>
        (m.teams.home.id === teamId || m.teams.away.id === teamId) &&
        m.fixture.status.short === 'FT'
    );

    // 2. Sort by date descending (newest first)
    teamMatches.sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime());

    // 3. Rolling 5 Context
    const last5Matches = teamMatches.slice(0, 5);

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;
    let points = 0;
    const formSequence: string[] = [];

    last5Matches.forEach(match => {
        const isHome = match.teams.home.id === teamId;
        const myGoals = isHome ? match.goals.home : match.goals.away;
        const opponentGoals = isHome ? match.goals.away : match.goals.home;

        goalsScored += myGoals;
        goalsConceded += opponentGoals;

        if (myGoals > opponentGoals) {
            wins++;
            points += 3;
            formSequence.push('W');
        } else if (myGoals === opponentGoals) {
            draws++;
            points += 1;
            formSequence.push('D');
        } else {
            losses++;
            formSequence.push('L');
        }
    });

    // 4. Calculate Fatigue
    let daysSinceLastMatch = 7; // Default healthy rest
    let fatigueLevel: FormStats['fatigueLevel'] = 'Low';

    if (last5Matches.length > 0) {
        const lastMatchDate = parseISO(last5Matches[0].fixture.date);
        // Compare with "currentDate" (which is effectively the prediction target match date)
        daysSinceLastMatch = differenceInDays(currentDate, lastMatchDate);

        if (daysSinceLastMatch <= 2) fatigueLevel = 'Critical';
        else if (daysSinceLastMatch <= 4) fatigueLevel = 'High';
        else if (daysSinceLastMatch <= 6) fatigueLevel = 'Medium';
    }

    // 5. Streak Logic
    let streakType: FormStats['streak']['type'] = 'NONE';
    let streakCount = 0;

    if (formSequence.length > 0) {
        const firstResult = formSequence[0];

        // Count consecutive specific results
        let count = 0;
        for (const res of formSequence) {
            if (res === firstResult) count++;
            else break;
        }

        if (count >= 2) {
            if (firstResult === 'W') streakType = 'WIN';
            else if (firstResult === 'L') streakType = 'LOSS';
            else if (firstResult === 'D') streakType = 'DRAW';
            streakCount = count;
        }

        // Check Unbeaten if not winning streak
        if (streakType === 'NONE' && !formSequence.includes('L') && formSequence.length >= 3) {
            streakType = 'UNBEATEN';
            streakCount = formSequence.length;
        }
    }

    return {
        matchesPlayed: last5Matches.length,
        wins,
        draws,
        losses,
        goalsScored,
        goalsConceded,
        last5: formSequence, // Note: index 0 is newest
        pointsLast5: points,
        avgGoalsScored: last5Matches.length ? goalsScored / last5Matches.length : 0,
        avgGoalsConceded: last5Matches.length ? goalsConceded / last5Matches.length : 0,
        daysSinceLastMatch,
        fatigueLevel,
        streak: { type: streakType, count: streakCount }
    };
}
