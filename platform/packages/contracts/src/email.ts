import { z } from 'zod';

/** Email verification and change: the shared words and rules. Nothing here holds a token. */

/** Whether an account must confirm its email address before it can sign in. */
export type EmailVerification = 'required' | 'optional';
export const EMAIL_VERIFICATION_VALUES: readonly EmailVerification[] = ['required', 'optional'];

/** The server setting: `required` or `optional`; when unset, required in production and optional elsewhere. Null when invalid. */
export function emailVerificationSetting(env: Readonly<Record<string, string | undefined>>): EmailVerification | null {
    const raw = env.EMAIL_VERIFICATION?.trim();
    if (!raw) return env.NODE_ENV === 'production' ? 'required' : 'optional';
    return (EMAIL_VERIFICATION_VALUES as readonly string[]).includes(raw) ? raw as EmailVerification : null;
}

/** How long a confirmation link works, in seconds. */
export const EMAIL_LINK_SECONDS = 24 * 60 * 60;

/** Where a confirmation link returns to, inside the app, and what the page then says. */
export const EMAIL_CONFIRMED_PATH = '/account?email=confirmed';

export const emailChangeRequest = z.object({
    newEmail: z.string().trim().toLowerCase().email('Enter an email address you can open.').max(254),
    password: z.string().min(1, 'Enter your password.').max(128),
}).strict();
export type EmailChangeRequest = z.infer<typeof emailChangeRequest>;

/** The same answer whether or not the address belongs to someone else, so the form never reveals who has an account. */
export const EMAIL_CHANGE_SENT = 'Check the new address for a confirmation link. Your email changes only when you open it.';

/** "a***@example.org": enough to recognise an address in a notice without spelling it out. */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
}

export const verificationMail = (url: string) => ({
    subject: 'Confirm your email address for REUNIR',
    text: `Open this link to confirm this email address for your REUNIR account:\n\n${url}\n\nThe link works for 24 hours. If you did not ask for this, ignore this message and nothing will change.`,
});

/** Sent to the current address when someone asks to move the account to another one. */
export const changeNoticeMail = (newEmail: string) => ({
    subject: 'Your REUNIR email address is being changed',
    text: `Someone signed in to your REUNIR account asked to change its email address to ${maskEmail(newEmail)}. The change happens only when the confirmation link sent to that address is opened.\n\nIf this was not you, sign in and change your password straight away. Until the link is opened, this address still signs you in.`,
});
