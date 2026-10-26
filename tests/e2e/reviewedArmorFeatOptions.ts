import {expect,type Locator} from '@playwright/test';

// Resolve the player's exact label once, then keep the actual source identity.
// ChoiceWorkspace renders the label as direct text and the reason as SMALL;
// .is-picked:before adds CSS-only "✓ " to the accessible name after selection.
// This read-only DOM query must not bind later assertions to either decoration.
export async function armorFeatOption(workspace:Locator,name:string):Promise<Locator>{
 let reference:string|null=null;
 await expect.poll(async()=>{
  reference=await workspace.locator('button.choice-option').evaluateAll((options,label)=>{
  const named=options.filter(option=>Array.from(option.childNodes).filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim()===label);
  if(named.length===0)return null;
  if(named.length!==1)throw new Error(`Expected one armor feat option labelled ${label}; found ${named.length}`);
  const value=named[0].getAttribute('data-reference');
  if(!value?.trim())throw new Error(`Armor feat option ${label} has no source reference`);
  if(options.filter(option=>option.getAttribute('data-reference')===value).length!==1)throw new Error(`Armor feat option ${label} has a duplicate source reference`);
  return value;
  },name);
  return reference;
 },{message:`Waiting for one armor feat option labelled ${name}`}).not.toBeNull();
 if(reference===null)throw new Error(`Armor feat option ${name} did not load`);
 return workspace.locator(`button.choice-option[data-reference=${JSON.stringify(reference)}]`);
}
