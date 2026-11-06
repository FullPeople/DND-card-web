import {expect,it} from 'vitest';
import type {Entry,Raw} from '../src/core/model';
import {sourceSpellFilter} from '../src/core/automation/sourceSpellFilter';

function entry(kind:Entry['kind'],name:string,source:string,raw:Raw={},edition:Entry['edition']='both'):Entry{
 return {id:`authored:${kind}:${source}:${name}`,kind,name,english:name,source,edition,packId:['PHB','XPHB'].includes(source)?'kiwee':'kiwee-homebrew',revision:'authored-class-filter-input',entries:[],raw:{name,source,...raw}};
}
const base=()=>entry('class','Wizard','PHB',{},'2014');
const spell=(name:string,source='PHB',raw:Raw={},edition:Entry['edition']='2014')=>entry('spell',name,source,{level:0,school:'A',...raw},edition);
function references(expression:string,catalog:Entry[],edition:'2014'|'2024'='2014'){
 const before=JSON.stringify(catalog),result=sourceSpellFilter(expression,catalog,edition);
 expect(JSON.stringify(catalog)).toBe(before);expect(result.supported).toBe(true);
 if(!result.supported)throw Error(result.reason);return result;
}

it('evaluates a positive class clause against explicit source-qualified base membership',()=>{
 const known=spell('Authored base spell', 'PHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}});
 expect(references('level=0|class=Wizard',[base(),known]).references).toEqual(['Authored base spell|PHB']);
});
it('resolves a lookup class name through aliases of the same class identity',()=>{
 const owner={...base(),name:'法师',english:'Wizard',raw:{name:'法师',ENG_name:'Wizard',source:'PHB'}},known=spell('Authored indexed spell','PHB',{_spellClasses:{PHB:{Wizard:true}}});
 expect(references('class=法师|level=0',[owner,known]).references).toEqual(['Authored indexed spell|PHB']);
});
it('keeps edition-specific class identities separate even when the spell itself matches the character edition',()=>{
 const modern=entry('class','Wizard','XPHB',{},'2024'),right=spell('Authored modern spell','XPHB',{classes:{fromClassList:[{name:'Wizard',source:'XPHB'}]}},'2024'),wrong=spell('Authored wrong class edition','XPHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}},'2024');
 expect(references('class=Wizard',[base(),modern,right,wrong],'2024').references).toEqual(['Authored modern spell|XPHB']);
});
it('retains same-name third-party classes as different sources and honors an explicit source qualifier',()=>{
 const one=entry('class','Authored caster','LLMC',{_homebrew:true}),two=entry('class','Authored caster','LLVESSEL',{_homebrew:true});
 const a=spell('Authored A spell','PHB',{classes:{fromClassList:[{name:'Authored caster',source:'LLMC'}]}}),b=spell('Authored B spell','PHB',{classes:{fromClassList:[{name:'Authored caster',source:'LLVESSEL'}]}});
 expect(references('class=Authored caster (LLMag)',[one,two,a,b]).references).toEqual(['Authored A spell|PHB']);
});
it('accepts a declared source qualifier containing a colon without interpreting it as a range',()=>{
 const owner=entry('class','Authored caster','KT:O',{_homebrew:true}),known=spell('Authored colon-source spell','PHB',{classes:{fromClassList:[{name:'Authored caster',source:'KT:O'}]}});
 expect(references('class=Authored caster (KT:O)',[owner,known]).references).toEqual(['Authored colon-source spell|PHB']);
});
it('ORs semicolon class alternatives while retaining the other filter clauses',()=>{
 const second=entry('class','Cleric','PHB',{},'2014');
 const first=spell('Authored arcane spell','PHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}}),other=spell('Authored divine spell','PHB',{classes:{fromClassList:[{name:'Cleric',source:'PHB'}]}}),excluded=spell('Authored higher spell','PHB',{level:1,classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}});
 expect(references('class=Wizard;Cleric|level=0',[base(),second,first,other,excluded]).references).toEqual(['Authored arcane spell|PHB','Authored divine spell|PHB']);
});
it('uses explicit class spell additions without borrowing a same-name spell from another source',()=>{
 const owner=entry('class','Authored caster','LLMC',{_homebrew:true,classSpells:['Authored added spell|PHB']}),known=spell('Authored added spell'),other=spell('Authored added spell','XPHB',{},'2024');
 expect(references('class=Authored caster (LLMag)',[owner,known,other]).references).toEqual(['Authored added spell|PHB']);
});
it('copies only the explicitly declared source-qualified base class list',()=>{
 const owner=entry('class','Authored caster','LLMC',{_homebrew:true,classSpells:[{className:'Wizard',classSource:'PHB'}]}),modern=entry('class','Wizard','XPHB',{},'2024');
 const known=spell('Authored copied spell','PHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}}),wrong=spell('Authored other-source list','PHB',{classes:{fromClassList:[{name:'Wizard',source:'XPHB'}]}});
 expect(references('class=Authored caster (LLMag)',[owner,base(),modern,known,wrong]).references).toEqual(['Authored copied spell|PHB']);
});
it('matches a declared spell-group addition by both group name and source',()=>{
 const owner=entry('class','Authored caster','LLMC',{_homebrew:true,classSpells:[{groupName:'Authored group',groupSource:'AGROUP'}]});
 const known=spell('Authored group spell','PHB',{groups:[{name:'Authored group',source:'AGROUP'}]}),wrong=spell('Authored other group spell','PHB',{groups:[{name:'Authored group',source:'BGROUP'}]});
 expect(references('class=Authored caster (LLMag)',[owner,known,wrong]).references).toEqual(['Authored group spell|PHB']);
});
it('keeps optional-only membership visibly unresolved while offering verified base choices',()=>{
 const known=spell('Authored base option','PHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}}),optional=spell('Authored optional option','PHB',{classes:{fromClassListVariant:[{name:'Wizard',source:'PHB',definedInSource:'LLMC'}]}});
 const result=references('class=Wizard',[base(),known,optional]);expect(result.references).toEqual(['Authored base option|PHB']);expect(result).toMatchObject({incomplete:true,reason:expect.any(String)});
});
it('preserves an unresolved class clause and never treats a comma as an unverified OR separator',()=>{
 const known=spell('Authored base spell','PHB',{classes:{fromClassList:[{name:'Wizard',source:'PHB'}]}});
 expect(sourceSpellFilter('class=Unavailable',[base(),known],'2014').supported).toBe(false);
 expect(sourceSpellFilter('class=Wizard,Cleric',[base(),known],'2014').supported).toBe(false);
});
it('does not claim a complete result for a class-list copy cycle',()=>{
 const one=entry('class','Authored one','LLMC',{_homebrew:true,classSpells:[{className:'Authored two',classSource:'LLMC'}]}),two=entry('class','Authored two','LLMC',{_homebrew:true,classSpells:[{className:'Authored one',classSource:'LLMC'}]});
 const result=sourceSpellFilter('class=Authored one (LLMag)',[one,two,spell('Authored unrelated spell')],'2014');
 if(result.supported){expect(result.references).toEqual([]);expect(result).toMatchObject({incomplete:true,reason:expect.any(String)});}else expect(result.reason).toBeTruthy();
});
