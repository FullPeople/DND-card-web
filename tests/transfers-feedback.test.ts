import {describe,it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {evaluate} from '../src/core/engine';
import {exportCharacter,exportCharacters,exportLinkedOwlbear,exportOwlbear} from '../src/core/export';
import {readCharacterTransfer,deleteLocalCharacters} from '../src/core/transfers';
import {imagePdf,pngArchive} from '../src/platform/exportFiles';

describe('character file exchange and batch boundaries',()=>{
 it('round trips native catalog identity and depleted resources through Owlbear JSON',()=>{
  const card=newCharacter('2014');card.selections.push({id:'selected',entry:{id:'spell:PHB:spark',kind:'spell',name:'自制测试闪光',english:'Fixture Spark',source:'PHB',edition:'2014',packId:'upstream',revision:'fixture',entries:['测试条目'],raw:{level:1,school:'V'}},level:1,quantity:1,equipped:false});card.runtime.resources={innate:{current:0,max:2}};
  const [restored]=readCharacterTransfer([JSON.stringify(exportLinkedOwlbear(card,evaluate(card)))]);
  expect(restored.selections).toEqual(card.selections);expect(restored.edition).toBe('2014');expect(restored.runtime.resources.innate.current).toBe(0);expect(restored.id).not.toBe(card.id);
  const tampered=exportLinkedOwlbear(card,evaluate(card));tampered.dnd_card_web.abilities.str=999;
  expect(()=>readCharacterTransfer([JSON.stringify(tampered)])).toThrow();
 });
 it('validates all files before returning any batch and never mutates originals',()=>{
  const a=newCharacter(),b=newCharacter('2014'),before=JSON.stringify([a,b]);
  const restored=readCharacterTransfer([JSON.stringify(exportCharacters([a,b]))]);expect(restored).toHaveLength(2);expect(restored[0].id).not.toBe(restored[1].id);
  expect(()=>readCharacterTransfer([JSON.stringify(exportCharacter(a)),'{"broken":true}'])).toThrow();expect(JSON.stringify([a,b])).toBe(before);
 });
 it('retains unmapped legacy data without recursive native snapshots and does not merge same-name spells',()=>{
  const card=newCharacter();card.profile.enabledSources.push('HOMEBREW');card.externalSnapshot={core_stats:{hit_dice:{current:2,max:4}},unmapped:{note:'retain'},dnd_card_web:{deep:'old nested copy'}};
  card.selections=['XPHB','HOMEBREW'].map(source=>({id:source,entry:{id:`spell:${source}:same`,kind:'spell' as const,name:'同名测试术',english:'Same Fixture',source,edition:'2024' as const,packId:'fixture',revision:'1',entries:['测试'],raw:{level:1}},level:1,quantity:1,equipped:false}));
  card.spellSettings={mode:'prepared',ability:'int',capacity:1,prepared:['XPHB'],attackBonus:0,dcBonus:0,slots:{}};
  const projected=exportOwlbear(card,evaluate(card));expect(projected.spellcasting.prepared.map(s=>s.source)).toEqual(['XPHB']);expect(projected.spellcasting.always_known.map(s=>s.source)).toEqual(['HOMEBREW']);
  const backup=exportLinkedOwlbear(card,evaluate(card));expect(backup.dnd_card_web.externalSnapshot).toEqual({core_stats:{hit_dice:{current:2,max:4}},unmapped:{note:'retain'}});expect(card.externalSnapshot.dnd_card_web).toEqual({deep:'old nested copy'});
 });
 it('deleting a batch preserves the active survivor and refuses deleting every card',()=>{
  const a=newCharacter(),b=newCharacter(),c=newCharacter();expect(deleteLocalCharacters([a,b,c],b.id,[a.id])).toEqual({characters:[b,c],activeId:b.id});expect(deleteLocalCharacters([a,b],a.id,[a.id]).activeId).toBe(b.id);expect(()=>deleteLocalCharacters([a],a.id,[a.id])).toThrow();
 });
 it('writes valid PDF object offsets and binary image lengths',async()=>{
  const bytes=new Uint8Array([0xff,0xd8,10,37,0xff,0xd9]),pdf=new Uint8Array(await imagePdf([{bytes,width:4,height:4},{bytes,width:4,height:4}]).arrayBuffer());
  const text=new TextDecoder('latin1').decode(pdf);expect(text).toContain('/Count 2');const start=Number(text.match(/startxref\n(\d+)/)?.[1]);expect(text.slice(start,start+4)).toBe('xref');const offsets=[...text.matchAll(/(\d{10}) 00000 n/g)].map(m=>Number(m[1]));offsets.forEach((offset,i)=>expect(text.slice(offset,offset+7)).toBe(`${i+1} 0 obj`));expect(text).toContain('/Length 6');
 });
 it('archives every UTF-8 PNG with matching central-directory offsets',async()=>{
  const archive=new Uint8Array(await (await pngArchive([{name:'主要.png',blob:new Blob(['first'])},{name:'法术.png',blob:new Blob(['second'])}])).arrayBuffer());const end=new DataView(archive.buffer,archive.length-22);expect(end.getUint32(0,true)).toBe(0x06054b50);expect(end.getUint16(10,true)).toBe(2);const firstCentral=end.getUint32(16,true),central=new DataView(archive.buffer,firstCentral);expect(central.getUint32(0,true)).toBe(0x02014b50);expect(central.getUint32(42,true)).toBe(0);expect(central.getUint16(8,true)).toBe(0x800);
 });
});
