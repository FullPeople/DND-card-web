import {expect,it} from 'vitest';
import {entryReferenceResolver,resolveEntryReference} from '../src/core/entryReferences';
import type {Entry} from '../src/core/model';
import {newCharacter} from '../src/core/model';
import {sourceClassChoices} from '../src/core/automation/sourceClassChoices';
const entry=(id:string,name:string,raw:Entry['raw']={},kind:Entry['kind']='feature'):Entry=>({id,kind,name,english:raw.ENG_name||name,source:raw.source||'AUTH',edition:'2024',packId:'authored',revision:'1',entries:['Original authored reference example.'],raw});
it('indexed planning keeps complete UIDs, authored-name preference, schema boundaries and ambiguity',()=>{
 const a=entry('a','Authored first',{ENG_name:'Shared',className:'Owner',classSource:'XPHB',subclassShortName:'A',subclassSource:'AUTH',level:3,_category:'subclassFeature'}),b=entry('b','Authored second',{...a.raw}),other=entry('other','Authored first',{...a.raw,subclassShortName:'B'});
 const choice=entry('choice','Authored choice',{_category:'charoption'}),option=entry('option','Authored choice',{_category:'optionalfeature'}),rows=[a,b,other,choice,option],resolve=entryReferenceResolver(rows);
 expect(resolve('Authored first|Owner|XPHB|A|AUTH|3','feature')).toBe(a);
 expect(resolve('Shared|Owner|XPHB|A|AUTH|3','feature')).toBeUndefined();
 expect(resolve('Authored first|Owner|XPHB|B|AUTH|3','feature')).toBe(other);
 expect(resolve('Authored first|Owner|XPHB|A|AUTH|4','feature')).toBeUndefined();
 expect(resolve('Authored choice|AUTH','feature')).toBeUndefined();
 expect(resolve('Authored choice|AUTH','feature','charoption')).toBe(choice);
 for(const ref of ['Shared|AUTH','Authored first|Owner|XPHB|A|AUTH|3','Authored choice|OTHER','  AUTHORED FIRST |Owner|XPHB|A|AUTH|3'])expect(resolve(ref,'feature')).toBe(resolveEntryReference(ref,rows,'feature'));
});
it('repeated planning references do not repeatedly inspect unrelated catalog names',()=>{
 let reads=0;const unrelated=Array.from({length:1000},(_,i)=>{const row=entry('unrelated-'+i,'Unrelated '+i);Object.defineProperty(row,'name',{get(){reads++;return 'Unrelated '+i;}});return row;});
 const selected=entry('selected','Selected authored option',{_category:'optionalfeature'}),resolve=entryReferenceResolver([...unrelated,selected]);
 for(let i=0;i<30;i++){expect(resolve('Selected authored option|AUTH','feature')).toBe(selected);expect(resolve('Missing authored option|AUTH','feature')).toBeUndefined();}
 expect(reads).toBeLessThan(2000);
});
it('a fresh planning snapshot sees edits while an old name cannot select a renamed record',()=>{
 const selected=entry('selected','Before edit'),rows=[selected],before=entryReferenceResolver(rows);expect(before('Before edit|AUTH')).toBe(selected);
 selected.name=selected.english='After edit';expect(before('Before edit|AUTH')).toBeUndefined();expect(entryReferenceResolver(rows)('After edit|AUTH')).toBe(selected);
});
it('a card without class grants does not inspect unrelated catalog names for a planning index',()=>{
 let reads=0;const row=entry('unrelated','Unrelated');Object.defineProperty(row,'name',{get(){reads++;return 'Unrelated';}});
 expect(sourceClassChoices(newCharacter(),[row])).toEqual([]);expect(reads).toBe(0);
});
