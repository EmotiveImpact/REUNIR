import { validateRuntimeConfiguration } from './config';
import { requireSafeRuntimeRole } from '../../../packages/db/src/runtime-safety';
import { PilotOperations } from './operations';
import {MailQueue,resendTransport} from './mail';
import {InvitationService} from './invitations';
import {DigestService} from './digests';
import { openDatabase } from '../../../packages/db/src/connection';
import { WorkspaceRepository } from '../../../packages/db/src/repository';
import { createAuth, passwordCheck } from './auth';
import { createApp } from './app';
import { googleStorage } from './storage';
export async function bootstrap() {
    const { DATABASE_URL, APP_ORIGIN, BETTER_AUTH_SECRET, GCS_BUCKET, GCS_CREDENTIALS_JSON } = process.env;
    if (!DATABASE_URL || !APP_ORIGIN || !BETTER_AUTH_SECRET)
        throw new Error('Set DATABASE_URL, APP_ORIGIN and BETTER_AUTH_SECRET on the server.');
    validateRuntimeConfiguration(process.env);
    const db = await openDatabase(DATABASE_URL);
    try {
    const repository = new WorkspaceRepository(db);
    const mail=new MailQueue(db,process.env.EMAIL_ENCRYPTION_KEY||BETTER_AUTH_SECRET,resendTransport(process.env.RESEND_API_KEY,process.env.EMAIL_FROM));
    const auth = createAuth(db, APP_ORIGIN, BETTER_AUTH_SECRET,false,mail);
    const registration=createAuth(db,APP_ORIGIN,BETTER_AUTH_SECRET,true);
    const invitations=new InvitationService(repository,new URL(APP_ORIGIN).origin,mail);
    if (process.env.NODE_ENV === 'production') await requireSafeRuntimeRole(db);
    const operations=new PilotOperations(repository,process.env);
    // Digests are queued only where mail can be sent; otherwise they would wait in the outbox for no one.
    const digests=mail.transport?new DigestService(db,mail,new URL(APP_ORIGIN).origin):undefined;
    const app = createApp({ repository, invitations, mail, operations, cronSecret:process.env.CRON_SECRET, digests,
        registerInvited:async(name,email,password)=>{const result=await registration.api.signUpEmail({body:{name,email,password}});return {id:result.user.id};},
        verifyPassword: passwordCheck(auth), origin: APP_ORIGIN, resolveSession: async (headers) => { const session = await auth.api.getSession({ headers }); return session ? { id: session.user.id, name: session.user.name } : null; }, authHandler: req => auth.handler(req), storage: GCS_BUCKET ? googleStorage(GCS_BUCKET, GCS_CREDENTIALS_JSON) : undefined });
    return { app, db, repository, auth, mail, invitations, digests };
    } catch(error) { await db.close(); throw error; }
}
