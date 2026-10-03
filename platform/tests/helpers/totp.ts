import { createHmac } from 'node:crypto';
/** RFC 4648 base32, as an `otpauth://` link carries the secret. */
export function base32Decode(text: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0;
    const out: number[] = [];
    for (const ch of text.replace(/=+$/, '').toUpperCase()) {
        const index = alphabet.indexOf(ch);
        if (index < 0) throw new Error('Not base32.');
        value = (value << 5) | index; bits += 5;
        if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
}
/** RFC 6238 time-based code (HMAC-SHA1, 30 seconds, six digits), computed independently of the library under test. */
export function totpCode(otpauth: string, at = Date.now(), step = 0): string {
    const key = base32Decode(new URL(otpauth).searchParams.get('secret') ?? '');
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000) + step));
    const mac = createHmac('sha1', key).update(counter).digest();
    const offset = mac[mac.length - 1] & 15;
    const number = ((mac[offset] & 127) << 24 | mac[offset + 1] << 16 | mac[offset + 2] << 8 | mac[offset + 3]) % 1_000_000;
    return String(number).padStart(6, '0');
}
