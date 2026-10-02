/** Redacted and read-only. Does not migrate, provision accounts, deliver mail or deploy. */
import './env';
import {inspectConfiguration} from '../apps/api/src/config';
import {manualPilotGates,RELEASE_VERSION,type PilotCheck} from '../packages/contracts/src/operations';
import {openDatabase} from '../packages/db/src/connection';
import {runtimeRoleIsSafe} from '../packages/db/src/runtime-safety';
import {inspectMigrations} from '../packages/db/src/inspection';
const args=new Set(process.argv.slice(2));
if([...args].some(a=>!['--database','--migrations','--json','--help'].includes(a))){console.error('Unknown option. Use --help.');process.exit(2);}
if(args.has('--help')){console.log('npm run pilot:check -- [--database] [--migrations] [--json]\nDefault: configuration only, no connection. --database reads DATABASE_URL role. --migrations reads MIGRATION_DATABASE_URL checksums. No writes or emails. A zero exit means no observed blocker, NOT launch approval.');process.exit(0);}
// The administrative URL is local to this explicit inspection; runtime startup still rejects it.
const runtimeView={...process.env};
if(args.has('--migrations'))delete runtimeView.MIGRATION_DATABASE_URL;
const checks:PilotCheck[]=inspectConfiguration(runtimeView);
if(args.has('--migrations'))checks.push({key:'cli-only-migration-credential',title:'CLI inspection boundary',state:'unverified',detail:'An administrative URL is being used only for this explicit inspection. Confirm it is absent from the deployed environment.'});
if(args.has('--database')){
    let db;
    try{
        if(!process.env.DATABASE_URL)throw new Error('Missing');
        db=await openDatabase(process.env.DATABASE_URL);const safe=await runtimeRoleIsSafe(db);
        checks.push({key:'database-connected',title:'Database connection',state:'pass',detail:'A read-only query completed using the configured runtime connection.'});
        checks.push({key:'runtime-role',title:'Runtime permissions',state:safe?'pass':'blocked',detail:safe?'Dedicated non-owner role with no membership, schema creation or RLS bypass detected.':'The runtime role can administer or bypass isolation. Use the restricted application role.'});
    }catch{checks.push({key:'database-connected',title:'Database connection',state:'blocked',detail:'The runtime inspection failed. Check connectivity and credentials locally. Connection details are intentionally redacted.'});}
    finally{await db?.close();}
}else checks.push({key:'database-connected',title:'Database connection',state:'unverified',detail:'No connection attempted. Use --database for a read-only runtime check.'});
if(args.has('--migrations')){
    let db;
    try{
        if(!process.env.MIGRATION_DATABASE_URL)throw new Error('Missing');
        db=await openDatabase(process.env.MIGRATION_DATABASE_URL);
        for(const row of await inspectMigrations(db))checks.push({key:'migration-'+row.version,title:'Migration '+row.version,state:row.state==='matching'?'pass':'blocked',detail:row.state==='matching'?'Applied checksum matches the source release.':'Migration state: '+row.state+'. Inspect staging before applying any changes.'});
    }catch{checks.push({key:'migrations',title:'Migration inspection',state:'blocked',detail:'Could not inspect history. Use an administrative MIGRATION_DATABASE_URL only in this isolated CLI process, not the deployed runtime.'});}
    finally{await db?.close();}
}else checks.push({key:'migrations',title:'Migration inspection',state:'unverified',detail:'History was not read. Use --migrations with the administrative connection in a separate process.'});
checks.push(...manualPilotGates());
const blocked=checks.some(c=>c.state==='blocked');
const report={version:RELEASE_VERSION,generatedAt:new Date().toISOString(),method:'Read-only configuration and explicitly selected database inspections; no deployment certification.',overall:blocked?'blocked':'needs-verification',checks};
if(args.has('--json'))console.log(JSON.stringify(report,null,2));else{console.log('REUNIR '+RELEASE_VERSION+' | '+report.overall);for(const c of checks)console.log(`[${c.state}] ${c.title}: ${c.detail}`);}
process.exitCode=blocked?1:0;
