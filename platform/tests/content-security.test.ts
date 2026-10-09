import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT_SECURITY_POLICY } from '../apps/api/src/content-security';

test('Vercel sends the same report-only Content-Security-Policy as the Node server', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const sent = vercel.headers.find((h: { source: string }) => h.source === '/(.*)').headers.find((h: { key: string }) => h.key === 'Content-Security-Policy-Report-Only');
    assert.equal(sent?.value, CONTENT_SECURITY_POLICY);
});

test('the policy allows scripts only from the site and forbids plugins, framing and base changes', () => {
    const directives = new Map(CONTENT_SECURITY_POLICY.split('; ').map(d => { const [name, ...values] = d.split(' '); return [name, values.join(' ')]; }));
    assert.equal(directives.get('script-src'), "'self'");
    assert.equal(directives.get('object-src'), "'none'");
    assert.equal(directives.get('frame-ancestors'), "'none'");
    assert.equal(directives.get('base-uri'), "'none'");
    assert(!CONTENT_SECURITY_POLICY.includes('unsafe-eval'));
});
