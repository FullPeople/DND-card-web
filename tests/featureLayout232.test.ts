import {expect,it} from 'vitest';
import {newCharacter} from '../src/core/model';
import {expandedFeatureIds,saveFeatureLayout} from '../src/core/featureLayout';

it('fresh and legacy-unspecified feature layouts start collapsed on both pages',()=>{
  const character=newCharacter();expect(expandedFeatureIds(character)).toEqual([]);expect(expandedFeatureIds(character,true)).toEqual([]);
  character.featureLayout={order:['one'],expanded:['one']};
  expect(expandedFeatureIds(character)).toEqual(['one']);expect(expandedFeatureIds(character,true)).toEqual([]);
  expect(expandedFeatureIds(character,false,true)).toEqual([]);
});

it('opening one detailed panel does not implicitly expand any other feature or overwrite overview choices',()=>{
  const character=newCharacter();character.featureLayout={order:['other','one'],expanded:['overview'],optionsVisible:{owner:true}};
  const selections=structuredClone(character.selections),runtime=structuredClone(character.runtime);
  saveFeatureLayout(character,['one','two'],['one','two'],['one'],true);
  expect(character.featureLayout).toEqual({order:['other','one','two'],expanded:['overview'],detailsExpanded:['one'],optionsVisible:{owner:true}});
  expect(character.selections).toEqual(selections);expect(character.runtime).toEqual(runtime);
});

it('respects saved explicit expansion and collapse, with separate pages and panels',()=>{
  const character=newCharacter();character.featureLayout={order:['other','one','two'],expanded:['overview'],detailsExpanded:['other','one']};
  expect(expandedFeatureIds(character,true)).toEqual(['other','one']);
  saveFeatureLayout(character,['one','two'],['two','one'],[],true);
  expect(expandedFeatureIds(character,true)).toEqual(['other']);
  expect(expandedFeatureIds(character)).toEqual(['overview']);
  saveFeatureLayout(character,['overview'],['overview'],[],false);
  expect(expandedFeatureIds(character,true)).toEqual(['other']);expect(expandedFeatureIds(character)).toEqual([]);
  const restored=JSON.parse(JSON.stringify(character));expect(expandedFeatureIds(restored,true)).toEqual(['other']);
});

it('group toggles preserve foreign panels without duplicating their expanded IDs',()=>{
  const character=newCharacter();character.featureLayout={order:['other','one'],expanded:['other'],detailsExpanded:['other']};
  saveFeatureLayout(character,['one'],['one'],['other','one','one','unrelated'],true);
  expect(expandedFeatureIds(character,true)).toEqual(['other','one']);
  saveFeatureLayout(character,['one'],['one'],['other','one'],false);
  expect(expandedFeatureIds(character)).toEqual(['other','one']);
});
