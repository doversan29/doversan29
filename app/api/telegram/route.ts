import { NextRequest, NextResponse } from 'next/server';
import { getBankroll, getMatchAnalysis, placeBet } from '@/lib/db/queries';
import { calculateKellyStake } from '@/lib/betting/kelly-criterion';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN no configurado');
}

/**
 * Verificar que el webhook viene de Telegram
 */
function verifyTelegramRequest(request: NextRequest): boolean {
    if (!TELEGRAM_SECRET_TOKEN) return true; // En desarrollo

    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    return secretHeader === TELEGRAM_SECRET_TOKEN;
}

/**
 * Enviar mensaje a Telegram
 */
async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log('[DEV] Telegram message:', text);
        return;
    }

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
        })
    });

    return await response.json();
}

/**
 * Responder a callback (botones inline)
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
    if (!TELEGRAM_BOT_TOKEN) return;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text || '✅ Procesado'
        })
    });
}

/**
 * Manejar comandos de texto
 */
async function handleCommand(command: string, chatId: number) {
    if (command === '/start') {
        await sendTelegramMessage(
            chatId,
            '⚽ *BetPredict v2.0 Activado*\n\n' +
            'Tu agente autónomo de apuestas está listo.\n\n' +
            'Recibirás alertas cuando detecte VALUE BETS con edge >10%.\n\n' +
            'Comandos:\n' +
            '/bankroll - Ver estado del bankroll\n' +
            '/stats - Estadísticas del sistema'
        );
    } else if (command === '/bankroll') {
        try {
            const bankroll = await getBankroll();
            if (!bankroll) {
                await sendTelegramMessage(chatId, '❌ Bankroll no inicializado. Contacta al administrador.');
                return;
            }

            const emoji = bankroll.totalProfit >= 0 ? '📈' : '📉';
            await sendTelegramMessage(
                chatId,
                `💰 *Tu Bankroll*\n\n` +
                `Balance Actual: $${bankroll.currentBalance.toFixed(2)}\n` +
                `Inversión Inicial: $${bankroll.initialInvestment.toFixed(2)}\n` +
                `${emoji} P&L Total: $${bankroll.totalProfit.toFixed(2)}\n` +
                `📊 ROI: ${bankroll.roi.toFixed(1)}%`
            );
        } catch (error) {
            console.error('Error fetching bankroll:', error);
            await sendTelegramMessage(chatId, '❌ Error al obtener el bankroll. Intenta de nuevo más tarde.');
        }
    } else if (command === '/stats') {
        try {
            await sendTelegramMessage(
                chatId,
                `📊 *Estadísticas del Sistema*\n\n` +
                `🤖 Modelo: Poisson v3.6 + Reality Dampener\n` +
                `🎯 Umbral Value: >10% edge\n` +
                `💰 Kelly: Fractional (1/4)\n` +
                `🔄 Auto-Tuning: Activo\n\n` +
                `📱 Estado: ✅ Operacional\n` +
                `🌐 Web: doversan29.vercel.app`
            );
        } catch (error) {
            console.error('Error in stats command:', error);
            await sendTelegramMessage(chatId, '❌ Error al obtener estadísticas.');
        }
    } else {
        await sendTelegramMessage(
            chatId,
            '❓ Comando no reconocido.\n\n' +
            'Comandos disponibles:\n' +
            '/start - Iniciar bot\n' +
            '/bankroll - Ver bankroll\n' +
            '/stats - Ver estadísticas'
        );
    }
}

/**
 * Manejar botones inline (Callback Queries)
 */
async function handleCallback(callbackData: string, chatId: number, callbackQueryId: string) {
    const [action, ...params] = callbackData.split(':');

    if (action === 'bet_placed') {
        const fixtureId = parseInt(params[0]);
        const stake = parseFloat(params[1]);

        const analysis = await getMatchAnalysis(fixtureId);
        if (!analysis) {
            await answerCallbackQuery(callbackQueryId, '❌ Análisis no encontrado');
            return;
        }

        // Registrar apuesta
        const odds = analysis.predictedOutcome === 'HOME' ? analysis.oddsHome :
            analysis.predictedOutcome === 'DRAW' ? analysis.oddsDraw :
                analysis.oddsAway;

        if (!odds) {
            await answerCallbackQuery(callbackQueryId, '❌ Cuotas no disponibles');
            return;
        }

        const potentialReturn = stake * odds;

        const bet = await placeBet({
            analysisId: analysis.id,
            stakeAmount: stake,
            potentialReturn
        });

        await answerCallbackQuery(callbackQueryId, '✅ Apuesta registrada');
        await sendTelegramMessage(
            chatId,
            `✅ *Apuesta Confirmada*\n\n` +
            `Partido: ${analysis.homeTeam} vs ${analysis.awayTeam}\n` +
            `Apuesta: ${analysis.predictedOutcome}\n` +
            `Stake: $${stake.toFixed(2)}\n` +
            `Cuota: ${odds.toFixed(2)}\n` +
            `Retorno Potencial: $${potentialReturn.toFixed(2)}\n\n` +
            `🎯 Tracking ID: #${bet.id}`
        );
    } else if (action === 'bet_skipped') {
        await answerCallbackQuery(callbackQueryId, '⏭️ Apuesta omitida');
        await sendTelegramMessage(chatId, '⏭️ Señal omitida. Esperando próxima oportunidad...');
    }
}

/**
 * Endpoint principal del webhook
 */
export async function POST(request: NextRequest) {
    try {
        // Verificar autenticidad
        if (!verifyTelegramRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const update = await request.json();

        // Manejar mensaje de texto
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text?.trim();

            if (text?.startsWith('/')) {
                await handleCommand(text, chatId);
            }
        }

        // Manejar callback (botones)
        if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const callbackData = update.callback_query.data;
            const callbackQueryId = update.callback_query.id;

            await handleCallback(callbackData, chatId, callbackQueryId);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * FUNCIÓN AUXILIAR: Enviar alerta de Value Bet
 * (Llamar desde el detector de valor)
 */
export async function sendValueBetAlert(data: {
    chatId: number;
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    recommendedBet: string;
    edge: number;
    kellyStake: number;
    odds: number;
}) {
    const text =
        `🚨 *VALUE BET DETECTADO*\n\n` +
        `⚽ ${data.homeTeam} vs ${data.awayTeam}\n\n` +
        `🎯 Apuesta: *${data.recommendedBet}*\n` +
        `📊 Edge: *${data.edge.toFixed(1)}%*\n` +
        `💰 Kelly Stake: *$${data.kellyStake.toFixed(2)}*\n` +
        `🔢 Cuota: *${data.odds.toFixed(2)}*\n\n` +
        `¿Qué deseas hacer?`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: '✅ Bet Placed', callback_data: `bet_placed:${data.fixtureId}:${data.kellyStake}` },
                { text: '❌ Skip', callback_data: `bet_skipped:${data.fixtureId}` }
            ],
            [
                { text: '📉 Odds Dropped', callback_data: `odds_dropped:${data.fixtureId}` }
            ]
        ]
    };

    await sendTelegramMessage(data.chatId, text, keyboard);
}
