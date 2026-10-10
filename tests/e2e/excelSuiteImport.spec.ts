import {test,expect,type Page} from '@playwright/test';
import {mockSource,suppressAnnouncement} from './fixtures';
import {xlsxFixture} from './xlsxFixtures';
const payload=async(edition='2024')=>({name:`card-${edition}.xlsx`,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:await xlsxFixture(edition)});

async function setupSuite(page:Page,baseURL:string,rejectSecond=false){
 await mockSource(page);await suppressAnnouncement(page);
 const url=new URL(baseURL);url.hash='suite=excel-suite&bridge='+encodeURIComponent(url.origin);await page.goto(url.href);await expect(page.locator('.app-shell')).toBeVisible();
 await page.evaluate(({rejectSecond})=>{
  const w=window as any;w.excelCreates=[];w.excelCards=[];w.excelDocs={};let sequence=0;
  const emit=(type:string,payload:any={})=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{protocol:'full-suite-workbench/v1',session:'excel-suite',hostStarted:272,type,...payload}}));
  const catalog=()=>emit('catalog',{sequence:++sequence,role:'GM',cards:w.excelCards,monsters:[],enabled:{characterCards:true},visibility:{wiki:true,monsters:true}});
  window.addEventListener('message',event=>{
   const m=event.data;if(m?.protocol!=='full-suite-workbench/v1'||m.session!=='excel-suite')return;
   if(m.type==='ping')emit('pong');
   if(m.type==='createCard'){
    w.excelCreates.push(m);
    if(rejectSecond&&w.excelCreates.length===2){emit('ack',{requestId:m.requestId,ok:false,message:'测试拒绝第二张'});return;}
    const id='excel-room-'+w.excelCreates.length;w.excelDocs['card:'+id]=m.data;
    w.excelCards.push({id,cardId:id,itemId:'card:'+id,key:'room:card:'+id,name:m.data.identity.character_name,kind:'character',role:'GM',write:true,inScene:false,locked:false,documentRevision:1,resources:[],stats:{}});
    emit('ack',{requestId:m.requestId,ok:true,result:{created:{id}}});catalog();
   }
   if(m.type==='select'){const data=w.excelDocs[m.itemId],state=w.excelCards.find((card:any)=>card.itemId===m.itemId);if(data)emit('selection',{sequence:++sequence,state,document:{...data,_suiteRevision:1}});}
  });
  emit('ready');catalog();
 },{rejectSecond});
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();
}

test('Suite synchronization creates one room card and sends no backup or pre-review create request',async({page,baseURL})=>{
 await setupSuite(page,baseURL!);await page.getByTestId('character-file').setInputFiles(await payload());
 expect(await page.evaluate(()=>(window as any).excelCreates.length)).toBe(0);
 await page.getByRole('button',{name:'同步 5etools 资料',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Excel 资料同步',exact:true});await dialog.getByRole('button',{name:'确认并继续',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).excelCreates.length)).toBe(0);
 await dialog.getByRole('button',{name:'确认同步并导入',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await page.evaluate(()=>({creates:(window as any).excelCreates,cards:(window as any).excelCards}));
 expect(result.creates).toHaveLength(1);expect(result.cards).toHaveLength(1);expect(result.creates[0].data.dnd_card_web.name).toBe('Excel 验收角色');
 expect(result.creates[0].data.dnd_card_web.selections.find((row:any)=>row.entry.kind==='class').entry.source).toBe('XPHB');
 await expect(page.locator('.paper')).toBeVisible();
});

test('Suite batch retry skips acknowledged imports and retains the same rejected-card identity',async({page,baseURL})=>{
 await setupSuite(page,baseURL!,true);await page.getByLabel('批量导入角色文件',{exact:true}).setInputFiles([await payload('2014'),await payload('2024')]);
 const dialog=page.getByRole('dialog',{name:'Excel 导入方式',exact:true});await dialog.getByRole('button',{name:'取消同步，导入自定义卡',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('测试拒绝第二张');
 expect(await page.evaluate(()=>(window as any).excelCards.length)).toBe(1);
 await expect(dialog.getByRole('button',{name:'同步 5etools 资料',exact:true})).toBeDisabled();
 const id=await page.evaluate(()=>(window as any).excelCreates[1].data.dnd_card_web.id);
 await dialog.getByRole('button',{name:'取消同步，导入自定义卡',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await page.evaluate(()=>({creates:(window as any).excelCreates,cards:(window as any).excelCards}));
 expect(result.cards).toHaveLength(2);expect(result.creates).toHaveLength(3);expect(result.creates[2].data.dnd_card_web.id).toBe(id);
 expect(result.creates[2].data.dnd_card_web.edition).toBe('2024');
});
