import { connect } from 'node:net';

/** What a scan found. A flagged file names the signature ClamAV matched, never the file's contents. */
export type ScanVerdict = { clean: true } | { clean: false; signature: string };
/** Bytes to scan: held in memory, or streamed in pieces (for example straight from storage) with their total size. */
export type ScanSource = Uint8Array | { chunks: AsyncIterable<Uint8Array>; size: number };
export interface FileScanner {
    scan(source: ScanSource): Promise<ScanVerdict>;
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
/**
 * One clamd command over a fresh TCP connection, returning its null-terminated reply. `write` may be slow (a stream from
 * storage); it waits for the socket to drain, stops as soon as clamd has answered, and an error it throws ends the
 * conversation with that error rather than as an unavailable scanner.
 */
function converse(options: Required<ClamdOptions>, write: (send: (b: Uint8Array) => Promise<void>, answered: () => boolean) => Promise<void>): Promise<string> {
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
        // Waits for the socket to drain when it is full, and otherwise lets I/O run between writes, so clamd's answer is
        // heard even while a long stream is still being sent.
        const send = (b: Uint8Array) => new Promise<void>(done => {
            if (settled) return done();
            if (socket.write(b)) return void setImmediate(done);
            const go = () => { socket.off('drain', go); socket.off('close', go); done(); };
            socket.on('drain', go); socket.on('close', go);
        });
        socket.on('connect', () => { write(send, () => settled).catch(error => finish(error instanceof Error ? error : new Error(String(error)))); });
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
        async scan(source) {
            const size = source instanceof Uint8Array ? source.length : source.size;
            const pieces: AsyncIterable<Uint8Array> = source instanceof Uint8Array ? (async function* () { yield source; })() : source.chunks;
            // A lesson video can be hundreds of megabytes, so the allowance grows with the file rather than cutting it off at 30 s.
            const timeoutMs = scanTimeoutMs(o, size);
            const reply = await converse({ ...o, timeoutMs }, async (send, answered) => {
                await send(Buffer.from('zINSTREAM\0'));
                // Re-cut whatever arrives into chunks clamd accepts, so a whole file is never held at once.
                for await (const piece of pieces) {
                    for (let at = 0; at < piece.length; at += o.chunkBytes) {
                        if (answered()) return;
                        const part = piece.subarray(at, Math.min(piece.length, at + o.chunkBytes)), length = Buffer.alloc(4);
                        length.writeUInt32BE(part.length);
                        await send(Buffer.concat([length, part]));
                    }
                }
                await send(Buffer.alloc(4));
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
