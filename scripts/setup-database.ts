import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
    console.log('🚀 Creando tablas en Supabase...\n');

    // Leer el archivo SQL
    const fs = require('fs');
    const sql = fs.readFileSync('supabase-schema.sql', 'utf8');

    try {
        // Ejecutar SQL usando Supabase
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ Error ejecutando SQL:', error.message);
            console.log('\n⚠️  SOLUCIÓN MANUAL REQUERIDA:');
            console.log('1. Ve a: https://supabase.com/dashboard/project/zpvpyizifptdtlhiflru');
            console.log('2. Abre SQL Editor');
            console.log('3. Copia el contenido de supabase-schema.sql');
            console.log('4. Pégalo y ejecuta (RUN)');
            return false;
        }

        console.log('✅ Tablas creadas exitosamente\n');
        return true;
    } catch (e: any) {
        console.log('⚠️  La creación automática falló.');
        console.log('📋 EJECUTA MANUALMENTE:');
        console.log('\n1. Abre: https://supabase.com/dashboard/project/zpvpyizifptdtlhiflru/editor');
        console.log('2. SQL Editor → New Query');
        console.log('3. Pega el contenido de: supabase-schema.sql');
        console.log('4. Click en RUN\n');
        return false;
    }
}

// Verificar conexión
async function testConnection() {
    console.log('🔌 Verificando conexión con Supabase...');

    try {
        const { data, error } = await supabase.from('user_bankroll').select('count');

        if (!error || error.code === 'PGRST116') {
            console.log('✅ Conexión exitosa\n');
            return true;
        } else {
            console.log('⚠️  Tablas no existen aún\n');
            return false;
        }
    } catch (e) {
        console.log('❌ Error de conexión\n');
        return false;
    }
}

async function main() {
    const connected = await testConnection();

    if (!connected) {
        await createTables();
    } else {
        console.log('✅ Las tablas ya existen en Supabase');
    }
}

main();
