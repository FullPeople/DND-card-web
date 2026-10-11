import {afterEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {CloudStore} from '../server/cloud/store';
import {newCharacter} from '../src/core/model';

const stores:CloudStore[]=[],folders:string[]=[];
afterEach(()=>{
 for(const store of stores.splice(0))store.close();
 for(const folder of folders.splice(0)){
  if(!resolve(folder).startsWith(resolve(tmpdir(),'dnd-directory-')))throw Error('Unexpected test cleanup target');
  rmSync(folder,{recursive:true,force:true});
 }
});
const opened=(filename=':memory:')=>{const store=new CloudStore(filename);stores.push(store);return store;};
const owner=(store:CloudStore)=>store.provisionVerifiedAccount('fixture-owner','1234567');

describe('cloud directory without complete-document scans',()=>{
 it('upgrades a legacy database without changing character bytes, revisions or the legacy table shape',()=>{
  const folder=mkdtempSync(join(tmpdir(),'dnd-directory-'));folders.push(folder);const filename=join(folder,'cards.sqlite');
  const db=new DatabaseSync(filename),id=randomUUID(),accountId=randomUUID(),card=newCharacter('2014');card.name='迁移前的角色';card.notes='original\n'.repeat(10000);card.externalSnapshot={unknown:{preserve:'原文'}};
  const body=JSON.stringify(card),updatedAt='2026-10-11T00:00:00.000Z';
  db.exec('CREATE TABLE accounts(id TEXT PRIMARY KEY,subject TEXT UNIQUE NOT NULL,qq TEXT UNIQUE,extra_slots INTEGER NOT NULL DEFAULT 0); CREATE TABLE cards(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,revision INTEGER NOT NULL,body TEXT NOT NULL,updated_at TEXT NOT NULL);');
  db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(accountId,'fixture-owner','1234567',0);db.prepare('INSERT INTO cards VALUES(?,?,?,?,?)').run(id,accountId,7,body,updatedAt);db.close();
  let store=opened(filename),account=owner(store);
  expect(store.db.prepare('SELECT body,revision,updated_at FROM cards WHERE id=?').get(id)).toEqual({body,revision:7,updated_at:updatedAt});
  expect(store.db.prepare('PRAGMA table_info(cards)').all().map(row=>row.name)).toEqual(['id','owner_id','revision','body','updated_at']);
  expect(store.list(account)).toEqual([{id,name:card.name,edition:'2014',revision:7,updatedAt,role:'owner'}]);
  stores.splice(stores.indexOf(store),1);store.close();store=opened(filename);account=owner(store);
  expect(store.db.prepare('SELECT count(*) n FROM card_directory').get()).toEqual({n:1});expect(store.db.prepare('SELECT body FROM cards WHERE id=?').get(id)).toEqual({body});
  expect(store.db.prepare('PRAGMA integrity_check').get()).toEqual({integrity_check:'ok'});expect(store.read(id,account).character.externalSnapshot).toEqual(card.externalSnapshot);
 });
 it('maintains summaries when a previous server uses the original five-value insert and body update',()=>{
  const store=opened(),account=owner(store),id=randomUUID(),card=newCharacter('2014');card.name='旧程序写入';
  store.db.prepare('INSERT INTO cards VALUES(?,?,?,?,?)').run(id,account.id,1,JSON.stringify(card),'old-write');
  expect(store.summary(id,account)).toMatchObject({name:card.name,edition:'2014'});
  store.db.prepare('UPDATE cards SET body=?,revision=? WHERE id=?').run(JSON.stringify({...card,name:'旧程序更新',edition:'2024'}),2,id);
  expect(store.list(account)).toMatchObject([{name:'旧程序更新',edition:'2024',revision:2}]);
 });
 it('reflects an authorized editor rename while preserving account visibility',()=>{
  const store=opened(),account=owner(store),editor=store.provisionVerifiedAccount('fixture-editor','2345678'),other=store.provisionVerifiedAccount('fixture-other');
  const card=store.create(account,newCharacter());store.grant(card.id,account,editor.qq!);store.update(card.id,editor,1,{...card.character,name:'获准编辑的名称'});
  expect(store.list(account)[0]).toMatchObject({name:'获准编辑的名称',revision:2,role:'owner'});expect(store.list(editor)[0].role).toBe('editor');expect(store.list(other)).toEqual([]);
  store.grant(card.id,account,editor.qq!,true);expect(store.list(editor)).toEqual([]);
 });
 it('cannot change summary or content when access or compare-and-swap checks reject a write',()=>{
  const store=opened(),account=owner(store),other=store.provisionVerifiedAccount('fixture-other'),card=store.create(account,newCharacter());
  expect(()=>store.update(card.id,other,1,{...card.character,name:'denied'})).toThrow();expect(()=>store.update(card.id,account,0,{...card.character,name:'stale'})).toThrow();
  expect(store.summary(card.id,account)).toMatchObject({name:card.character.name,revision:1});
 });
 it('removes the summary in the same successful delete and retains it after a rejected delete',()=>{
  const store=opened(),account=owner(store),card=store.create(account,newCharacter());
  expect(()=>store.delete(card.id,account,2)).toThrow();expect(store.db.prepare('SELECT count(*) n FROM card_directory').get()).toEqual({n:1});
  store.delete(card.id,account,1);expect(store.db.prepare('SELECT count(*) n FROM card_directory').get()).toEqual({n:0});
 });
 it('lists names and revisions even when document JSON extraction is unavailable',()=>{
  const store=opened(),account=owner(store),card=store.create(account,{...newCharacter(),notes:'large'.repeat(200000)});
  store.db.function('json_extract',{varargs:true},()=>{throw Error('Complete document scan is forbidden during directory reads');});
  expect(store.summary(card.id,account)).toMatchObject({name:card.character.name,revision:1});expect(store.list(account)).toHaveLength(1);
 });
});
