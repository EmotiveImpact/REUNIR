import { useId, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { downloadLearningRecord } from '../lib/learning-record';

/** Your own learning in this community, as a file to keep. Shown only on your own profile. */
export function LearningRecordPanel() {
    const { slug, userId, toast } = useWorkspace();
    const [working, setWorking] = useState(false);
    const heading = useId();
    const download = async () => {
        setWorking(true);
        try { toast(await downloadLearningRecord(slug, userId)); }
        catch (e) { toast(displayError(e),'error'); }
        finally { setWorking(false); }
    };
    return <section className="panel learning-record" aria-labelledby={heading}>
        <h2 id={heading}>Your learning record</h2>
        <p>A file of the tracks you joined, the lessons you completed, your knowledge-check answers with their marks and feedback, and your mission work in this community. Only you can download it.</p>
        <button type="button" className="button secondary" disabled={working} onClick={() => void download()}>{working ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Download size={15} aria-hidden="true"/>}Download your learning record</button>
    </section>;
}
