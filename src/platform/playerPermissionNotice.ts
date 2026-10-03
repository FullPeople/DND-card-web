/** Read-only status observer: opening/dismissing the guide never implies read. */
export function permissionNoticeState(query:()=>Promise<unknown>,publish:(seen:boolean)=>void){
 let active=true,revision=0;
 return {
  async refresh(){
   if(!active)return;
   const current=++revision;
   try{
    const result=await query();
    if(active&&current===revision)publish(!!result&&typeof result==='object'&&(result as {seen?:unknown}).seen===true);
   }catch{ /* An unavailable host cannot acknowledge on the reader's behalf. */ }
  },
  dispose(){active=false;++revision;},
 };
}
