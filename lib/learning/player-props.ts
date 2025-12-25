
interface PlayerPropAnalysis {
    playerId: number;
    playerName: string;
    teamId: number;
    photo: string;
    seasonGoals: number;
    goalProbability: number; // 0-1
    fairOdd: number; // Decimal odd (e.g., 2.50)
    marketOdd?: number; // Optional if we had real odds
    valueEdge?: number;
}

/**
 * Calculates Anytime Goalscorer probability for a player in a specific match.
 * 
 * Logic:
 * 1. Base Rate: Player Goals / Team Minutes Played (Goals per 90 simplified)
 * 2. Opponent Factor: How leaky is the opponent defense? (Opponent GA / League Avg GA)
 * 3. Match Factor: Expected Team Goals for this specific match (from Poisson model)
 */
export function analyzePlayerGoalscorer(
    player: any, // Raw player object from API 'topscorers'
    teamExpectedGoals: number, // Our main model's prediction for the TEAM's goals
    teamTotalGoalsSeason: number
): PlayerPropAnalysis {
    // 1. Player Contribution Ratio
    // What % of team goals does this player score?
    // Cap it to avoid overestimation (e.g. if player scored 100% of team goals in 1 game)
    const playerGoals = player.statistics[0].goals.total || 0;
    const contributionRatio = teamTotalGoalsSeason > 0 ? (playerGoals / teamTotalGoalsSeason) : 0;

    // Adjust ratio using some regression to the mean (dampening)
    // If a player has 50% of team goals, tough to sustain.
    const dampenedRatio = (contributionRatio * 0.7) + 0.05; // Base heuristic

    // 2. Expected Goals for Player in THIS match
    // xG_Player = xG_Team_Match * Player_Share
    const playerExpectedGoals = teamExpectedGoals * dampenedRatio;

    // 3. Convert xG to Probability (Poisson for k>=1 goal)
    // P(Goals >= 1) = 1 - P(Goals = 0)
    // P(0) = e^(-lambda) where lambda is xG
    const probScoreAtLeastOne = 1 - Math.exp(-playerExpectedGoals);

    // 4. Calculate Fair Odd
    const fairOdd = probScoreAtLeastOne > 0 ? (1 / probScoreAtLeastOne) : 999;

    return {
        playerId: player.player.id,
        playerName: player.player.name,
        teamId: player.statistics[0].team.id,
        photo: player.player.photo,
        seasonGoals: playerGoals,
        goalProbability: probScoreAtLeastOne,
        fairOdd: parseFloat(fairOdd.toFixed(2))
    };
}
