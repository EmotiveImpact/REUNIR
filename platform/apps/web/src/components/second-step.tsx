import { useId, useState } from 'react';
import { displayError } from '../lib/data';
import { completeSecondStep, type SecondStep } from '../lib/two-factor';

/** The second step of signing in, used by the sign-in page and by an invitation's sign-in. */
export function SecondStepForm({ onDone, onRestart }: { onDone: () => void | Promise<void>; onRestart: () => void }) {
    const [kind, setKind] = useState<SecondStep>('app'), [code, setCode] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const field = useId(), hint = useId();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setWorking(true);
        try { await completeSecondStep(kind, code); await onDone(); }
        catch (err) { setError(displayError(err)); setWorking(false); }
    };
    return <form className="form-stack two-step-form" onSubmit={submit} noValidate>
        <h2>One more step.</h2>
        <p>{kind === 'app' ? 'Enter the six-digit code from your authenticator app.' : 'Enter one of the backup codes you saved. Each one works once.'}</p>
        <label htmlFor={field}>{kind === 'app' ? 'Six-digit code' : 'Backup code'}</label>
        <input id={field} aria-describedby={hint} value={code} onChange={e => setCode(e.target.value)} disabled={working} required
            {...(kind === 'app' ? { inputMode: 'numeric' as const, autoComplete: 'one-time-code', maxLength: 7, pattern: '[0-9 ]*' } : { autoComplete: 'off', autoCapitalize: 'none', spellCheck: false, maxLength: 20 })}/>
        <small id={hint}>{kind === 'app' ? 'The code changes every 30 seconds.' : 'Backup codes look like ab12c-3de4f.'}</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" disabled={working}>{working ? 'Checking…' : 'Continue'}</button>
        <button type="button" className="button secondary" disabled={working} onClick={() => { setKind(kind === 'app' ? 'backup' : 'app'); setCode(''); setError(''); }}>{kind === 'app' ? 'Use a backup code instead' : 'Use your authenticator app instead'}</button>
        <button type="button" className="text-link" disabled={working} onClick={onRestart}>Start again</button>
    </form>;
}
