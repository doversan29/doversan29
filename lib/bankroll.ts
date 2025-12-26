import fs from 'fs';
import path from 'path';
import { db } from './db/client';
import { betOutcome, matchAnalysis } from './db/schema';
import { desc, eq } from 'drizzle-orm';

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
    // 1. Fetch JSON History
    let jsonHistory: Bet[] = [];
    if (fs.existsSync(BETS_FILE)) {
        try {
            const content = fs.readFileSync(BETS_FILE, 'utf-8');
            jsonHistory = JSON.parse(content);
        } catch (e) {
            console.error("Error reading JSON bankroll:", e);
        }
    }

    // 2. Fetch Database History (v4.0 Sync)
    let dbHistory: Bet[] = [];
    try {
        const dbPicks = await db.select({
            id: betOutcome.id,
            status: betOutcome.status,
            stake: betOutcome.stakeAmount,
            odds: betOutcome.selectedOdds,
            createdAt: betOutcome.createdAt,
            home: matchAnalysis.homeTeam,
            away: matchAnalysis.awayTeam,
            betType: betOutcome.betType
        })
            .from(betOutcome)
            .innerJoin(matchAnalysis, eq(betOutcome.analysisId, matchAnalysis.id))
            .orderBy(desc(betOutcome.createdAt));

        dbHistory = dbPicks.map(p => ({
            id: `db_${p.id}`,
            date: p.createdAt.toISOString(),
            match: `${p.home} vs ${p.away}`,
            selection: p.betType || 'Pick',
            stake: p.stake || 10,
            odds: p.odds || 1.80,
            status: (p.status?.toUpperCase() as any) || 'PENDING',
            profit: 0 // Calculated below
        }));
    } catch (e) {
        console.error("Error fetching DB picks for bankroll:", e);
    }

    // 3. Merge and Sort
    const combinedHistory = [...jsonHistory, ...dbHistory].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let currentBalance = INITIAL_BANKROLL;
    let wins = 0;
    let losses = 0;
    let totalStaked = 0;
    let totalProfit = 0;

    combinedHistory.forEach(bet => {
        totalStaked += bet.stake;
        // Calculate dynamic profit based on status
        if (bet.status === 'WON') {
            bet.profit = (bet.stake * bet.odds) - bet.stake;
            currentBalance += bet.profit;
            totalProfit += bet.profit;
            wins++;
        } else if (bet.status === 'LOST') {
            bet.profit = -bet.stake;
            currentBalance -= bet.stake;
            totalProfit -= bet.stake;
            losses++;
        } else {
            bet.profit = 0;
        }
    });

    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    return {
        currentBalance,
        totalBets: combinedHistory.length,
        wins,
        losses,
        roi,
        history: combinedHistory
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
