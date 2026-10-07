import type {Edition,Entry,Raw} from '../../src/core/model';
import source from '../fixtures/shield-training-sources.json' with {type:'json'};
export {source};
/** Node-safe mechanical projection; the actual normalizer is checked separately in unit tests. */
export function shieldTrainingEntries():Entry[]{
 return ([['class',source.projection.class],['item',source.projection.baseitem]] as const).flatMap(([kind,rows])=>rows.map(row=>{
  const raw=structuredClone(row) as Raw,edition:Edition=raw.edition==='one'?'2024':'2014';
  return {id:`kiwee:${kind}:${raw.source.toLowerCase()}:${encodeURIComponent(raw.ENG_name.toLowerCase())}::::::`,kind,name:raw.name,english:raw.ENG_name,source:raw.source,edition,packId:'kiwee',revision:'sha256:'+source.inputs[kind==='class'?0:1].sha256,entries:[],raw:{...raw,_category:kind==='class'?'class':'baseitem'}};
 }));
}
