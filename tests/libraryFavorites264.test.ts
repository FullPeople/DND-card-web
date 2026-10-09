import {describe,it,expect} from 'vitest';
import type {Entry} from '../src/core/model';
import {favoriteIdentity,readFavoriteIdentities} from '../src/ui/libraryFavorites';
const entry:Entry={id:'original:fixture',kind:'feat',name:'原创同名条目',english:'Original fixture',source:'FIXTURE',packId:'fixture',edition:'2024',revision:'1',entries:['原创正文'],raw:{}};
describe('personal Wiki bookmark identities',()=>{
 it('distinguishes editions, sources, packs and kinds, and follows refreshed revisions',()=>{
  const key=favoriteIdentity(entry);
  for(const variant of [{edition:'2014'},{source:'OTHER'},{packId:'other'},{kind:'rule'},{id:'other'}])expect(favoriteIdentity({...entry,...variant} as Entry)).not.toBe(key);
  expect(favoriteIdentity({...entry,revision:'2',name:'更新名称',entries:['更新正文']})).toBe(key);
 });
 it('stores no publisher body, character data, names or private snapshots',()=>{
  const value=JSON.stringify([favoriteIdentity(entry)]);expect(value).not.toContain('原创');expect(value).not.toContain('entries');expect(readFavoriteIdentities(value)).toEqual([favoriteIdentity(entry)]);
 });
 it('recovers malformed preferences and deduplicates valid bookmarks',()=>{
  const key=favoriteIdentity(entry);expect(readFavoriteIdentities(JSON.stringify([key,key,5,'bad','[]',JSON.stringify(['',1]),JSON.stringify(['', 's','p','2024','feat'])]))).toEqual([key]);
  expect(readFavoriteIdentities('{broken')).toEqual([]);expect(readFavoriteIdentities('{"entries":[]}')).toEqual([]);expect(readFavoriteIdentities(null)).toEqual([]);
 });
});
