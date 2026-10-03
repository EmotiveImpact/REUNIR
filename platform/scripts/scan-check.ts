/** Read-only launch check for virus scanning. Sends three small in-memory samples to clamd; stores and uploads nothing. */
import './env';
import { ScannerUnavailable, scannerFromEnvironment } from '../apps/api/src/scanner';
// The industry-standard EICAR test file, assembled here so that this source file itself is not flagged by scanners.
const eicar = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$', 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');
const scanner = scannerFromEnvironment(process.env);
if (!scanner) { console.error('CLAMAV_HOST is not set. Nothing to check.'); process.exit(2); }
const results: [string, boolean][] = [];
results.push(['clamd answers PING', await scanner.ping()]);
try {
    results.push(['a harmless sample is clean', (await scanner.scan(new TextEncoder().encode('%PDF-1.4\n% REUNIR scanning check\n'))).clean]);
    results.push(['the EICAR test file is flagged', !(await scanner.scan(new TextEncoder().encode(eicar))).clean]);
} catch (error) {
    results.push([`scanning completes (${error instanceof ScannerUnavailable ? error.message : 'unexpected error'})`, false]);
}
for (const [title, ok] of results) console.log(`${ok ? 'pass ' : 'FAIL '} ${title}`);
const failed = results.some(([, ok]) => !ok);
console.log(failed ? 'Scanning is not ready. Uploads will wait with SCAN_UNAVAILABLE until it is.' : 'Scanning is ready. This is not launch approval.');
process.exit(failed ? 1 : 0);
