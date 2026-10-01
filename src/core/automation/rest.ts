import type {Character} from '../model';
import {evaluate} from '../engine';
import {isHitDieResource,setResource} from '../resources';
import {restResources} from './featureResources';
import {automationEnabled} from './state';
export type HitDieRoll={id:string;faces:number;value:number};
export type RestReceipt={id:string;fingerprint:string;kind:'short'|'long';hpBefore:number;hpAfter:number;rolls:HitDieRoll[];recovered:Record<string,number>};
export type RestState={version:1;sequence:number;last?:RestReceipt};
export type RestRequest={id:string;revision:number;sequence:number;kind:'short'|'long';rolls:HitDieRoll[];recover:Record<string,number>};
export function longRestHitDiceBudget(c:Character){const total=Object.entries(c.runtime.resources).filter(([id])=>isHitDieResource(id)).reduce((n,[,r])=>n+r.max,0);return c.edition==='2024'?total:Math.max(1,Math.floor(total/2));}
/** Rolls are transaction inputs. Recalculation never rolls, heals or rests. */
export function performRest(c:Character,request:RestRequest):RestReceipt{
 const state=c.runtime.rests,fingerprint=JSON.stringify([request.revision,request.sequence,request.kind,request.rolls,request.recover]);
 if(state?.last?.id===request.id){if(state.last.fingerprint!==fingerprint)throw Error('休息操作编号已被用于其他请求。');return state.last;}
 if(!automationEnabled(c)||!request.id||request.id.length>128||!['short','long'].includes(request.kind)||!Number.isSafeInteger(request.sequence)||request.sequence!==(state?.sequence||0)||request.revision!==c.revision)throw Error('角色已发生变化，请按当前资源重新确认休息。');
 if(state&&state.version!==1||request.sequence>=Number.MAX_SAFE_INTEGER)throw Error('休息记录版本或序号不支持。');
 const counts:Record<string,number>={};
 for(const die of request.rolls){const r=c.runtime.resources[die.id];if(request.kind!=='short'||!isHitDieResource(die.id)||!r||die.faces!==Number(die.id.split(':')[1])||!Number.isSafeInteger(die.value)||die.value<1||die.value>die.faces)throw Error('生命骰结果无效。');counts[die.id]=(counts[die.id]||0)+1;if(counts[die.id]>r.current)throw Error('剩余生命骰不足。');}
 let recovered=0;
 for(const [id,n] of Object.entries(request.recover)){const r=c.runtime.resources[id];if(request.kind!=='long'||!isHitDieResource(id)||!r||!Number.isSafeInteger(n)||n<0||n>r.max-r.current)throw Error('生命骰恢复数量无效。');recovered+=n;}
 if(recovered>longRestHitDiceBudget(c))throw Error('超过此版本的长休生命骰恢复数量。');
 const d=evaluate(c),hpBefore=c.runtime.hp;
 for(const [id,n] of Object.entries(counts))setResource(c,id,c.runtime.resources[id].current-n);
 for(const [id,n] of Object.entries(request.recover))setResource(c,id,c.runtime.resources[id].current+n);
 if(request.kind==='short')c.runtime.hp=Math.min(d.maxHp,c.runtime.hp+request.rolls.reduce((n,r)=>n+Math.max(0,r.value+d.modifiers.con),0));
 else {c.runtime.hp=d.maxHp;c.runtime.tempHp=0;c.runtime.deathSaves={success:0,failure:0};}
 restResources(c,request.kind);
 const receipt:RestReceipt={id:request.id,fingerprint,kind:request.kind,hpBefore,hpAfter:c.runtime.hp,rolls:request.rolls,recovered:request.recover};c.runtime.rests={version:1,sequence:request.sequence+1,last:receipt};return receipt;
}
export function validateRestState(value:unknown){
 if(value===undefined)return;const v=value as RestState;
 if(!v||typeof v!=='object'||Array.isArray(v)||v.version!==1||!Number.isSafeInteger(v.sequence)||v.sequence<0)throw Error('休息记录无效。');
 const r=v.last;if(r&&(!r.id||typeof r.fingerprint!=='string'||r.fingerprint.length>40000||!['short','long'].includes(r.kind)||!Number.isFinite(r.hpBefore)||!Number.isFinite(r.hpAfter)||!Array.isArray(r.rolls)||r.rolls.length>100||r.rolls.some(d=>!Number.isInteger(d.faces)||d.faces<2||d.faces>100||!Number.isInteger(d.value)||d.value<1||d.value>d.faces||typeof d.id!=='string')||!r.recovered||typeof r.recovered!=='object'||Object.values(r.recovered).some(n=>!Number.isSafeInteger(n)||n<0||n>100)))throw Error('休息回执无效。');
}
