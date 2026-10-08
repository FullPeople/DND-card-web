import {expect,type Page} from '@playwright/test';

/** Exercise the same area clicks a player uses, including reopening a saved entry. */
export async function customField(page:Page,label:string){
 const input=page.getByLabel(label,{exact:true});
 if(await input.isVisible())return input;
 const edit=page.getByRole('button',{name:'编辑此条目',exact:true});if(await edit.isVisible())await edit.click();
 const area:Record<string,string>={'自定义条目名称':'名称','自定义条目英文名':'英文名','自定义条目类型':'类型','自定义条目版本':'适用版本','自定义条目正文':'正文','物品价格（金币）':'价格（金币）','物品重量（磅）':'重量（磅）','法术环阶':'学派','法术学派':'学派','职业生命骰':'生命骰','施法时间数量':'施法时间','施法时间单位':'施法时间','施法时间条件':'施法时间','材料说明':'法术成分','言语 V':'法术成分','姿势 S':'法术成分','材料 M':'法术成分','持续时间类型':'持续时间','需要专注':'持续时间','怪物 AC':'怪物 AC','怪物平均 HP':'怪物 HP','怪物生命骰':'怪物 HP','怪物体型':'体型、类型与阵营','怪物类型':'体型、类型与阵营','怪物力量属性':'力量'};
 const name=label.startsWith('职业')&&label.endsWith('豁免熟练')?'豁免熟练':area[label];
 if(!name)throw Error(`No canvas area for ${label}`);
 await page.locator('.custom-document').getByRole('button',{name:'修改'+name,exact:true}).click();await expect(input).toBeVisible();return input;
}
