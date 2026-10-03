import type { MailQueue } from './mail';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '../../../packages/db/src/auth-schema';
import type { Database } from '../../../packages/db/src/connection';
export function createAuth(db: Database, baseURL: string, secret: string, bootstrap = false, mail?: MailQueue) {
    if (secret.length < 32)
        throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
    const base = new URL(baseURL);
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
        throw new Error('Production APP_ORIGIN must use HTTPS.');
    return betterAuth({ appName: 'REUNIR', baseURL: base.origin, basePath: '/api/auth', secret,
        database: drizzleAdapter(db.orm, { provider: 'pg', schema }),
        trustedOrigins: [base.origin],
        emailAndPassword: { enabled: true, disableSignUp: !bootstrap, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: false,
            ...(bootstrap ? {autoSignIn:false} : {}),
            revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
            ...(mail ? {sendResetPassword: async ({user,url}: {user:{email:string};url:string}) => {
                await mail.enqueue({to:user.email,subject:'Reset your REUNIR password',text:`A password reset was requested for your REUNIR account.\n\n${url}\n\nThis link expires in 30 minutes. If this was not you, ignore this message. Your existing password still works.`});
            }} : {}) },
        session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 60, customRules: { '/sign-in/email': { window: 60, max: 8 } } },
        advanced: { cookiePrefix: 'reunir', useSecureCookies: base.protocol === 'https:', defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: base.protocol === 'https:' } },
    });
}
/** The signed-in person's current password, checked by Better Auth. False only for a wrong password; other errors rise. */
export function passwordCheck(auth: ReturnType<typeof createAuth>) {
    return async (headers: Headers, password: string) => {
        try { await auth.api.verifyPassword({ body: { password }, headers }); return true; }
        catch (error) { if ((error as { body?: { code?: string } }).body?.code === 'INVALID_PASSWORD') return false; throw error; }
    };
}
