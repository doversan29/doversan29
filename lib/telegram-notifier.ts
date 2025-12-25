
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Main admin chat or channel for alerts

/**
 * Send a value bet alert to the configured Telegran Chat/Channel
 */
export async function sendSniperAlert(data: {
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    matchDate: string;
    recommendedBet: string;
    edge: number;
    odds: number;
    kellyStake: number;
}) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('[Telegram] Bot token or Chat ID missing for Sniper Alerts');
        return;
    }

    const emoji = data.edge > 20 ? '🚨🔥' : data.edge > 15 ? '🚨' : '⚡';
    const edgeText = data.edge.toFixed(1);

    const message =
        `${emoji} *SNIPER ALERT DETECTED*\n\n` +
        `⚽ *${data.homeTeam}* vs *${data.awayTeam}*\n` +
        `📅 ${data.matchDate.split('T')[0]}\n\n` +
        `🎯 Bet: *${data.recommendedBet}*\n` +
        `💵 Odds: *${data.odds.toFixed(2)}*\n` +
        `📈 Edge: *${edgeText}%*\n` +
        `💰 Rec. Stake: *$${data.kellyStake.toFixed(2)}*\n\n` +
        `[Ver en App](https://doversan29.vercel.app/fixture/${data.fixtureId})`;

    // Inline button to go straight to app
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🚀 Bet Now', url: `https://doversan29.vercel.app/fixture/${data.fixtureId}` }
            ]
        ]
    };

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            })
        });
        console.log(`[Sniper] Alert sent for fixture ${data.fixtureId}`);
    } catch (error) {
        console.error('[Sniper] Failed to send Telegram alert:', error);
    }
}
