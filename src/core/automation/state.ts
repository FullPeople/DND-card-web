import {ABILITIES,type Ability,type Character} from '../model';

/** Versioned saved intent; derived values and consumed resources never live here. */
export interface AutomationState {protocol:number; enabled?:boolean; defaultsVersion?:number; rulesVersion?:string; spellSets?:Record<string,number>; spellAbilities?:Record<string,Ability>; spellUsageModes?:Record<string,'shared'|'each'>; spellChoices?:Record<string,string[]>; [key:string]:unknown}
export const AUTOMATION_PROTOCOL=3;
export const RULES_VERSION='ir.1';
export const supportedAutomation=(c:Character)=>c.automation?.protocol===AUTOMATION_PROTOCOL&&c.automation.rulesVersion===RULES_VERSION;
export const automationEnabled=(c:Character)=>supportedAutomation(c)&&c.automation?.enabled===true;
export function newAutomationState():AutomationState{return {protocol:AUTOMATION_PROTOCOL,enabled:true,defaultsVersion:1,rulesVersion:RULES_VERSION};}
/** Apply the default once at a validated loading boundary, preserving later manual opt-outs. */
export const automationNeedsInitialization=(c:Character)=>!c.automation||supportedAutomation(c)&&c.automation.defaultsVersion!==1;
export function initializeAutomation(c:Character):boolean{
 if(!c.automation){c.automation=newAutomationState();return true;}
 if(!supportedAutomation(c)||c.automation.defaultsVersion===1)return false;
 c.automation.enabled=true;c.automation.defaultsVersion=1;return true;
}
export function setAutomationEnabled(c:Character,enabled:boolean){
 if(c.automation&&!supportedAutomation(c))throw Error('此卡的自动化协议暂不支持，已保留原数据；不能覆盖为当前版本。');
 c.automation??=newAutomationState();c.automation.enabled=enabled;c.automation.defaultsVersion=1;
}
export function validateAutomation(value:unknown):void{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('自动化记录需要对象。');
 const state=value as AutomationState;
 if(!Number.isSafeInteger(state.protocol)||state.protocol<1)throw Error('自动化协议版本无效。');
 // Preserve unfamiliar protocols verbatim, but never execute or rewrite them.
 if(state.protocol!==AUTOMATION_PROTOCOL&&state.protocol!==2)return;
 for(const [name,choices] of Object.entries({spellSets:state.spellSets,spellAbilities:state.spellAbilities,spellUsageModes:state.spellUsageModes})){if(choices===undefined)continue;if(!choices||typeof choices!=='object'||Array.isArray(choices)||Object.keys(choices).length>3000||Object.values(choices).some(v=>name==='spellSets'?typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>1000:name==='spellUsageModes'?!['shared','each'].includes(String(v)):!ABILITIES.includes(v as Ability)))throw Error('自动化法术选择记录无效。');}
 if(state.spellChoices!==undefined&&(!state.spellChoices||typeof state.spellChoices!=='object'||Array.isArray(state.spellChoices)||Object.keys(state.spellChoices).length>3000||Object.entries(state.spellChoices).some(([k,v])=>k.length>20000||!Array.isArray(v)||v.length>100||new Set(v).size!==v.length||v.some(ref=>typeof ref!=='string'||ref.length>1000))))throw Error('来源法术自选记录无效。');
 if(state.defaultsVersion!==undefined&&state.defaultsVersion!==1)throw Error('自动化默认设置版本无效。');
 if(typeof state.enabled!=='boolean'||typeof state.rulesVersion!=='string'||state.rulesVersion.length>120)throw Error('自动化开关或规则版本无效。');
}
