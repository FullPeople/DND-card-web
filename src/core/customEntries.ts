import type {Entry,Kind} from './model';
export const CUSTOM_TYPES:Record<string,{label:string;kind:Kind;category?:string;raw?:Record<string,unknown>}>={
 item:{label:'物品 · 背包',kind:'item'},weapon:{label:'武器 · 背包 / 武器训练',kind:'item',raw:{type:'M',weaponCategory:'simple'}},armor:{label:'护甲 · 背包 / 护甲训练',kind:'item',raw:{type:'LA'}},tool:{label:'工具 · 背包 / 工具训练',kind:'item',raw:{type:'AT'}},
 condition:{label:'状态',kind:'condition'},feature:{label:'特性',kind:'feature'},feat:{label:'专长',kind:'feat'},spell:{label:'法术',kind:'spell'},language:{label:'语言熟练',kind:'rule',category:'language'},weaponProperty:{label:'武器词条',kind:'rule',category:'itemProperty'},weaponMastery:{label:'武器精通',kind:'rule',category:'itemMastery'},
 background:{label:'背景',kind:'background'},race:{label:'种族',kind:'race'},class:{label:'职业',kind:'class'},subclass:{label:'子职',kind:'subclass'},rule:{label:'规则',kind:'rule',category:'variantrule'}
};
export function createCustomEntry(value:{id?:string;name:string;type:string;body:string;raw?:unknown;edition?:Entry['edition'];revision?:string}):Entry{
 const type=CUSTOM_TYPES[value.type];if(!type||!value.name.trim()||value.name.length>160||value.body.length>100000)throw Error('请填写条目名称和有效类型');
 if(value.raw!==undefined&&(!value.raw||typeof value.raw!=='object'||Array.isArray(value.raw)))throw Error('结构字段必须是对象');
 const raw={...(value.raw||{}),...type.raw,_category:type.category,_custom:true,_workbenchCustom:true,_customType:value.type};
 if(value.type!=='weapon')delete (raw as Record<string,unknown>).weaponCategory;
 for(const key of ['weight','value','level'])if(key in raw&&(typeof (raw as any)[key]!=='number'||!Number.isFinite((raw as any)[key])||(raw as any)[key]<0))throw Error(`${key} 必须是非负数`);
 return {id:value.id||`custom:${crypto.randomUUID()}`,name:value.name.trim(),english:value.name.trim(),kind:type.kind,source:'CUSTOM',packId:'custom',edition:value.edition||'both',revision:value.revision||'1',entries:value.body.split(/\n\s*\n/).filter(s=>s.trim()),raw};
}
