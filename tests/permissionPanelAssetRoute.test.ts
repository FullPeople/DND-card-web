import {describe,it,expect} from 'vitest';
import {permissionPanelAssetRoute} from './e2e/permissionPanelAssetRoute';

describe('paired permission guide asset routing',()=>{
 it('serves the real guide HTML and its generated JavaScript with query strings',()=>{
  for(const path of ['/workbench-panels/permissions.html?instance=test&permissions=1&v=entry', '/suite-dev/workbench-panels/permissions-Df34a.js', '/suite-dev/workbench-panels/permissions-shared-Df34a.js?v=build']){
   expect(permissionPanelAssetRoute(new URL(path,'http://localhost:5764')),path).toBe(true);
  }
 });
 it('leaves optional workbench sounds and unrelated panels to their normal loaders',()=>{
  for(const path of ['/workbench-panels/sound.js', '/suite-dev/workbench-panels/sound.js?v=build', '/workbench-panels/settings.html', '/workbench-panels/settings-Df34a.js', '/workbench-panels/supporters.js', '/workbench-panels/studio/index.html']){
   expect(permissionPanelAssetRoute(new URL(path,'http://localhost:5764')),path).toBe(false);
  }
 });
 it('does not claim Vite source requests or similarly named unrelated assets',()=>{
  for(const path of ['/src/platform/workbenchSound.ts', '/src/ui/WorkbenchPanel.tsx', '/workbench-panels/permissions.html.js', '/workbench-panels/permissions.css', '/workbench-panels/permissions-extra.html']){
   expect(permissionPanelAssetRoute(new URL(path,'http://localhost:5764')),path).toBe(false);
  }
 });
});
