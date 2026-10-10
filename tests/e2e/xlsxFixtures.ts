import {pngArchive} from '../../src/platform/exportFiles';
import type {CellValue} from '../../src/platform/xlsxWorkbook';

const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function testWorkbookCells(edition='2024'){
 const main:Record<string,CellValue>={E2:'5E'+edition,E3:'Excel 验收角色',E4:'测试玩家',E6:'测试法师',O6:3,T6:'测试旅人',AL39:'盾牌',AQ39:'AC',AS39:'着装',AQ40:2,AS40:'否',S3:2,D22:2,D23:15,L23:14,AR24:30,R22:22,V22:29,T24:3,L24:'智力',G66:14,K66:'+6',E72:1,H72:3,B26:'手动资源',J26:1,M26:4,AG60:17,P77:0,Q77:'微光术',AX17:'个人特性',BC17:'保留自定义正文'};
 [12,14,16,18,10,8].forEach((total,i)=>{main['F'+(13+i)]=total;main['R'+(13+i)]=Math.floor((total-10)/2);main['I'+(13+i)]=total;main['T'+(13+i)]=Math.floor((total-10)/2);});
 return{main,person:{E6:'抄书员',S17:'人物故事原文',S12:'保留个性'} as Record<string,CellValue>,spells:{A3:'微光术',B3:0,M3:'自制测试法术正文',N3:'Glimmer'} as Record<string,CellValue>,inventory:{B5:'旅行物品',G5:'背包原文',S5:2,V5:3} as Record<string,CellValue>};
}
export async function xlsxFixture(edition='2024',patch:Record<string,CellValue>={},english=false):Promise<Buffer>{
 const values=testWorkbookCells(edition);Object.assign(values.main,patch);
 const names=english?['Main','Origin','Spell Compendium','Equipment','Data','Areas of Effect','Web Import','Inventory','Background Data']:['主要',edition==='2024'?'起源':'背景','法术大全','装备','数据表','圆形效应范围','网页导入','背包',edition==='2024'?'背景':'背景数据'];
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const files=[{name:'xl/workbook.xml',blob:new Blob([`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${names.map((name,index)=>`<sheet name="${name}" sheetId="${index+1}" r:id="r${index}"/>`).join('')}</sheets></workbook>`])},{name:'xl/_rels/workbook.xml.rels',blob:new Blob([`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,index)=>`<Relationship Id="r${index}" Type="${rel}/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}</Relationships>`])}];
 names.forEach((_,index)=>{
  const cells=index===0?values.main:index===1?values.person:index===2?values.spells:index===7?values.inventory:{};
  const rows=new Map<number,string[]>();
  for(const [ref,value] of Object.entries(cells)){
   const row=Number(ref.match(/\d+$/)![0]);if(!rows.has(row))rows.set(row,[]);
   rows.get(row)!.push(typeof value==='number'?`<c r="${ref}"><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${escape(String(value??''))}</t></is></c>`);
  }
  files.push({name:`xl/worksheets/sheet${index+1}.xml`,blob:new Blob([`<worksheet xmlns="${ns}"><sheetData>${[...rows].sort(([a],[b])=>a-b).map(([row,cells])=>`<row r="${row}">${cells.join('')}</row>`).join('')}</sheetData></worksheet>`])});
 });
 return Buffer.from(await(await pngArchive(files)).arrayBuffer());
}
