import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, LoaderCircle } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { handOverOwnership } from '../lib/ownership';
import { Modal } from './ui';
import type { Member } from '../../../../packages/contracts/src/index';

/** The owner hands the community to an administrator, after their password and the community's name. */
export function HandOverDialogue({ target, onClose }: { target: Member; onClose: () => void }) {
    const { data, mode, slug, userId, toast, reload } = useWorkspace();
    const cache = useQueryClient();
    const [password, setPassword] = useState(''), [typed, setTyped] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const passwordField = useId(), nameField = useId(), nameHint = useId();
    const community = data.organisation.name;
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setWorking(true);
        try {
            const r = await handOverOwnership(slug, userId, target.id, password, typed);
            await cache.invalidateQueries({ queryKey: ['identity'] });
            reload(); toast(r.message); onClose();
        }
        catch (err) { setError(displayError(err)); setWorking(false); }
    };
    return <Modal title={`Hand ${community} to ${target.name}?`} onClose={() => { if (!working) onClose(); }}>
        <form className="form-stack" onSubmit={submit} noValidate>
            <p className="account-warning">{target.name} becomes the owner of {community}: they assign roles and can hand it on again. You stay as an administrator, and only the new owner can change that. Posts, projects and everything else stay exactly as they are.</p>
            {mode === 'live'
                ? <div className="account-field"><label htmlFor={passwordField}>Your password</label><input id={passwordField} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={working}/></div>
                : <p className="sample-note">This fictional demo has no passwords. A connected community asks for yours here.</p>}
            <div className="account-field">
                <label htmlFor={nameField}>Type <strong>{community}</strong> to confirm</label>
                <input id={nameField} aria-describedby={nameHint} autoComplete="off" spellCheck={false} required value={typed} onChange={e => setTyped(e.target.value)} disabled={working}/>
                <small id={nameHint}>Typing the community’s name guards against handing it over by accident.</small>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={onClose} disabled={working}>Keep ownership</button>
                <button type="submit" className="button primary" disabled={working}>{working ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Crown size={15} aria-hidden="true"/>}Hand over ownership</button>
            </div>
        </form>
    </Modal>;
}
