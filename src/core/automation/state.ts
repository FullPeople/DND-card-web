import type {Character} from '../model';

/** Versioned saved intent; derived values and consumed resources never live here. */
export interface AutomationState {protocol:number; enabled?:boolean; rulesVersion?:string; [key:string]:unknown}
export const AUTOMATION_PROTOCOL=2;
export const RULES_VERSION='equipment.1';
export const supportedAutomation=(c:Character)=>c.automation?.protocol===AUTOMATION_PROTOCOL&&c.automation.rulesVersion===RULES_VERSION;
export const automationEnabled=(c:Character)=>supportedAutomation(c)&&c.automation?.enabled===true;
export function newAutomationState():AutomationState{return {protocol:AUTOMATION_PROTOCOL,enabled:true,rulesVersion:RULES_VERSION};}
export function setAutomationEnabled(c:Character,enabled:boolean){
 if(c.automation&&!supportedAutomation(c))throw Error('此卡的自动化协议暂不支持，已保留原数据；不能覆盖为当前版本。');
 c.automation??=newAutomationState();c.automation.enabled=enabled;
}
export function validateAutomation(value:unknown):void{
 if(value===undefined)return;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('自动化记录需要对象。');
 const state=value as AutomationState;
 if(!Number.isSafeInteger(state.protocol)||state.protocol<1)throw Error('自动化协议版本无效。');
 // Preserve unfamiliar protocols verbatim, but never execute or rewrite them.
 if(state.protocol!==AUTOMATION_PROTOCOL)return;
 if(typeof state.enabled!=='boolean'||typeof state.rulesVersion!=='string'||state.rulesVersion.length>120)throw Error('自动化开关或规则版本无效。');
}
