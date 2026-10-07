import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {validateCharacter} from '../../src/core/validation';
import type {Character} from '../../src/core/model';

export class CloudError extends Error {
  constructor(public status:number,public code:string,message:string){super(message);}
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const validQQ=(value:unknown):value is string=>typeof value==='string'&&/^[1-9]\d{4,11}$/.test(value);
export interface Account {id:string;qq:string|null;extra_slots:number}
export interface Session {account:Account;csrf:string}
export interface CloudCard {id:string;revision:number;character:Character;updatedAt:string;role?:'owner'|'editor';editors?:string[]}

export class CloudStore {
  readonly db:DatabaseSync;
  constructor(path:string){
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,subject TEXT UNIQUE NOT NULL,qq TEXT UNIQUE,extra_slots INTEGER NOT NULL DEFAULT 0 CHECK(extra_slots>=0));
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS cards(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES accounts(id),revision INTEGER NOT NULL,body TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS cards_owner ON cards(owner_id);
      CREATE TABLE IF NOT EXISTS editors(card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,qq TEXT NOT NULL,PRIMARY KEY(card_id,qq));
      CREATE INDEX IF NOT EXISTS editors_qq ON editors(qq);`);
  }
  // Server-only boundary for a future identity provider. Never exposed by HTTP.
  // QQ must come from verified provider evidence, never from a profile form.
  provisionVerifiedAccount(subject:string,verifiedQQ:string|null=null):Account {
    if(!subject||verifiedQQ!==null&&!validQQ(verifiedQQ))throw Error('Invalid verified identity');
    const existing=this.db.prepare('SELECT * FROM accounts WHERE subject=?').get(subject) as unknown as Account|undefined;
    if(existing){if(existing.qq!==verifiedQQ)throw Error('Verified identity changed');return existing;}
    const id=randomUUID();this.db.prepare('INSERT INTO accounts(id,subject,qq) VALUES(?,?,?)').run(id,subject,verifiedQQ);
    return {id,qq:verifiedQQ,extra_slots:0};
  }
  issueVerifiedSession(accountId:string,ttl=86400_000){
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),accountId,csrf,Date.now()+ttl);
    return {token,csrf};
  }
  session(token:string|undefined):Session|undefined {
    if(!token||token.length>128)return;
    const row=this.db.prepare('SELECT a.id,a.qq,a.extra_slots,s.csrf FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>?').get(hash(token),Date.now()) as unknown as (Account&{csrf:string})|undefined;
    if(row)return {account:{id:row.id,qq:row.qq,extra_slots:row.extra_slots},csrf:row.csrf};
  }
  logout(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  slots(account:Account){
    const fresh=this.db.prepare('SELECT extra_slots FROM accounts WHERE id=?').get(account.id) as {extra_slots:number};
    const count=this.db.prepare('SELECT COUNT(*) AS n FROM cards WHERE owner_id=?').get(account.id) as {n:number};
    return {free:10,permanent:fresh.extra_slots,total:10+fresh.extra_slots,used:count.n,priceYuan:2,paymentAvailable:false};
  }
  private transaction<T>(action:()=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try {const result=action();this.db.exec('COMMIT');return result;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  private row(id:string){
    const row=this.db.prepare('SELECT * FROM cards WHERE id=?').get(id) as {id:string;owner_id:string;revision:number;body:string;updated_at:string}|undefined;
    if(!row)throw new CloudError(404,'not_found','没有找到这张云端角色卡。');return row;
  }
  private role(row:{id:string;owner_id:string},account?:Account):'owner'|'editor'|undefined {
    if(row.owner_id===account?.id)return 'owner';
    if(account?.qq&&this.db.prepare('SELECT 1 FROM editors WHERE card_id=? AND qq=?').get(row.id,account.qq))return 'editor';
  }
  private checkBody(character:unknown):asserts character is Character {
    if(!character||typeof character!=='object'||(character as Character).schemaVersion!==1)throw new CloudError(422,'invalid_character','需要完整的原生角色文档。');
    try {validateCharacter(structuredClone(character));}
    catch(error){throw new CloudError(422,'invalid_character',error instanceof Error?error.message:String(error));}
    if(Buffer.byteLength(JSON.stringify(character))>20_000_000)throw new CloudError(413,'too_large','单张云端卡不能超过 20 MB，请保留完整本机备份。');
  }
  read(id:string,account?:Account):CloudCard {
    const row=this.row(id),role=this.role(row,account);
    return {id:row.id,revision:row.revision,character:JSON.parse(row.body),updatedAt:row.updated_at,...(role?{role}:{}),...(role==='owner'?{editors:this.db.prepare('SELECT qq FROM editors WHERE card_id=? ORDER BY qq').all(id).map(row=>String(row.qq))}:{})};
  }
  list(account:Account){
    const rows=this.db.prepare('SELECT DISTINCT c.id FROM cards c LEFT JOIN editors e ON e.card_id=c.id WHERE c.owner_id=? OR (e.qq=? AND ? IS NOT NULL) ORDER BY c.updated_at DESC').all(account.id,account.qq,account.qq);
    return rows.map(row=>{const card=this.read(String(row.id),account);return {id:card.id,revision:card.revision,name:card.character.name,edition:card.character.edition,updatedAt:card.updatedAt,role:card.role};});
  }
  create(account:Account,character:unknown):CloudCard {
    this.checkBody(character);
    return this.transaction(()=>{
      const quota=this.slots(account);if(quota.used>=quota.total)throw new CloudError(409,'quota_full','免费槽位最多保存 10 张自有角色卡；当前槽位已满。请先导出备份，再移除不需要的云端卡。');
      const id=randomUUID();this.db.prepare('INSERT INTO cards VALUES(?,?,?,?,?)').run(id,account.id,1,JSON.stringify(character),new Date().toISOString());return this.read(id,account);
    });
  }
  update(id:string,account:Account,expected:unknown,character:unknown):CloudCard {
    this.checkBody(character);
    if(!Number.isSafeInteger(expected)||Number(expected)<1)throw new CloudError(400,'revision_required','更新需要云端修订号。');
    return this.transaction(()=>{
      const row=this.row(id);if(!this.role(row,account))throw new CloudError(403,'forbidden','编辑权限已撤销或尚未授予。本机草稿保留。');
      if(row.revision!==expected)throw new CloudError(409,'conflict','云端卡已被其他人修改。本机草稿保留，请先导出备份并核对新版本。');
      this.db.prepare('UPDATE cards SET body=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(character),new Date().toISOString(),id,Number(expected));return this.read(id,account);
    });
  }
  grant(id:string,account:Account,qq:unknown,remove=false){
    if(!validQQ(qq))throw new CloudError(400,'invalid_qq','请输入 5 至 12 位、首位非零的 QQ 号。');
    return this.transaction(()=>{
      const row=this.row(id);if(row.owner_id!==account.id)throw new CloudError(403,'owner_only','只有卡主可以管理编辑授权。');
      if(remove)this.db.prepare('DELETE FROM editors WHERE card_id=? AND qq=?').run(id,qq);
      else {const count=this.db.prepare('SELECT COUNT(*) n FROM editors WHERE card_id=?').get(id) as {n:number};if(count.n>=100&&!this.db.prepare('SELECT 1 FROM editors WHERE card_id=? AND qq=?').get(id,qq))throw new CloudError(400,'too_many_editors','每张卡最多指定 100 个编辑者。');this.db.prepare('INSERT OR IGNORE INTO editors VALUES(?,?)').run(id,qq);}
      return this.read(id,account);
    });
  }
  delete(id:string,account:Account,expected:unknown){
    return this.transaction(()=>{
      const row=this.row(id);if(row.owner_id!==account.id)throw new CloudError(403,'owner_only','只有卡主可以删除云端卡。');
      if(row.revision!==expected)throw new CloudError(409,'conflict','云端卡版本已改变，未删除。请重新核对。');
      this.db.prepare('DELETE FROM cards WHERE id=?').run(id);
    });
  }
  close(){this.db.close();}
}
