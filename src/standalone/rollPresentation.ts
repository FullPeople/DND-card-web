export const ROLL_REVEAL_MS=620;
/** Hold one real outcome. Closing or reopening cannot reveal a stale result. */
export function createRollPresentation<Result>(io:{rolling:()=>void;reveal:(result:Result)=>void;error:(message:string)=>void;reduced:()=>boolean}){
 let timer:ReturnType<typeof setTimeout>|undefined,pending:{value:Result}|undefined;
 const cancel=()=>{clearTimeout(timer);timer=undefined;pending=undefined;};
 const reveal=()=>{const result=pending;cancel();if(result)io.reveal(result.value);};
 return {
  start(generate:()=>Result){
   if(pending)return;
   let value:Result;try{value=generate();}catch(error){io.error(error instanceof Error?error.message:String(error));return;}
   pending={value};io.rolling();
   if(io.reduced())reveal();else timer=setTimeout(reveal,ROLL_REVEAL_MS);
  },reveal,cancel,
 };
}
