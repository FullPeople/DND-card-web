import { newCharacter, type Character, type Edition } from './model';
import { parseFile, validateCharacter } from './validation';
export type ProfileCode = { version:1; edition:Edition; profile:Character['profile']; sourceDisplay:'full'|'short'|'both' };
export async function encodeProfile(value:ProfileCode){
 const bytes=new Uint8Array(await new Response(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let text='';for(const b of bytes)text+=String.fromCharCode(b);return 'DND1.'+btoa(text).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export async function decodeProfile(code:string):Promise<ProfileCode>{
 if(code.length>4_000_000||!/^DND1\.[\w-]+$/.test(code.trim()))throw new Error('配置码格式不正确。');
 const bytes=Uint8Array.from(atob(code.trim().slice(5).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8_000_000)throw new Error('配置码内容过大。');chunks.push(value);}}finally{await reader.cancel();}
 const text=await new Blob(chunks as BlobPart[]).text();const value=parseFile(text) as ProfileCode;
 if(value?.version!==1||!['2014','2024'].includes(value.edition)||!['full','short','both'].includes(value.sourceDisplay))throw new Error('配置码版本不支持。');
 const template=newCharacter(value.edition);template.profile=value.profile;validateCharacter(template);return value;
}
