/** Downloadable authoring example; imported packs keep their own source identity. */
export const RULE_PACK_EXAMPLE = {
 schemaVersion:1,id:'homebrew.study',name:'我的扩展 · 编写示例',version:'1.1.0',author:'',editions:['2014','2024'],requires:[],conflicts:[],
 entries:[
  {id:'scholar-notes',name:'学者笔记',kind:'feat',entries:['这是自定义规则示例：智力提高 1，并选择一项知识技能。'],effects:[{op:'add',target:'int',value:1}],choices:[{id:'knowledge',label:'选择一项知识技能',count:1,options:['arcana','history','nature','religion']}]},
  {id:'training-spear',name:'练习矛',english:'Training Spear',kind:'item',entries:['武器示例。重量以磅计，value 以铜币计：100 铜币 = 1 金币。property 使用武器属性代码，正文中的掷骰可写为 {@damage 1d6}。'],raw:{type:'M',weaponCategory:'simple',rarity:'none',weight:3,value:100,dmg1:'1d6',dmg2:'1d8',dmgType:'P',property:['T','V'],range:20,longRange:60}},
  {id:'travel-armor',name:'旅行皮甲',english:'Travel Leather Armor',kind:'item',entries:['轻甲示例，基础 AC 为 11。中甲用 type: MA，重甲用 HA，盾牌用 S；strength 是力量要求，stealth: true 表示隐匿检定劣势。'],raw:{type:'LA',armor:true,ac:11,rarity:'none',weight:10,value:1000}},
  {id:'carving-tools',name:'雕刻工具',english:'Carving Tools',kind:'item',entries:['工匠工具示例。工具类别用 AT，乐器用 INS；不要把工具写成武器。'],raw:{type:'AT',rarity:'none',weight:5,value:1000}},
  {id:'travel-pouch',name:'旅行小袋',english:'Travel Pouch',kind:'item',entries:['普通物品示例。正文、名称和结构化字段分别填写；未声明的自动效果不会由正文推断。魔法物品可填写 rarity，并用 reqAttune: true 或同调条件文本声明同调。'],raw:{type:'G',rarity:'none',weight:1,value:50,reqAttune:false}}
 ]
};
