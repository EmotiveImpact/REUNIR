import { connect } from 'node:net';

/** What a scan found. A flagged file names the signature ClamAV matched, never the file's contents. */
export type ScanVerdict = { clean: true } | { clean: false; signature: string };
export interface FileScanner {
    scan(bytes: Uint8Array): Promise<ScanVerdict>;
    /** True when the scanner answers. Used by the launch check, never on a request path. */
    ping(): Promise<boolean>;
}
/** The scanner could not give a verdict: unreachable, timed out, over its limits or answering in a way we do not understand. */
export class ScannerUnavailable extends Error {
    constructor(reason: string) { super(reason); this.name = 'ScannerUnavailable'; }
}
export interface ClamdOptions {
    host: string;
    port?: number;
    /** Whole conversation, connect to verdict, for a small file. A scan adds `msPerMegabyte` for each MiB it sends. */
    timeoutMs?: number;
    msPerMegabyte?: number;
    chunkBytes?: number;
}
/** One clamd command over a fresh TCP connection, returning its null-terminated reply. */
function converse(options: Required<ClamdOptions>, write: (send: (b: Uint8Array) => void) => void): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = connect({ host: options.host, port: options.port });
        const chunks: Buffer[] = [];
        let settled = false;
        const finish = (error: Error | null, reply?: string) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            if (error) reject(error); else resolve(reply!);
        };
        const timer = setTimeout(() => finish(new ScannerUnavailable('timeout')), options.timeoutMs);
        socket.on('connect', () => { write(b => socket.write(b)); });
        socket.on('data', d => {
            chunks.push(d);
            const all = Buffer.concat(chunks), end = all.indexOf(0);
            if (end >= 0) finish(null, all.subarray(0, end).toString('utf8').trim());
        });
        socket.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8').replace(/\0+$/, '').trim()));
        socket.on('error', () => finish(new ScannerUnavailable('connection')));
    });
}
/** Reads a clamd INSTREAM reply: `stream: OK`, `stream: <signature> FOUND`, or anything else as unavailable. */
export function readVerdict(reply: string): ScanVerdict {
    const body = reply.replace(/^stream:\s*/, '');
    if (body === 'OK') return { clean: true };
    const found = /^(.+) FOUND$/.exec(body);
    if (found) return { clean: false, signature: found[1].trim().slice(0, 200) };
    throw new ScannerUnavailable(/ERROR$/.test(body) ? 'scanner-error' : 'unexpected-reply');
}
/**
 * ClamAV's clamd daemon, spoken to with its INSTREAM command: bytes go in length-prefixed chunks and a zero-length chunk
 * ends the stream. Nothing is written to disk on either side by this client.
 */
export function clamdScanner(options: ClamdOptions): FileScanner {
    if (!options.host) throw new Error('CLAMAV_HOST is required for upload scanning.');
    const o: Required<ClamdOptions> = { port: 3310, timeoutMs: 30_000, msPerMegabyte: 1_000, chunkBytes: 64 * 1024, ...options };
    if (!Number.isInteger(o.port) || o.port < 1 || o.port > 65535) throw new Error('CLAMAV_PORT must be a TCP port.');
    return {
        async scan(bytes) {
            // A lesson video can be hundreds of megabytes, so the allowance grows with the file rather than cutting it off at 30 s.
            const timeoutMs = scanTimeoutMs(o, bytes.length);
            const reply = await converse({ ...o, timeoutMs }, send => {
                send(Buffer.from('zINSTREAM\0'));
                for (let at = 0; at < bytes.length; at += o.chunkBytes) {
                    const part = bytes.subarray(at, Math.min(bytes.length, at + o.chunkBytes)), size = Buffer.alloc(4);
                    size.writeUInt32BE(part.length);
                    send(size); send(part);
                }
                send(Buffer.alloc(4));
            });
            return readVerdict(reply);
        },
        async ping() {
            try { return (await converse(o, send => send(Buffer.from('zPING\0')))) === 'PONG'; }
            catch { return false; }
        },
    };
}
/** How long one scan of `size` bytes may take, connect to verdict. */
export function scanTimeoutMs(options: Pick<Required<ClamdOptions>, 'timeoutMs' | 'msPerMegabyte'>, size: number): number {
    return options.timeoutMs + Math.ceil(size / (1024 * 1024)) * options.msPerMegabyte;
}
/** The scanner the server should use, or none. Throws on a setting that cannot be honoured. */
export function scannerFromEnvironment(env: Readonly<Record<string, string | undefined>>): FileScanner | undefined {
    const host = env.CLAMAV_HOST?.trim();
    if (!host) return undefined;
    return clamdScanner({ host, port: env.CLAMAV_PORT?.trim() ? Number(env.CLAMAV_PORT) : 3310 });
}
