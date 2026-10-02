import type {Database} from '../../packages/db/src/connection';
import {tables} from '../../packages/db/src/tables';
import {createSeed} from '../../packages/domain/src/seed';
/** Test-only fixture for schemas before 0006. New fields must not be used against old DDL. */
export async function seedBeforeProjectWork(db:Database){
    const state=createSeed();
    await db.transaction(async tx=>{
        const o=state.organisation;
        await tx.query('INSERT INTO organisations(id,slug,name,tagline,accent,created_at,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[o.id,o.slug,o.name,o.tagline,o.accent,o.createdAt,state.revision]);
        for(const spec of tables.filter(t=>!['projectTasks','taskNotes'].includes(t.key))){
            for(const row of state[spec.key]){
                const r=row as unknown as Record<string,unknown>;
                const values=spec.fields.map(f=>f.type==='jsonb'?JSON.stringify(r[f.property]):r[f.property]);
                await tx.query(`INSERT INTO ${spec.table} (${spec.fields.map(f=>f.column).join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
            }
        }
    });
}
