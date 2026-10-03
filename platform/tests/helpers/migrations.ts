import { readdirSync } from 'node:fs';
/** How many migrations the source holds, so upgrade tests need no edit each time an additive migration lands. */
export const MIGRATION_COUNT = readdirSync(new URL('../../packages/db/migrations/', import.meta.url)).filter(n => /^\d{4}_[a-z0-9_]+\.sql$/.test(n)).length;
