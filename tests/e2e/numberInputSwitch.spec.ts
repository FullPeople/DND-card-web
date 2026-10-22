import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
async function ready(page:Page){await page.goto('/tests/fixtures/number-input-switch/');await expect(page.getByLabel('力量基础值',{exact:true})).toHaveValue('12');}
const state=(page:Page)=>page.evaluate(()=>(window as any).numberInputSwitch.state());
const publish=(page:Page,hp:number)=>page.evaluate(hp=>(window as any).numberInputSwitch.publish(hp),hp);
test('warmed real NumberInput fields each commit once when switching between two cards',async({page},info)=>{
 await ready(page);await page.evaluate(()=>{const fixture=(window as any).numberInputSwitch;fixture.switch(1);fixture.switch(0);});
 const rounds=[];for(const index of [1,0,1,0])rounds.push(await page.evaluate(index=>{const fixture=(window as any).numberInputSwitch;fixture.clear();fixture.switch(index);return {index,samples:[...fixture.samples],values:[...document.querySelectorAll<HTMLInputElement>('input')].map(input=>input.value)};},index));
 const evidence=info.outputPath('number-input-switch-commits.json');writeFileSync(evidence,JSON.stringify(rounds,null,2));await info.attach('number-input-switch-commits',{path:evidence,contentType:'application/json'});
 for(const round of rounds){expect(round.samples.filter(row=>row.phase==='nested-update')).toHaveLength(0);expect(round.samples).toHaveLength(8);expect(new Set(round.samples.map(row=>row.id)).size).toBe(8);expect(round.values).toEqual(round.index===1?['22','21','22','23','24','25','13','11']:['12','11','12','13','14','15','3','1']);}
});
test('focused arithmetic keeps its draft across external updates and Enter uses the latest balance once',async({page})=>{
 await ready(page);const hp=page.getByLabel('当前生命值',{exact:true});await hp.fill('-5');await publish(page,20);await expect(hp).toHaveValue('-5');expect((await state(page)).edits).toBe(0);await hp.press('Enter');await expect(hp).toHaveValue('15');expect((await state(page)).c.runtime.hp).toBe(15);expect((await state(page)).edits).toBe(1);
 await hp.fill('=(8 + 2) * 2');await publish(page,30);await expect(hp).toHaveValue('=(8 + 2) * 2');await page.locator('#outside').click();await expect(hp).toHaveValue('20');expect((await state(page)).edits).toBe(2);
});
test('Escape, invalid arithmetic and empty blur preserve the latest external value without writes',async({page})=>{
 await ready(page);const hp=page.getByLabel('当前生命值',{exact:true});await hp.fill('-5');await publish(page,20);await hp.press('Escape');await expect(hp).toHaveValue('20');expect((await state(page)).edits).toBe(0);
 await hp.fill('invalid(');await publish(page,21);await hp.press('Enter');await expect(hp).toHaveValue('21');expect((await state(page)).edits).toBe(0);
 await hp.fill('');await publish(page,22);await page.locator('#outside').click();await expect(hp).toHaveValue('22');expect((await state(page)).edits).toBe(0);
});
test('ordinary fields seed the current stored value on focus and readonly fields track props',async({page})=>{
 await ready(page);const strength=page.getByLabel('力量基础值',{exact:true});await strength.focus();await expect(strength).toHaveValue('10');await strength.fill('13');await page.locator('#outside').click();await expect(strength).toHaveValue('15');expect((await state(page)).edits).toBe(1);
 await strength.focus();await expect(strength).toHaveValue('13');await strength.press('Escape');await expect(strength).toHaveValue('15');expect((await state(page)).edits).toBe(1);
 await page.evaluate(()=>(window as any).numberInputSwitch.switch(1));await strength.focus();await expect(strength).toHaveValue('20');await strength.press('Escape');await expect(strength).toHaveValue('22');
 await page.getByRole('button',{name:'切换只读',exact:true}).click();const hp=page.getByLabel('当前生命值',{exact:true});await hp.focus();await publish(page,31);await expect(hp).toHaveValue('31');await expect(hp).not.toBeEditable();expect((await state(page)).edits).toBe(1);
});
