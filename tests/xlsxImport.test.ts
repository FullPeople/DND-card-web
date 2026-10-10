import {describe,expect,it} from 'vitest';
import {newCharacter} from '../src/core/model';
import {exportCharacter} from '../src/core/export';
import {readCharacterFiles} from '../src/platform/characterFiles';
import {parseXlsxCharacter} from '../src/platform/xlsxCharacter';
import {synchronizedImport} from '../src/platform/importCardSync';
import {planBatchCardMigration} from '../src/core/batchCardMigration';
import type {CellValue,XlsxWorkbook} from '../src/platform/xlsxWorkbook';

function workbook(edition='2024',english=false):XlsxWorkbook{
 const names=english?['Main','Origin','Spell Compendium','Equipment','Data','Areas of Effect','Web Import','Inventory','Background Data']:['主要',edition==='2024'?'起源':'背景','法术大全','装备','数据表','圆形效应范围','网页导入','背包',edition==='2024'?'背景':'背景数据'];
 const main=new Map<string,CellValue>([['E2','5E'+edition],['E3','导入测试'],['E6','自定义职业'],['O6',3],['T6','自定义种族'],['AL39','盾牌'],['AQ39','AC'],['AS39','着装'],['AQ40',2],['AS40','是'],['AG60',17],['R22',12],['V22',23],['L24','感知'],['B26','自定义资源'],['J26',1],['M26',4]]);
 for(let i=0;i<6;i++){main.set('F'+(13+i),10+i);main.set('R'+(13+i),Math.floor(i/2));}
 const person=new Map<string,CellValue>([['E6','自定义背景'],['S17','保留故事原文'],['S12','保留个性']]);
 return{names,sheet:async name=>({cells:name===names[0]?main:name===names[1]?person:new Map(),maxRow:90})};
}

describe('Excel character import boundaries',()=>{
 it.each(['2014','2024'])('keeps edition, core values, resource uses and biography for %s',async edition=>{
  const value=await parseXlsxCharacter(workbook(edition),'input.xlsx');
  expect(value.meta.ruleset).toBe('5E'+edition);expect(value.identity.character_name).toBe('导入测试');
  expect(value.abilities.cha.total).toBe(15);expect(value.core_stats.hp).toEqual({current:12,max:23,temp:0});
  expect(value.combat.shield.equipped).toBe(true);expect(value.special_resources[0]).toMatchObject({name:'自定义资源',current:1,max:4});
  expect(value.inventory.currency.wallet.gp).toBe(17);expect(value.background.story).toBe('保留故事原文');
 });
 it('accepts the reviewed English worksheet aliases without translating cell values',async()=>{
  const value=await parseXlsxCharacter(workbook('2024',true),'english.xlsx');expect(value.identity.character_name).toBe('导入测试');expect(value.background.traits).toBe('保留个性');
 });
 it('rejects unknown, incomplete, duplicated or conflicting template identities',async()=>{
  const duplicate=workbook();duplicate.names.push('Main');await expect(parseXlsxCharacter(duplicate,'duplicate.xlsx')).rejects.toThrow(/重复/);
  const incomplete=workbook();incomplete.names=incomplete.names.filter(name=>name!=='背包');await expect(parseXlsxCharacter(incomplete,'missing.xlsx')).rejects.toThrow(/缺少/);
  const conflict=workbook();const sheet=await conflict.sheet('主要');sheet.cells.set('F2','5E2014');await expect(parseXlsxCharacter(conflict,'conflict.xlsx')).rejects.toThrow(/冲突/);
 });
 it('validates the whole batch before reading even its first accepted file',async()=>{
  let read=false;const first={name:'first.json',size:1,text:async()=>{read=true;return '{}';}} as File;
  await expect(readCharacterFiles([first,new File(['x'],'bad.xls')])).rejects.toThrow(/不支持/);expect(read).toBe(false);
 });
 it('retains JSON collection compatibility and gives each imported card one new identity',async()=>{
  const original=newCharacter(),value=await readCharacterFiles([new File([JSON.stringify(exportCharacter(original))],'backup.JSON')]);
  expect(value.excelIds).toEqual([]);expect(value.cards).toHaveLength(1);expect(value.cards[0].id).not.toBe(original.id);expect(original.name).toBe('未命名的冒险者');
 });
 it('synchronizes an unpublished import without changing its identity or creating a backup',()=>{
  const original=newCharacter();original.name='同一张导入卡';original.runtime.resources.manual={current:1,max:4,type:'count'};
  const before=structuredClone(original),{plan}=planBatchCardMigration(original,[],{},{},{id:'planned-copy',now:'2026-10-10T00:00:00.000Z'});
  const current=synchronizedImport(original,original,plan);
  expect(current.id).toBe(original.id);expect(current.name).toBe(original.name);expect(current.revision).toBe(1);expect(current.runtime.resources.manual.current).toBe(1);expect(original).toEqual(before);
  const changed={...original,revision:2};expect(()=>synchronizedImport(original,changed,plan)).toThrow(/变化/);
 });
});
