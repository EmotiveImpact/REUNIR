import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Vite's development server rewrites named imports from CommonJS packages such as React into constants at the
 * import's position. Code placed above a binding import then fails in `npm run dev` although production builds work.
 */
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
});
test('web modules declare nothing above their last binding import', () => {
    const root = join(import.meta.dirname, '../apps/web/src');
    const offenders = files(root).flatMap(file => {
        const lines = readFileSync(file, 'utf8').split('\n');
        const last = lines.reduce((at, line, i) => /^import\s+(?!['"])/.test(line) ? i : at, -1);
        return lines.slice(0, Math.max(0, last)).flatMap((line, i) => /^(?!import\b)[A-Za-z_$]/.test(line) ? [`${relative(root, file)}:${i + 1}`] : []);
    });
    assert.deepEqual(offenders, []);
});
