import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Variables de entorno requeridas
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL o SUPABASE_DATABASE_URL no está configurada en las variables de entorno');
}

// Crear cliente de PostgreSQL
// Para Supabase, la URL tiene el formato:
// postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const client = postgres(DATABASE_URL, {
    max: 10, // Conexiones máximas en el pool
    idle_timeout: 20,
    connect_timeout: 10
});

// Crear instancia de Drizzle
export const db = drizzle(client, { schema });

// Tipos exportados para uso en la app
export type Database = typeof db;

/**
 * Helper para manejar transacciones
 */
export async function withTransaction<T>(
    callback: (tx: Database) => Promise<T>
): Promise<T> {
    return await db.transaction(async (tx) => {
        return await callback(tx as Database);
    });
}

/**
 * Health check de la base de datos
 */
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await client`SELECT 1`;
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
}
