import {afterPaint} from './afterPaint';
import {preloadModules,type PreloadTask} from './preloadQueue';
const tools:PreloadTask[]=[
 {name:'角色各页',load:()=>import('../ui/CharacterPages')},
 {name:'法术页',load:()=>import('../ui/SpellsPage')},
 {name:'背包页',load:()=>import('../ui/InventoryPage')},
 {name:'场景背包',load:()=>import('../ui/StockBoard')},
 {name:'生命值',load:()=>import('../ui/HitPointEditor')},
 {name:'快捷栏',load:()=>import('../ui/QuickbarManager')},
 {name:'资源面板',load:()=>import('../ui/ResourceDashboard')},
 {name:'资源编辑',load:()=>import('../ui/ResourceModuleEditor')},
 {name:'法术能力',load:()=>import('../ui/SpellAbilityEditor')},
 {name:'自动化设置',load:()=>import('../ui/AutomationPanel')},
 {name:'角色簿',load:()=>import('../ui/CharacterManager')},
 {name:'规则设置',load:()=>import('../ui/RuleOptions')},
 {name:'来源设置',load:()=>import('../ui/SourceSettings')},
 {name:'房间规则',load:()=>import('../ui/RoomRulesSummary')},
 {name:'导入导出',load:()=>import('../ui/TransferPanel')},
 {name:'审卡',load:()=>import('../ui/CharacterReview')},
 {name:'自定义条目',load:()=>import('../ui/PersonalEntries')},
 {name:'旧卡核对',load:()=>import('../ui/CardMigration')},
];
let started=false;
const start=()=>{
 if(started||new URLSearchParams(location.search).get('legacyViewer')==='1')return;
 started=true;
 afterPaint(()=>{void preloadModules(tools,result=>window.dispatchEvent(new CustomEvent('dnd-card-tool-warm',{detail:result}))).then(()=>window.dispatchEvent(new Event('dnd-card-tools-warm')));});
};
window.addEventListener('dnd-card-ready',start,{once:true});
