import {newCharacter,type Entry,type Character} from '../../src/core/model';
import {newAutomationState} from '../../src/core/automation/state';

/** Original software fixtures describe current product policy, not publisher rule clauses. */
export function equipmentAcCard(edition:'2014'|'2024',entries?:Entry[]):Character{
 const source=edition==='2014'?'PHB':'XPHB',c=newCharacter(edition);
 c.name='AC定向验收 '+edition;c.automation=newAutomationState();c.abilities.dex=16;
 c.training={armor:'中甲、重甲、盾牌',weapons:'手工武器记录'};
 c.runtime.hp=7;c.runtime.tempHp=2;c.runtime.resources={manual:{name:'手工剩余次数',current:1,max:4}};
 c.answers={'manual-note':['原创手工记录']};
 c.inventory={view:'grid',order:[],attunementLimit:3,coins:{gp:7,cp:0,sp:0,ep:0,pp:0}};
 const items=entries||[{name:'AC验收重甲',type:'HA',ac:16},{name:'AC验收中甲',type:'MA',ac:14},{name:'AC验收盾牌',type:'S',ac:2}].map(raw=>({id:'authored-ac:'+edition+':'+raw.type,kind:'item' as const,name:raw.name,english:'Authored '+raw.type,source,edition,packId:'authored-test',revision:'authored-ac-directed',entries:[],raw:{...raw,source}}));
 c.selections=items.filter(entry=>entry.edition===edition).map(entry=>({id:entry.raw.type.startsWith('HA')?'heavy':entry.raw.type.startsWith('MA')?'medium':'shield',entry,quantity:entry.raw.type.startsWith('S')?5:1,level:1,equipped:false}));
 return c;
}
