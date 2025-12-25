import fs from 'fs';
import path from 'path';
import { getFixtureById } from './api-client';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'predictions.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface PredictionRecord {
    id: string; // fixtureId
    date: string;
    homeTeam: string;
    awayTeam: string;
    prediction: {
        homeWinProb: number;
        drawProb: number;
        awayWinProb: number;
        pick: string; // "HOME", "DRAW", "AWAY"
        confidence: number;
    };
    result?: 'WON' | 'LOST' | 'PENDING' | 'VOID';
    matchScore?: string;
}

function getHistory(): PredictionRecord[] {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
}

function saveHistory(history: PredictionRecord[]) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export async function savePrediction(fixture: any, prediction: any) {
    const history = getHistory();
    const existing = history.find(h => h.id === fixture.fixture.id.toString());

    if (existing) return; // Already saved

    const winProb = prediction.homeWinProb;
    const drawProb = prediction.drawProb;
    const lossProb = prediction.awayWinProb;

    let pick = "DRAW";
    let confidence = drawProb;

    if (winProb > drawProb && winProb > lossProb) {
        pick = "HOME";
        confidence = winProb;
    } else if (lossProb > winProb && lossProb > drawProb) {
        pick = "AWAY";
        confidence = lossProb;
    }

    const newRecord: PredictionRecord = {
        id: fixture.fixture.id.toString(),
        date: fixture.fixture.date,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        prediction: {
            homeWinProb: winProb,
            drawProb: drawProb,
            awayWinProb: lossProb,
            pick,
            confidence
        },
        result: 'PENDING'
    };

    history.push(newRecord);
    saveHistory(history);
}

export async function verifyPredictions() {
    const history = getHistory();
    const pending = history.filter(h => h.result === 'PENDING');

    if (pending.length === 0) return history;

    let updated = false;

    // We can't batch fetch by ID easily in standard API without logic, so we loop (carefully)
    // Or we rely on the user visiting a page to update? 
    // Let's verify up to 3 oldest pending to avoid rate limits
    const toVerify = pending.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);

    for (const record of toVerify) {
        // Only verify if match date has passed
        if (new Date(record.date).getTime() > Date.now()) continue;

        try {
            const fixtureData = await getFixtureById(parseInt(record.id));
            if (fixtureData && fixtureData.fixture.status.short === 'FT') {
                const homeGoals = fixtureData.goals.home;
                const awayGoals = fixtureData.goals.away;
                const pick = record.prediction.pick;

                let won = false;
                if (pick === 'HOME' && homeGoals > awayGoals) won = true;
                else if (pick === 'AWAY' && awayGoals > homeGoals) won = true;
                else if (pick === 'DRAW' && homeGoals === awayGoals) won = true;

                record.result = won ? 'WON' : 'LOST';
                record.matchScore = `${homeGoals}-${awayGoals}`;
                updated = true;
            }
        } catch (e) {
            console.error(`Failed to verify ${record.id}`, e);
        }
    }

    if (updated) {
        saveHistory(history);
    }

    return history;
}

export function getPredictionStats() {
    const history = getHistory();
    const finished = history.filter(h => h.result === 'WON' || h.result === 'LOST');
    const won = finished.filter(h => h.result === 'WON').length;
    const total = finished.length;
    const rate = total > 0 ? (won / total) * 100 : 0;

    return {
        total,
        won,
        rate,
        history: history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Newest first
    };
}
