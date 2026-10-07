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

async function ready(page:Page,profile:typeof profiles[number],imported=card(profile)){
  await mockSource(page,{displayMode:'a4'});await suppressAnnouncement(page);
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-card-startup','complete');
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
  await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
  await page.getByTestId('character-file').setInputFiles({name:'authored-paint-fixture.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(exportCharacter(imported)))});
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.locator('.save-status')).toContainText('已保存到本机');
}

// Follow the actual ancestor chain, including both scroll viewports. A positive
// SVG bbox or a fit inside rm-group alone does not prove the glyph is unclipped.
async function clippingAncestors(face:Locator){
  return face.evaluate(node=>{
    const violations:unknown[]=[],unsupported:unknown[]=[];
    // These actual sheet frames use convex cut-corner polygons. Check the SVG
    // corners against their edges as well as their rectangular overflow bounds.
    const polygon=(value:string,parent:HTMLElement)=>{
      const match=/^polygon\((.*)\)$/.exec(value);if(!match)return undefined;
      const position=(text:string,size:number)=>{
        const expression=text.replace(/^calc\((.*)\)$/,'$1'),terms=expression.match(/[+-]?\s*\d+(?:\.\d+)?(?:px|%)/g);
        if(!terms||expression.replace(/[+-]?\s*\d+(?:\.\d+)?(?:px|%)/g,'').trim())return NaN;
        return terms.reduce((sum,term)=>sum+parseFloat(term.replace(/\s/g,''))*(term.endsWith('%')?size/100:1),0);
      };
      const box=parent.getBoundingClientRect(),points=match[1].split(',').map(pair=>{
        const parts=pair.trim().match(/calc\([^)]*\)|[+-]?\d+(?:\.\d+)?(?:px|%)/g);if(parts?.length!==2)return {x:NaN,y:NaN};
        return {x:box.left+position(parts[0],parent.offsetWidth)*box.width/parent.offsetWidth,
          y:box.top+position(parts[1],parent.offsetHeight)*box.height/parent.offsetHeight};
      });
      if(points.length<3||points.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return undefined;
      const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0),direction=Math.sign(area);
      if(!direction||points.some((a,i)=>{const b=points[(i+1)%points.length],c=points[(i+2)%points.length];
        return direction*((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))<0;}))return undefined;
      return {points,direction};
    };
    const svg=[...node.querySelectorAll<SVGSVGElement>('.resource-dashboard-icon')].map((icon,index)=>{
      const r=icon.getBoundingClientRect(),bounds={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height},clips=[];
      for(let parent=icon.parentElement;parent;parent=parent.parentElement){
        const style=getComputedStyle(parent),paint=/\b(paint|strict|content)\b/.test(style.contain);
        const clipPath=style.clipPath!=='none',unknownClip=style.clip!=='auto'||style.maskImage!=='none',
          x=paint||clipPath||unknownClip||style.overflowX!=='visible',y=paint||clipPath||unknownClip||style.overflowY!=='visible';
        if(!x&&!y)continue;
        const box=parent.getBoundingClientRect(),sx=parent.offsetWidth?box.width/parent.offsetWidth:1,sy=parent.offsetHeight?box.height/parent.offsetHeight:1;
        const shape=clipPath?polygon(style.clipPath,parent):undefined;
        const clip={element:`${parent.tagName.toLowerCase()}.${parent.className}`,overflowX:style.overflowX,overflowY:style.overflowY,
          contain:style.contain,clipPath:style.clipPath,x,y,left:box.left+parent.clientLeft*sx,top:box.top+parent.clientTop*sy,
          right:box.left+(parent.clientLeft+parent.clientWidth)*sx,bottom:box.top+(parent.clientTop+parent.clientHeight)*sy,polygon:shape?.points,
          radii:[style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomRightRadius,style.borderBottomLeftRadius]};
        clips.push(clip);
        if(clipPath&&!shape)unsupported.push({index,element:clip.element,clipPath:style.clipPath});
        if(style.clip!=='auto'||style.maskImage!=='none')unsupported.push({index,element:clip.element,clip:style.clip,maskImage:style.maskImage});
        const corners=[{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}];
        if((paint||style.overflowX!=='visible')&&(paint||style.overflowY!=='visible')){
          const borders=[['Left','Top'],['Right','Top'],['Right','Bottom'],['Left','Bottom']];
          clip.radii.forEach((radius,i)=>{
            if(!/^\d+(?:\.\d+)?px(?: \d+(?:\.\d+)?px)?$/.test(radius)){unsupported.push({index,element:clip.element,radius});return;}
            const parts=radius.split(' ').map(parseFloat),rx=Math.max(0,parts[0]-parseFloat(style.getPropertyValue(`border-${borders[i][0].toLowerCase()}-width`)))*sx,
              ry=Math.max(0,(parts[1]??parts[0])-parseFloat(style.getPropertyValue(`border-${borders[i][1].toLowerCase()}-width`)))*sy;
            const left=i===0||i===3,top=i<2,cx=left?clip.left+rx:clip.right-rx,cy=top?clip.top+ry:clip.bottom-ry;
            if(rx&&ry&&corners.some(point=>(left?point.x<cx:point.x>cx)&&(top?point.y<cy:point.y>cy)&&
              ((point.x-cx)/(rx+1))**2+((point.y-cy)/(ry+1))**2>1))violations.push({index,bounds,clip,reason:'rounded overflow corner'});
          });
        }
        if(shape){
          if(corners.some(point=>shape.points.some((a,i)=>{const b=shape.points[(i+1)%shape.points.length];
            return shape.direction*((b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x))/Math.hypot(b.x-a.x,b.y-a.y)<-1;})))
            violations.push({index,bounds,clip,reason:'polygon edge'});
        }
        if(x&&(r.left<clip.left-1||r.right>clip.right+1)||y&&(r.top<clip.top-1||r.bottom>clip.bottom+1))violations.push({index,bounds,clip});
      }
      if(r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight)violations.push({index,bounds,clip:'browser viewport'});
      return {index,bounds,clips};
    });
    return {svg,violations,unsupported};
  });
}

test('one saved card crosses the actual screen pane breakpoint narrow → wide → narrow with shared, pact and styled members groups',async({page})=>{
  const c=card(profiles[2]);c.name='原创实际容器往返诊断';
  c.runtime.resources['pact-slot:2']={name:'原创契约位',current:1,max:2,type:'count'};
  c.runtime.resources['manual-a']={name:'原创充能甲',current:3,max:4,type:'count'};
  c.runtime.resources['manual-b']={name:'原创充能乙',current:2,max:3,type:'count'};
  const layout={x:1,y:1,w:6,h:4,style:'poolpips' as const};
  c.quickbarLayout={order:[],hidden:[],attacks:{x:0,y:0,w:4,h:6,page:0,style:'segments',resourceArea:true,split:.35},widgets:{
    'spell-slot:1':{...layout,page:0},'pact-slot:2':{...layout,page:1},
    'manual-a':{...layout,page:2,members:['manual-a','manual-b'],label:'原创组合充能',
      contentScale:.8,padding:3,gap:2,borderWidth:2,borderRadius:4,background:'#e7e2d9',color:'#a36d61',icon:'flame'},
  }};
  await page.setViewportSize({width:1000,height:1100});await ready(page,profiles[2],c);
  await page.getByRole('button',{name:'切换为非 A4 显示',exact:true}).click();
  const splitter=page.getByRole('separator',{name:'调整角色卡与规则资料宽度',exact:true});
  await splitter.press('Home');for(let i=0;i<9;i++)await splitter.press('ArrowRight');
  const pane=await page.locator('.sheet-pane').elementHandle(),screen=await page.locator('.sheet-viewport').elementHandle();
  const before=await savedCharacter(page);expect(JSON.parse(before).name).toContain(c.name);
  const ids=['spell-slot:1','pact-slot:2','manual-a'],records=[];
  for(const [step,width] of [['narrow',1000],['wide',1600],['narrow-restored',1000]] as const){
    await page.setViewportSize({width,height:1100});
    await expect(page.locator('.sheet-viewport')).toHaveAttribute('data-sheet-display','screen');
    const dimensions=()=>page.locator('.sheet-viewport').evaluate(node=>({paneWidth:node.closest('.sheet-pane')!.getBoundingClientRect().width,
      screenWidth:node.getBoundingClientRect().width,screenClientWidth:node.clientWidth,containerName:getComputedStyle(node).containerName,
      quickbarHeight:node.querySelector('.resource-diy-quickbar')!.getBoundingClientRect().height}));
    await expect.poll(async()=>{const d=await dimensions();return d.containerName==='screen'&&(step==='wide'?d.screenClientWidth>760:d.screenClientWidth<760)&&d.quickbarHeight===(step==='wide'?150:215);}).toBeTruthy();
    const container=await dimensions(),samePane=await pane!.evaluate(node=>node===document.querySelector('.sheet-pane')),
      sameScreen=await screen!.evaluate(node=>node===document.querySelector('.sheet-viewport'));
    expect(samePane).toBeTruthy();expect(sameScreen).toBeTruthy();
    const modules=[];
    for(const id of ids){
      const widget=page.locator(`.paper .resource-widget[data-resource-id="${id}"]`),face=widget.locator('.resource-widget-face');
      await face.scrollIntoViewIfNeeded();
      const bounds=await geometry(face),clips=await clippingAncestors(face),paint=await paintedPixels(page,face);
      const grid=await widget.evaluate(node=>Object.fromEntries(['x','y','w','h','page'].map(k=>[k,node.getAttribute(`data-grid-${k}`)])));
      const rowIds=await face.locator('.rm-pool').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-subresource-id')));
      expect(rowIds).toEqual(id==='spell-slot:1'?['spell-slot:1','spell-slot:2','spell-slot:3']:id==='pact-slot:2'?['pact-slot:2']:['manual-a','manual-b']);
      await expect(widget).toHaveAttribute('data-resource-name',id==='spell-slot:1'?'法术位（共用）':id==='pact-slot:2'?'契约法术位':'原创组合充能');
      await expect(face.locator('.is-spell-pool')).toHaveCount(id==='manual-a'?0:1);
      const style=await face.locator('.resource-module-art').evaluate(node=>({scale:node.getAttribute('data-content-scale'),
        tone:getComputedStyle(node).getPropertyValue('--rm-icon-tone'),background:getComputedStyle(node).getPropertyValue('--rm-background'),
        borderWidth:getComputedStyle(node).borderWidth,borderRadius:getComputedStyle(node).borderRadius,
        padding:getComputedStyle(node.querySelector('.rm-content')!).padding,iconPath:node.querySelector('.resource-dashboard-icon path')!.getAttribute('d')}));
      modules.push({id,bounds,clips,paintedPixels:paint.changed,grid,rowIds,style});
      const imagePath=test.info().outputPath(`${step}-${id.replace(':','-')}.png`);writeFileSync(imagePath,paint.screenshot);
      await test.info().attach(`${step}-${id}`,{path:imagePath,contentType:'image/png'});
      if(id==='manual-a'){expect(rowIds).toEqual(['manual-a','manual-b']);await expect(face.locator('.is-spell-pool')).toHaveCount(0);
        await expect(page.locator('.paper .resource-widget[data-resource-id="manual-b"]')).toHaveCount(0);}
      await face.click();await expect(page.getByRole('dialog',{name:/资源操作$/})).toBeVisible();
      await expect(page.getByRole('dialog',{name:/资源操作$/}).locator('.resource179-row')).toHaveCount(rowIds.length);
      await page.getByRole('button',{name:'关闭资源操作',exact:true}).click();expect(await savedCharacter(page)).toBe(before);
    }
    const savedRecordUnchanged=await savedCharacter(page)===before;expect(savedRecordUnchanged).toBeTruthy();
    records.push({step,viewportWidth:width,container,samePane,sameScreen,savedRecordUnchanged,modules});
  }
  const reportPath=test.info().outputPath('pane-roundtrip.json');writeFileSync(reportPath,JSON.stringify({ua:await page.evaluate(()=>navigator.userAgent),records},null,2)+'\n');
  await test.info().attach('actual-pane-roundtrip',{path:reportPath,contentType:'application/json'});
  for(const record of records)for(const module of record.modules){
    expect.soft(module.clips.unsupported,`${record.step} ${module.id}: every clip type is checked`).toEqual([]);
    expect.soft(module.clips.violations,`${record.step} ${module.id}: all SVG edges fit all clipping ancestors`).toEqual([]);
    expect.soft(module.paintedPixels,`${record.step} ${module.id}: SVG paints`).toBeGreaterThan(5);
    expect.soft(module.clips.svg.every(svg=>svg.bounds.width>2&&svg.bounds.height>2)).toBeTruthy();
    const initial=records[0].modules.find(first=>first.id===module.id)!;expect(module.grid).toEqual(initial.grid);expect(module.style).toEqual(initial.style);
  }
  expect(records[2].container).toEqual(records[0].container);
});

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
