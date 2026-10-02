import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** Load local configuration only. Existing environment variables always take priority. */
const path = resolve(import.meta.dirname, '../.env');
if (existsSync(path))
    process.loadEnvFile(path);
