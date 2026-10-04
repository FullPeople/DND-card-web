// Authored text with the real upstream schema: category O in feat data and
// category=o in the race's declared filter. No publisher prose or player data.
export const originFeatData={
 race:[{name:'验收旅人',ENG_name:'Fixture Traveller',source:'XPHB',edition:'one',feats:[{anyFromCategory:{category:['O'],count:1}}],entries:[
  {type:'entries',name:'起源选择验收',ENG_name:'Fixture Versatility',entries:['选择一项{@filter 起源候选|feats|category=o}。']},
 ]}],
 feat:[
  {name:'验收警觉',ENG_name:'Fixture Alert',source:'XPHB',category:'O',entries:['原创起源专长。']},
  {name:'验收艺能',ENG_name:'Fixture Skills',source:'XPHB',category:'O',repeatable:true,skillProficiencies:[{choose:{from:['athletics','perception','history'],count:2}}],entries:['原创嵌套熟练选择。']},
  {name:'验收通用',ENG_name:'Fixture General',source:'XPHB',category:'G',prerequisite:[{level:4}],entries:['原创通用专长。']},
  {name:'验收警觉',ENG_name:'Fixture Alert',source:'PHB',category:'O',entries:['原创旧版同名条目。']},
  {name:'验收未分类',ENG_name:'Fixture Uncategorized',source:'XPHB',entries:['原创无类别条目。']},
 ],
};
