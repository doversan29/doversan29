import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Variables de entorno requeridas
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

// Crear cliente de PostgreSQL solo si DATABASE_URL existe (runtime)
// Durante el build, esto puede no estar disponible, lo cual es OK
const client = DATABASE_URL ? postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10
}) : null as any;

// Crear instancia de Drizzle
export const db = client ? drizzle(client, { schema }) : null as any;

// Tipos exportados
export type Database = typeof db;

/**
 * Health check de la base de datos
 */
export async function checkDatabaseConnection(): Promise<boolean> {
    if (!client) return false;

    try {
        await client`SELECT 1`;
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
}
