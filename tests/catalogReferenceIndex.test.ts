import {describe,expect,it} from 'vitest';
import {newCharacter,type Entry} from '../src/core/model';
import {librarySourceEnabled} from '../src/ui/libraryData';
import {catalogReferenceIndex,lookupCatalogReference} from '../src/platform/catalogReferenceIndex';

const row=(id:string,kind:Entry['kind'],name:string,source='PHB',raw:Entry['raw']={}):Entry=>({id,kind,name,english:name,source,edition:source==='XPHB'?'2024':'2014',packId:'fixture',revision:'one',entries:[],raw});
const old=row('spell-old','spell','Same spell'),modern=row('spell-new','spell','Same spell','XPHB');
function reader(entries:Entry[],personal:Entry[]=[],enabled=['PHB','XPHB']){
 const character=newCharacter('2024');character.profile.enabledSources=enabled;character.selections=personal.map((entry,i)=>({id:'personal-'+i,entry,level:1,quantity:1,equipped:false}));
 const context={index:catalogReferenceIndex(entries),character,canRead:(entry:Entry)=>librarySourceEnabled(character,entry)};
 return (reference:string,tag?:string,detail?:{edition:string;source:string})=>lookupCatalogReference({...context,...detail},reference,tag);
}
describe('indexed standalone reference reading',()=>{
 it('preserves separate edition/source identities and the original unspecified-source precedence',()=>{
  const read=reader([modern,old]);expect(read('Same spell','spell')).toBe(old);expect(read('Same spell|xphb','spell')).toBe(modern);expect(read('Same spell','spell',{edition:'2024',source:'XPHB'})).toBe(modern);expect(reader([modern,old],[],['XPHB'])('Same spell','spell')).toBe(modern);
 });
 it('keeps card-local snapshots first for exact IDs and preserves the first enabled catalog duplicate',()=>{
  const snapshot={...modern,name:'Saved spell',packId:'imported',source:'IMPORTED'},disabled={...old,id:'duplicate',source:'OFF'},enabled={...modern,id:'duplicate'};
  expect(reader([modern],[snapshot])('entry:'+modern.id)).toBe(snapshot);expect(reader([disabled,enabled])('entry:duplicate')).toBe(enabled);expect(reader([old,{...old,revision:'later'}])('entry:'+old.id)).toBe(old);
 });
 it('resolves subclass short names with independent parent/source fields',()=>{
  const a=row('old-sub','subclass','Old school','PHB',{shortName:'Evoker',className:'Wizard',classSource:'PHB'}),b=row('new-sub','subclass','New school','XPHB',{ENG_shortName:'Evoker',classEnglish:'Wizard',classSource:'XPHB'}),read=reader([b,a]);
  expect(read('Wizard|PHB||Evoker|PHB','class')).toBe(a);expect(read('Wizard|XPHB||Evoker|XPHB','class')).toBe(b);expect(read('Wizard|||Evoker','class')).toBe(a);expect(reader([a,b],[],['XPHB'])('Wizard|PHB||Evoker|PHB','class')).toBeUndefined();
 });
 it('keeps feature UID level/class/source constraints and tag aliases',()=>{
  const wrong=row('wrong','feature','Shared feature','PHB',{className:'Wizard',classSource:'PHB',level:5}),right=row('right','feature','Shared feature','PHB',{className:'Wizard',classSource:'PHB',level:3}),rule=row('rule','rule','Shared feature'),condition=row('condition','condition','Shared feature'),read=reader([wrong,rule,right,condition]);
  expect(read('Shared feature|Wizard|PHB|3|PHB','feature')).toBe(right);expect(read('Shared feature','variantrule')).toBe(rule);expect(read('Shared feature','status')).toBe(condition);expect(read('Missing','spell')).toBeUndefined();
 });
 it('reuses immutable indexes, indexes case-insensitive aliases once and invalidates a replacement catalog',()=>{
  const entries=[old,modern],first=catalogReferenceIndex(entries);expect(catalogReferenceIndex(entries)).toBe(first);expect(first.names.get('same spell')).toEqual([old,modern]);const changed={...old,revision:'two'},next=catalogReferenceIndex([changed,modern]);expect(next).not.toBe(first);expect(next.ids.get(old.id)).toEqual([changed]);expect(first.ids.get(old.id)).toEqual([old]);
 });
});
