import { api, mode } from './data';
import { authCall } from './two-factor';
import { EMAIL_CONFIRMED_PATH, type EmailVerification } from '../../../../packages/contracts/src/email';

/** What the connected server offers for email addresses. The demo has no addresses, so it offers nothing. */
export interface EmailCapabilities { confirmation: boolean; change: boolean; verification: EmailVerification }
export async function emailCapabilities(): Promise<EmailCapabilities> {
    if (mode === 'demo') return { confirmation: false, change: false, verification: 'optional' };
    const c = await api<{ emailConfirmation?: boolean; emailChange?: boolean; emailVerification?: EmailVerification }>('/api/account/capabilities');
    return { confirmation: !!c.emailConfirmation, change: !!c.emailChange, verification: c.emailVerification === 'required' ? 'required' : 'optional' };
}

const confirmedURL = () => window.location.origin + '/#' + EMAIL_CONFIRMED_PATH;

/** A fresh confirmation link to the account's current address. */
export const sendConfirmation = (email: string) => authCall('/send-verification-email', { email, callbackURL: confirmedURL() });

/** A confirmation link to a new address, after the password. Nothing changes until that link is opened. */
export const requestEmailChange = (newEmail: string, password: string) => api<{ requested: boolean; message: string }>('/api/account/email', { newEmail, password });
