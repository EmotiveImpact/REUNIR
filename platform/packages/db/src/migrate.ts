import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Database } from './connection';
/** Ordered, checksummed additive migrations. `through` is used by upgrade verification. */
export async function migrate(db: Database, through?: string) {
    const directory = new URL('../migrations/', import.meta.url);
    const names = (await readdir(directory)).filter(n => /^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
    if (through && !names.some(n => n.startsWith(through + '_'))) throw new Error('Unknown migration target.');
    await db.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(74829361)');
        await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, digest text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        for (const name of names) {
            const version = name.slice(0,4);
            if (through && version > through) break;
            const sql = await readFile(new URL(name,directory),'utf8');
            const digest = createHash('sha256').update(sql).digest('hex');
            const existing = await tx.query<{digest:string}>('SELECT digest FROM schema_migrations WHERE version=$1',[version]);
            if (existing.rows.length) {
                if (existing.rows[0].digest !== digest) throw new Error(`Migration ${version} differs from its applied checksum. Write a new migration.`);
                continue;
            }
            // These versioned files contain fixed DDL, no procedural bodies or semicolons in strings.
            for (const statement of sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean)) await tx.query(statement);
            await tx.query('INSERT INTO schema_migrations(version,digest) VALUES($1,$2)',[version,digest]);
        }
    });
}
