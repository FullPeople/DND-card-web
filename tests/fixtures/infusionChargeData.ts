// Prose-free mechanical projections independently checked against the frozen
// https://5e.kiwee.top/data/ inputs, not copied from the implementation registry:
// class/class-artificer.json c65cad57eebdfff6508a0cfb821ec670a41cc3f057512cadd19f3805cf1a01d7
// optionalfeatures.json 031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844
// items.json 883f7bb4df2eb35fb37e7caa3a8765e0209014caa360d1c0358daa6f4b2da488
// items-base.json 8933a3e70e47aa4fd6196bd7f1f2e3a57d6d8dbe7e781d37bb6a0519d7c4ffff
// Unrelated class features and publisher prose are deliberately absent.
export const infusionChargeData={
 class:[{name:'奇械师',ENG_name:'Artificer',source:'TCE',edition:'classic',hd:{number:1,faces:8},classFeatures:['物品注法|奇械师|TCE|2'],optionalfeatureProgression:[{name:'已知注法',ENG_name:'Infusions',featureType:['AI'],progression:[0,4,4,4,4,6,6,6,6,8,8,8,8,10,10,10,10,12,12,12]}]}],
 classFeature:[{name:'物品注法',ENG_name:'Infuse Item',source:'TCE',className:'奇械师',classSource:'TCE',level:2,entries:[]}],
 optionalfeature:[
  {name:'斥力之盾',ENG_name:'Repulsion Shield',source:'TCE',featureType:['AI'],prerequisite:[{level:{level:6,class:{ENG_name:'Artificer',name:'奇械师',source:'TCE'}},item:['一面盾牌（需要同调）']}],entries:[]},
  {name:'思维砥石',ENG_name:'Mind Sharpener',source:'TCE',featureType:['AI'],prerequisite:[{item:['一套盔甲或法袍']}],entries:[]},
  {name:'增强防御',ENG_name:'Enhanced Defense',source:'TCE',featureType:['AI'],prerequisite:[{item:['一套盔甲或一面盾牌']}],entries:[]},
 ],
 item:[{name:'长袍',ENG_name:'Robes',type:'G',source:'PHB',rarity:'none',weight:4,value:100}],
 baseitem:[{name:'盾牌',ENG_name:'Shield',type:'S',source:'PHB',edition:'classic',rarity:'none',weight:6,value:1000,ac:2},{name:'皮甲',ENG_name:'Leather Armor',type:'LA',source:'PHB',edition:'classic',rarity:'none',ac:11}],
};
