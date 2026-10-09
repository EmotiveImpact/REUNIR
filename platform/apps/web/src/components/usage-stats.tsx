import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '../lib/context';
import { browserAsksNotToCount, leftOut, loadUsage, setLeftOut } from '../lib/usage';
import { USAGE_KEEP_DAYS, USAGE_THRESHOLD, type UsageCell } from '../../../../packages/contracts/src/usage';
import { InlineError, Loading } from './states';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

const short = (day: string) => new Date(`${day}T00:00:00.000Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const cell = (n: UsageCell) => n === null ? <><span aria-hidden="true">&lt;{USAGE_THRESHOLD}</span><span className="sr-only">fewer than {USAGE_THRESHOLD}</span></> : n;

/**
 * Community studio, for owners and administrators: how often each part of the community was opened, week by week
 * (decision 060). No person, ranking or score appears here, and small counts are hidden.
 */
export function UsageStats() {
    const { slug, mode } = useWorkspace();
    const heading = useId();
    const q = useQuery({ queryKey: ['usage', slug], staleTime: 0, refetchOnWindowFocus: false, queryFn: () => loadUsage(slug) });
    return <section className="panel usage-stats" aria-labelledby={heading}>
        <h2 id={heading}>How the community is used</h2>
        <p>How often each part of the community was opened, week by week. Nothing records who opened it, so no person, ranking or score can come from these counts. Counts under {USAGE_THRESHOLD} show as “&lt;{USAGE_THRESHOLD}” so a small community never shows what one person did. Daily counts are kept for {USAGE_KEEP_DAYS} days.</p>
        {mode === 'demo' && <p className="sample-note">Illustrative counts in this demonstration. Pages you open here add to this week only while this page stays open.</p>}
        {q.isPending ? <Loading label="Reading the usage counts…"/> : q.isError ? <InlineError error={q.error} onRetry={() => void q.refetch()}/> : <div className="usage-table-wrap" tabIndex={0} role="region" aria-label="Weekly usage counts">
            <table className="usage-table">
                <caption className="sr-only">Times each part of the community was opened, by week starting</caption>
                <thead><tr><th scope="col">Part of the community</th>{q.data.weeks.map((w, i) => <th scope="col" key={w}>{i === q.data.weeks.length - 1 ? 'This week' : short(w)}</th>)}</tr></thead>
                <tbody>{q.data.areas.map(a => <tr key={a.area}><th scope="row">{a.label}</th>{a.counts.map((n, i) => <td key={q.data.weeks[i]}>{cell(n)}</td>)}</tr>)}</tbody>
            </table>
        </div>}
    </section>;
}

/** Your account: leave this device out of usage counts. The browser's own privacy signal does the same. */
export function UsageChoicePanel() {
    const heading = useId();
    const [out, setOut] = useState(leftOut()), [note, setNote] = useState('');
    const signal = browserAsksNotToCount();
    return <section className="panel usage-choice" aria-labelledby={heading}>
        <h2 id={heading}>Usage counts</h2>
        <p>Communities count how often each of their parts is opened, so their owners can see what people use. The count is all that is kept: never who opened what, when in the day, or from where.</p>
        {signal
            ? <p className="muted">Your browser asks sites not to track you, so nothing you open from it is counted.</p>
            : <Label className="usage-toggle"><Switch checked={!out} onCheckedChange={on => { const kept = setLeftOut(!on); setOut(!on); setNote(kept ? '' : 'This browser cannot keep the choice, so it lasts until you close this page.'); }}/>Count what I open from this device</Label>}
        {note && <p className="muted" role="status">{note}</p>}
    </section>;
}
