import {test,expect,type Page,type Locator} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {newCharacter,type Entry} from '../../src/core/model';
import {exportCharacter} from '../../src/core/export';
import {mockSource,suppressAnnouncement} from '../e2e/fixtures';

const profiles=[
  {name:'spell-single',prefix:'spell',levels:1,classes:1},
  {name:'spell-nine',prefix:'spell',levels:9,classes:1},
  {name:'shared-three',prefix:'spell',levels:3,classes:2},
  {name:'pact-single',prefix:'pact',levels:1,classes:1},
  {name:'pact-four',prefix:'pact',levels:4,classes:1},
  {name:'custom-shared',prefix:'spell',levels:3,classes:2,custom:true},
] as const;

function card(profile:typeof profiles[number]){
  const c=newCharacter();c.name=`原创绘制诊断 ${profile.name}`;
  c.automation={protocol:2,enabled:false,defaultsVersion:1,rulesVersion:'equipment.1'};
  c.selections=Array.from({length:profile.classes},(_,i)=>{
    const entry:Entry={id:`paint-class-${i}`,kind:'class',name:`原创测试职业 ${i+1}`,english:`Authored class ${i+1}`,
      source:'XPHB',edition:'2024',packId:'paint-fixture',revision:'1',entries:['原创界面夹具，不授予规则。'],raw:{_custom:true,hd:{faces:6}}};
    return {id:entry.id,entry,level:1,quantity:1,equipped:false,
      catalogReview:{edition:c.edition,entryId:entry.id,source:entry.source,kind:entry.kind}};
  });
  const slots=Object.fromEntries(Array.from({length:profile.levels},(_,i)=>[String(i+1),{max:i%2?3:4,used:1}]));
  c.spellSettings={mode:'prepared',modeOverride:true,ability:'int',capacity:0,attackBonus:0,dcBonus:0,prepared:[],slots:profile.prefix==='spell'?slots:{}};
  c.runtime.resources=Object.fromEntries(Object.entries(slots).map(([level,slot])=>[`${profile.prefix}-slot:${level}`,
    {name:`${level}环${profile.prefix==='pact'?'契约':''}法术位`,current:slot.max-slot.used,max:slot.max,type:'count' as const}]));
  if('custom' in profile)c.quickbarLayout={order:[],hidden:[],
    attacks:{x:0,y:0,w:4,h:6,page:0,style:'segments',resourceArea:true,split:.35},
    widgets:{'spell-slot:1':{x:1,y:1,w:9,h:5,page:0,style:'poolpips',
      contentScale:.8,padding:3,gap:2,borderWidth:2,borderRadius:4,background:'#e7e2d9',color:'#a36d61',icon:'flame'}}};
  return c;
}

async function ready(page:Page,profile:typeof profiles[number]){
  await mockSource(page,{displayMode:'a4'});await suppressAnnouncement(page);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
  await page.getByTestId('character-file').setInputFiles({name:'authored-paint-fixture.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(exportCharacter(card(profile))))});
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
}

async function savedCharacter(page:Page){
  return page.evaluate(async()=>{
    const request=indexedDB.open('dnd-card-standalone');
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{
      const read=db.transaction('documents').objectStore('documents').get('workspace');
      const workspace=await new Promise<any>((resolve,reject)=>{read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);});
      return JSON.stringify(workspace.characters.find((c:{id:string})=>c.id===workspace.activeId));
    }finally{db.close();}
  });
}

async function geometry(face:Locator){
  return face.evaluate(node=>{
    const measure=(el:Element)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {x:r.x,y:r.y,width:r.width,height:r.height,containerType:s.containerType,heightStyle:s.height,overflow:s.overflow};};
    const art=node.querySelector('.resource-module-art')!,content=art.querySelector('.rm-content')!;
    return {button:measure(node),group:measure(art),content:measure(content),pools:measure(art.querySelector('.rm-pools')!),
      svg:[...art.querySelectorAll('svg')].map(measure)};
  });
}

// Compare actual browser raster pixels against the same frame with only SVG
// painting hidden. DOM attachment or a clickable outer button cannot pass this.
async function paintedPixels(page:Page,face:Locator){
  const options={animations:'disabled' as const,caret:'hide' as const,scale:'css' as const};
  const visible=await face.screenshot(options);
  const hiddenStyle=await face.evaluate(node=>{
    const style=document.createElement('style');style.textContent='svg{visibility:hidden!important}';node.append(style);return style.outerHTML;
  });
  let hidden:Buffer;
  try{hidden=await face.screenshot(options);}finally{
    await face.evaluate((node,html)=>{[...node.querySelectorAll('style')].find(el=>el.outerHTML===html)?.remove();},hiddenStyle);
  }
  const changed=await page.evaluate(async({visible,hidden})=>{
    async function pixels(base64:string){const img=new Image();img.src=`data:image/png;base64,${base64}`;await img.decode();
      const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height);}
    const a=await pixels(visible),b=await pixels(hidden);if(a.width!==b.width||a.height!==b.height)throw Error('Frame changed during paint measurement');
    let changed=0;for(let i=0;i<a.data.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k])))>10)changed++;
    return changed;
  },{visible:visible.toString('base64'),hidden:hidden!.toString('base64')});
  return {changed,screenshot:visible};
}

for(const width of [390,1320])for(const profile of profiles){
  test(`${profile.name}: A4 and responsive spell SVG paints at ${width}px without changing saved data`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize({width,height:1000});await ready(page,profile);
    const before=await savedCharacter(page),id=`${profile.prefix}-slot:1`;
    const widget=page.locator(`.paper .resource-widget[data-resource-id="${id}"]`),face=widget.locator('.resource-widget-face');
    const records=[];
    for(const mode of ['a4','screen','a4-restored']){
      if(mode!=='a4')await page.getByRole('button',{name:mode==='screen'?'切换为非 A4 显示':'切换为 A4 显示',exact:true}).click();
      await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display',mode==='screen'?'screen':'a4');
      await face.scrollIntoViewIfNeeded();
      const bounds=await geometry(face),paint=await paintedPixels(page,face);
      const dimensions=await widget.evaluate(node=>Object.fromEntries(['x','y','w','h','page'].map(k=>[k,node.getAttribute(`data-grid-${k}`)])));
      records.push({mode,bounds,paintedPixels:paint.changed,dimensions});
      const imagePath=test.info().outputPath(`${mode}-${profile.name}-${width}.png`);writeFileSync(imagePath,paint.screenshot);
      await test.info().attach(`${mode}-${profile.name}-${width}`,{path:imagePath,contentType:'image/png'});
      await face.click();const dialog=page.getByRole('dialog',{name:/资源操作$/});await expect(dialog).toBeVisible();
      await expect(dialog.locator('.resource179-row')).toHaveCount(profile.levels);
      await page.getByRole('button',{name:'关闭资源操作',exact:true}).click();
      expect(await savedCharacter(page)).toBe(before);
    }
    const reportPath=test.info().outputPath('geometry-and-paint.json');
    writeFileSync(reportPath,JSON.stringify({ua:await page.evaluate(()=>navigator.userAgent),width,profile,records,errors},null,2)+'\n');
    await test.info().attach('geometry-and-paint',{path:reportPath,contentType:'application/json'});
    for(const record of records){
      expect.soft(record.bounds.group.height,`${record.mode}: group has painted height`).toBeGreaterThan(5);
      expect.soft(record.bounds.content.height,`${record.mode}: content has painted height`).toBeGreaterThan(5);
      expect.soft(record.bounds.svg.every(svg=>svg.width>2&&svg.height>2),`${record.mode}: SVG has real dimensions`).toBeTruthy();
      expect.soft(record.bounds.svg.every(svg=>svg.y>=record.bounds.group.y-1&&svg.y+svg.height<=record.bounds.group.y+record.bounds.group.height+1),
        `${record.mode}: each SVG fits inside the clipping group`).toBeTruthy();
      expect.soft(record.paintedPixels,`${record.mode}: inline SVG produces actual pixels`).toBeGreaterThan(5);
      expect(record.dimensions).toEqual(records[0].dimensions);
    }
    expect(errors).toEqual([]);
  });
}
