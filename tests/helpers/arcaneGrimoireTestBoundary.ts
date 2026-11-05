/** Keep full private-source assertions inside the callback, never in reporters.
 * Do not inspect/rethrow the original error: message, cause, actual, expected and
 * even accessor properties can contain source bodies. This is not a console or
 * arbitrary-process-output sanitizer; these checks must not log private inputs.
 */
export async function runArcaneGrimoireCheck(index:number,run:()=>unknown):Promise<void>{
 if(!Number.isSafeInteger(index)||index<1)throw new Error('ARCANE_GRIMOIRE_CHECK_INDEX_INVALID');
 try{await run();}
 catch{throw new Error(`ARCANE_GRIMOIRE_CHECK_${String(index).padStart(3,'0')}_FAILED`);}
}
