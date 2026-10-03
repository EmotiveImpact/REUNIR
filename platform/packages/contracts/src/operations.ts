/** Redacted operational observations. These are not a launch certificate. */
export type PilotCheckState = 'pass' | 'warning' | 'blocked' | 'unverified';
export interface PilotCheck {
    key: string;
    title: string;
    state: PilotCheckState;
    detail: string;
    action?: string;
}
export interface PilotStatus {
    version: string;
    generatedAt: string;
    source: 'server' | 'demo';
    checks: PilotCheck[];
    overall: 'blocked' | 'needs-verification';
    community: { activeMembers: number; independentModerators: number; purposes: number | null; paths: number | null; projects: number | null };
    delivery: { queued: number | null; sending: number | null; failed: number | null; oldestQueuedAt: string | null; lastSentAt: string | null; lastWorkerAt: string | null };
}
export const RELEASE_VERSION = '0.16.0-alpha.1';
export const manualPilotGates = (): PilotCheck[] => [
    {key:'hosted-browser',title:'Hosted member journey',state:'unverified',detail:'Real hosted sign-in, invitation, recovery and messaging must pass in a browser.',action:'Run the connected-browser release gate against staging. Demo tests are not a substitute.'},
    {key:'restore',title:'Backup and restore',state:'unverified',detail:'A database connection does not demonstrate recoverability.',action:'Restore a staging backup into a separate empty database and verify the records and permissions.'},
    {key:'delivery-receipt',title:'Email received by a real person',state:'unverified',detail:'Provider acceptance and a drained queue do not prove inbox delivery.',action:'Verify the sender, receive a staging invitation and a password-reset email, then check bounce handling.'},
    {key:'pilot-approval',title:'Pilot approval',state:'unverified',detail:'These observations never automatically authorise public launch.',action:'Review privacy, moderation, accessibility, retention and approved content with the community owner.'},
];
