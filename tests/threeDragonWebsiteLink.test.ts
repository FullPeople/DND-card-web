import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/ui/App.tsx',import.meta.url),'utf8');
describe('online Three Dragon link stays independent of card recovery',()=>{
 it('uses the deployed explicit new-window link without an embedded table lifecycle',()=>{
  expect(app).toContain('href="https://dnd.center/3-dragon/" target="_blank" rel="noopener noreferrer"');
  expect(app).toContain("import './threeDragonLink.css'");
  expect(app).not.toMatch(/ThreeDragonFullscreen|tableOpen|setTableOpen|workbench-underlay|workbench-content/);
  // A plain anchor with a native tooltip, rendered only when the module is enabled; no hover preview wrapper.
  expect(app).not.toContain('HelpHint');
  expect(app).toMatch(/threeDragonAnte!==false&&<a className="suite-website-link icon-button" href="https:\/\/dnd\.center\/3-dragon\/" target="_blank" rel="noopener noreferrer"/);
 });
 it('keeps current main startup isolation and recovery UI together',()=>{
  expect(app).toContain("from './overviewConditionEntry'");
  expect(app).toContain("from '../core/classMigrationQuery'");
  expect(app).toContain("else if(workspace&&c&&d)window.dispatchEvent(new Event('dnd-card-ready'))");
  expect(app).toContain('正在恢复编辑模式，当前卡面仍可查阅');
  expect(app).toContain('inWorkbench&&wb.readFailure?');expect(app).toContain('retryWorkbenchRead()');
 });
 it('does not couple the local permission guide to the removed table layout',()=>{
  const notice=readFileSync(new URL('../src/ui/PlayerPermissionButton.tsx',import.meta.url),'utf8');
  expect(notice).toContain('panel="permissions"');expect(notice).not.toMatch(/ThreeDragon|tableOpen|workbench-underlay/);
  const css=readFileSync(new URL('../src/ui/playerPermissionNotice.css',import.meta.url),'utf8');
  expect(css).toContain('@media print{.player-permission-dialog{display:none!important}}');
 });
});
