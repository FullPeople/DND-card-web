import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {newCharacter,ABILITIES,type Character} from '../../src/core/model';
import {validateCharacter} from '../../src/core/validation';

async function readCard(page:Page):Promise<Character>{return page.evaluate(async()=>{const path='/src/platform/storage.ts';const {loadWorkspace}=await import(path);const w=await loadWorkspace(true);return w.characters.find((c:Character)=>c.id===w.activeId);});}
async function derivedStrength(page:Page){return page.evaluate(async()=>{const storagePath='/src/platform/storage.ts',enginePath='/src/core/engine.ts';const {loadWorkspace}=await import(storagePath),{evaluate}=await import(enginePath);const w=await loadWorkspace(true);return evaluate(w.characters.find((card:Character)=>card.id===w.activeId)).abilities.str;});}
async function setup(page:Page){
 const card=newCharacter('2024');card.name='Authored ability generation';card.notes='Keep manual notes and source records';card.abilities.str=14;
 card.profile.autoSourceDefaults=['PHB','XPHB'];card.rulePacks=[];
 card.runtime.hp=3;card.runtime.resources={spent:{name:'Authored resource',max:4,current:1}};
 validateCharacter(card);
 await mockSource(page);await suppressAnnouncement(page);await page.goto('/');await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.evaluate(async(card)=>{const path='/src/platform/storage.ts',catalogPath='/src/data/catalog.ts',validationPath='/src/core/validation.ts';const {loadWorkspace,saveWorkspace}=await import(path),{normalizeData}=await import(catalogPath),{validateCharacter}=await import(validationPath);const from=['str','dex','con','int','wis','cha'];const [entry]=normalizeData({feat:[{name:'Ability Score Improvement',source:'XPHB',category:'G',repeatable:true,ability:[{choose:{from,amount:2},hidden:true},{choose:{from,count:2},hidden:true}]}]},'ability-generation-fixture');card.selections=[{id:'boost',entry,quantity:1,level:1,equipped:false}];card.answers['boost:feat-abilities']=['str:2'];validateCharacter(card);const w=await loadWorkspace();await saveWorkspace({...w,characters:[card],activeId:card.id});},card);
 await page.reload();await expect(page.getByRole('tab',{name:card.name,exact:true})).toBeVisible();await expect(page.locator('.save-status')).toContainText('已保存到本机');
 expect(await derivedStrength(page)).toBe(16);
 await expect(page.getByRole('button',{name:'生成基础属性',exact:true})).toHaveCount(0);
 await page.getByRole('switch',{name:'编辑模式',exact:true}).click();return readCard(page);
}
const retained=(card:Character)=>{const {abilities,revision,updatedAt,...other}=card;return other;};

test('point buy previews and cancels without edits, then applies only base values and survives reopening',async({page},info)=>{
 const before=await setup(page),launch=page.getByRole('button',{name:'生成基础属性',exact:true});
 await expect(launch).toBeVisible({timeout:5000});await launch.click();let dialog=page.getByRole('dialog',{name:'生成基础属性',exact:true});
 await dialog.getByRole('combobox',{name:'力量购点值',exact:true}).selectOption('14');
 expect(await readCard(page)).toEqual(before);await dialog.getByRole('button',{name:'取消',exact:true}).click();expect(await readCard(page)).toEqual(before);
 await launch.click();dialog=page.getByRole('dialog',{name:'生成基础属性',exact:true});
 for(const name of ['力量','敏捷','体质'])await dialog.getByRole('combobox',{name:`${name}购点值`,exact:true}).selectOption('15');
 await expect(dialog.getByRole('status')).toContainText('剩余 0 / 27 点');
 await page.screenshot({path:info.outputPath('point-buy-preview.png')});
 await dialog.getByRole('button',{name:'应用基础值',exact:true}).click();await expect(dialog).toHaveCount(0);
 const expected={str:15,dex:15,con:15,int:8,wis:8,cha:8};await expect.poll(async()=>(await readCard(page)).abilities).toEqual(expected);
 await expect(page.locator('.save-status')).toContainText('已保存到本机');await page.reload();
 const saved=await readCard(page);expect(saved.abilities).toEqual(expected);expect(retained(saved)).toEqual(retained(before));expect(await derivedStrength(page)).toBe(17);
});

test('random generation retains all dice, swaps assignments and leaves failed or cancelled previews unsaved',async({page},info)=>{
 const before=await setup(page);await page.getByRole('button',{name:'生成基础属性',exact:true}).click();let dialog=page.getByRole('dialog',{name:'生成基础属性',exact:true});
 await dialog.getByRole('button',{name:'随机掷骰',exact:true}).click();
 await page.evaluate(()=>{Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:()=>{throw Error('Authored random unavailable');}});});
 await dialog.getByRole('button',{name:'投掷六组',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Authored random unavailable');expect(await readCard(page)).toEqual(before);
 const dice=[[6,6,6,1],[1,2,3,4],[4,4,4,1],[6,5,2,1],[1,2,2,3],[5,5,5,2]];
 await page.evaluate(dice=>{const faces=dice.flat();Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:(array:Uint8Array)=>{for(let i=0;i<array.length;i++){if(!faces.length)throw Error('Unexpected extra dice');array[i]=faces.shift()!-1;}return array;}});},dice);
 await dialog.getByRole('button',{name:'投掷六组',exact:true}).click();await expect(dialog.locator('[data-generated-roll]')).toHaveCount(6);
 await dialog.getByRole('combobox',{name:'力量随机分配',exact:true}).selectOption('1');
 await expect(dialog.getByRole('combobox',{name:'敏捷随机分配',exact:true})).toHaveValue('0');
 expect(await readCard(page)).toEqual(before);await page.screenshot({path:info.outputPath('random-ability-preview.png')});
 await dialog.getByRole('button',{name:'取消',exact:true}).click();expect(await readCard(page)).toEqual(before);
 await page.getByRole('button',{name:'生成基础属性',exact:true}).click();dialog=page.getByRole('dialog',{name:'生成基础属性',exact:true});await dialog.getByRole('button',{name:'随机掷骰',exact:true}).click();
 await page.evaluate(dice=>{const faces=dice.flat();Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:(array:Uint8Array)=>{for(let i=0;i<array.length;i++){if(!faces.length)throw Error('Unexpected extra dice');array[i]=faces.shift()!-1;}return array;}});},dice);
 await dialog.getByRole('button',{name:'投掷六组',exact:true}).click();await dialog.getByRole('combobox',{name:'力量随机分配',exact:true}).selectOption('1');
 await dialog.getByRole('button',{name:'应用基础值',exact:true}).click();await expect(dialog).toHaveCount(0);
 const expected={str:9,dex:18,con:12,int:13,wis:7,cha:15};await expect.poll(async()=>(await readCard(page)).abilities).toEqual(expected);await expect(page.locator('.save-status')).toContainText('已保存到本机');
 await page.reload();const saved=await readCard(page);expect(saved.abilities).toEqual(expected);expect(retained(saved)).toEqual(retained(before));expect(await derivedStrength(page)).toBe(11);
 expect(ABILITIES.every(a=>saved.abilities[a]===expected[a])).toBe(true);
});
