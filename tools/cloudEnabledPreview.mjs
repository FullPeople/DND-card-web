// Historical enabled cloud flows run only in a separately compiled test fixture.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
execFileSync(process.execPath,['tools/buildCloudEnabledTestFixture.mjs'],{stdio:'inherit'});
process.env.CLOUD_PREVIEW_PROFILE='enabled-fixture';process.env.CLOUD_PREVIEW_ROOT=resolve('.local-evidence/cloud-enabled-fixture');
await import('./cloudPreview.mjs');
