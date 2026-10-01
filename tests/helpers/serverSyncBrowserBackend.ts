import {mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startBackend} from './goBackend.ts';
/**
 * Playwright webServer for tests/e2e/serverSync.spec.ts: the real Go backend on
 * a fresh temporary SQLite database. Synthetic test-only tokens are written to
 * the OS temp directory (never the repository) for the spec to read.
 */
export const SERVER_SYNC_E2E={backendPort:18087,appPort:5196,credentials:join(tmpdir(),'dnd-server-sync-e2e','credentials.json')};
if(import.meta.url===`file://${process.argv[1]}`){
  const backend=await startBackend({DND_RETENTION:'3',DND_CHARACTER_RATE:'200',DND_CORS_ORIGIN:`http://127.0.0.1:${SERVER_SYNC_E2E.appPort}`},['owner','player'],SERVER_SYNC_E2E.backendPort);
  mkdirSync(join(tmpdir(),'dnd-server-sync-e2e'),{recursive:true});
  writeFileSync(SERVER_SYNC_E2E.credentials,JSON.stringify({baseUrl:backend.baseUrl,users:backend.users}));
  const stop=()=>{void backend.stop().finally(()=>process.exit(0));};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
