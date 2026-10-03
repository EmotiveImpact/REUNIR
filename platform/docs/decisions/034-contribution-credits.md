# Decision 034: crediting teammates on a contribution, with consent

Status: implemented on a feature branch, verified locally; not deployed. Date: 3 October 2026.

## Problem

A project contribution names one person: the member who recorded it. Real work is often shared: one person writes up a test that three people ran, or edits an issue someone else photographed. There was no honest way to say "with Nia" without inventing a second contribution or editing someone else's record.

## Decision

- **The author credits, the credited person consents.** Only the person who recorded a contribution can credit others on it (`credit.invite`). They choose an active member of the project's team, never themselves, with an optional short description such as "co-author". The person named accepts or declines (`credit.respond`). Either of them can later withdraw an accepted credit; the author can also withdraw an invitation (`credit.withdraw`).
- **Nothing shows until it is accepted.** Invitations, refusals and withdrawals are visible only to the author and the person named, in snapshots and in row security; administrators do not see them. An invited person may read the contribution so they can decide. Accepted credits show on the contribution ("With Nia James") to anyone who can read it, and on the credited person's profile under **Credited on**, separate from their own contributions.
- **A credit is not evidence.** Credits never count towards milestones, paths, goal completion, outcomes, community outputs, reputation points, roles, teaching or any credential. Those keep reading the contribution's own author and review. A credited person cannot record an outcome from someone else's contribution. Nothing is inferred from engagement.
- **The review stays about the contribution.** Recognising or requesting changes is unchanged, and the author still cannot review their own work. A person with an accepted credit on a contribution cannot review it either, because they share it; another project owner or an administrator reviews.
- **No asking twice.** One live credit (invited or accepted) per person per contribution, enforced by a partial unique index. If the person declined, or removed their own credit, the author cannot ask again. If the author withdrew, they may. At most 10 live credits per contribution, and 30 credit records in total.
- **Notifications.** The invitee is notified when asked, and the author when they answer. A withdrawn accepted credit notifies the other person. All link to the project page and fall under the Projects notification topic, so they follow the person's notification settings.
- **Inactive members.** A suspended member cannot invite, answer or withdraw (they cannot act in the community at all), and their accepted credits are hidden from people who cannot see suspended members, as in the directory; administrators still see them. Former members: deleting an account deletes every credit naming that person (`contributionCredits` is a personal collection). Credits the person gave on their own contributions stay with the contribution, which is kept as Former member's work; an open invitation from them can still be answered, and no notice goes to them.
- **Storage.** Additive migration `0033_contribution_credits.sql` adds `contribution_credits` with forced row security. Foreign keys tie the inviter to the contribution's author and the credited person to the project's team. The runtime role gets select, insert and delete, and update only on `status`, `responded_at`, `withdrawn_by` and `withdrawn_at`. Deletion is admitted only during the person's own account deletion.

## Not decided here

Removing someone from a project team (no such command exists yet), credits on outcomes or community outputs, credits for people outside the team, moderation of credit descriptions by administrators, and any public or cross-community display.
