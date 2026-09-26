import type {Entry,Raw} from './model';

export type SpellLearner={name:string;source:string;kind:string;reference:string};
export type SpellLearnerGroup={label:string;learners:SpellLearner[]};
/** Source lookup is descriptive only: it never grants a spell or overrides a rule profile. */
export function spellLearners(entry:Entry):SpellLearnerGroup[]{
  if(entry.kind!=='spell')return [];
  const raw=entry.raw,lookup=raw._spellSources||{class:raw._spellClasses},groups:SpellLearnerGroup[]=[];
  const add=(label:string,name:string,source:string,kind:string,reference=`${name}|${source}`)=>{
    if(!name)return;
    let group=groups.find(g=>g.label===label);if(!group){group={label,learners:[]};groups.push(group);}
    if(!group.learners.some(v=>v.kind===kind&&v.reference===reference))group.learners.push({name,source,kind,reference});
  };
  for(const [field,label,kind] of [['class','职业','class'],['classVariant','职业（扩展法术表）','class'],['race','种族','race'],['background','背景','background'],['feat','专长','feat'],['optionalfeature','可选特性','optfeature'],['reward','特殊奖励','reward']]){
    for(const [source,names] of Object.entries(lookup?.[field]||{}))for(const name of Object.keys(names as Raw))add(label,name,source,kind);
  }
  for(const [classSource,classes] of Object.entries(lookup?.subclass||{}))for(const [className,sources] of Object.entries(classes as Raw))for(const [source,names] of Object.entries(sources as Raw))for(const [shortName,detail] of Object.entries(names as Raw)){
    const name=(detail as Raw)?.name||shortName;
    add('子职',`${className}：${name}`,source,'class',`${className}|${classSource}|${className}：${name}|${shortName}|${source}`);
  }
  for(const [field,label] of [['fromClassList','职业'],['fromClassListVariant','职业（扩展法术表）']])for(const item of raw.classes?.[field]||[])add(label,item.name,item.source||'PHB','class');
  for(const item of raw.classes?.fromSubclass||[]){const c=item.class,s=item.subclass;if(c&&s)add('子职',`${c.name}：${s.name}`,s.source||'PHB','class',`${c.name}|${c.source||'PHB'}|${c.name}：${s.name}|${s.shortName||s.name}|${s.source||'PHB'}`);}
  for(const [field,label,kind] of [['races','种族','race'],['backgrounds','背景','background'],['feats','专长','feat'],['optionalfeatures','可选特性','optfeature']])for(const item of raw[field]||[])if(item.name)add(label,item.name,item.source||'PHB',kind);
  return groups;
}
