import { z } from 'zod';
import { listNames } from './account';

/** Most people a contribution can credit at once: invited and accepted credits together. */
export const CREDIT_LIMIT = 10;
/** Every credit record a contribution keeps, including declined and withdrawn ones, so repeated asking stays bounded. */
export const CREDIT_HISTORY_LIMIT = 30;
export const CREDIT_ROLE_MAX = 60;
export type CreditStatus = 'invited' | 'accepted' | 'declined' | 'withdrawn';
/** Invited and accepted credits are live; a person has at most one live credit on a contribution. */
export const LIVE_CREDIT: readonly CreditStatus[] = ['invited', 'accepted'];

/**
 * Optional, short and on one line, such as "co-author" or "photography". It describes the shared work; it is not a title,
 * a role in the community or a credential.
 */
export const creditRole = z.string().trim().max(CREDIT_ROLE_MAX).regex(/^[^\u0000-\u001f\u007f]*$/, 'Keep the role on one line.').default('');

/** "With Nia" or "With Nia and Theo" or "With Nia, Theo and Maya". */
export const withNames = (names: string[]) => names.length ? `With ${listNames(names)}` : '';
