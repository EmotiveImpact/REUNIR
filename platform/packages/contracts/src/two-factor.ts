/** Two-step sign-in: the shared words and rules. Nothing here holds or derives a secret. */
export const TWO_FACTOR_ISSUER = 'REUNIR';

/** Whether owners and administrators must have two-step sign-in turned on to use their authority. */
export type AdminTwoFactor = 'required' | 'optional';
export const ADMIN_TWO_FACTOR_VALUES: readonly AdminTwoFactor[] = ['required', 'optional'];

/** The server setting: `required` or `optional`; when unset, required in production and optional elsewhere. Null when invalid. */
export function adminTwoFactorSetting(env: Readonly<Record<string, string | undefined>>): AdminTwoFactor | null {
    const raw = env.ADMIN_TWO_FACTOR?.trim();
    if (!raw) return env.NODE_ENV === 'production' ? 'required' : 'optional';
    return (ADMIN_TWO_FACTOR_VALUES as readonly string[]).includes(raw) ? raw as AdminTwoFactor : null;
}

export const TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED';
export const TWO_FACTOR_REQUIRED_MESSAGE = 'Owner and administrator tools need two-step sign-in. Turn it on from Your account, then try again.';

/** A six-digit code from an authenticator app. Spaces people type between the digits do not matter. */
export const normaliseAppCode = (typed: string) => typed.replace(/\s+/g, '');
export const isAppCode = (typed: string) => /^\d{6}$/.test(normaliseAppCode(typed));
/** A backup code as issued (five characters, a hyphen, five more). Spaces around it do not matter. */
export const normaliseBackupCode = (typed: string) => typed.trim();

/** The setup key inside an `otpauth://` link, grouped in fours so it can be typed into an app by hand. Empty when absent. */
export function setupKey(totpURI: string): string {
    try {
        const secret = new URL(totpURI).searchParams.get('secret') ?? '';
        return secret.replace(/(.{4})/g, '$1 ').trim();
    } catch { return ''; }
}
