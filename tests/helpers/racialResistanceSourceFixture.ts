import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCatalogData} from '../../src/data/catalog';
import {hydrateSpellLookup} from '../../src/data/spellLookup';
import type {Entry} from '../../src/core/model';

// Immutable, exact-source IO only. Consumers must clone retained full entries.
export const racialResistancePin={url:'https://5e.kiwee.top/data/races.json',sha256:'a9289aaafcc24674d632b3daafc93eace5bf4496c66c9f5482a6baf304473712',bytes:451902}as const;
type Form='canonical'|'app';
type RawHeader={name:string;ENG_name:string;source:string;page?:number;edition?:string;raceName?:string;raceSource?:string};
type Parent={path:string;header:RawHeader;rawSha256:string};
export interface RacialResistanceSpec {key:string;sourcePath:string;header:RawHeader;rawSha256:string;resistances:readonly string[];clause:{path:string;utf8Bytes:number;sha256:string};parent?:Parent}
const parent=(path:string,name:string,english:string,source:string,page:number,rawSha256:string):Parent=>({path,header:{name,ENG_name:english,source,page},rawSha256});
const elf=parent('race/38','精灵','Elf','PHB',21,'5754e3320cc451ca113b28023ef3f14e225101274f407fe692482eb942b44672');
const genasiEepc=parent('race/48','元素裔','Genasi','EEPC',9,'0c69ea064f7a3d2bc72d9a462c3c7b3a9b2cda26e01a85d3728d88e46eec7d54');
const genasiMpmm=parent('race/49','元素裔','Genasi','MPMM',16,'142edceccac9117be031ba56e0e134793c3a24906ef63028474e766711c24523');
const halfElf=parent('race/71','半精灵','Half-Elf','PHB',38,'fccec19eafe587b6b3759d1dd1bbc6838fde8c3dd63e8c90e1dc89a717734fc8');
const halfling=parent('race/73','半身人','Halfling','PHB',26,'a85a098e369e1e35be88fb62d6736f140a7c6ac43c5e759ace5586f0d2d2199e');
const dragonborn=parent('race/27','龙裔','Dragonborn','PHB',32,'4495fc7c6fea0dbef2a3822a8011cdfcc6fbdeb9189bd29ff10d65bd7658b6cd');
const goblin=parent('race/62','地精','Goblin','PSZ',16,'fb7e22cbce55a844f0be02948a76fdd16db02e507aca36152ccb45463fe23c5e');
const hashes={dual:'47c4598056500e44746cc76746b05e25ea7df10f00d5449fe7cd5aedb1caab8e',necrotic:'d73bbf01d8ebc67523c50bbcada7d93d59d71fcd6a377e4a40a3d61edd9b15c8',fire:'0c88388c1805c6d6bdee080d6728f2f45b1e89153cbb0d7dabc42f9645c314fc',acid:'9ef5ea3d39626e630ee1acf5818e3a379f9defa40b26fce344eb61dc2f27519c',lightning:'d182ef60d93a99a5689751cc6620e1eb5c67bfff54b3f476d2e673975b7d9069',psychic:'3ab2a68045387edc02a7a9d37f46787cca673c9bce596649ddf9c03a7073b063',poison:'aee47d00c384413d7e2e7eb43b6ecf96f4fff71f3f3417763f1fc31b771210a9',resilience:'b0fd6ca87e2771232e07fd85b056ee9bfdce547c83cf72265ef0f323b04db36c'}as const;
function spec(key:string,name:string,english:string,source:string,page:number|undefined,rawSha256:string,resistances:readonly string[],clauseSuffix:string,utf8Bytes:number,sha256:string,parent?:Parent,edition?:string):RacialResistanceSpec{return{key,sourcePath:key,header:{name,ENG_name:english,source,...(page===undefined?{}:{page}),...(edition?{edition}:{}),...(parent?{raceName:parent.header.name,raceSource:parent.header.source}:{})},rawSha256,resistances,clause:{path:key+'/'+clauseSuffix,utf8Bytes,sha256},...(parent?{parent}:{})};}
// These are the 38 explicit source candidates, not 38 invented normalized IDs.
export const racialResistanceSpecs:readonly RacialResistanceSpec[]=[
 spec('race/3','阿斯莫','Aasimar','DMG',286,'ed5d85850e611714e78547c8c01f39962321fe13b68fcdea516f732944f2a7f4',['necrotic','radiant'],'entries/3/entries/0',42,hashes.dual),
 spec('race/4','阿斯莫','Aasimar','MPMM',7,'a18a8ae981a4deeb44648498073c4576daf491435e39934e8c92834aa3d2c845',['necrotic','radiant'],'entries/1/entries/0',42,hashes.dual),
 spec('race/5','阿斯莫','Aasimar','VGM',104,'e3a57bc345e934cca5555719944e027f920852b6110136a92bc545a6b7be344d',['necrotic','radiant'],'entries/3/entries/0',42,hashes.dual),
 spec('race/6','阿斯莫','Aasimar','XPHB',186,'28f8e9a745e128a55e68e2441fb19977f7ff556546bb6bb34fe1570d03d14c2f',['necrotic','radiant'],'entries/0/entries/0',62,'796184d983e89de194e7f1cc1593c6286639f1967dc7a3872ff4d8e34e384426',undefined,'one'),
 spec('race/7','乙太种','Aetherborn','PSK',17,'8f62d5b65f8ee52d5ec23a927befdfc4ae68320ef193e3f7deef41bfc119d33c',['necrotic'],'entries/4/entries/0',33,hashes.necrotic),
 spec('race/9','自动侏儒','Autognome','AAG',11,'a3c2a1a6d1fbbc8048e1c437ed9ccc085e005757edae7188dd46237e190fb6aa',['poison'],'entries/4/entries/0',173,'2106c412f6eac6960ff128aa65158d05a24e9d1a6d345fe57e6e28c79be7e05a'),
 spec('race/25','半血裔','Dhampir','RHW',28,'ea3df054941fca7c05a7a9dea553ea3949df6e38d9501ff8aef52a24b94c3137',['necrotic'],'entries/2/entries/0',56,'b6fbb866fd57fc08cfd8470541b595b7dfaf9b917417cd6c2a129a943446ba62'),
 spec('race/32','灰矮人','Duergar','MPMM',12,'1f0ad6893399804bda473cce9c1e4e3ecb2fb6756605fc002d9f39842d6edf9e',['poison'],'entries/3/entries/0',127,hashes.resilience),
 spec('race/33','矮人','Dwarf','PHB',18,'6e51d570accc43fb4d42da125c6268a80c1676b7af17f80b52ec0c16d2f5d5c0',['poison'],'entries/4/entries/0',87,hashes.poison),
 spec('race/34','矮人','Dwarf','XPHB',188,'a334dc252c549c6a78c4e4878e77f722fb20ee93ec1a13ea0399151853270e96',['poison'],'entries/1/entries/0',167,'9b4ddfadab7624b8aa3c6cc88da6190ce57702daa1490491af346195dfe01709',undefined,'one'),
 spec('race/35','矮人 (卡拉德许)','Dwarf (Kaladesh)','PSK',19,'29897be4c84c2fd3e2118aa04403e838c6a7ede0509fe0833c0e0362282fbed1',['poison'],'entries/5/entries/0',87,hashes.poison),
 spec('race/52','吉斯洋基人','Githyanki','MPMM',18,'775b9d7c7d7b23505c04d3a94a41b43b984f7a87e42017515be4b5c5dc35b1ce',['psychic'],'entries/2/entries/0',33,hashes.psychic),
 spec('race/53','吉斯泽莱人','Githzerai','MPMM',19,'7c6d02f8a5c75afdafc19561d22522826bafbff807fb8a6753279363b25b0ccf',['psychic'],'entries/2/entries/0',33,hashes.psychic),
 spec('race/62','地精','Goblin','PSZ',16,'fb7e22cbce55a844f0be02948a76fdd16db02e507aca36152ccb45463fe23c5e',['fire','psychic'],'entries/5/entries/0',137,'1ee23b5d69950ae2e39bb268b8324a399090fda750f18b843e78fdd6124955ef'),
 spec('race/65','歌利亚','Goliath','MPMM',21,'d141f667825f4e353c844e38c3976988688403905891ee00277f9f4c0af0ac49',['cold'],'entries/1/entries/0',141,'fc886dbc5f265dc92dd75da174e489c902e14ecc82ae15d700ad042ed1eadd89'),
 spec('race/66','歌利亚','Goliath','VGM',108,'c6af3ee9e70bebb9836449ef00ae18dfd2627a6cfff4d8ef8020b34174b4afea',['cold'],'entries/5/entries/0',114,'beec626d5965db1f57fbda6a4089a7bad1e7ec9cf611ced44a9eb85931c48731'),
 spec('race/89','离梦人','Kalashtar','EFA',35,'c099eb346a0dea0f4200b635efd8968fa22061746c79212fc268569311a627b9',['psychic'],'entries/1/entries/0',56,'a5f88b78c6fd9005482da5fbb48d84ba1a54b06160428c29f760f5303c7145c8',undefined,'one'),
 spec('race/90','离梦人','Kalashtar','ERLW',29,'d8155d1cf7c2caf422f00e6b969ea6952d66d7f8e1be3afebcb680ce36dfe72a',['psychic'],'entries/4/entries/0',33,hashes.psychic),
 spec('race/126','流浆体','Plasmoid','AAG',14,'efb1c34743ac390ef1fa4139520281fdfa473dfece5c9bc53f6932a8c5d857e3',['acid','poison'],'entries/5/entries/0',115,'c45c6c87f9fad3d56dfd535d24af66813c5df37fc705c7aac699099be098cd44'),
 spec('race/128','重生者','Reborn','VRGR',20,'a60aa205d435b1dd08dfaf57b0b091c6f2bc4fcac48ce6c8e4cd85365729dfd2',['poison'],'entries/2/entries/1/items/0',106,'9335232468f973d719b90bc5517bc8f28a77298634a5a8cf1fd9d5296f4bc2b5'),
 spec('race/129','霜身','Rimekin','LFL',undefined,'d17cc04b3ee8a3b0ed8e4a9377db615c756ed523bfdca5034ff16fe1205fa5ed',['cold'],'entries/1/entries/0',53,'13d5aaa37d3c73f4ab5e2a5009ba9e30777805c81a9c154bc74bb0c4a17cfc4a'),
 spec('race/132','海精灵','Sea Elf','MPMM',30,'f17035e004edfecacc266f06aa337f2eb1e1a0481ed0f82178d835846c3a9252',['cold'],'entries/2/entries/0',72,'367aeab5a6a9bcd27a2bdfc0f46a3addebfda8ab7787d17319faea98f5b201c9'),
 spec('race/133','影灵','Shadar-Kai','MPMM',31,'21d34ddf3061972627871007cf0092669f9dbe69b6d10e71c01d4cff494cd9e4',['necrotic'],'entries/5/entries/0',33,hashes.necrotic),
 spec('race/143','提夫林','Tiefling','PHB',42,'e9d347c21b6ceee4254a739d7c57792e4270630072b88f4d66cf926bb7a40a3f',['fire'],'entries/3/entries/0',33,hashes.fire),
 spec('race/148','梭螺鱼人','Triton','MPMM',35,'d56260c31e80889280743aea0b2f5daab504fdff41a7d81c7d4fc46c9e297fc6',['cold'],'entries/5/entries/0',72,'87445164ec3c9863d6b26035cd80f0fc38cff79531760077e7790b8817448a15'),
 spec('race/149','梭螺鱼人','Triton','VGM',115,'9f0ee0c8d0739f6aff471f109e854e2f0a56c924100162b5bdf6388e154c02ef',['cold'],'entries/7/entries/0',69,'059f9bab9da4da1e5e6bbd7aa749f5599cbdb4ee7214fd9224dd237485d1a032'),
 spec('race/151','吸血鬼','Vampire','PSZ',14,'64ede6a49962763969d026585747ed180bd9016b328c0fd3668b7f5fd110b636',['necrotic'],'entries/6/entries/0',33,hashes.necrotic),
 spec('race/155','战俑','Warforged','EFA',38,'a36f98d3a9d2437eec208f01bf8c82deaaf3dc6d02c9335b7fdbadacb080c443',['poison'],'entries/0/entries/0',160,'b1abb5a6a9aef02cf67a7b779332410cc9fb1a44c965e013075c714801b15965',undefined,'one'),
 spec('race/156','战俑','Warforged','ERLW',35,'51e15bf12aabea5352c186c918ddbcb5c433fe8cc64940654416cd9d173e0aff',['poison'],'entries/3/entries/1/items/0',97,'d05eab739247a3d64c37510bce04c2add10106120141efa143c0cfd61d3ebe17'),
 spec('race/157','蛇人','Yuan-Ti','MPMM',36,'49a49bde4fece787bd9cc2118cd57311a1112b94abe34bdba7743901a1699fd9',['poison'],'entries/3/entries/0',127,hashes.resilience),
 spec('subrace/20','影灵','Shadar-kai','MTF',62,'05cd4fee20227e09651000b082e75ce87a01178bcd6ccaf48d08f8322fb5f096',['necrotic'],'entries/0/entries/0',33,hashes.necrotic,elf),
 spec('subrace/29','火','Fire','EEPC',9,'84d5466b5f0c99e770e1428e3269de0d9f6b0820af9515b20df52f70a2ba061e',['fire'],'entries/1/entries/0',33,hashes.fire,genasiEepc),
 spec('subrace/30','水','Water','EEPC',10,'8e10806e1707368eb70668ae41dca22404064fbcb58daad8d28a5f5cfd735e31',['acid'],'entries/0/entries/0',33,hashes.acid,genasiEepc),
 spec('subrace/31','气','Air','MPMM',16,'190144af3a1c898a0bd7d7cb395f35db1e10913fddc1729e9ce9bdb3d93b8e75',['lightning'],'entries/1/entries/0',33,hashes.lightning,genasiMpmm),
 spec('subrace/33','火','Fire','MPMM',17,'b6a6bc3e3866ab7fd8e958adfbf141a2f890db8529a97ab9a43798f1e1812769',['fire'],'entries/0/entries/0',33,hashes.fire,genasiMpmm),
 spec('subrace/34','水','Water','MPMM',17,'6cd5343d6a21c2646a09b82fa91a7e469302b0fa4216baa42bef8b28a7af4cc3',['acid'],'entries/1/entries/0',33,hashes.acid,genasiMpmm),
 spec('subrace/50','变体; 暴风龙纹','Variant; Mark of Storm','ERLW',50,'b071038be951a9bce0f7a70595a80a7abec373f85ba880a38d5ee4381a9491fc',['lightning'],'entries/1/entries/0',33,hashes.lightning,halfElf),
 spec('subrace/60','敦实','Stout','PHB',28,'39f6d68472f690acfa20534cab26ed7bd705999bbf5f684a63042bd5de2033ca',['poison'],'entries/0/entries/0',87,hashes.poison,halfling),
];
type HeldSpec={key:string;header:RawHeader;rawSha256:string;reasonCode:string;parent?:Parent};
const heldChoice='ancestry-or-damage-type-choice-not-executed';
const heldNull='explicit-null-resist-override-no-parent-fallback';
const heldSpecs:readonly HeldSpec[]=[
 {key:'race/27',header:dragonborn.header,rawSha256:dragonborn.rawSha256,reasonCode:heldChoice},
 {key:'race/28',header:{name:'龙裔',ENG_name:'Dragonborn',source:'XPHB',edition:'one',page:187},rawSha256:'dcd92857702bc606c87be2d95e610e8dd25a13a5f05d4128d6afe1640defa2a5',reasonCode:heldChoice},
 {key:'race/29',header:{name:'龙裔 (色彩)',ENG_name:'Dragonborn (Chromatic)',source:'FTD',page:10},rawSha256:'eef403fa14578bca2c37a6e8bd5f70705bb188c6846c06b66aaeec810f82a744',reasonCode:heldChoice},
 {key:'race/30',header:{name:'龙裔 (宝石)',ENG_name:'Dragonborn (Gem)',source:'FTD',page:11},rawSha256:'0881086f31350ef2cbb1f5b198d86fde72cce9d4ef15a7963f5337676ec43a3a',reasonCode:heldChoice},
 {key:'race/31',header:{name:'龙裔 (金属)',ENG_name:'Dragonborn (Metallic)',source:'FTD',page:12},rawSha256:'856a2b6390824d8bb4921252a058ae66ee20faf3248cbc3da4416afd23d0d707',reasonCode:heldChoice},
 {key:'race/127',header:{name:'重生者',ENG_name:'Reborn',source:'RHW',edition:'one',page:31},rawSha256:'038cf0d771a726c029213dda2b56663d4ef03c193c19d20819b7a6c8f8004cae',reasonCode:heldChoice},
 {key:'race/144',header:{name:'提夫林',ENG_name:'Tiefling',source:'XPHB',edition:'one',page:197},rawSha256:'847157775f0365c3a1deec98491c0c7da5526305fb4e7d5fd8737e1dc5dc028f',reasonCode:heldChoice},
 {key:'subrace/7',header:{name:'龙血裔',ENG_name:'Draconblood',source:'EGW',page:168,raceName:'龙裔',raceSource:'PHB'},rawSha256:'4aae3822d6463af64efb49ebd76bc37d2b3d8e4ebb8e1ef8407c85105cf071b8',reasonCode:heldNull,parent:dragonborn},
 {key:'subrace/8',header:{name:'峡谷裔',ENG_name:'Ravenite',source:'EGW',page:168,raceName:'龙裔',raceSource:'PHB'},rawSha256:'946f8129c12fcaebff909e08c71a563678884b87b2c2ebf66107f27a175dd8e1',reasonCode:heldNull,parent:dragonborn},
 {key:'subrace/42',header:{name:'依夏兰',ENG_name:'Ixalan',source:'PSX',page:16,raceName:'地精',raceSource:'PSZ'},rawSha256:'9a3366a5b0ff75d4d2d9f5b081a7bbc4509389fa3eae328eaea5a4fbc6642720',reasonCode:heldNull,parent:goblin},
 {key:'race/47',header:{name:'炎身',ENG_name:'Flamekin',source:'LFL'},rawSha256:'7cac3f99f6d1e744bdb7f4e6df014158754a72e89ecf0ab33b88eaa26c464072',reasonCode:'copied-source-outside-explicit-native-family'},
];
const inheritedKeys=['subrace/1','subrace/2','subrace/3','subrace/9','subrace/10','subrace/11','subrace/12','subrace/43','subrace/44','subrace/45','subrace/82','subrace/83','subrace/84','subrace/85','subrace/86','subrace/87','subrace/88','subrace/89','subrace/90','subrace/91','subrace/92','subrace/93','subrace/94','subrace/95','subrace/96','subrace/97'];
const versionKeys=['race/4/_versions/0','race/4/_versions/1','race/4/_versions/2','race/7/_versions/0'];
const sorted=(value:any):any=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,sorted(value[key])])):value;
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const racialResistanceSnapshot=(value:unknown)=>digest(JSON.stringify(sorted(value)));
const fail:(code:string)=>never=code=>{throw Error('RACIAL_RESISTANCE_SOURCE_'+code);};
const at=(value:any,path:string):any=>path.split('/').reduce((row,key)=>row?.[key],value);
// Closed expected-source vocabulary only. This checks original localized tags
// against already-qualified clauses; it never rewrites any source/Entry field
// or grants authority from a live raw tag.
const expectedLiteralTags=Object.freeze({acid:'强酸',cold:'寒冷',fire:'火焰',lightning:'闪电',necrotic:'暗蚀',poison:'毒素',psychic:'心灵',radiant:'光耀'}as const);
export function racialResistanceLiteralTags(types:readonly string[]):string[]{return types.map(type=>{if(!Object.hasOwn(expectedLiteralTags,type))fail('UNKNOWN_SOURCE_DAMAGE_TYPE');return expectedLiteralTags[type as keyof typeof expectedLiteralTags];});}

function boundary(){const key=Symbol.for('dnd.offlineCatalogFetch.v1'),descriptor=Object.getOwnPropertyDescriptor(globalThis,key),guard=(globalThis as any)[key];if(!descriptor||descriptor.writable!==false||descriptor.configurable!==false||!Object.isFrozen(guard)||guard.version!==1||globalThis.fetch!==guard.deny||!Array.isArray(guard.unexpected)||guard.unexpected.length)fail('STARTUP_BOUNDARY');}
const rawHeader=(raw:Record<string,any>)=>({name:raw.name,ENG_name:raw.ENG_name,source:raw.source,...(raw.page===undefined?{}:{page:raw.page}),...(raw.edition===undefined?{}:{edition:raw.edition}),...(raw.raceName===undefined?{}:{raceName:raw.raceName}),...(raw.raceSource===undefined?{}:{raceSource:raw.raceSource})});
const header=(entry:Entry)=>({id:entry.id,kind:entry.kind,name:entry.name,english:entry.english,source:entry.source,edition:entry.edition,packId:entry.packId,page:entry.page??null,category:entry.raw._category});
const expectedHeader=(spec:{key:string;header:RawHeader;parent?:Parent})=>({kind:'race',name:spec.parent?spec.parent.header.name+'（'+spec.header.name+'）':spec.header.name,english:spec.parent?spec.parent.header.ENG_name+' ('+spec.header.ENG_name+')':spec.header.ENG_name,source:spec.header.source,edition:spec.header.edition==='one'||['XPHB','XDMG','XMM'].includes(spec.header.source)?'2024':spec.header.edition==='classic'||['PHB','DMG','MM'].includes(spec.header.source)?'2014':'both',packId:'kiwee',page:spec.header.page??null,category:spec.key.startsWith('subrace/')?'subrace':'race'});
let original:Record<string,any>|undefined;
function body():Record<string,any>{
 boundary();if(original)return original;const directory=process.env.RACIAL_RESISTANCE_FROZEN_DIR;if(!directory)fail('FROZEN_DIRECTORY');const root=realpathSync(directory),index=JSON.parse(readFileSync(root+'/index.json','utf8'));if(!Array.isArray(index.rows))fail('INDEX');const rows=index.rows.filter((row:any)=>row?.url===racialResistancePin.url),expectedPath='files/'+racialResistancePin.sha256+'.json';
 if(rows.length!==1||rows[0].sha256!==racialResistancePin.sha256||rows[0].path!==expectedPath)fail('INPUT_PIN');const file=realpathSync(root+'/'+rows[0].path);if(!file.replaceAll('\\','/').startsWith(root.replaceAll('\\','/')+'/'))fail('INPUT_PATH');const bytes=readFileSync(file);if(bytes.length!==racialResistancePin.bytes||digest(bytes)!==racialResistancePin.sha256)fail('INPUT_BYTES');const source=JSON.parse(bytes.toString('utf8'));if(digest(JSON.stringify(source))!==racialResistancePin.sha256)fail('INPUT_CANONICAL');
 for(const spec of [...racialResistanceSpecs,...heldSpecs]){const raw=at(source,spec.key);if(!raw||racialResistanceSnapshot(raw)!==spec.rawSha256||racialResistanceSnapshot(rawHeader(raw))!==racialResistanceSnapshot(spec.header))fail('RAW_HEADER_OR_FINGERPRINT');if(spec.parent){const rawParent=at(source,spec.parent.path);if(!rawParent||rawParent._copy||racialResistanceSnapshot(rawParent)!==spec.parent.rawSha256||racialResistanceSnapshot(rawHeader(rawParent))!==racialResistanceSnapshot(spec.parent.header)||raw.raceName!==rawParent.name||raw.raceSource!==rawParent.source)fail('RAW_PARENT');}}
 for(const spec of racialResistanceSpecs){const raw=at(source,spec.key),clause=at(source,spec.clause.path);if(raw._copy||typeof clause!=='string'||Buffer.byteLength(clause,'utf8')!==spec.clause.utf8Bytes||digest(clause)!==spec.clause.sha256||racialResistanceSnapshot(raw.resist)!==racialResistanceSnapshot(racialResistanceLiteralTags(spec.resistances)))fail('LITERAL_FIXED_SOURCE_CLAUSE');}
 return original=source;
}
type NormalizedParent={normalizedId:string;header:ReturnType<typeof header>;revision:string;fullNormalizedSnapshotSha256:string};
type Route={admitted:Map<string,Entry>;held:Map<string,Entry>;parents:Map<string,NormalizedParent>;rejected:{key:string;reasonCode:string;matchCount:number}[];heldUnlocated:{key:string;reasonCode:string;matchCount:number}[]};
const cache:Partial<Record<Form,Route>>={};
function route(form:Form):Route{
 boundary();if(form!=='canonical'&&form!=='app')fail('FORM');if(cache[form])return cache[form]!;
 // Independently normalize the complete original for each route, without any
 // ID construction, payload repair, field removal or spell lookup input.
 const normalized=normalizeCatalogData(structuredClone(body()),racialResistancePin.sha256,'kiwee'),routed=form==='app'?normalized.map(entry=>hydrateSpellLookup(entry,{},'')):normalized;
 const admitted=new Map<string,Entry>(),held=new Map<string,Entry>(),parents=new Map<string,NormalizedParent>(),rejected:Route['rejected']=[],heldUnlocated:Route['heldUnlocated']=[];
 const locate=(spec:{key:string;header:RawHeader;parent?:Parent})=>routed.filter(entry=>{const{id,...actual}=header(entry);return racialResistanceSnapshot(actual)===racialResistanceSnapshot(expectedHeader(spec))&&(!spec.parent||entry.raw._parentName===spec.parent.header.name&&entry.raw._parentSource===spec.parent.header.source&&entry.raw._subraceName===spec.header.name&&entry.raw.raceName===spec.header.raceName&&entry.raw.raceSource===spec.header.raceSource);});
 const valid=(entry:Entry)=>!!entry.id&&entry.revision===racialResistancePin.sha256&&!entry.raw._copy&&!entry.raw._unresolvedParent&&routed.filter(row=>row.id===entry.id).length===1;
 for(const spec of racialResistanceSpecs){
  const matches=locate(spec);if(matches.length!==1){rejected.push({key:spec.key,reasonCode:'complete-normalized-owner-header-not-unique',matchCount:matches.length});continue;}
  if(!valid(matches[0])){rejected.push({key:spec.key,reasonCode:'complete-normalized-owner-unresolved-or-id-collision',matchCount:matches.length});continue;}
  if(racialResistanceSnapshot(matches[0].raw.resist)!==racialResistanceSnapshot(racialResistanceLiteralTags(spec.resistances))){rejected.push({key:spec.key,reasonCode:'normalized-resistance-not-exact-explicit-source',matchCount:matches.length});continue;}
  if(spec.parent){const parentMatches=locate({key:spec.parent.path,header:spec.parent.header});if(parentMatches.length!==1||!valid(parentMatches[0])){rejected.push({key:spec.key,reasonCode:'complete-normalized-parent-not-unique-or-unresolved',matchCount:parentMatches.length});continue;}const entry=parentMatches[0];parents.set(spec.parent.path,{normalizedId:entry.id,header:header(entry),revision:entry.revision,fullNormalizedSnapshotSha256:racialResistanceSnapshot(entry)});}
  admitted.set(spec.key,matches[0]);
 }
 for(const spec of heldSpecs){const matches=locate(spec);if(matches.length!==1||!valid(matches[0])){heldUnlocated.push({key:spec.key,reasonCode:'held-complete-normalized-owner-not-unique-or-unresolved',matchCount:matches.length});continue;}held.set(spec.key,matches[0]);}
 // Only explicit admitted owners and the eleven bounded negative controls are
 // retained; all inherited/version/other normalized rows are discarded.
 return cache[form]={admitted,held,parents,rejected,heldUnlocated};
}
export function racialResistanceEntries(form:Form='canonical'):Entry[]{return[...route(form).admitted.values()];}
export function racialResistanceFind(key:string=racialResistanceSpecs[0].key,form:Form='canonical'):Entry{if(!racialResistanceSpecs.some(spec=>spec.key===key))fail('UNREVIEWED_KEY');const entry=route(form).admitted.get(key);if(!entry)fail('HELD_NORMALIZED_OWNER');return entry;}
export function racialResistanceHeldEntries(form:Form='canonical'):Entry[]{return[...route(form).held.values()];}
const forms=(canonical:Entry,app:Entry)=>([{form:'canonical',entry:canonical},{form:'app',entry:app}]as const).map(({form,entry})=>({form,id:entry.id,revision:entry.revision,sha256:racialResistanceSnapshot(entry),completeSnapshotSha256:racialResistanceSnapshot(entry),canonicalReboundSnapshotSha256:racialResistanceSnapshot({...entry,id:canonical.id,revision:canonical.revision})}));
function sourceProof(spec:RacialResistanceSpec,canonical:Route,app:Route){
 const parent=spec.parent?canonical.parents.get(spec.parent.path):undefined,finalParent=spec.parent?app.parents.get(spec.parent.path):undefined;
 if(spec.parent&&(!parent||!finalParent||parent.normalizedId!==finalParent.normalizedId))fail('PARENT_FORM_IDENTITY');
 return{path:spec.key,rawSha256:spec.rawSha256,rawHeader:{...spec.header},clause:{...spec.clause},...(spec.parent&&parent&&finalParent?{parent:{path:spec.parent.path,rawSha256:spec.parent.rawSha256,header:{...spec.parent.header},normalizedId:parent.normalizedId,normalizedHeader:parent.header,revision:parent.revision,fullNormalizedSnapshotSha256:parent.fullNormalizedSnapshotSha256,forms:[{form:'canonical' as const,id:parent.normalizedId,revision:parent.revision,sha256:parent.fullNormalizedSnapshotSha256},{form:'app' as const,id:finalParent.normalizedId,revision:finalParent.revision,sha256:finalParent.fullNormalizedSnapshotSha256}]}}:{})};
}
function buildEvidence(){
 const canonical=route('canonical'),app=route('app');if(racialResistanceSnapshot([...canonical.admitted.keys()])!==racialResistanceSnapshot([...app.admitted.keys()])||racialResistanceSnapshot([...canonical.held.keys()])!==racialResistanceSnapshot([...app.held.keys()]))fail('ROUTE_ADMISSION_DISAGREEMENT');
 const rules=racialResistanceSpecs.filter(spec=>canonical.admitted.has(spec.key)).map(spec=>{const entry=canonical.admitted.get(spec.key)!,final=app.admitted.get(spec.key)!;if(entry.id!==final.id)fail('FORM_IDENTITY');return{key:spec.key,...header(entry),revision:entry.revision,fullNormalizedSnapshotSha256:racialResistanceSnapshot(entry),forms:forms(entry,final),resistances:[...spec.resistances],requiredSources:[...new Set([entry.source,...(entry.dependencies||[])])],sourceProof:sourceProof(spec,canonical,app),wholeEntryCompletionCredit:0};});
 const held=heldSpecs.map(spec=>{const entry=canonical.held.get(spec.key),final=app.held.get(spec.key);return{key:spec.key,sourcePath:spec.key,rawHeader:{...spec.header},rawSha256:spec.rawSha256,reasonCode:spec.reasonCode,...(entry&&final?{...header(entry),revision:entry.revision,fullNormalizedSnapshotSha256:racialResistanceSnapshot(entry),forms:forms(entry,final)}:{forms:[],normalizationStatus:'not-unique-or-unresolved'})};});
 const routeForms=rules.flatMap(rule=>rule.forms),heldRouteForms=held.flatMap(hold=>hold.forms),counts={actualOwners:rules.length,typedAssociations:rules.reduce((sum,rule)=>sum+rule.resistances.length,0),verifiedRouteProofs:routeForms.length,distinctNormalizedSnapshotForms:new Set(routeForms.map(form=>form.sha256)).size,heldOwners:canonical.held.size};
 if(new Set(rules.map(rule=>rule.id)).size!==rules.length||counts.verifiedRouteProofs!==rules.length*2||rules.some(rule=>held.some(hold=>'id'in hold&&hold.id===rule.id)))fail('COUNTS_OR_OVERLAP');
 return{schemaVersion:1,scope:'explicit-unconditional-fixed-racial-resistance-type-union',input:{...racialResistancePin},sourceProseIncluded:false,wholeEntryCompletionCredit:0,newReportWitnessCredit:0,sourceCandidateCounts:{owners:38,races:30,subraces:8,typedAssociations:44},counts,heldRouteProofs:heldRouteForms.length,normalization:{canonical:'complete-original-races-body-through-installed-normalizeCatalogData',app:'independent-complete-original-races-body-normalize-then-real-hydrateSpellLookup',transportRevision:racialResistancePin.sha256,noPayloadRepair:true},policy:{operation:'derived-fixed-damage-type-union-only',manualMechanisms:['numeric-damage','hp','saving-throw-advantage','immunity','temporary-all-damage-resistance','ancestry-choice','conditional-resistance']},rules,held,normalizationHolds:canonical.rejected,unlocatedHeldOwners:canonical.heldUnlocated,excluded:{inherited:{keys:inheritedKeys,reasonCode:'inherited-owner-outside-explicit-native-family',count:26},versions:{keys:versionKeys,reasonCode:'expanded-version-outside-explicit-native-family',count:4}}};
}
let evidence:ReturnType<typeof buildEvidence>|undefined;
export function racialResistanceSourceEvidence(){boundary();return evidence??=buildEvidence();}
