import * as dotenv from 'dotenv';
import path from 'path';

// Fix for resolving .env.local correctly from current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testCapabilities() {
    // Dynamic import to ensure process.env is populated before the module reads it
    const { fetchApi } = await import('./lib/api-client');

    console.log("Testing API Capabilities...");

    // 1. Get a recent fixture ID (e.g., from Premier League)
    const fixtures = await fetchApi('fixtures', { league: 39, next: 1 });
    if (!fixtures || fixtures.length === 0) {
        console.error("No fixtures found to test.");
        return;
    }
    const fixtureId = fixtures[0].fixture.id;
    console.log(`Testing with Fixture ID: ${fixtureId} (${fixtures[0].teams.home.name} vs ${fixtures[0].teams.away.name})`);

    // 2. Check Referee & Venue (Standard Fixture Data)
    console.log("Referee:", fixtures[0].fixture.referee);
    console.log("Venue:", fixtures[0].fixture.venue);

    // 3. Test Injuries Endpoint
    console.log("\n--- Testing Injuries ---");
    try {
        const injuries = await fetchApi('injuries', { fixture: fixtureId });
        console.log(`Injuries found: ${injuries.length}`);
        if (injuries.length > 0) console.log(injuries[0]);
    } catch (e: any) {
        console.log("Injuries endpoint failed (likely access restricted):", e.message);
    }

    // 4. Test Odds Endpoint
    console.log("\n--- Testing Odds ---");
    try {
        const odds = await fetchApi('odds', { fixture: fixtureId });
        if (odds.length > 0) {
            console.log("Odds found!");
            console.log(JSON.stringify(odds[0].bookmakers[0], null, 2));
        } else {
            console.log("No odds available for this fixture.");
        }
    } catch (e: any) {
        console.log("Odds endpoint failed (likely access restricted):", e.message);
    }
}

testCapabilities();
