import type {Entry,Edition} from '../core/model';
import {EQUIPMENT_TRAINING} from '../core/proficiencyText';

/** Project-authored category handles; identities remain separate for both books. */
export const EQUIPMENT_TRAINING_ENTRIES:Entry[]=(['2014','2024'] as Edition[]).flatMap(edition=>EQUIPMENT_TRAINING.map(([category,name,english,training])=>({id:`dnd-card.weapon-training:${edition}:${category}`,kind:'rule',name,english,source:edition==='2014'?'PHB':'XPHB',edition,packId:'dnd-card.weapon-training',revision:'2',entries:[`装备熟练类别：${name}。拖入角色卡可记录相应训练；具体范围以获得该熟练的来源说明为准。`],raw:{_category:'itemProperty',_trainingCategory:training,...(training==='weapons'?{weaponCategory:category}:{}),_authoredBy:'DND Card 项目整理'}})));
export const WEAPON_TRAINING_ENTRIES=EQUIPMENT_TRAINING_ENTRIES.filter(entry=>['simple','martial'].includes(entry.raw.weaponCategory));
