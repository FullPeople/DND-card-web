import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {suppressAnnouncement} from './fixtures';
test('drag paints independent depth immediately and keeps cached paper nodes',async({page,request,context})=>{
 const fixture=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:'http://127.0.0.1:5320','X-CSRF-Token':fixture.ownerSession.csrf,Cookie:'dnd_cloud='+fixture.ownerSession.token},ids:string[]=[];
 for(let i=0;i<5;i++){const r=await request.post('/api/cards',{headers,data:{confirmUpload:true,character:{...fixture.card.character,id:crypto.randomUUID(),name:'原创弧线过渡验收 '+i,runtime:{...fixture.card.character.runtime,resources:{...fixture.card.character.runtime.resources,'hit-die:8':{current:1,max:1,name:'生命骰 d8'}}}}}});expect(r.status()).toBe(201);ids.push((await r.json()).id);}
 await context.addCookies([{name:'dnd_cloud',value:fixture.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 try{
  await suppressAnnouncement(page);const reads:string[]=[];page.on('request',r=>{if(/\/api\/cards\/[A-Z]{6}$/.test(r.url())&&r.method()==='GET')reads.push(r.url());});await page.goto('/library/?q=原创弧线过渡验收');await expect(page.locator('.cloud-gallery-stage .paper')).toHaveCount(5);await expect.poll(()=>reads.length).toBe(5);const dice=page.locator('.cloud-gallery-stage .hit-die-art img');await expect(dice).toHaveCount(5);for(const die of await dice.all())await expect.poll(()=>die.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  const stage=page.locator('.cloud-gallery-stage'),active=page.locator('.cloud-gallery-item.is-active'),previous=page.locator('.cloud-gallery-item[data-offset="-1"]');const scale=(node:any)=>node.evaluate((el:HTMLElement)=>{const m=new DOMMatrix(getComputedStyle(el).transform);return Math.hypot(m.a,m.b);});const a=await scale(active),b=await scale(previous),id=await active.getAttribute('data-card-id');const papers=await page.locator('.cloud-gallery-item').evaluateAll(nodes=>{(window as any).savedGalleryPapers=Object.fromEntries(nodes.map(node=>[node.getAttribute('data-card-id'),node.querySelector('.paper')]));return nodes.length;});expect(papers).toBe(5);
  const box=(await stage.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:6});await expect(active).toHaveAttribute('data-card-id',id!);await expect.poll(()=>scale(active)).toBeLessThan(a-.005);await expect.poll(()=>scale(previous)).toBeGreaterThan(b+.005);expect(await stage.boundingBox()).toEqual(box);await page.mouse.up();await expect(page.getByRole('dialog',{name:'全屏角色卡'})).toHaveCount(0);
  for(let i=0;i<5;i++){await page.getByRole('button',{name:'下一张角色卡'}).click();await expect(page.locator('.cloud-gallery-item.is-active .paper')).toBeVisible();}expect(reads).toHaveLength(5);expect(await page.locator('.cloud-gallery-item').evaluateAll(nodes=>nodes.every(node=>(window as any).savedGalleryPapers[node.getAttribute('data-card-id')!]===node.querySelector('.paper')))).toBe(true);
 }finally{for(const id of ids)expect((await request.delete('/api/cards/'+id,{headers,data:{revision:1}})).ok()).toBe(true);}
});

test('old English training names stay Chinese in gallery and full screen without a wiki download',async({page,request,context})=>{
 const fixture=JSON.parse(readFileSync('evidence/cloud-fixture.json','utf8')),headers={Origin:'http://127.0.0.1:5320','X-CSRF-Token':fixture.ownerSession.csrf,Cookie:'dnd_cloud='+fixture.ownerSession.token},ids:string[]=[];
 const english=['battleaxe','handaxe','light hammer','warhammer'],chinese=['战斧','手斧','轻锤','战锤'];
 for(const manual of [false,true]){
  const character=structuredClone(fixture.card.character);character.id=crypto.randomUUID();character.name='原创无词库熟练翻译 '+(manual?'手填':'授予');
  character.edition='2014';character.selections.push({id:crypto.randomUUID(),level:1,quantity:1,equipped:false,entry:{id:'fixture:training-race',kind:'race',name:'原创熟练种族',english:'Original training race',edition:'2014',source:'PHB',packId:'fixture',revision:'1',raw:{weaponProficiencies:[Object.fromEntries(english.map(name=>[name,true]))]},entries:[]}});
  if(manual)character.training={...character.training,weapons:'battleaxe|PHB、{@item handaxe|PHB}、light hammer、warhammer、battleaxe|PHB|我的斧头、unknown weapon|HOME'};
  else if(character.training)delete character.training.weapons;
  const response=await request.post('/api/cards',{headers,data:{confirmUpload:true,character}});expect(response.status(),await response.text()).toBe(201);ids.push((await response.json()).id);
 }
 await context.addCookies([{name:'dnd_cloud',value:fixture.ownerSession.token,url:'http://127.0.0.1:5320/api/',httpOnly:true,sameSite:'Strict'}]);
 try{
  await suppressAnnouncement(page);const wiki:string[]=[];page.on('request',r=>{if(/5e\.kiwee|homebrew\.kiwee|\/data\/(?:items|languages)/.test(r.url()))wiki.push(r.url());});
  await page.goto('/library/?q=原创无词库熟练翻译');await expect(page.locator('.cloud-gallery-stage .paper')).toHaveCount(2);
  // Gallery papers deliberately hide their controls from accessibility/input;
  // inspect the visible captions, then use normal accessible roles full screen.
  for(const id of ids){const chips=page.locator(`.cloud-gallery-item[data-card-id="${id}"] .training-chips`);for(const label of chinese)await expect(chips.locator('.feature-caption').filter({hasText:new RegExp(`^${label}$`)})).toBeVisible();for(const name of english)await expect(chips.locator('.feature-caption').filter({hasText:new RegExp(`^${name}$`)})).toHaveCount(0);}
  const manualChips=page.locator(`.cloud-gallery-item[data-card-id="${ids[1]}"] .training-chips`);await expect(manualChips.locator('.feature-caption').filter({hasText:/^我的斧头$/})).toBeVisible();await expect(manualChips.locator('.feature-caption').filter({hasText:/^unknown weapon$/})).toBeVisible();
  await page.locator('.cloud-gallery-item.is-active .cloud-gallery-open').click();const full=page.getByRole('dialog',{name:'全屏角色卡'});await expect(full).toBeVisible();for(const label of chinese)await expect(full.locator('.training-chips').getByRole('button',{name:label,exact:true})).toBeVisible();expect(wiki).toEqual([]);
  const stored=(await (await request.get('/api/cards/'+ids[1],{headers})).json()).character;expect(stored.training.weapons).toBe('battleaxe|PHB、{@item handaxe|PHB}、light hammer、warhammer、battleaxe|PHB|我的斧头、unknown weapon|HOME');
 }finally{for(const id of ids)expect((await request.delete('/api/cards/'+id,{headers,data:{revision:1}})).ok()).toBe(true);}
});
