'use server';

import fs from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';

export async function refreshData() {
    const cacheDir = path.join(process.cwd(), 'data', 'cache');

    try {
        if (fs.existsSync(cacheDir)) {
            const files = fs.readdirSync(cacheDir);
            for (const file of files) {
                fs.unlinkSync(path.join(cacheDir, file));
            }
        }
        console.log("Cache cleared manually.");
    } catch (e) {
        console.error("Failed to clear cache:", e);
        return { success: false, message: "Failed to clear cache" };
    }

    revalidatePath('/', 'layout'); // Purge Next.js data cache for everything
    return { success: true, message: "Data refreshed successfully" };
}

import { savePrediction, verifyPredictions, getPredictionStats } from '@/lib/history';

export async function savePredictionAction(fixture: any, prediction: any) {
    await savePrediction(fixture, prediction);
    revalidatePath('/dashboard');
    return { success: true };
}

export async function verifyPredictionsAction() {
    await verifyPredictions();
    revalidatePath('/dashboard');
    return { success: true };
}

export async function getHistoryAction() {
    return getPredictionStats();
}
