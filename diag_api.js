const API_KEY = "5ffa52153e4dbe8ee79e4b4bad4e532f";
const BASE_URL = "https://v3.football.api-sports.io";

async function diag() {
    const leagues = [39, 140, 135]; // PL, La Liga, Serie A
    for (const id of leagues) {
        console.log(`\nChecking League ${id}...`);
        const res = await fetch(`${BASE_URL}/leagues?id=${id}`, {
            headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
        });
        const data = await res.json();
        const activeSeason = data.response[0].seasons.find(s => s.current);
        console.log(`Active Season: ${activeSeason ? activeSeason.year : 'None'}`);

        const year = activeSeason ? activeSeason.year : 2025;
        const fixturesRes = await fetch(`${BASE_URL}/fixtures?league=${id}&season=${year}&next=5`, {
            headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
        });
        const fixturesData = await fixturesRes.json();
        console.log(`Upcoming Fixtures: ${fixturesData.results}`);
    }
}

diag();
