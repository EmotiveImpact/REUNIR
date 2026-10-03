import { useId } from 'react';
import { RETENTION_POLICY } from '../../../../packages/contracts/src/retention';

/** Your account: how long REUNIR keeps things, from the same rules the retention job applies. */
export function RetentionPanel() {
    const heading = useId();
    return <section className="panel retention" aria-labelledby={heading}>
        <h2 id={heading}>How long things are kept</h2>
        <p>What you make stays while your community keeps it. Housekeeping records are cleared on a fixed schedule.</p>
        <dl className="retention-list">{RETENTION_POLICY.map(r => <div key={r.what}>
            <dt>{r.what}</dt>
            <dd className="retention-kept">{r.kept}</dd>
            <dd className="retention-why">{r.why}</dd>
        </div>)}</dl>
    </section>;
}
