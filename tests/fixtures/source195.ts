// Deliberately shared names and reordered copy parents reproduce edition ambiguity.
export const source195={
 class:[{name:'测试祭司',source:'XPHB',hd:{faces:8},spellcastingAbility:'wis',casterProgression:'full',classFeatures:['起始法术|测试祭司|XPHB|1','试炼抉择|测试祭司|XPHB|1']}],
 classFeature:[
  {name:'起始法术',source:'XPHB',className:'测试祭司',classSource:'XPHB',level:1,entries:['软件验收正文。']},
  {name:'试炼抉择',source:'XPHB',className:'测试祭司',classSource:'XPHB',level:1,entries:['选择下列其中一项：',{type:'entries',entries:[{type:'options',count:1,entries:[{type:'refClassFeature',classFeature:'守方|测试祭司|XPHB|1|XPHB'},{type:'refClassFeature',classFeature:'攻方|测试祭司|XPHB|1|XPHB'}]}]}]},
  {name:'守方',source:'XPHB',className:'测试祭司',classSource:'XPHB',level:1,entries:['以盾护身。']},
  {name:'攻方',source:'XPHB',className:'测试祭司',classSource:'XPHB',level:1,entries:['以矛制敌。']},
 ],
 subclass:[
  {name:'镜之路',shortName:'镜',source:'PHB',className:'测试祭司',classSource:'XPHB',_copy:{name:'镜之路',source:'PHB',className:'测试祭司',classSource:'PHB'},subclassFeatures:['旧影|测试祭司|XPHB|镜||3']},
  {name:'镜之路',shortName:'镜',source:'PHB',className:'测试祭司',classSource:'PHB',entries:['原版介绍'],subclassFeatures:['旧影|测试祭司||镜||2']},
  {name:'镜之路',shortName:'镜',source:'XPHB',className:'测试祭司',classSource:'XPHB',subclassFeatures:['新影|测试祭司|XPHB|镜|XPHB|3']},
 ],
 subclassFeature:[
  {name:'旧影',source:'PHB',className:'测试祭司',classSource:'XPHB',subclassShortName:'镜',subclassSource:'PHB',level:3,_copy:{name:'旧影',source:'PHB',className:'测试祭司',classSource:'PHB',subclassShortName:'镜',subclassSource:'PHB',level:2}},
  {name:'旧影',source:'PHB',className:'测试祭司',classSource:'PHB',subclassShortName:'镜',subclassSource:'PHB',level:2,entries:['独立的旧版正文。']},
  {name:'新影',source:'XPHB',className:'测试祭司',classSource:'XPHB',subclassShortName:'镜',subclassSource:'XPHB',level:3,entries:['新版总述。',{type:'entries',name:'子段甲',ENG_name:'Part A',entries:['第一段说明。']},{type:'entries',name:'子段乙',entries:['第二段说明。']},{type:'entries',name:'子段丙',entries:['第三段说明。']}]},
 ]
};
