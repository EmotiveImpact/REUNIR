import { useEffect, useState } from 'react';
import { BellOff, Mail } from 'lucide-react';
import { Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { api, mode } from '../lib/data';
import { DIGESTS, MUTABLE_TOPICS, TOPIC_LABELS, type DigestFrequency, type MutableTopic } from '../../../../packages/contracts/src/notifications';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const DIGEST_LABELS: Record<DigestFrequency, string> = { off: 'No email digest', daily: 'Daily digest', weekly: 'Weekly digest' };

/** Whether the server can send digests. The demo never emails anyone. */
async function digestsAvailable(): Promise<boolean> {
    if (mode === 'demo') return false;
    return !!(await api<{ emailDigests?: boolean }>('/api/account/capabilities')).emailDigests;
}

/**
 * A member's own notification settings for this community. Muting a topic stops new notices about it; existing notices
 * stay. Notices about the person's own access always arrive. Settings are private to the member.
 */
export function NotificationSettings({ onClose }: { onClose: () => void }) {
    const { data, me, command, busy } = useWorkspace();
    const saved = data.notificationPreferences?.find(p => p.userId === me.userId);
    const [muted, setMuted] = useState<MutableTopic[]>(saved ? [...saved.muted] as MutableTopic[] : []);
    const [digest, setDigest] = useState<DigestFrequency>(saved?.digest ?? 'off');
    const [email, setEmail] = useState<boolean | null>(null);
    useEffect(() => { let live = true; digestsAvailable().then(v => { if (live) setEmail(v); }, () => { if (live) setEmail(false); }); return () => { live = false; }; }, []);
    const toggle = (t: MutableTopic, on: boolean) => setMuted(m => on ? m.filter(x => x !== t) : [...m, t]);
    const save = async () => { const r = await command({ type: 'notification.preferences.save', muted, digest }); if (r) onClose(); };
    return <Modal title="Notification settings" onClose={onClose}>
        <form className="form-stack notification-settings" onSubmit={e => { e.preventDefault(); void save(); }}>
            <fieldset>
                <legend>Notices in {data.organisation.name}</legend>
                {MUTABLE_TOPICS.map(t => <Label className="access-checkbox" key={t}>
                    <Checkbox checked={!muted.includes(t)} disabled={busy} onCheckedChange={on => toggle(t, on === true)}/>
                    <span><strong>{TOPIC_LABELS[t].title}</strong><small>{TOPIC_LABELS[t].detail}</small></span>
                </Label>)}
                <p className="sample-note"><BellOff size={14}/> {TOPIC_LABELS.community.detail} Turning a topic off stops new notices; ones you already have stay.</p>
            </fieldset>
            <RadioGroup asChild name="digest" value={digest} disabled={busy} onValueChange={v => setDigest(v as DigestFrequency)}><fieldset>
                <legend>Email digest</legend>
                {DIGESTS.map(d => <Label className="access-checkbox" key={d}>
                    <RadioGroupItem value={d}/>
                    <span><strong>{DIGEST_LABELS[d]}</strong></span>
                </Label>)}
                <p className="sample-note" role="status"><Mail size={14}/> {email === null ? 'Checking whether email is set up…'
                    : email ? 'A digest lists notices you have not read since the last one, and is skipped when there are none.'
                    : mode === 'demo' ? 'The browser demo never sends email. Your choice is saved for when email is set up.'
                    : 'Email is not set up for this community yet. Your choice is saved and takes effect once it is.'}</p>
            </fieldset></RadioGroup>
            <Button variant="default" className="button primary" disabled={busy}>Save notification settings</Button>
        </form>
    </Modal>;
}
