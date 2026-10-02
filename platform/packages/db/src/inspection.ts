import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {SQL} from './connection';
export interface MigrationObservation { version:string; state:'matching'|'missing'|'different'|'unknown'; }
/** Read-only digest comparison. Never runs DDL, prints SQL, or applies a migration. */
export async function inspectMigrations(sql:SQL):Promise<MigrationObservation[]> {
    const directory=new URL('../migrations/',import.meta.url);
    const files=(await readdir(directory)).filter(n=>/^\d{4}_[a-z0-9_]+\.sql$/.test(n)).sort();
    const found=await sql.query<{present:boolean}>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
    const applied=found.rows[0]?.present ? (await sql.query<{version:string;digest:string}>('SELECT version,digest FROM schema_migrations')).rows : [];
    const records=new Map(applied.map(r=>[r.version,r.digest]));
    const expected=new Set(files.map(n=>n.slice(0,4)));
    const observations:MigrationObservation[]=[];
    for(const name of files){
        const version=name.slice(0,4),digest=createHash('sha256').update(await readFile(new URL(name,directory))).digest('hex');
        observations.push({version,state:!records.has(version)?'missing':records.get(version)===digest?'matching':'different'});
    }
    for(const version of records.keys())if(!expected.has(version))observations.push({version,state:'unknown'});
    return observations;
}
