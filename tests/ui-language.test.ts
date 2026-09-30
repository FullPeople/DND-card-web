import {describe,it,expect} from 'vitest';
import type {Entry} from '../src/core/model';
import {readUiLanguage,writeUiLanguage,uiEntryName,uiEntryLabel,UI_LANGUAGE_KEY} from '../src/ui/uiText';

describe('UI language is a local display preference',()=>{
 it('defaults to Chinese for old or unknown preferences and changes only its own key',()=>{
  const values=new Map([['dnd-card:announcement-ack','0.1.14'],['character','{"id":"unchanged","edition":"2014"}']]);const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  expect(readUiLanguage(storage)).toBe('zh');values.set(UI_LANGUAGE_KEY,'unknown');expect(readUiLanguage(storage)).toBe('zh');expect(values.get(UI_LANGUAGE_KEY)).toBe('unknown');
  writeUiLanguage('en',storage);expect(readUiLanguage(storage)).toBe('en');writeUiLanguage('zh',storage);expect(readUiLanguage(storage)).toBe('zh');expect(values.get('dnd-card:announcement-ack')).toBe('0.1.14');expect(values.get('character')).toBe('{"id":"unchanged","edition":"2014"}');
 });
 it('does not fail when browser storage is denied',()=>{const storage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};expect(readUiLanguage(storage)).toBe('zh');expect(()=>writeUiLanguage('en',storage)).not.toThrow();});
 it('uses the existing English title with fallback and preserves imported identity and raw content',()=>{
  const entry:Entry={id:'imported:2014:tuple',kind:'feature',name:'原始标题',english:'Existing title',source:'IMPORTED',edition:'2014',packId:'imported',revision:'keep',raw:{name:'原始标题',unknown:{keep:true}},entries:['不翻写正文 {@feat 原始引用|PHB}。']};const before=structuredClone(entry);
  expect(uiEntryName(entry,'zh')).toBe('原始标题');expect(uiEntryName(entry,'en')).toBe('Existing title');expect(uiEntryLabel(entry,'en')).toBe('▞ Existing title');expect(entry).toEqual(before);
  expect(uiEntryName({...entry,english:''},'en')).toBe('原始标题');expect(uiEntryName({...entry,english:'   '},'en')).toBe('原始标题');
 });
});
