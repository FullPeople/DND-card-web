import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Entry} from '../src/core/model';
import {extraFacts,translationInfo} from '../src/ui/wikiMetadata';
import {entryFluff,readingImage,readingJson,volumeChapters} from '../src/data/wikiReading';
const storage=vi.hoisted(()=>({read:vi.fn(),write:vi.fn()}));
vi.mock('../src/platform/storage',()=>({readCache:storage.read,writeCache:storage.write}));
afterEach(()=>{vi.unstubAllGlobals();storage.read.mockReset();storage.write.mockReset();});
const entry=(kind:Entry['kind'],raw:Record<string,any>):Entry=>({id:'authored',kind,name:'纸页法师',english:'Paper Mage',source:'PHB',revision:'1',packId:'kiwee',edition:'2014',entries:[],raw});
describe('reading metadata retains source choices',()=>{
 it('does not imply a named translator or unlabelled source is machine or proofread',()=>{expect(translationInfo({translator:'Kai'}).machine).toBe(false);expect(translationInfo({}).status).toBe('未标注译者');expect(translationInfo({translator:'机翻'}).machine).toBe(true);});
 it('retains candidates and distinct weighted improvements without granting them',()=>{const original={ability:[{choose:{weighted:{from:['int','wis','cha'],weights:[2,1]}}}],repeatable:false};const before=structuredClone(original);const rows=extraFacts(entry('feat',original));expect(rows.find(([label])=>label==='属性提升')?.[1]).toContain('智力、感知、魅力');expect(rows.find(([label])=>label==='属性提升')?.[1]).toContain('分别增加 2、1');expect(rows.find(([label])=>label==='重复选择')?.[1]).toBe('不可重复选择');expect(original).toEqual(before);});
 it('retains multiclass alternatives and optional proficiency counts',()=>{const rows=extraFacts(entry('class',{hd:{faces:6},multiclassing:{requirements:{or:[{int:13},{wis:13}]},proficienciesGained:{skills:[{choose:{from:['arcana','history'],count:1}}]}}}));expect(rows.find(([label])=>label==='兼职属性要求')?.[1]).toBe('（智力至少 13 或 感知至少 13）');expect(rows.find(([label])=>label==='兼职获得熟练')?.[1]).toContain('选择 1 项');});
 it('reads deities with no prose using their own structured fields',()=>{const rows=extraFacts(entry('rule',{_category:'deity',pantheon:'纸页神系',domains:['旅行'],province:'档案',symbol:'折纸',alignment:['N','G']}));expect(rows).toContainEqual(['神系','纸页神系']);expect(rows).toContainEqual(['象征','折纸']);expect(rows).toContainEqual(['阵营','中立、善良']);});
});
describe('optional reading data does not replace or write a character',()=>{
 it.each([null,[],42,'corrupt'])('recovers an invalid cached reading body (%j) through the source',async body=>{
  storage.read.mockResolvedValue({body});storage.write.mockResolvedValue(undefined);
  const fetch=vi.fn(async()=>new Response(JSON.stringify({book:[{id:'RECOVERED',name:'Recovered source'}]}),{headers:{etag:'fresh'}}));vi.stubGlobal('fetch',fetch);
  expect(await readingJson('data/books.json',new AbortController().signal)).toEqual({book:[{id:'RECOVERED',name:'Recovered source'}]});
  expect(fetch).toHaveBeenCalledOnce();expect(storage.write).toHaveBeenCalledWith('https://5e.kiwee.top/data/books.json',{body:{book:[{id:'RECOVERED',name:'Recovered source'}]},revision:'fresh'});
 });
 it('rejects traversal before requesting source files',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(readingJson('data/book/../secret.json',new AbortController().signal)).rejects.toThrow('资料地址');expect(fetch).not.toHaveBeenCalled();});
 it('does not return a late cache hit after cancellation',async()=>{const controller=new AbortController();storage.read.mockImplementation(async()=>{controller.abort();return {body:{book:[]}};});await expect(readingJson('data/books.json',controller.signal)).rejects.toBeDefined();expect(storage.write).not.toHaveBeenCalled();});
 it('reads the selected bookData identity and rejects a missing one',async()=>{storage.read.mockResolvedValue({body:{bookData:[{id:'PAPER',data:[{name:'原创章'}]}]}});expect(await volumeChapters('book','paper',new AbortController().signal)).toEqual([{name:'原创章'}]);await expect(volumeChapters('book','OTHER',new AbortController().signal)).rejects.toThrow('没有可读取的章节');});
 it('supports adventureData independently from books',async()=>{storage.read.mockResolvedValue({body:{adventureData:[{id:'TRIP',data:[{name:'启程'}]}]}});expect(await volumeChapters('adventure','TRIP',new AbortController().signal)).toEqual([{name:'启程'}]);});
 it('resolves inherited descriptions without mutating source copies',async()=>{const body={raceFluff:[{name:'基础纸页',source:'PHB',entries:['原创简介']},{name:'纸页法师',ENG_name:'Paper Mage',source:'PHB',_copy:{name:'基础纸页',source:'PHB'}}]};storage.read.mockResolvedValue({body});expect((await entryFluff(entry('race',{}),new AbortController().signal))?.entries).toEqual(['原创简介']);expect(body.raceFluff[1]._copy).toBeDefined();});
 it('keeps image URLs out of executable and insecure protocols',()=>{expect(readingImage({href:{type:'external',url:'javascript:alert(1)'}})).toBeUndefined();expect(readingImage({href:{type:'external',url:'http://example.com/image.png'}})).toBeUndefined();expect(readingImage({href:{type:'internal',path:'races/Paper.webp'}})).toBe('https://5e.kiwee.top/img/races/Paper.webp');});
});
