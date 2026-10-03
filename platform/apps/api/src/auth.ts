import type { MailQueue } from './mail';
import { betterAuth } from 'better-auth';
import { createEmailVerificationToken } from 'better-auth/api';
import { verifyJWT } from 'better-auth/crypto';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { TWO_FACTOR_ISSUER } from '../../../packages/contracts/src/two-factor';
import { EMAIL_LINK_SECONDS, verificationMail, type EmailVerification } from '../../../packages/contracts/src/email';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import * as schema from '../../../packages/db/src/auth-schema';
import type { Database } from '../../../packages/db/src/connection';
/**
 * `emailVerification` decides whether an unconfirmed address may sign in. It applies only where mail can be queued: without
 * a mail queue nobody could confirm, so nothing is required and changing the address is unavailable.
 */
export function createAuth(db: Database, baseURL: string, secret: string, bootstrap = false, mail?: MailQueue, emailVerification: EmailVerification = 'optional') {
    if (secret.length < 32)
        throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.');
    const base = new URL(baseURL);
    if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
        throw new Error('Production APP_ORIGIN must use HTTPS.');
    return betterAuth({ appName: 'REUNIR', baseURL: base.origin, basePath: '/api/auth', secret,
        database: drizzleAdapter(db.orm, { provider: 'pg', schema }),
        trustedOrigins: [base.origin],
        emailAndPassword: { enabled: true, disableSignUp: !bootstrap, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: !!mail && emailVerification === 'required',
            ...(bootstrap ? {autoSignIn:false} : {}),
            revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 1800,
            ...(mail ? {sendResetPassword: async ({user,url}: {user:{email:string};url:string}) => {
                await mail.enqueue({to:user.email,subject:'Reset your REUNIR password',text:`A password reset was requested for your REUNIR account.\n\n${url}\n\nThis link expires in 30 minutes. If this was not you, ignore this message. Your existing password still works.`});
            }} : {}) },
        // Confirming an address: one link, for 24 hours, to the address being confirmed. The same link confirms a new address
        // when someone changes theirs, and only then does the address change. Signing in with an unconfirmed address, when
        // that is required, sends a fresh link instead of a session.
        ...(mail ? {
            emailVerification: { sendOnSignUp: false, sendOnSignIn: emailVerification === 'required', autoSignInAfterVerification: false, expiresIn: EMAIL_LINK_SECONDS,
                sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => { await mail.enqueue({ to: user.email, ...verificationMail(url) }); } },
            user: { changeEmail: { enabled: true, updateEmailWithoutVerification: false } },
        } : {}),
        session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
        rateLimit: { enabled: true, storage: 'database', window: 60, max: 60, customRules: { '/sign-in/email': { window: 60, max: 8 }, '/send-verification-email': { window: 60, max: 3 } } },
        // Two-step sign-in: an authenticator app's six-digit codes and ten one-time backup codes. The plugin encrypts the
        // secret and the backup codes with the session secret. No SMS or email codes, and no "trust this device" in this slice.
        plugins: [twoFactor({ issuer: TWO_FACTOR_ISSUER, backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' } })],
        advanced: { cookiePrefix: 'reunir', useSecureCookies: base.protocol === 'https:', defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: base.protocol === 'https:' } },
    });
}
/**
 * The signed-in person's current password, checked against their stored hash with Better Auth's own hasher. False for a
 * wrong password or no session; other errors rise. Typing the password is the fresh proof of who is asking, so this does
 * not also require a session started within the last day, as Better Auth's own route does: a session stays valid for
 * seven days and every route that asks for the password must work throughout.
 */
export function passwordCheck(auth: ReturnType<typeof createAuth>) {
    return async (headers: Headers, password: string) => {
        const session = await auth.api.getSession({ headers });
        if (!session) return false;
        const ctx = await auth.$context;
        const hash = (await ctx.internalAdapter.findAccounts(session.user.id)).find(a => a.providerId === 'credential')?.password;
        return !!hash && await ctx.password.verify({ hash, password });
    };
}
/** The signed-in person as the API needs them: who they are, their address and whether it is confirmed, and two-step sign-in. */
export function sessionResolver(auth: ReturnType<typeof createAuth>) {
    return async (headers: Headers) => {
        const session = await auth.api.getSession({ headers });
        return session ? { id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified === true, twoFactorEnabled: session.user.twoFactorEnabled === true } : null;
    };
}
/** Asks Better Auth to send a confirmation link to a new address. The address changes only when that link is opened. */
/**
 * Sends the link that moves an account to a new address, after the caller has checked the password. The link is Better
 * Auth's own (the same signed token its change-email route makes), so opening it changes the address through Better Auth.
 * A taken address gets no link and the same answer.
 */
export function emailChanger(auth: ReturnType<typeof createAuth>) {
    return async (user: { id: string; email: string; name: string }, newEmail: string, callbackURL: string) => {
        const ctx = await auth.$context;
        const send = ctx.options.emailVerification?.sendVerificationEmail;
        if (!send) throw new Error('Changing an email address needs a mail queue.');
        if (await ctx.internalAdapter.findUserByEmail(newEmail)) return;
        const token = await createEmailVerificationToken(ctx.secret, user.email, newEmail, EMAIL_LINK_SECONDS, { requestType: 'change-email-verification' });
        await send({ user: { ...user, email: newEmail } as never, url: `${ctx.baseURL}/verify-email?token=${token}&callbackURL=${encodeURIComponent(callbackURL)}` });
    };
}
/**
 * Whether a link to change an address may still be used. A link asked for before the password last changed is refused, so
 * changing or resetting the password stops a change someone else asked for. Links that change no address pass through.
 */
export function emailChangeLinkCheck(auth: ReturnType<typeof createAuth>) {
    return async (token: string) => {
        const ctx = await auth.$context;
        const payload = await verifyJWT<{ email?: string; updateTo?: string; iat?: number }>(token, ctx.secret);
        if (!payload?.updateTo || !payload.email) return true;
        const user = await ctx.internalAdapter.findUserByEmail(payload.email);
        if (!user) return true;
        const credential = (await ctx.internalAdapter.findAccounts(user.user.id)).find(a => a.providerId === 'credential');
        const changed = credential ? Math.floor(new Date(credential.updatedAt).getTime() / 1000) : 0;
        return typeof payload.iat === 'number' && payload.iat >= changed;
    };
}
