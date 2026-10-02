import { Pool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as authSchema from './auth-schema';
export interface SQL {
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{
        rows: T[];
    }>;
}
export interface Database extends SQL {
    transaction<T>(fn: (sql: SQL) => Promise<T>): Promise<T>;
    close(): Promise<void>;
    orm: ReturnType<typeof pgDrizzle> | ReturnType<typeof liteDrizzle>;
    kind: 'postgres' | 'pglite';
}
export function postgresConfig(connectionString: string) {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol))
        throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslnegotiation'])
        url.searchParams.delete(key);
    // Do not let connection-string sslmode silently override certificate validation.
    return { connectionString: url.toString(), ssl: local ? false as const : { rejectUnauthorized: true }, max: process.env.VERCEL ? 2 : 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, enableChannelBinding: true };
}
export async function openDatabase(url: string): Promise<Database> {
    if (!url)
        throw new Error('DATABASE_URL is required. No cloud connection has been substituted.');
    if (url.startsWith('pglite:')) {
        if (process.env.NODE_ENV === 'production')
            throw new Error('PGlite development databases are forbidden in production.');
        const directory = url.slice('pglite:'.length);
        const client = new PGlite(directory === 'memory' ? undefined : directory);
        await client.waitReady;
        const orm = liteDrizzle(client, { schema: authSchema });
        return { kind: 'pglite', orm, query: async <T>(text: string, params: unknown[] = []) => { const r = await client.query<T>(text, params); return { rows: r.rows }; }, transaction: fn => client.transaction(async (tx) => fn({ query: async <T>(text: string, params: unknown[] = []) => { const r = await tx.query<T>(text, params); return { rows: r.rows }; } })), close: () => client.close() };
    }
    const pool = new Pool(postgresConfig(url));
    const orm = pgDrizzle(pool, { schema: authSchema });
    return { kind: 'postgres', orm, query: async <T>(text: string, params: unknown[] = []) => ({ rows: (await pool.query(text, params)).rows as T[] }), transaction: async (fn) => { const client = await pool.connect(); try {
            await client.query('BEGIN');
            await client.query("SET LOCAL statement_timeout = '15s'");
            const result = await fn({ query: async <T>(text: string, params: unknown[] = []) => ({ rows: (await client.query(text, params)).rows as T[] }) });
            await client.query('COMMIT');
            return result;
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        } }, close: () => pool.end() };
}
