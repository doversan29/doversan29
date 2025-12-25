import { initializeBankroll, initializeSystemWeights } from './lib/db/queries';

/**
 * Script de inicialización de la base de datos
 * 
 * Ejecutar una vez después de crear las tablas en Supabase
 */
async function initializeDatabase() {
    console.log('🚀 Inicializando BetPredict v2.0...\n');

    try {
        // 1. Inicializar Bankroll
        console.log('1️⃣ Creando bankroll inicial...');
        const bankroll = await initializeBankroll('default', 100);
        console.log(`   ✅ Bankroll creado: $${bankroll.currentBalance}\n`);

        // 2. Inicializar Pesos del Sistema
        console.log('2️⃣ Configurando estrategias del sistema...');
        await initializeSystemWeights();
        console.log('   ✅ Estrategias inicializadas\n');

        console.log('✅ Base de datos lista para operar\n');
        console.log('📱 Próximo paso: Configurar webhook de Telegram');
        console.log('   Ejecuta: npm run setup:telegram');

    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
        process.exit(1);
    }

    process.exit(0);
}

initializeDatabase();
