import type {Entry,Raw} from '../../src/core/model';
import source from '../fixtures/warforged-tool-sources.json' with {type:'json'};
export {source};
export function warforgedToolEntries():Entry[]{
 return ([['race',source.projection.race],['item',source.projection.baseitem]] as const).flatMap(([kind,rows])=>rows.map(row=>{
  const raw=structuredClone(row) as Raw;
  return {id:`kiwee:${kind}:${raw.source.toLowerCase()}:${encodeURIComponent(raw.ENG_name.toLowerCase())}::::::`,kind,name:raw.name,english:raw.ENG_name,source:raw.source,edition:raw.edition==='one'||['XPHB','XDMG','XMM'].includes(raw.source)?'2024':raw.edition==='classic'||['PHB','DMG','MM'].includes(raw.source)?'2014':'both',packId:'kiwee',revision:'mechanical-projection',entries:[],raw:{...raw,_category:kind==='race'?'race':'baseitem'}};
 }));
}
