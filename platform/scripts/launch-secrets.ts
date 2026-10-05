/**
 * Fills the empty server secrets in a local, git-ignored environment file with independent random values, so the
 * owner never has to invent, copy or paste one. It never prints a value, never replaces one already set and refuses
 * a file that git would track.
 *
 *   npm run launch:secrets -- --env-file .env.staging
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Server secrets the app generates for itself. Provider keys and the database password come from their providers. */
export const GENERATED_SECRETS = ['BETTER_AUTH_SECRET', 'EMAIL_ENCRYPTION_KEY', 'CRON_SECRET'] as const;

/** 48 random bytes as base64url: 64 characters, safe in headers, URLs and .env files without quoting. */
export const newSecret = () => randomBytes(48).toString('base64url');

/**
 * Pure apart from `generate`: sets each listed name whose value is empty, keeping every other line, comment and value
 * exactly as it was. A name that is missing entirely is appended.
 */
export function fillSecrets(text: string, generate: () => string = newSecret): { text: string; filled: string[]; kept: string[] } {
    const filled: string[] = [], kept: string[] = [];
    const lines = text.split('\n');
    for (const name of GENERATED_SECRETS) {
        const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`);
        const at = lines.findIndex(l => pattern.test(l));
        if (at < 0) {
            if (lines.length && lines[lines.length - 1] === '') lines.splice(lines.length - 1, 0, `${name}=${generate()}`);
            else lines.push(`${name}=${generate()}`);
            filled.push(name);
            continue;
        }
        const value = pattern.exec(lines[at])![1].replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');
        if (value) { kept.push(name); continue; }
        lines[at] = `${name}=${generate()}`;
        filled.push(name);
    }
    return { text: lines.join('\n'), filled, kept };
}

/** True when git would ignore the file, or when the folder is not a git checkout at all. */
function ignoredByGit(path: string): boolean {
    const r = spawnSync('git', ['check-ignore', '-q', basename(path)], { cwd: dirname(path) });
    return r.status === 0 || r.status === 128 || r.error !== undefined;
}

function main(argv: string[]): number {
    const at = argv.indexOf('--env-file'), file = at >= 0 ? argv[at + 1] : undefined;
    if (!file || argv.length !== 2) { console.error('Usage: npm run launch:secrets -- --env-file <path to a git-ignored file such as .env.staging>'); return 2; }
    const path = resolve(file);
    if (!ignoredByGit(path)) { console.error('Refusing: git would track this file. Use a name such as .env.staging, which the repository ignores.'); return 2; }
    let text: string;
    try { text = readFileSync(path, 'utf8'); } catch { console.error('Could not read the environment file. Copy .env.staging.example to it first.'); return 2; }
    const result = fillSecrets(text);
    if (result.filled.length) { writeFileSync(path, result.text); chmodSync(path, 0o600); }
    console.log([
        result.filled.length ? `Generated (values not shown): ${result.filled.join(', ')}.` : 'Nothing generated.',
        result.kept.length ? `Already set, left unchanged: ${result.kept.join(', ')}.` : '',
        'Keep this file out of chat, commits and screenshots. Next: npm run launch:preflight -- --env-file ' + file,
    ].filter(Boolean).join('\n'));
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
