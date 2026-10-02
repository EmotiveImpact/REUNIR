import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../packages/contracts/src/index';
const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const uploadSchema = z.object({ name: z.string().trim().min(1).max(160).refine(n => !/[\x00-\x1f\\/]/.test(n), 'Use a filename, not a path.'), contentType: z.enum(allowed), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).strict();
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export function objectKey(organizationId: string, userId: string, contentType: keyof typeof extensions, id = randomUUID()) {
    for (const value of [organizationId, userId, id])
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value))
            throw new DomainError('INVALID_PATH', 'Invalid object scope.');
    return `organisations/${organizationId}/members/${userId}/${id}.${extensions[contentType]}`;
}
export interface PrivateStorage {
    upload(key: string, contentType: string, sizeBytes: number): Promise<{
        url: string;
        fields: Record<string, string>;
    }>;
    download(key: string): Promise<string>;
    metadata(key: string): Promise<{
        size: number;
        contentType: string;
    }>;
}
export function googleStorage(bucket: string, credentialJSON?: string): PrivateStorage {
    if (!bucket)
        throw new Error('GCS_BUCKET is required for storage.');
    const client = new Storage(credentialJSON ? { credentials: JSON.parse(credentialJSON) } : {});
    const b = client.bucket(bucket);
    return { upload: async (key, contentType, sizeBytes) => (await b.file(key).generateSignedPostPolicyV4({ expires: Date.now() + 5 * 60 * 1000, fields: { 'Content-Type': contentType }, conditions: [['content-length-range', sizeBytes, sizeBytes]] }))[0], download: async (key) => (await b.file(key).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 2 * 60 * 1000, responseDisposition: 'attachment' }))[0], metadata: async (key) => { const [m] = await b.file(key).getMetadata(); return { size: Number(m.size), contentType: m.contentType || '' }; } };
}
