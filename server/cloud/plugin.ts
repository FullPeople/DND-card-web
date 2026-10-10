import type {IncomingMessage,ServerResponse} from 'node:http';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {CloudError,CloudStore,type Session} from './store';
import {normalizeLegacyUpload} from '../../src/platform/legacyPlayerBridge';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
type Grant={id:string;card_id:string;room:string;capability_hash:string;locked:number;expires:number};
/** Room capabilities grant access to one loaded card. A room ID is never identity. */
export function pluginAccess(store:CloudStore,origin:string,extraOrigins:string[]=[]){
  const allowed=new Set([origin,'https://obr.dnd.center',...extraOrigins]);
  store.db.exec(`CREATE TABLE IF NOT EXISTS plugin_connections(id TEXT PRIMARY KEY,origin TEXT NOT NULL,challenge TEXT NOT NULL,session_hash TEXT REFERENCES sessions(token_hash) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS plugin_sessions(token_hash TEXT PRIMARY KEY,session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,origin TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS room_cards(id TEXT PRIMARY KEY,card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,room TEXT NOT NULL,capability_hash TEXT NOT NULL,locked INTEGER NOT NULL DEFAULT 1,expires INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS room_cards_card_room ON room_cards(card_id,room);`);
  function session(request:IncomingMessage):Session|undefined{
    const header=request.headers.authorization;if(!header?.startsWith('Bearer '))return;
    const token=header.slice(7);if(token.length>128)return;
    const row=store.db.prepare('SELECT s.account_id,s.csrf FROM plugin_sessions p JOIN sessions s ON s.token_hash=p.session_hash WHERE p.token_hash=? AND p.origin=? AND p.expires>? AND s.expires>?').get(hash(token),request.headers.origin||origin,Date.now(),Date.now());
    if(!row)return;
    const a=store.db.prepare('SELECT id,qq,extra_slots FROM accounts WHERE id=?').get(String(row.account_id));
    return a?{account:{id:String(a.id),qq:a.qq===null?null:String(a.qq),extra_slots:Number(a.extra_slots)},csrf:String(row.csrf)}:undefined;
  }
  function cors(request:IncomingMessage,response:ServerResponse){
    const source=request.headers.origin;
    if(!source||source===origin)return;
    if(!allowed.has(source))throw new CloudError(403,'origin','请从已配置的枭熊插件访问。');
    response.setHeader('Access-Control-Allow-Origin',source);response.setHeader('Vary','Origin');
    response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-CSRF-Token, X-Room-Capability');
    response.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
  }
  function grant(id:string){
    const row=store.db.prepare('SELECT * FROM room_cards WHERE id=? AND expires>?').get(id,Date.now()) as Grant|undefined;
    if(!row)throw new CloudError(404,'room_missing','房间卡已过期或被移除，请卡主重新加载。');return row;
  }
  const owner=(g:Grant,s?:Session)=>!!s&&store.db.prepare('SELECT 1 FROM cards WHERE id=? AND owner_id=?').get(g.card_id,s.account.id)!==undefined;
  function authorized(g:Grant,request:IncomingMessage,s?:Session){
    const capability=request.headers['x-room-capability'];
    const isOwner=owner(g,s);
    if(!isOwner&&(typeof capability!=='string'||capability.length>128||hash(capability)!==g.capability_hash))throw new CloudError(403,'room_forbidden','没有这张房间卡的访问权限。');
    const row=store.db.prepare('SELECT id,qq,extra_slots FROM accounts WHERE id=(SELECT owner_id FROM cards WHERE id=?)').get(g.card_id)!;
    const isEditor=!!s&&store.db.prepare('SELECT 1 FROM account_editors WHERE card_id=? AND account_id=?').get(g.card_id,s.account.id)!==undefined;
    return {isOwner,isEditor,account:{id:String(row.id),qq:row.qq===null?null:String(row.qq),extra_slots:Number(row.extra_slots)}};
  }
  function roomResult(g:Grant,isOwner:boolean,account:Session['account'],isEditor=false,since?:string|null){
    const card=store.read(g.card_id,account);
    const info={id:g.id,cardId:g.card_id,room:g.room,name:card.character.name,revision:card.revision,locked:!!g.locked,owner:isOwner,editor:isEditor,ownerAccountId:account.id,ownerNickname:store.qqProfile(account.id)?.nickname||'卡主',editors:isOwner?card.editors:undefined,write:isOwner||isEditor||!g.locked};
    if(since===String(card.revision))return {...info,unchanged:true};
    const document=normalizeLegacyUpload(card.character);
    return {...info,character:card.character,document:{...document,_suiteRevision:card.revision}};
  }
  return {session,cors,async handle(request:IncomingMessage,response:ServerResponse,url:URL,s:Session|undefined,cookieToken:string|undefined,body:()=>Promise<Record<string,unknown>>,send:(status:number,value:unknown)=>void){
    const method=request.method;
    if(url.pathname==='/api/plugin/start'&&method==='POST'){
      const data=await body(),source=request.headers.origin||origin;
      if(!allowed.has(source)||typeof data.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.challenge))throw new CloudError(400,'plugin_request','插件连接请求无效。');
      store.db.prepare('DELETE FROM plugin_connections WHERE expires<?').run(Date.now());
      if(Number(store.db.prepare('SELECT COUNT(*) n FROM plugin_connections').get()!.n)>=1000)throw new CloudError(429,'plugin_busy','连接请求过多，请稍后重试。');
      const id=randomUUID();store.db.prepare('INSERT INTO plugin_connections VALUES(?,?,?,NULL,?)').run(id,source,data.challenge,Date.now()+600000);send(201,{connection:id});return true;
    }
    if(url.pathname==='/api/plugin/poll'&&method==='POST'){
      const data=await body();if(typeof data.connection!=='string'||data.connection.length>64||typeof data.verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(data.verifier))throw new CloudError(403,'plugin_request','插件连接请求无效。');
      const row=store.db.prepare('SELECT * FROM plugin_connections WHERE id=? AND origin=? AND expires>?').get(data.connection,request.headers.origin||origin,Date.now());
      if(!row||row.challenge!==createHash('sha256').update(data.verifier).digest('base64url'))throw new CloudError(403,'plugin_expired','连接请求已失效，请重新登录。');
      if(!row.session_hash){send(202,{pending:true});return true;}
      if(!store.db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires>?').get(String(row.session_hash),Date.now()))throw new CloudError(403,'plugin_expired','网站登录已失效，请重新连接。');
      store.db.prepare('DELETE FROM plugin_connections WHERE id=?').run(data.connection);
      const token=secret();store.db.prepare('INSERT INTO plugin_sessions VALUES(?,?,?,?)').run(hash(token),String(row.session_hash),String(row.origin),Date.now()+86400000);send(200,{token,expiresAt:Date.now()+86400000});return true;
    }
    if(url.pathname==='/api/plugin/authorize'&&method==='POST'){
      const web=store.session(cookieToken);
      if(!s||!web||web.account.id!==s.account.id||web.csrf!==s.csrf||request.headers.origin!==origin||request.headers['x-csrf-token']!==s.csrf)throw new CloudError(403,'login_required','请先在网站完成 QQ 登录。');
      const data=await body();if(typeof data.origin!=='string'||!allowed.has(data.origin)||typeof data.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.challenge))throw new CloudError(400,'plugin_request','插件连接请求无效。');
      if(typeof data.connection!=='string')throw new CloudError(400,'plugin_request','插件连接请求无效。');
      const row=store.db.prepare('SELECT 1 FROM plugin_connections WHERE id=? AND origin=? AND challenge=? AND expires>? AND session_hash IS NULL').get(data.connection,data.origin,data.challenge,Date.now());
      if(!row)throw new CloudError(403,'plugin_expired','连接请求已失效，请从插件重新开始。');
      store.db.prepare('UPDATE plugin_connections SET session_hash=? WHERE id=?').run(hash(cookieToken!),data.connection);send(200,{connected:true});return true;
    }
    if(url.pathname==='/api/plugin/logout'&&method==='POST'){
      const header=request.headers.authorization;if(!s||request.headers['x-csrf-token']!==s.csrf)throw new CloudError(403,'login_required','登录已失效。');
      store.db.prepare('DELETE FROM plugin_sessions WHERE token_hash=?').run(hash(header!.slice(7)));send(200,{ok:true});return true;
    }
    const load=/^\/api\/cards\/([A-Z]{6}|[a-f0-9-]{36})\/rooms$/.exec(url.pathname);
    if(load&&method==='POST'){
      if(!s||request.headers['x-csrf-token']!==s.csrf)throw new CloudError(403,'login_required','请先完成 QQ 登录。');
      const card=store.read(load[1],s.account);if(card.role!=='owner')throw new CloudError(403,'owner_only','只有卡主可以把原卡加载到房间。');
      const data=await body();if(data.confirmRoomSync!==true||typeof data.room!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(data.room))throw new CloudError(400,'room_request','需要确认房间改动自动写回云端原卡。');
      const existing=store.db.prepare('SELECT id FROM room_cards WHERE card_id=? AND room=?').get(card.id,data.room);
      const id=existing?String(existing.id):randomUUID(),capability=secret(),expires=Date.now()+7*86400000;
      store.db.prepare('INSERT INTO room_cards VALUES(?,?,?,?,1,?) ON CONFLICT(card_id,room) DO UPDATE SET capability_hash=excluded.capability_hash,locked=1,expires=excluded.expires').run(id,card.id,data.room,hash(capability),expires);
      send(201,{...roomResult(grant(id),true,s.account),capability,expiresAt:expires});return true;
    }
    const match=/^\/api\/room-cards\/([a-f0-9-]{36})(?:\/(lock))?$/.exec(url.pathname);
    if(!match)return false;
    const g=grant(match[1]),auth=authorized(g,request,s);
    if(method==='GET'&&!match[2]){send(200,roomResult(g,auth.isOwner,auth.account,auth.isEditor,url.searchParams.get('since')));return true;}
    if(!allowed.has(request.headers.origin||''))throw new CloudError(403,'origin','请从已配置的枭熊插件操作。');
    if(match[2]&&method==='PUT'){
      if(!auth.isOwner||request.headers['x-csrf-token']!==s!.csrf)throw new CloudError(403,'owner_only','只有卡主可以解锁或重新锁定房间卡。');
      const data=await body();if(typeof data.locked!=='boolean')throw new CloudError(400,'lock_required','请选择锁定或解锁。');
      store.db.prepare('UPDATE room_cards SET locked=? WHERE id=?').run(data.locked?1:0,g.id);
      send(200,roomResult(grant(g.id),true,auth.account));return true;
    }
    if(method==='PUT'&&!match[2]){
      if((auth.isOwner||auth.isEditor)&&request.headers['x-csrf-token']!==s!.csrf)throw new CloudError(403,'csrf','登录状态已改变，请重新连接。');
      const data=await body();
      // Read permissions again after receiving the body: locking revokes an in-flight write.
      const fresh=grant(g.id),permission=authorized(fresh,request,s);if(!permission.isOwner&&!permission.isEditor&&fresh.locked)throw new CloudError(403,'room_locked','卡主未授予当前账号编辑权限，本机草稿保留。');
      const native=(data.document as {dnd_card_web?:unknown}|undefined)?.dnd_card_web??data.character;
      const before=store.read(g.card_id,auth.account);if(!native||typeof native!=='object'||(native as {id?:string}).id!==before.character.id)throw new CloudError(422,'identity_changed','房间改动不能更换云端原卡的身份。');
      store.update(g.card_id,auth.account,data.revision,native);
      send(200,roomResult(grant(g.id),auth.isOwner,auth.account,auth.isEditor));return true;
    }
    if(method==='DELETE'&&!match[2]){
      if(!auth.isOwner||request.headers['x-csrf-token']!==s!.csrf)throw new CloudError(403,'owner_only','只有卡主可以移除房间授权。');
      store.db.prepare('DELETE FROM room_cards WHERE id=?').run(g.id);send(200,{ok:true});return true;
    }
    throw new CloudError(405,'method','此接口不支持该操作。');
  }};
}
