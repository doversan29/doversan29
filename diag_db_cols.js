
const fs = require('fs');
const path = require('path');

// Manually parse .env.local since we might not have dotenv installed
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const postgres = require('postgres');
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL not found");
    process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function checkCols() {
    try {
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'match_analysis';
        `;
        console.log('Columns in match_analysis:');
        columns.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

        const betCols = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_outcome';
        `;
        console.log('\nColumns in bet_outcome:');
        betCols.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));

    } catch (e) {
        console.error("Error diagnosing DB:", e);
    } finally {
        await sql.end();
    }
}

checkCols();
