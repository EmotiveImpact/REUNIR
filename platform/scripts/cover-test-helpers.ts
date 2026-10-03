/** Shared by the cover browser checks. Test pictures are drawn by the browser's own encoder; none show a person. */
import type { Page } from '@playwright/test';

/** Insert an EXIF block with a recognisable description, as a camera or phone adds metadata. */
export function withExif(jpeg: Buffer, marker: string): Buffer {
    const text = Buffer.from(marker + '\0', 'latin1');
    const tiff = Buffer.concat([Buffer.from('MM\0\x2a\0\0\0\x08', 'latin1'), Buffer.from([0, 1, 0x01, 0x0e, 0, 2, 0, 0, 0, text.length, 0, 0, 0, 26, 0, 0, 0, 0]), text]);
    const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body, jpeg.subarray(2)]);
}

/** A neutral grey test picture, optionally on a transparent ground. */
export async function picture(page: Page, type: 'image/png' | 'image/jpeg', width: number, height: number, transparent = false): Promise<Buffer> {
    const encoded = await page.evaluate(async ({ type, width, height, transparent }) => {
        const c = document.createElement('canvas'); c.width = width; c.height = height;
        const g = c.getContext('2d')!;
        if (!transparent) { g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, width, height); }
        g.fillStyle = '#222222'; g.fillRect(width * .1, height * .2, width * .35, height * .6);
        g.fillStyle = '#777777'; g.beginPath(); g.arc(width * .7, height * .45, Math.min(width, height) * .25, 0, Math.PI * 2); g.fill();
        const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!), type, .9));
        let text = ''; for (const byte of new Uint8Array(await blob.arrayBuffer())) text += String.fromCharCode(byte);
        return btoa(text);
    }, { type, width, height, transparent });
    return Buffer.from(encoded, 'base64');
}
