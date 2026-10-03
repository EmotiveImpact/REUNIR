/** Minimal image headers with chosen dimensions. Enough for signature and size checks; not decodable pictures. */
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => typeof p === 'string' ? Array.from(p, c => c.charCodeAt(0)) : p));
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const be32 = (n: number) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

export function pngHeader(width: number, height: number) {
    return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13], 'IHDR', be32(width), be32(height), [8, 6, 0, 0, 0], [0, 0, 0, 0], new Array(64).fill(0));
}
/** JFIF and a quantisation table before the frame header, as a browser encoder writes them. */
export function jpegHeader(width: number, height: number) {
    return bytes([0xff, 0xd8, 0xff, 0xe0], be16(16), 'JFIF', [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
        [0xff, 0xdb], be16(67), [0], new Array(64).fill(1),
        [0xff, 0xc0], be16(17), [8], be16(height), be16(width), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
        [0xff, 0xda], be16(12), new Array(10).fill(0), new Array(64).fill(0));
}
export function webpHeader(width: number, height: number, kind: 'VP8X' | 'VP8 ' | 'VP8L' = 'VP8X') {
    const body = kind === 'VP8X' ? [[16, 0, 0, 0], le24(width - 1), le24(height - 1)]
        : kind === 'VP8 ' ? [[0, 0, 0], [0x9d, 0x01, 0x2a], [width & 255, (width >> 8) & 0x3f], [height & 255, (height >> 8) & 0x3f]]
        : (() => { const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14); return [[0x2f], [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]]; })();
    return bytes('RIFF', [0, 0, 0, 0], 'WEBP', kind, [10, 0, 0, 0], body.flat(), new Array(64).fill(0));
}
