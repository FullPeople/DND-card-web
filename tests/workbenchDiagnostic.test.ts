import {describe,expect,it,vi} from 'vitest';
import {diagnosticText} from '../src/ui/CopyDiagnostic';

describe('shareable workbench diagnostics',()=>{
 it('keeps correlation and failure metadata while omitting private payloads, links and stack traces',()=>{
  const error=Object.assign(Error('HTTP 404 https://private.invalid/card?token=TOP_SECRET'),{
   requestId:'request-123',uncertain:false,
   stack:'Error at https://private.invalid/?cookie=COOKIE_SECRET',
   diagnostic:{code:'DOCUMENT_UNAVAILABLE',status:404,phase:'read',operation:'readCards',version:'1.0.243-dev',requestId:'request-123',retryable:true,
    token:'TOP_SECRET',cookie:'COOKIE_SECRET',url:'https://private.invalid/?token=URL_SECRET',key:'room:PRIVATE_CARD',
    document:{name:'PRIVATE_CHARACTER',background:'PRIVATE_HISTORY'},
    connection:{online:true,transport:'relay',hostStarted:42,cache:{confirmed:true,epoch:7,room:'PRIVATE_ROOM',scope:'PRIVATE_SCOPE'},relayState:{status:503,retryAt:60000,message:'Bearer RELAY_SECRET'},pending:[{id:'pending-1',type:'readCards',elapsedMs:15,document:{name:'PRIVATE_PENDING'}}],recent:[{requestId:'recent-1',type:'deleteCard',ok:false,totalMs:120,timing:{readMs:10,private:'PRIVATE_TIMING'}}]}}
  });
  const text=diagnosticText(error),diagnostic=JSON.parse(text);
  expect(diagnostic).toMatchObject({product:'Full Suite',requestId:'request-123',uncertain:false,diagnostic:{code:'DOCUMENT_UNAVAILABLE',status:404,phase:'read',operation:'readCards',version:'1.0.243-dev',retryable:true}});
  expect(text).not.toMatch(/SECRET|PRIVATE_|private\.invalid|stack|cookie|token|document|background/);
  expect(diagnostic.diagnostic.connection).toMatchObject({online:true,transport:'relay',cache:{confirmed:true,epoch:7},relayState:{status:503,retryAt:60000}});
 });
 it('never serializes arbitrary thrown values, error messages or custom toJSON methods',()=>{
  const toJSON=vi.fn(()=>({token:'SERIALIZED_SECRET'}));
  const text=diagnosticText({message:'MESSAGE_SECRET',diagnostic:{toJSON,code:'READ_FAILED',cause:{token:'NESTED_SECRET'}}});
  expect(text).toContain('READ_FAILED');expect(text).not.toContain('SECRET');expect(toJSON).not.toHaveBeenCalled();
  expect(diagnosticText('https://private.invalid/?token=STRING_SECRET')).not.toContain('STRING_SECRET');
 });
 it('handles cycles, malformed fields and bounded timing histories without throwing or exposing raw fields',()=>{
  const cyclic:any={status:404,operation:'readCards',requestId:'https://private.invalid/?token=ID_SECRET'};cyclic.cause=cyclic;
  cyclic.connection={transport:'relay',pending:Array.from({length:60},(_,i)=>({id:'request-'+i,type:'readCards',elapsedMs:1,token:'ROW_SECRET'})),recent:[{requestId:'last',type:'readCards',ok:false,totalMs:Infinity}]};
  let text='';expect(()=>text=diagnosticText({diagnostic:cyclic})).not.toThrow();
  const diagnostic=JSON.parse(text);expect(diagnostic.diagnostic.status).toBe(404);expect(diagnostic.diagnostic.connection.pending.length).toBeLessThanOrEqual(24);expect(text).not.toMatch(/SECRET|private\.invalid/);
 });
});

describe('diagnostic context and clipboard re-sanitization',()=>{
 it('keeps the incident time, version and operation through a second clipboard sanitization',()=>{
  const at='2026-10-03T12:00:00.000Z',first=diagnosticText({requestId:'request-1',diagnostic:{status:404}}, {operation:'readCards',at,version:'1.0.243-dev',connection:{online:false,transport:'relay',relayState:{status:0,retryAt:1,message:'DO_NOT_COPY'}}});
  const second=diagnosticText(JSON.parse(first));expect(JSON.parse(second)).toMatchObject({at,version:'1.0.243-dev',operation:'readCards',requestId:'request-1',connection:{online:false,transport:'relay',relayState:{status:0,retryAt:1}},diagnostic:{status:404}});expect(second).not.toContain('DO_NOT_COPY');
 });
 it('normalizes legacy HTTP status and drops invalid scalar values',()=>{
  const safe=JSON.parse(diagnosticText({diagnostic:{httpStatus:404,retryable:'true',uncertain:0,phase:'https://private.invalid/?token=SECRET',version:'1.0.0?token=SECRET',status:999}}));expect(safe.diagnostic).toEqual({status:404});
 });
 it('never evaluates nested getters while preparing a diagnostic',()=>{
  const getter=vi.fn(()=>{throw Error('GETTER_SECRET');}),source={};Object.defineProperty(source,'status',{get:getter});Object.defineProperty(source,'connection',{get:getter});expect(()=>diagnosticText({diagnostic:source})).not.toThrow();expect(getter).not.toHaveBeenCalled();
 });
 it('sanitizes legacy raw connection JSON at the copy boundary',()=>{
  const safe=JSON.parse(diagnosticText({cache:{confirmed:false,epoch:7,room:'ROOM_SECRET',scope:'SCOPE_SECRET',snapshots:[{name:'CHARACTER_SECRET'}]},transport:'relay',relayState:{status:503,retryAt:12,message:'RELAY_SECRET'},pending:[{id:'id-1',type:'readCards',elapsedMs:30,token:'TOKEN_SECRET'}]}));
  expect(safe.connection).toEqual({cache:{confirmed:false,epoch:7},transport:'relay',relayState:{status:503,retryAt:12},pending:[{id:'id-1',type:'readCards',elapsedMs:30}]});expect(JSON.stringify(safe)).not.toContain('SECRET');
 });
});
