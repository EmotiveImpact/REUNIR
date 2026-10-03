import './env';
import { openDatabase } from '../packages/db/src/connection';
import { RetentionJob } from '../packages/db/src/retention';
// The retention rules in RETENTION.md. A dry run unless RETENTION=apply; counts only, never contents.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL securely in the local environment.');
const db = await openDatabase(url);
try {
    const apply = process.env.RETENTION === 'apply';
    const result = await new RetentionJob(db).run(new Date(), apply);
    console.log(JSON.stringify(result));
    if (!apply) console.log('Dry run: nothing was changed. Set RETENTION=apply to clear these records.');
} finally { await db.close(); }
