import './env';
import {bootstrap} from '../apps/api/src/bootstrap';
const {digests,db}=await bootstrap();
try {console.log(JSON.stringify(digests?await digests.run(new Date(),200):{configured:false,due:0,queued:0,quiet:0,skipped:0}));} finally {await db.close();}
