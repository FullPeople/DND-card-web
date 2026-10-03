import {validateAutomation} from './automation/validate';
import type {AutomationEnvelope} from './automation/protocol';
self.onmessage=({data}:{data:{id:number;text:string}})=>{
 try{const envelope:unknown=JSON.parse(data.text);validateAutomation(envelope);self.postMessage({id:data.id,envelope:envelope as AutomationEnvelope});}
 catch{self.postMessage({id:data.id,error:'自动化资料未通过校验；尚未应用任何规则。'});}
};
