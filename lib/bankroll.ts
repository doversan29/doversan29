import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const BETS_FILE = path.join(DATA_DIR, 'bets_history.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Bet {
    id: string;
    date: string;
    match: string;
    selection: string;
    stake: number;
    odds: number;
    status: 'PENDING' | 'WON' | 'LOST' | 'VOID';
    profit: number;
}

export interface BankrollStats {
    currentBalance: number;
    totalBets: number;
    wins: number;
    losses: number;
    roi: number;
    history: Bet[];
}

const INITIAL_BANKROLL = 1000;

export async function getBankrollStats(): Promise<BankrollStats> {
    if (!fs.existsSync(BETS_FILE)) {
        // Return default empty state
        return {
            currentBalance: INITIAL_BANKROLL,
            totalBets: 0,
            wins: 0,
            losses: 0,
            roi: 0,
            history: []
        };
    }

    const content = fs.readFileSync(BETS_FILE, 'utf-8');
    const history: Bet[] = JSON.parse(content);

    let currentBalance = INITIAL_BANKROLL;
    let wins = 0;
    let losses = 0;
    let totalStaked = 0;
    let totalProfit = 0;

    history.forEach(bet => {
        totalStaked += bet.stake;
        if (bet.status === 'WON') {
            const profit = (bet.stake * bet.odds) - bet.stake;
            currentBalance += profit;
            totalProfit += profit;
            wins++;
        } else if (bet.status === 'LOST') {
            currentBalance -= bet.stake;
            totalProfit -= bet.stake;
            losses++;
        }
        // PENDING/VOID don't affect balance yet (simplified)
    });

    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    return {
        currentBalance,
        totalBets: history.length,
        wins,
        losses,
        roi,
        history
    };
}

export async function addBet(bet: Omit<Bet, 'id' | 'status' | 'profit' | 'date'>) {
    const stats = await getBankrollStats();
    const newBet: Bet = {
        ...bet,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        status: 'PENDING',
        profit: 0
    };

    // Validate bankroll? Nah, allow negative for simplicity or logging past bets

    const newHistory = [newBet, ...stats.history];
    fs.writeFileSync(BETS_FILE, JSON.stringify(newHistory, null, 2));
    return newBet;
}

export async function updateBetStatus(id: string, status: 'WON' | 'LOST' | 'VOID') {
    const stats = await getBankrollStats();
    const updatedHistory = stats.history.map(bet => {
        if (bet.id === id) {
            return { ...bet, status };
        }
        return bet;
    });

    fs.writeFileSync(BETS_FILE, JSON.stringify(updatedHistory, null, 2));
}
