import './env';
import {bootstrap} from '../apps/api/src/bootstrap';
const {mail,db}=await bootstrap();
try {console.log(JSON.stringify(await mail.drain(20)));} finally {await db.close();}
