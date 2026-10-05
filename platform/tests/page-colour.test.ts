import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A host page (an embedding viewer, a browser extension, a light system theme) must not show through the dark interface.
test('the app declares its dark scheme and paints its own page and text', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../apps/web/src/styles.css'), 'utf8');
    assert.match(css, /:root\{[^}]*color-scheme:dark/);
    assert.match(css, /(^|\})body\{[^}]*background:var\(--bg\)[^}]*color:#f1f1f1/m);
});
