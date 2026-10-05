import type { DownloadOptions, PrivateStorage } from '../../apps/api/src/storage';

/** In-memory stand-in for the private bucket. Each write gets a new generation, as in Cloud Storage. */
export class FakeBucket implements PrivateStorage {
    objects = new Map<string, { bytes: Uint8Array; contentType: string; generation: string }>();
    policies: { key: string; contentType: string; sizeBytes: number }[] = [];
    removed: string[] = [];
    reads: { key: string; bytes: number; generation: string }[] = [];
    private generation = 1712345678900000;
    put(key: string, bytes: Uint8Array, contentType: string) { this.objects.set(key, { bytes, contentType, generation: String(++this.generation) }); }
    async upload(key: string, contentType: string, sizeBytes: number) { this.policies.push({ key, contentType, sizeBytes }); return { url: 'https://storage.example.test/reunir-test/', fields: { key, 'Content-Type': contentType } }; }
    async download(key: string, options: DownloadOptions = {}) { return `https://storage.example.test/signed/${encodeURIComponent(key)}?generation=${options.generation}`; }
    async metadata(key: string) { const o = this.objects.get(key); return o ? { size: o.bytes.length, contentType: o.contentType, generation: o.generation } : null; }
    async head(key: string, bytes: number, generation: string) {
        this.reads.push({ key, bytes, generation });
        const o = this.objects.get(key);
        if (!o || o.generation !== generation) throw Object.assign(new Error('No such object generation'), { code: 404 });
        return o.bytes.slice(0, bytes);
    }
    /** Whole generations, in 1000-byte pieces, as the scan worker reads them. */
    streams: { key: string; generation: string }[] = [];
    async *stream(key: string, generation: string) {
        this.streams.push({ key, generation });
        const o = this.objects.get(key);
        if (!o || o.generation !== generation) throw Object.assign(new Error('No such object generation'), { code: 404 });
        for (let at = 0; at < o.bytes.length; at += 1000) yield o.bytes.slice(at, at + 1000);
    }
    async remove(key: string) { this.removed.push(key); this.objects.delete(key); }
}
