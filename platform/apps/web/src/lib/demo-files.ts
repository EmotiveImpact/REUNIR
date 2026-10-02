/**
 * Fictional demo only: file bytes stay in this browser. IndexedDB keeps them across reloads where the
 * browser allows it; private windows and embedded previews fall back to memory for the session.
 */
const memory = new Map<string, Blob>();
let opened: Promise<IDBDatabase | null> | undefined;
function database(): Promise<IDBDatabase | null> {
    opened ??= new Promise(resolve => {
        try {
            const request = indexedDB.open('reunir.demo.files.v1', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('files');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        }
        catch { resolve(null); }
    });
    return opened;
}
async function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await database();
    if (!db) return undefined;
    return new Promise(resolve => {
        try {
            const request = act(db.transaction('files', mode).objectStore('files'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(undefined);
        }
        catch { resolve(undefined); }
    });
}
const key = (slug: string, id: string) => `${slug}/${id}`;
export async function putDemoFile(slug: string, id: string, blob: Blob) { memory.set(key(slug, id), blob); await run('readwrite', s => s.put(blob, key(slug, id))); }
export async function getDemoFile(slug: string, id: string): Promise<Blob | undefined> {
    const value = memory.get(key(slug, id)) ?? await run<Blob>('readonly', s => s.get(key(slug, id)));
    return value instanceof Blob ? value : undefined;
}
export async function removeDemoFile(slug: string, id: string) { memory.delete(key(slug, id)); await run('readwrite', s => s.delete(key(slug, id))); }
export async function clearDemoFiles() { memory.clear(); await run('readwrite', s => s.clear()); }
