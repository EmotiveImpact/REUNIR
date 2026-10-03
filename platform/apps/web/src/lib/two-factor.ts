import { api, mode } from './data';
import { isAppCode, normaliseAppCode, normaliseBackupCode, type AdminTwoFactor } from '../../../../packages/contracts/src/two-factor';

/** What the connected server says about two-step sign-in. The demo has no accounts, so it never asks. */
export interface TwoStepCapabilities { available: boolean; adminTwoFactor: AdminTwoFactor }
export async function twoStepCapabilities(): Promise<TwoStepCapabilities> {
    if (mode === 'demo') return { available: false, adminTwoFactor: 'optional' };
    const c = await api<{ twoStepSignIn?: boolean; adminTwoFactor?: AdminTwoFactor }>('/api/account/capabilities');
    return { available: !!c.twoStepSignIn, adminTwoFactor: c.adminTwoFactor === 'required' ? 'required' : 'optional' };
}

/** Better Auth answers in its own shape; these turn its codes into plain sentences. */
const AUTH_MESSAGES: Record<string, string> = {
    INVALID_PASSWORD: 'That password is not right.',
    INVALID_CODE: 'That code is not right. Codes change every 30 seconds; try the one showing now.',
    INVALID_BACKUP_CODE: 'That backup code is not right, or it has already been used.',
    INVALID_TWO_FACTOR_COOKIE: 'This sign-in has expired. Start again with your email and password.',
    TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Too many attempts. Start again with your email and password.',
    ACCOUNT_TEMPORARILY_LOCKED: 'Too many wrong codes. Wait 15 minutes, then try again.',
    TOTP_ALREADY_ENABLED: 'Two-step sign-in is already on.',
};
async function authCall<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch('/api/auth' + path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) throw new Error('Too many attempts in a short time. Wait a moment, then try again.');
    if (!res.ok) throw new Error(AUTH_MESSAGES[data.code] || data.message || 'That did not go through. Please try again.');
    return data as T;
}

/** Email and password. When the account has two-step sign-in, the answer asks for the second step instead of signing in. */
export async function signInWithPassword(email: string, password: string): Promise<'signed-in' | 'second-step'> {
    const r = await authCall<{ twoFactorRedirect?: boolean }>('/sign-in/email', { email, password });
    return r.twoFactorRedirect ? 'second-step' : 'signed-in';
}

export type SecondStep = 'app' | 'backup';
/** The second step: a six-digit code from the app, or one backup code (each works once). */
export async function completeSecondStep(kind: SecondStep, typed: string): Promise<void> {
    if (kind === 'app') {
        if (!isAppCode(typed)) throw new Error('Enter the six-digit code from your authenticator app.');
        await authCall('/two-factor/verify-totp', { code: normaliseAppCode(typed) });
    } else {
        const code = normaliseBackupCode(typed);
        if (!code) throw new Error('Enter one of your backup codes.');
        await authCall('/two-factor/verify-backup-code', { code });
    }
}

/** Starting setup: the password, then a setup link and backup codes. Nothing is on until a code confirms it. */
export const beginTwoStep = (password: string) => authCall<{ totpURI: string; backupCodes: string[] }>('/two-factor/enable', { password });
export async function confirmTwoStep(typed: string) {
    if (!isAppCode(typed)) throw new Error('Enter the six-digit code from your authenticator app.');
    await authCall('/two-factor/verify-totp', { code: normaliseAppCode(typed) });
}
export const turnOffTwoStep = (password: string) => authCall('/two-factor/disable', { password });
export const newBackupCodes = async (password: string) => (await authCall<{ backupCodes: string[] }>('/two-factor/generate-backup-codes', { password })).backupCodes;
