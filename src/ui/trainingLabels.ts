// Basic equipment names match the catalog's Chinese labels. Readers keep this
// small display-only glossary instead of downloading the entire equipment wiki.
// A resolved entry or an explicit user caption always takes precedence.
const weapons:Record<string,string>={
 battleaxe:'战斧',blowgun:'吹箭筒',club:'短棒',dagger:'匕首',dart:'飞镖',flail:'链枷',glaive:'长柄刀',greataxe:'巨斧',greatclub:'巨棒',greatsword:'巨剑',halberd:'长戟',
 'hand crossbow':'手弩',handaxe:'手斧','heavy crossbow':'重弩',javelin:'标枪',lance:'骑枪','light crossbow':'轻弩','light hammer':'轻锤',longbow:'长弓',longsword:'长剑',
 mace:'硬头锤',maul:'巨锤',morningstar:'钉头锤',net:'捕网',pike:'长矛',quarterstaff:'长棍',rapier:'刺剑',scimitar:'弯刀',shortbow:'短弓',shortsword:'短剑',sickle:'镰刀',sling:'投石索',spear:'矛',trident:'三叉戟','war pick':'战镐',warhammer:'战锤',whip:'鞭子',
};
const tools:Record<string,string>={
 "alchemist's supplies":'炼金工具',"brewer's supplies":'酿酒工具',"calligrapher's supplies":'书法工具',"carpenter's tools":'木匠工具',"cartographer's tools":'制图工具',"cobbler's tools":'鞋匠工具',"cook's utensils":'厨师工具',"glassblower's tools":'玻璃匠工具',"jeweler's tools":'珠宝匠工具',"leatherworker's tools":'皮匠工具',"mason's tools":'石匠工具',"painter's supplies":'画家工具',"potter's tools":'陶匠工具',"smith's tools":'铁匠工具',"tinker's tools":'修补工具',"weaver's tools":'织布工具',"woodcarver's tools":'木雕工具',
 bagpipes:'风笛',drum:'鼓',dulcimer:'扬琴',flute:'长笛',horn:'号角',lute:'鲁特琴',lyre:'里拉琴','pan flute':'排箫',shawm:'芦笛',viol:'提琴',
};
export function fallbackTrainingLabel(value:string,group?:string,source='PHB'):string|undefined{
 if(!['PHB','XPHB'].includes(source.toUpperCase()))return undefined;
 const name=value.trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ');
 return (group==='weapons'?weapons:group==='tools'?tools:{} as Record<string,string>)[name];
}
