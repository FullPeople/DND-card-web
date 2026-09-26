import {describe,expect,it} from 'vitest';
import {normalizeData} from '../src/data/catalog';
import {homebrewBody} from '../src/data/homebrew';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

describe('starting equipment from mixed source formats',()=>{
  it('loads a whole collection containing array-based backgrounds and preserves their linked equipment',()=>{
    const body={background:[{name:'验收旅人',source:'XPHB',entries:['自制验收正文。'],startingEquipment:[{a:[{item:'验收绳索|XPHB',quantity:2},{value:500}],b:[{special:'旅行纪念品'}],_:[{equipmentType:'tool',quantity:1}]}]}],feat:[{name:'同文件专长',source:'XPHB',entries:['同一资料中的其他类别也必须能加载。']}]};
    const original=structuredClone(body),entries=normalizeData(body,'regression');
    expect(entries).toHaveLength(2);
    const background=entries.find(entry=>entry.kind==='background')!;
    expect(JSON.stringify(background.entries)).toContain('{@item 验收绳索|XPHB} ×2');
    expect(JSON.stringify(background.entries)).toContain('5 gp');
    expect(JSON.stringify(background.entries)).toContain('旅行纪念品');
    expect(JSON.stringify(background.entries)).toContain('选择装备：tool');
    expect(background.raw.startingEquipment).toEqual(original.background[0].startingEquipment);
    expect(body).toEqual(original);
  });
  it.each([
    {default:['旧版职业装备。']},
    {entries:['新版职业装备。'],defaultData:[{_:[{value:100}]}]},
    {defaultData:[{_:[{item:'验收短剑|XPHB'}]}]},
  ])('keeps supported class equipment formats readable: %j',equipment=>{
    const [entry]=normalizeData({class:[{name:'验收职业',source:'XPHB',startingEquipment:equipment}]},'regression');
    const sections=entry.entries.filter(value=>typeof value==='object'&&value!==null&&(value as {name?:string}).name==='起始装备');
    expect(sections).toHaveLength(1);
    expect((sections[0] as {entries:unknown[]}).entries.length).toBeGreaterThan(0);
    if('entries' in equipment)expect((sections[0] as {entries:unknown[]}).entries).toEqual(equipment.entries);
  });
  it('does not mistake inherited array methods for fields, including an empty equipment array',()=>{
    expect(typeof [].entries).toBe('function');
    const [entry]=normalizeData({background:[{name:'空装备背景',source:'XPHB',startingEquipment:[],entries:['背景说明仍可用。']}]},'regression');
    expect(entry.entries).toContain('背景说明仍可用。');
  });
});

it.skipIf(!process.env.EQUIPMENT_SOURCE_DIR)('normalizes the ten reported upstream files without losing their background records',()=>{
  const directory=process.env.EQUIPMENT_SOURCE_DIR!;
  const manifest=JSON.parse(readFileSync(join(directory,'manifest.json'),'utf8')) as {path:string;file:string;error?:string}[];
  const results=manifest.map(source=>{
    try{
      if(source.error)throw Error(source.error);
      const raw=JSON.parse(readFileSync(join(directory,source.file),'utf8'));
      const body=source.path.startsWith('data/')?raw:homebrewBody(raw);
      const entries=normalizeData(body,'real-source-regression');
      const missing=(body.background||[]).filter((item:{name:string;source:string})=>!entries.some(entry=>entry.kind==='background'&&entry.name===item.name&&entry.source===String(item.source).toUpperCase())).map((item:{name:string})=>item.name);
      expect(missing).toEqual([]);
      return {path:source.path,passed:true,entries:entries.length,backgrounds:entries.filter(entry=>entry.kind==='background').length};
    }catch(error){return {path:source.path,passed:false,error:String(error)};}
  });
  if(process.env.EQUIPMENT_RECEIPT)writeFileSync(process.env.EQUIPMENT_RECEIPT,JSON.stringify(results,null,2));
  expect(results).toHaveLength(10);
  expect(results.filter(result=>!result.passed)).toEqual([]);
});
