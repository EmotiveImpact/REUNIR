import './env';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const children: ChildProcess[] = [];
let ending = false;
function stop(code = 0) { if (ending)
    return; ending = true; for (const p of children)
    p.kill('SIGTERM'); process.exitCode = code; }
function run(args: string[]) { const p = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env }); children.push(p); p.on('error', e => { console.error(e.message); stop(1); }); p.on('exit', code => { if (!ending)
    stop(code ?? 1); }); }
if (process.env.VITE_DATA_MODE === 'live') {
    for (const key of ['DATABASE_URL', 'APP_ORIGIN', 'BETTER_AUTH_SECRET'])
        if (!process.env[key])
            throw new Error(`Set ${key} in platform/.env before starting live mode.`);
    run(['--import', 'tsx', 'apps/api/src/server.ts']);
}
else
    console.log('REUNIR fictional demo. No cloud account or database is required.');
run(['node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.config.ts']);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => stop());
