import type {Database} from '../../packages/db/src/connection';
import {tables} from '../../packages/db/src/tables';
import {createSeed} from '../../packages/domain/src/seed';
/** Test-only fixture for schemas before 0006. New fields must not be used against old DDL. */
export async function seedBeforeProjectWork(db:Database){
    const state=createSeed();
    await db.transaction(async tx=>{
        const o=state.organisation;
        await tx.query('INSERT INTO organisations(id,slug,name,tagline,accent,created_at,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[o.id,o.slug,o.name,o.tagline,o.accent,o.createdAt,state.revision]);
        for(const spec of tables.filter(t=>!['projectTasks','taskNotes','uploads','quizAttempts','trackInstructors','coverLibrary','moderationAppeals'].includes(t.key))){
            for(const row of state[spec.key]){
                const r=row as unknown as Record<string,unknown>;
                const fields=spec.fields.filter(f=>!['richBody','resources','quiz','coverImage','moderatedBy','moderatedAt'].includes(f.property));
                const values=fields.map(f=>f.type==='jsonb'?JSON.stringify(r[f.property]):r[f.property]);
                await tx.query(`INSERT INTO ${spec.table} (${fields.map(f=>f.column).join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
            }
        }
    });
}
/**
 * Test-only fixture for an older schema that already has the tables a test needs: inserts the current seed using only the
 * tables and columns that exist at that migration, so columns added later (for example 0024's posts.moderated_by) are skipped.
 */
export async function seedAtSchema(db:Database){
    const state=createSeed();
    await db.transaction(async tx=>{
        await tx.query("SELECT set_config('app.organization_id',$1,true)",[state.organisation.id]);
        const present=new Map<string,Set<string>>();
        for(const r of (await tx.query<{table_name:string;column_name:string}>("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows)
            (present.get(r.table_name)??present.set(r.table_name,new Set()).get(r.table_name)!).add(r.column_name);
        const o=state.organisation;
        await tx.query('INSERT INTO organisations(id,slug,name,tagline,accent,created_at,revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[o.id,o.slug,o.name,o.tagline,o.accent,o.createdAt,state.revision]);
        for(const spec of tables){
            const columns=present.get(spec.table);
            if(!columns)continue;
            const fields=spec.fields.filter(f=>columns.has(f.column));
            for(const row of state[spec.key]){
                const r=row as unknown as Record<string,unknown>;
                const values=fields.map(f=>f.type==='jsonb'&&r[f.property]!=null?JSON.stringify(r[f.property]):r[f.property]??null);
                await tx.query(`INSERT INTO ${spec.table} (${fields.map(f=>f.column).join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
            }
        }
    });
}
