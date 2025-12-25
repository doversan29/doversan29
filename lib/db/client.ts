import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Variables de entorno requeridas
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL o SUPABASE_DATABASE_URL no está configurada en las variables de entorno');
}

// Crear cliente de PostgreSQL
const client = postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10
});

// Crear instancia de Drizzle
export const db = drizzle(client, { schema });

// Tipos exportados
export type Database = typeof db;

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
