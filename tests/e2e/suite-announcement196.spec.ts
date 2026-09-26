import {test,expect} from '@playwright/test';
import {mockSource} from './fixtures';
import {newCharacter,type Entry} from '../../src/core/model';
test('authored character and Wiki preview for the legacy announcement',async({page})=>{
 await mockSource(page);await page.route('https://5e.kiwee.top/data/bestiary/index.json',route=>route.fulfill({json:{CUSTOM:'bestiary-showcase.json'}}));await page.goto('/');await expect(page.locator('.paper')).toBeVisible();
 const c=newCharacter();c.name='星湾记录员';c.player='示例角色';c.abilities={str:10,dex:14,con:14,int:16,wis:12,cha:10};c.baseHp=18;c.runtime.hp=18;
 const entry=(id:string,kind:Entry['kind'],name:string,raw:Record<string,unknown>={}):Entry=>({id,kind,name,english:name,source:'CUSTOM',edition:'both',packId:'custom',revision:'1',raw:{_custom:true,...raw},entries:['此内容为界面演示原创，不包含出版规则或真实玩家资料。']});
 c.selections=[entry('showcase-class','class','星图学者',{hd:{faces:6}}),entry('showcase-race','race','远行者',{speed:30}),entry('showcase-bg','background','抄书员'),entry('showcase-feature','feature','旅行札记'),entry('showcase-spell','spell','微光术',{level:0,school:'I'})].map(e=>({id:e.id,entry:e,level:e.kind==='class'?3:1,quantity:1,equipped:false}));
 await page.getByRole('button',{name:'导入 / 导出',exact:true}).click();await page.getByRole('textbox',{name:'角色 JSON 文本'}).fill(JSON.stringify(c));await page.getByRole('button',{name:'校验并导入 JSON 文本'}).click();
 const confirmation=page.getByRole('button',{name:'确认导入这批角色'});if(await confirmation.count())await confirmation.click();
 await page.getByRole('button',{name:/星湾记录员/}).click();
 const close=page.getByRole('button',{name:'关闭弹窗'});if(await close.count())await close.click();
 await expect(page.getByRole('textbox',{name:'角色姓名',exact:true})).toHaveValue('星湾记录员');await expect(page.getByRole('button',{name:'更新资料',exact:true})).toBeEnabled();
 await page.getByRole('navigation',{name:'资料分类'}).getByRole('button',{name:'法术',exact:true}).click();await page.getByRole('button',{name:/微光术 Test Glow/}).click();
 await expect(page.locator('.load-errors')).toHaveCount(0);const toast=page.locator('.notice button');if(await toast.count())await toast.click();await page.mouse.move(1910,1070);await page.screenshot({path:'F:/CodexWork/2026-09-27/feedback/suite/public/workbench-preview.png'});
});
