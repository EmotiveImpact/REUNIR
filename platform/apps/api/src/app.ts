import type { PilotOperations } from './operations';
import { RELEASE_VERSION } from '../../../packages/contracts/src/operations';
import { InvitationService, invitationEmail } from './invitations';
import { MessagingRepository } from '../../../packages/db/src/messaging';
import { startConversation, sendMessage, reportMessage } from '../../../packages/contracts/src/messaging';
import { id } from '../../../packages/contracts/src/index';
import type { MailQueue } from './mail';
import type { DigestService } from './digests';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError, z } from 'zod';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { DomainError } from '../../../packages/contracts/src/index';
import { WorkspaceRepository } from '../../../packages/db/src/repository';
import { coverLibraryObjectKey, coverObjectKey, isMissingObject, objectKey, resourceObjectKey, uploadSchema, type PrivateStorage } from './storage';
import { clientUpload, type StoredObservation } from '../../../packages/domain/src/resources';
import { learningRecordFilename } from '../../../packages/domain/src/learning-record';
import { SIGNATURE_BYTES, fileSignatureMatches, resourceUploadRequest, type ResourceContext } from '../../../packages/contracts/src/lesson-resources';
import { accountDeletionRequest } from '../../../packages/contracts/src/account';
import { pagedList, pageQuery } from '../../../packages/contracts/src/pages';
import { ownershipTransferRequest } from '../../../packages/contracts/src/ownership';
import { EMAIL_CHANGE_SENT, EMAIL_CONFIRMED_PATH, EMAIL_LINK_REFUSED_PATH, changeNoticeMail, emailChangeRequest, type EmailVerification } from '../../../packages/contracts/src/email';
import { TWO_FACTOR_REQUIRED, TWO_FACTOR_REQUIRED_MESSAGE, type AdminTwoFactor } from '../../../packages/contracts/src/two-factor';
import { COVER_HEAD_BYTES, coverBytesAcceptable, coverLibraryUploadRequest, coverSubject, coverUploadRequest } from '../../../packages/contracts/src/covers';
export interface SessionIdentity {
    id: string;
    name: string;
    /** The account's sign-in address, shown only to its owner. */
    email?: string;
    /** Whether that address has been confirmed by a link sent to it. */
    emailVerified?: boolean;
    /** Whether two-step sign-in is turned on for this account. */
    twoFactorEnabled?: boolean;
}
interface Dependencies {
    repository: WorkspaceRepository;
    operations?: PilotOperations;
    origin: string;
    resolveSession: (headers: Headers) => Promise<SessionIdentity | null>;
    authHandler?: (request: Request) => Promise<Response>;
    storage?: PrivateStorage;
    invitations?: InvitationService;
    mail?: MailQueue;
    cronSecret?: string;
    registerInvited?: (name:string,email:string,password:string)=>Promise<{id:string}>;
    /** Checks the signed-in person's current password. False only for a wrong password. */
    verifyPassword?: (headers: Headers, password: string) => Promise<boolean>;
    digests?: DigestService;
    /** When required, owners and administrators must have two-step sign-in turned on to use their authority. Default optional. */
    adminTwoFactor?: AdminTwoFactor;
    /** Whether an unconfirmed address may sign in. Reported to the browser; Better Auth enforces it. Default optional. */
    emailVerification?: EmailVerification;
    /** Asks the auth provider to send a confirmation link to a new address. Only this API's password-checked route calls it. */
    changeEmail?: (user: { id: string; email: string; name: string }, newEmail: string, callbackURL: string) => Promise<void>;
    /** False for a link to change an address that was asked for before the password last changed. */
    emailChangeLinkValid?: (token: string) => Promise<boolean>;
}
export function createApp({ repository, operations, origin, resolveSession, authHandler, storage, invitations, mail, cronSecret, registerInvited, verifyPassword, digests, adminTwoFactor = 'optional', emailVerification = 'optional', changeEmail, emailChangeLinkValid }: Dependencies) {
    const messaging=new MessagingRepository(repository);
    const canonical = new URL(origin).origin;
    const app = new Hono<{
        Variables: {
            identity: SessionIdentity;
            requestId: string;
        };
    }>();
    app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin', referrerPolicy: 'no-referrer', xFrameOptions: 'DENY' }));
    app.use('*', async (c, next) => { c.set('requestId', randomUUID()); c.header('Cache-Control', 'no-store'); c.header('X-Request-ID', c.get('requestId')); await next(); });
    app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: c => c.json({ error: { code: 'BODY_TOO_LARGE', message: 'Request exceeds 64 KB.' } }, 413) }));
    app.use('/api/*', async (c, next) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
            if (c.req.header('origin') !== canonical)
                return c.json({ error: { code: 'ORIGIN_REJECTED', message: 'This action must originate from the application.' } }, 403);
            if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json'))
                return c.json({ error: { code: 'CONTENT_TYPE', message: 'Send application/json.' } }, 415);
        }
        await next();
    });
    app.get('/api/health', async (c) => { await repository.db.query('SELECT 1'); return c.json({ status: 'ok', version: RELEASE_VERSION, mode: 'live', database: repository.db.kind, storage: storage ? 'configured' : 'not-configured' }); });
    app.get('/api/health/live', c=>c.json({status:'ok',version:RELEASE_VERSION}));
    app.get('/api/account/capabilities', c=>c.json({emailDigests:!!digests&&!!mail?.transport,invitations:!!invitations,passwordRecovery:!!mail?.transport,resourceUploads:!!storage,coverUploads:!!storage,twoStepSignIn:!!authHandler,adminTwoFactor,emailVerification,emailConfirmation:!!authHandler&&!!mail?.transport,emailChange:!!changeEmail&&!!mail?.transport}));
    // Best effort after commit: an orphaned object is private and unreferenced, never served.
    const removeQuietly = async (requestId: string, keys: string[]) => { for (const key of keys) {
        try { await storage?.remove(key); }
        catch { console.error(JSON.stringify({ event: 'storage.remove.failed', requestId })); }
    } };
    const scheduled = (c: Context) => {
        const provided=c.req.header('authorization')||'';
        const expected=cronSecret ? 'Bearer '+cronSecret : '';
        return !!expected && timingSafeEqual(createHash('sha256').update(provided).digest(),createHash('sha256').update(expected).digest());
    };
    app.get('/api/internal/mail',async c=>{
        if(!scheduled(c))return c.json({error:{code:'FORBIDDEN',message:'Not authorised.'}},403);
        return c.json(mail ? await mail.drain(2) : {configured:false,sent:0,failed:0});
    });
    // Queues notice digests for members who asked for them; the mail route above sends them. Same scheduler secret.
    app.get('/api/internal/digests',async c=>{
        if(!scheduled(c))return c.json({error:{code:'FORBIDDEN',message:'Not authorised.'}},403);
        return c.json(digests ? {configured:true,...await digests.run()} : {configured:false,due:0,queued:0,quiet:0,skipped:0});
    });
    app.use('/api/auth/request-password-reset',async(c,next)=>{if(!mail?.transport)return c.json({error:{code:'EMAIL_UNAVAILABLE',message:'Password recovery is not configured. Contact the community owner.'}},503);await next();});
    app.use('/api/invitations/*',async(c,next)=>{
        if(!invitations)return c.json({error:{code:'INVITATIONS_UNAVAILABLE',message:'Invitations are not configured.'}},503);
        // Global bounded gate plus per-peer gate. Deploy behind a trusted reverse proxy.
        const peer=createHash('sha256').update(c.req.header('x-real-ip')||'local').digest('hex');
        if(!await repository.consumeRateLimit('invite-global',200)||!await repository.consumeRateLimit('invite-peer:'+peer,30))return c.json({error:{code:'RATE_LIMITED',message:'Try again shortly.'}},429);
        await next();
    });
    const inviteToken=z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict();
    app.post('/api/invitations/inspect',async c=>c.json(await invitations!.inspect(inviteToken.parse(await c.req.json()).token)));
    app.post('/api/invitations/accept',async c=>{
        const who=await resolveSession(c.req.raw.headers);if(!who)throw new DomainError('UNAUTHENTICATED','Sign in to accept this invitation.',401);
        return c.json(await invitations!.accept(inviteToken.parse(await c.req.json()).token,who.id));
    });
    app.post('/api/invitations/register',async c=>{
        if(!registerInvited)throw new DomainError('REGISTRATION_UNAVAILABLE','Account creation is not configured.',503);
        const body=z.object({token:inviteToken.shape.token,name:z.string().trim().min(2).max(80),password:z.string().min(12).max(128)}).strict().parse(await c.req.json());
        const email=await invitations!.registrationEmail(body.token);
        let user:{id:string};
        try {user=await registerInvited(body.name,email,body.password);} catch {throw new DomainError('ACCOUNT_ACCESS','Unable to create this account. Already registered? Sign in, or use password recovery.',409);}
        // Registration uses the auth provider. A revoke race can leave a non-member account, never access.
        return c.json(await invitations!.accept(body.token,user.id),201);
    });
    // Deleting your own account: password re-entered, the phrase typed, owners refused, one transaction, then the stored
    // private files. The session rows go with the account, and the cookie is cleared as well.
    app.post('/api/account/delete', async c => {
        const who = await resolveSession(c.req.raw.headers);
        if (!who) throw new DomainError('UNAUTHENTICATED', 'Please sign in.', 401);
        if (!verifyPassword) throw new DomainError('UNAVAILABLE', 'Account deletion is not configured.', 503);
        if (!await repository.consumeRateLimit('account-delete:' + who.id, 5, 900)) throw new DomainError('RATE_LIMITED', 'Too many attempts. Wait a few minutes before trying again.', 429);
        const body = accountDeletionRequest.parse(await c.req.json());
        if (!await verifyPassword(c.req.raw.headers, body.password)) throw new DomainError('WRONG_PASSWORD', 'That password is not right.', 403);
        const { summary, files } = await repository.deleteAccount(who.id, mail ? (sql, email) => mail.forget(email, sql) : undefined);
        await removeQuietly(c.get('requestId'), files);
        const secure = new URL(canonical).protocol === 'https:';
        for (const name of secure ? ['__Secure-reunir.session_token', 'reunir.session_token'] : ['reunir.session_token'])
            c.header('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`, { append: true });
        return c.json({ deleted: true, summary });
    });
    // Changing your sign-in address: the password re-entered, then a confirmation link to the new address. The address changes
    // only when that link is opened, and the current address is told at once. The answer is the same whether or not the new
    // address already has an account, so the form reveals nothing about anyone else.
    app.post('/api/account/email', async c => {
        const who = await resolveSession(c.req.raw.headers);
        if (!who) throw new DomainError('UNAUTHENTICATED', 'Please sign in.', 401);
        if (!verifyPassword || !changeEmail || !mail?.transport) throw new DomainError('EMAIL_UNAVAILABLE', 'Changing your email address needs email to be set up. Ask the community owner.', 503);
        if (!await repository.consumeRateLimit('email-change:' + who.id, 5, 900)) throw new DomainError('RATE_LIMITED', 'Too many attempts. Wait a few minutes before trying again.', 429);
        const body = emailChangeRequest.parse(await c.req.json());
        if (!await verifyPassword(c.req.raw.headers, body.password)) throw new DomainError('WRONG_PASSWORD', 'That password is not right.', 403);
        if (body.newEmail === who.email?.toLowerCase()) throw new DomainError('SAME_EMAIL', 'That is already your email address.');
        if (!who.email) throw new DomainError('EMAIL_UNAVAILABLE', 'Your account has no email address to change.', 409);
        await changeEmail({ id: who.id, email: who.email, name: who.name }, body.newEmail, canonical + '/#' + EMAIL_CONFIRMED_PATH);
        await mail.enqueue({ to: who.email, ...changeNoticeMail(body.newEmail) });
        return c.json({ requested: true, message: EMAIL_CHANGE_SENT });
    });
    // Only the route above may change an address, so the password is always asked for.
    app.post('/api/auth/change-email', c => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }, 404));
    // A change link asked for before the password last changed no longer works, so a password change or reset stops it.
    app.get('/api/auth/verify-email', async (c, next) => {
        const token = c.req.query('token');
        if (token && emailChangeLinkValid && !await emailChangeLinkValid(token)) return c.redirect(canonical + '/#' + EMAIL_LINK_REFUSED_PATH);
        await next();
    });
    app.on(['GET', 'POST'], '/api/auth/*', c => authHandler ? authHandler(c.req.raw) : c.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Authentication is not configured.' } }, 503));
    app.get('/api/session', async (c) => { const who = await resolveSession(c.req.raw.headers); return c.json(who ? { ...who, emailVerified: who.emailVerified === true, twoFactorEnabled: who.twoFactorEnabled === true, memberships: await repository.memberships(who.id) } : null); });
    // The one rule for owner and administrator authority when ADMIN_TWO_FACTOR is required: an account without two-step
    // sign-in keeps everything a member or moderator can do, and reads, but not the tools only owners and administrators
    // have. Workspace commands are judged by the domain (does it succeed only because of the role?); the routes below that
    // exist only for owners and administrators check the role directly. Members and moderators are never asked.
    const administration = (c: Context): 'allowed' | 'withheld' => adminTwoFactor === 'required' && c.get('identity').twoFactorEnabled !== true ? 'withheld' : 'allowed';
    const requireTwoStepForAdministration = async (c: Context) => {
        if (administration(c) === 'allowed') return;
        const role = (await repository.memberships(c.get('identity').id)).find(m => m.slug === c.req.param('slug'))?.role;
        if (role === 'owner' || role === 'admin') throw new DomainError(TWO_FACTOR_REQUIRED, TWO_FACTOR_REQUIRED_MESSAGE, 403);
    };
    app.use('/api/organisations/*', async (c, next) => {
        const identity = await resolveSession(c.req.raw.headers);
        if (!identity)
            return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } }, 401);
        c.set('identity', identity);
        if (!await repository.consumeRateLimit('member:' + identity.id, c.req.method === 'GET' ? 240 : 100))
            return c.json({ error: { code: 'RATE_LIMITED', message: 'Take a moment before trying again.' } }, 429, { 'Retry-After': '60' });
        await next();
    });
    app.get('/api/organisations/:slug/pilot-status',async c=>{await requireTwoStepForAdministration(c);if(!operations)throw new DomainError('UNAVAILABLE','Pilot operations are not configured.',503);return c.json(await operations.snapshot(c.req.param('slug'),c.get('identity').id));});
    app.get('/api/organisations/:slug/invitations',async c=>{if(!invitations)throw new DomainError('UNAVAILABLE','Invitations not configured.',503);return c.json(await invitations.list(c.req.param('slug'),c.get('identity').id));});
    app.post('/api/organisations/:slug/invitations',async c=>{
        if(!invitations)throw new DomainError('UNAVAILABLE','Invitations not configured.',503);
        await requireTwoStepForAdministration(c);
        if(!await repository.consumeRateLimit('invite-admin:'+c.get('identity').id,10))throw new DomainError('RATE_LIMITED','Please wait before sending more invitations.',429);
        const {email,trackId}=z.object({email:invitationEmail,trackId:id.optional()}).strict().parse(await c.req.json());return c.json(await invitations.create(c.req.param('slug'),c.get('identity').id,email,trackId),201);
    });
    app.post('/api/organisations/:slug/invitations/:inviteId/revoke',async c=>{if(!invitations)throw new DomainError('UNAVAILABLE','Invitations not configured.',503);await requireTwoStepForAdministration(c);return c.json(await invitations.revoke(c.req.param('slug'),c.get('identity').id,id.parse(c.req.param('inviteId'))));});
    app.get('/api/organisations/:slug/conversations',async c=>c.json(await messaging.list(c.req.param('slug'),c.get('identity').id,c.req.query('before'))));
    app.post('/api/organisations/:slug/conversations',async c=>{const b=startConversation.parse(await c.req.json());return c.json(await messaging.start(c.req.param('slug'),c.get('identity').id,b.userId),201);});
    app.get('/api/organisations/:slug/conversations/:threadId',async c=>c.json(await messaging.detail(c.req.param('slug'),c.get('identity').id,c.req.param('threadId'))));
    app.get('/api/organisations/:slug/conversations/:threadId/messages',async c=>c.json(await messaging.messages(c.req.param('slug'),c.get('identity').id,c.req.param('threadId'),c.req.query('before'))));
    app.post('/api/organisations/:slug/conversations/:threadId/messages',async c=>{const b=sendMessage.parse(await c.req.json());if(!c.req.header('idempotency-key'))throw new DomainError('KEY_REQUIRED','An Idempotency-Key header is required.');return c.json(await messaging.send(c.req.param('slug'),c.get('identity').id,c.req.param('threadId'),b.body,c.req.header('idempotency-key')!),201);});
    app.post('/api/organisations/:slug/conversations/:threadId/read',async c=>{const b=z.object({messageId:id}).strict().parse(await c.req.json());return c.json(await messaging.read(c.req.param('slug'),c.get('identity').id,c.req.param('threadId'),b.messageId));});
    app.post('/api/organisations/:slug/conversations/:threadId/messages/:messageId/report',async c=>{const b=reportMessage.parse(await c.req.json());return c.json(await messaging.report(c.req.param('slug'),c.get('identity').id,c.req.param('threadId'),c.req.param('messageId'),b.reason));});
    app.post('/api/organisations/:slug/member-blocks',async c=>{const b=z.object({userId:id,blocked:z.boolean()}).strict().parse(await c.req.json());return c.json(await messaging.block(c.req.param('slug'),c.get('identity').id,b.userId,b.blocked));});
    app.get('/api/organisations/:slug/message-reports',async c=>c.json(await messaging.reports(c.req.param('slug'),c.get('identity').id)));
    app.post('/api/organisations/:slug/message-reports/:reportId/resolve',async c=>c.json(await messaging.resolve(c.req.param('slug'),c.get('identity').id,id.parse(c.req.param('reportId')))));
    app.get('/api/organisations/:slug/workspace', async (c) => c.json(await repository.snapshot(c.req.param('slug'), c.get('identity').id)));
    // Long lists a page at a time: older notices, review queues and the audit trail. The cursor is opaque and keyset-based.
    app.get('/api/organisations/:slug/pages/:list', async (c) => {
        const list = pagedList.safeParse(c.req.param('list'));
        if (!list.success) throw new DomainError('NOT_FOUND', 'That list does not exist.', 404);
        const query = pageQuery.parse({ cursor: c.req.query('cursor'), limit: c.req.query('limit') ?? undefined });
        return c.json(await repository.page(c.req.param('slug'), c.get('identity').id, list.data, query));
    });
    app.post('/api/organisations/:slug/commands', async (c) => {
        const key = c.req.header('idempotency-key');
        if (!key)
            throw new DomainError('KEY_REQUIRED', 'An Idempotency-Key header is required.');
        const input = await c.req.json();
        const { result, releasedFiles } = await repository.executeCommand(c.req.param('slug'), c.get('identity').id, input, key, c.get('requestId'), { administration: administration(c) });
        // A replaced or removed cover picture nothing shows any more: its record went with the change, its file goes now.
        await removeQuietly(c.get('requestId'), releasedFiles);
        return c.json(result);
    });
    // Handing a community to one of its administrators: the owner's password re-entered and the community's name typed.
    // It is not a workspace command, so it can never be sent without the password check.
    app.post('/api/organisations/:slug/ownership', async c => {
        if (!verifyPassword) throw new DomainError('UNAVAILABLE', 'Ownership transfer is not configured.', 503);
        const who = c.get('identity');
        await requireTwoStepForAdministration(c);
        if (!await repository.consumeRateLimit('ownership:' + who.id, 5, 900)) throw new DomainError('RATE_LIMITED', 'Too many attempts. Wait a few minutes before trying again.', 429);
        const body = ownershipTransferRequest.parse(await c.req.json());
        if (!await verifyPassword(c.req.raw.headers, body.password)) throw new DomainError('WRONG_PASSWORD', 'That password is not right.', 403);
        return c.json(await repository.transferOwnership(c.req.param('slug'), who.id, body.memberId, body.confirmation, c.get('requestId')));
    });
    app.post('/api/organisations/:slug/uploads', async (c) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const body = await c.req.json(), slug = c.req.param('slug'), who = c.get('identity');
        if (body && typeof body === 'object' && (body as { purpose?: unknown }).purpose === 'lesson_resource') {
            const input = resourceUploadRequest.parse(body);
            // The domain checks authoring rights and records the intent before any storage capability exists.
            const { upload, expired } = await repository.beginResourceUpload(slug, who.id, input, (organizationId, id) => resourceObjectKey(organizationId, input.trackId, input.contentType, id), c.get('requestId'));
            await removeQuietly(c.get('requestId'), expired.map(x => x.objectKey));
            const policy = await storage.upload(upload.objectKey, upload.contentType, upload.sizeBytes);
            return c.json({ id: upload.id, ...policy, method: 'POST', expiresIn: 300 }, 201);
        }
        if (body && typeof body === 'object' && (body as { purpose?: unknown }).purpose === 'cover_image') {
            const input = coverUploadRequest.parse(body);
            const { upload, expired } = await repository.beginCoverUpload(slug, who.id, input, (organizationId, id) => coverObjectKey(organizationId, input.subject, input.subjectId, input.contentType, id), c.get('requestId'));
            await removeQuietly(c.get('requestId'), expired.map(x => x.objectKey));
            const policy = await storage.upload(upload.objectKey, upload.contentType, upload.sizeBytes);
            return c.json({ id: upload.id, ...policy, method: 'POST', expiresIn: 300 }, 201);
        }
        if (body && typeof body === 'object' && (body as { purpose?: unknown }).purpose === 'cover_library') {
            await requireTwoStepForAdministration(c);
            const input = coverLibraryUploadRequest.parse(body);
            const { upload, expired } = await repository.beginCoverLibraryUpload(slug, who.id, input, (organizationId, id) => coverLibraryObjectKey(organizationId, input.contentType, id), c.get('requestId'));
            await removeQuietly(c.get('requestId'), expired.map(x => x.objectKey));
            const policy = await storage.upload(upload.objectKey, upload.contentType, upload.sizeBytes);
            return c.json({ id: upload.id, ...policy, method: 'POST', expiresIn: 300 }, 201);
        }
        const input = uploadSchema.parse(body);
        const snapshot = await repository.snapshot(slug, who.id);
        const id = randomUUID();
        const key = objectKey(snapshot.organisation.id, who.id, input.contentType, id);
        // Persist authorised intent before minting a short-lived capability. User input never selects a bucket or tenant prefix.
        await repository.createUploadIntent(slug, who.id, { id, objectKey: key, contentType: input.contentType, sizeBytes: input.sizeBytes, originalName: input.name });
        const policy = await storage.upload(key, input.contentType, input.sizeBytes);
        return c.json({ id, ...policy, method: 'POST', expiresIn: 300 }, 201);
    });
    app.post('/api/organisations/:slug/uploads/:id/complete', async (c) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const slug = c.req.param('slug'), who = c.get('identity').id, id = c.req.param('id');
        const intent = await repository.uploadIntent(slug, who, id);
        const key = String(intent.object_key);
        /** Size, type and generation as stored, plus the first bytes pinned to that generation. */
        const inspect = async (bytes: number) => {
            const meta = await storage.metadata(key);
            if (!meta)
                throw new DomainError('UPLOAD_MISSING', 'The file has not reached private storage. Try uploading it again.', 409);
            const matches = meta.size === Number(intent.size_bytes) && meta.contentType === intent.content_type && !!meta.generation;
            let head: Uint8Array = new Uint8Array();
            if (matches) {
                try { head = await storage.head(key, Math.min(bytes, meta.size), meta.generation!); }
                catch (error) {
                    if (isMissingObject(error))
                        throw new DomainError('UPLOAD_CHANGED', 'The file changed while it was being checked. Upload it again.', 409);
                    throw error;
                }
            }
            return { meta, matches, head };
        };
        if (intent.purpose === 'cover_image' || intent.purpose === 'cover_library') {
            let observed = { sizeBytes: 0, contentType: '', generation: null as string | null, bytesAcceptable: false };
            if (intent.status === 'pending') {
                const { meta, matches, head } = await inspect(COVER_HEAD_BYTES);
                observed = { sizeBytes: meta.size, contentType: meta.contentType, generation: meta.generation ?? null, bytesAcceptable: matches && coverBytesAcceptable(String(intent.content_type), head) };
            }
            const result = await repository.completeCoverUpload(slug, who, id, observed, c.get('requestId'));
            if (result.outcome === 'rejected') {
                await removeQuietly(c.get('requestId'), [key]);
                throw new DomainError('FILE_MISMATCH', 'This image is not a JPEG, PNG or WebP of a usable size. Nothing was changed.');
            }
            return c.json({ id, status: 'ready', upload: clientUpload(result.upload) });
        }
        if (intent.purpose === 'lesson_resource') {
            let observed: StoredObservation = { sizeBytes: 0, contentType: '', generation: null, signatureMatches: false };
            if (intent.status === 'pending') {
                // Read only the first bytes, pinned to the generation that was just measured.
                const { meta, matches, head } = await inspect(SIGNATURE_BYTES);
                observed = { sizeBytes: meta.size, contentType: meta.contentType, generation: meta.generation ?? null, signatureMatches: matches && fileSignatureMatches(String(intent.content_type), head) };
            }
            const result = await repository.completeResourceUpload(slug, who, id, observed, c.get('requestId'));
            if (result.outcome === 'rejected') {
                await removeQuietly(c.get('requestId'), [key]);
                throw new DomainError('FILE_MISMATCH', 'This file does not match its declared type and size. Nothing was attached.');
            }
            return c.json({ id, status: 'ready', upload: clientUpload(result.upload) });
        }
        const meta = await storage.metadata(key);
        if (!meta)
            throw new DomainError('UPLOAD_MISSING', 'The file has not reached private storage. Try uploading it again.', 409);
        if (meta.size !== Number(intent.size_bytes) || meta.contentType !== intent.content_type) {
            await repository.markUpload(slug, who, id, 'rejected');
            throw new DomainError('FILE_MISMATCH', 'The uploaded file does not match the permitted type and size.');
        }
        await repository.markUpload(slug, who, id, 'ready');
        return c.json({ id, status: 'ready' });
    });
    app.post('/api/organisations/:slug/uploads/:id/discard', async (c) => {
        const result = await repository.discardResourceUpload(c.req.param('slug'), c.get('identity').id, id.parse(c.req.param('id')), c.get('requestId'));
        await removeQuietly(c.get('requestId'), [result.objectKey]);
        return c.json({ id: result.id, status: 'discarded' });
    });
    app.get('/api/organisations/:slug/uploads/:id/download', async (c) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const intent = await repository.uploadIntent(c.req.param('slug'), c.get('identity').id, c.req.param('id'));
        // Lesson files are released only through the lesson, draft or revision that lists them.
        if (intent.purpose !== 'member')
            throw new DomainError('NOT_FOUND', 'File not found.', 404);
        if (intent.status !== 'ready')
            throw new DomainError('FILE_NOT_READY', 'This file is not ready to download.', 409);
        return c.json({ url: await storage.download(String(intent.object_key)), expiresIn: 120 });
    });
    const resourceDownload = async (slug: string, userId: string, context: ResourceContext, recordId: string, resourceId: string) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const target = await repository.resourceDownload(slug, userId, { context, recordId: id.parse(recordId), resourceId: id.parse(resourceId) });
        const url = await storage.download(target.objectKey, { filename: target.filename, contentType: target.contentType, generation: target.generation });
        return { url, expiresIn: 120, filename: target.filename };
    };
    /** Verified image bytes, pinned to their generation, with headers that only let them render as an image. */
    const sendImage = async (c: Context, target: { objectKey: string; generation: string; contentType: string; sizeBytes: number }, missing: string) => {
        let bytes: Uint8Array;
        try { bytes = await storage!.head(target.objectKey, target.sizeBytes, target.generation); }
        catch (error) {
            if (isMissingObject(error))
                throw new DomainError('NOT_FOUND', missing, 404);
            throw error;
        }
        c.header('Cache-Control', 'private, max-age=3600');
        c.header('Content-Type', target.contentType);
        c.header('Content-Disposition', 'inline');
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('Content-Security-Policy', "default-src 'none'; sandbox");
        return c.body(bytes as Uint8Array<ArrayBuffer>, 200);
    };
    // Cover bytes come through the application so cards need no third-party origin. The URL names the verified file,
    // so a browser may keep it privately for an hour; access is checked again whenever it asks.
    app.get('/api/organisations/:slug/covers/:subject/:subjectId/:fileId', async (c) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const subject = coverSubject.parse(c.req.param('subject'));
        const target = await repository.coverImage(c.req.param('slug'), c.get('identity').id, subject, id.parse(c.req.param('subjectId')), id.parse(c.req.param('fileId')));
        return sendImage(c, target, 'That cover is not available.');
    });
    // A library entry never changes its picture, so its ID is as stable as a file ID for caching.
    app.get('/api/organisations/:slug/cover-library/:itemId', async (c) => {
        if (!storage)
            throw new DomainError('STORAGE_UNAVAILABLE', 'Private storage is not configured.', 503);
        const target = await repository.coverLibraryPicture(c.req.param('slug'), c.get('identity').id, id.parse(c.req.param('itemId')));
        return sendImage(c, target, 'That picture is not in the cover library.');
    });
    app.post('/api/organisations/:slug/cover-library/:itemId/remove', async (c) => {
        await requireTwoStepForAdministration(c);
        const result = await repository.removeCoverLibraryItem(c.req.param('slug'), c.get('identity').id, id.parse(c.req.param('itemId')), c.get('requestId'));
        await removeQuietly(c.get('requestId'), result.objectKey ? [result.objectKey] : []);
        return c.json({ id: result.id, status: 'removed' });
    });
    // A member's own learning, as a file to keep. Nothing in it belongs to anyone else.
    app.get('/api/organisations/:slug/me/learning-record', async (c) => {
        const record = await repository.learningRecord(c.req.param('slug'), c.get('identity').id);
        c.header('Content-Disposition', `attachment; filename="${learningRecordFilename(record.community.slug, record.generatedAt)}"`);
        return c.json(record);
    });
    for (const [segment, context] of [['lessons', 'lesson'], ['lesson-drafts', 'draft'], ['lesson-revisions', 'revision']] as const)
        app.get(`/api/organisations/:slug/${segment}/:recordId/resources/:resourceId/download`, async (c) => c.json(await resourceDownload(c.req.param('slug'), c.get('identity').id, context, c.req.param('recordId'), c.req.param('resourceId'))));
    app.notFound(c => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }, 404));
    app.onError((err, c) => {
        if (err instanceof DomainError)
            return c.json({ error: { code: err.code, message: err.message, requestId: c.get('requestId') } }, err.status as 400);
        if (err instanceof ZodError)
            return c.json({ error: { code: 'VALIDATION', message: err.issues[0]?.message || 'Invalid request.' } }, 400);
        if (err instanceof SyntaxError)
            return c.json({ error: { code: 'INVALID_JSON', message: 'Send valid JSON.' } }, 400);
        console.error(JSON.stringify({ event: 'request.failed', requestId: c.get('requestId'), errorName: err.name }));
        return c.json({ error: { code: 'INTERNAL', message: 'This action could not be completed. No demo data was substituted.', requestId: c.get('requestId') } }, 500);
    });
    return app;
}
