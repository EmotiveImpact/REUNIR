import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Empty } from './ui';
import { simulatedFault } from './states';

/**
 * Demo only: a page that fails to display until Retry is pressed, so the error screen can be seen and checked.
 * It changes no data. The connected application does not register its route.
 */
export function SimulatedFault() {
    const [, rerender] = useState(0);
    if (simulatedFault.armed) throw new Error('A simulated display fault in the fictional demo. No data was changed.');
    return <Empty icon={CheckCircle2} title="The page recovered." body="This demo-only page fails on purpose to show how REUNIR handles a page that cannot be displayed. No data was changed." action={<><button type="button" className="button secondary" onClick={() => { simulatedFault.armed = true; rerender(n => n + 1); }}>Simulate the problem again</button><Link className="button secondary" to="/">Go to your home</Link></>}/>;
}
