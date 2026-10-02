import {readFileSync,existsSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const source=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
describe('native Owlbear owner UI contract',()=>{
 it('removes the custom player assignment toolbar and dialog implementation',()=>{
  expect(source('src/ui/App.tsx')).not.toContain('CardOwnership');
  expect(existsSync(new URL('../src/ui/CardOwnership.tsx',import.meta.url))).toBe(false);
 });
 it('explains native Set Owner without suggesting that character-name text grants permission',()=>{
  const text=source('src/ui/uiText.ts');
  expect(text).toContain('角色卡权限使用枭熊棋子的 Set Owner');
  expect(text).toContain('所属玩家可查看已上锁的卡');
  expect(text).toContain('Character permissions use Owlbear’s Set Owner');
  expect(text).not.toContain('点击工具栏“分配玩家”');
 });
 it('retains the independent write guard on the edit mode switch',()=>{
  expect(source('src/ui/App.tsx')).toContain('disabled={!automationRuntime||inWorkbench&&!wb.target?.write}');
 });
});
