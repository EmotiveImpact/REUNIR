# Decision 059: crediting people on an outcome, with consent

Status: built in Alpha 59. Date: 9 October 2026.

## Problem

Decision 034 let the author of a contribution credit teammates on it. An outcome, the record of what changed because of the work, still named only the person who recorded it, and so did the community output published from it. A film, a launch or a publication is rarely one person's, but the archive could not say so without inventing a second outcome.

## Decision

- **Same terms as contribution credits.** The outcome's author credits someone (`outcome.credit.invite`), with an optional short description of what they did. The person named accepts or declines (`outcome.credit.respond`). Either of them can later withdraw an accepted credit; the author can also withdraw an invitation (`outcome.credit.withdraw`). One live credit per person per outcome, no asking again after a refusal or after the person removed their own credit, at most 10 live credits and 30 credit records per outcome.
- **Who can be credited.** For an outcome from project work, an active member of that project's team. For an outcome from a mission proof, which has no team, any active member who can see the mission. Never the author.
- **Nothing shows until it is accepted.** Invitations, refusals and withdrawals are visible only to the author and the person named; administrators do not see them. The person invited may read the outcome before it is reviewed, so they can decide. Accepted credits show on the outcome card ("With Nia James"), on the community output published from it, and on the credited person's profile under **Credited on**, apart from their own outcomes.
- **A credit is not evidence.** Credits never count towards goals, paths, outcome review, whether an output is published, reputation points, roles or any credential. A credited person cannot complete a goal with someone else's outcome.
- **The review stays independent.** Someone with an accepted credit on an outcome cannot verify it or decide a correction to it; another administrator does. The administrator who verified an outcome, or decided a correction to it, cannot be credited on it.
- **Withdrawn outcomes.** Once an outcome is withdrawn, nobody new can be credited on it. Existing credits stay as they were and can still be answered or removed.
- **Notifications** link to Community outputs and fall under the Projects notification topic.
- **Inactive and former members** are treated as for contribution credits: a suspended member cannot invite, answer or withdraw, and their accepted credits are hidden from people who cannot see suspended members. Deleting an account deletes every outcome credit naming that person (`outcomeCredits` is a personal collection); credits they gave on their own outcomes stay with the outcome.
- **Storage.** Additive migration `0050_outcome_credits.sql` adds `outcome_credits` with forced row security. Foreign keys tie the inviter to the outcome's author and, for an outcome from project work, the credited person to the project's team. The insert policy also requires the credit to carry the outcome's own project (or none) and the outcome not to be withdrawn. The runtime role gets select, insert and delete, and update only on `status`, `responded_at`, `withdrawn_by` and `withdrawn_at`. Deletion is admitted only during the person's own account deletion.

## Alternatives considered

- **Copying accepted contribution credits onto the outcome automatically.** Consent was given for the contribution, not for a claim about what changed afterwards, so each outcome asks again.
- **One shared credits table for contributions and outcomes.** It would have meant rewriting migration 0033's constraints and policies. A second table with the same shape keeps earlier migrations untouched.
- **Credits on community outputs directly.** An output is derived from one outcome by an administrator; crediting the outcome keeps consent with the people who did the work, and the output shows the result.
