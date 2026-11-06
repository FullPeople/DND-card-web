import {expect,it} from 'vitest';
import {extractClassFilterSourceMetadata} from '../tools/classFilterSourceMetadata';
const fixture=()=>`throw new Error('must never execute');
Parser.SRC_A='ABOOK'; Parser.SRC_B='BBOOK';
Parser.SRC_UA_PREFIX='UA'; Parser.SRC_UA_ONE_PREFIX='XUA'; Parser.SRC_PS_PREFIX='PS'; Parser.SRC_MCVX_PREFIX='MCV';
Parser.SOURCE_JSON_TO_ABV={};
Parser.SOURCE_JSON_TO_ABV[Parser.SRC_A]='Different abbreviation';
Parser.SOURCE_JSON_TO_ABV[Parser.SRC_B]=Parser.SOURCE_JSON_TO_ABV[Parser.SRC_A];
Parser.SOURCES_NON_STANDARD_WOTC=new Set([Parser.SRC_B]);`;
it('reads declared static metadata without executing upstream code or treating source IDs as abbreviations',()=>{
 expect(extractClassFilterSourceMetadata(fixture())).toEqual({schemaVersion:1,abbreviations:{ABOOK:'Different abbreviation',BBOOK:'Different abbreviation'},nonstandardSources:['BBOOK'],nonstandardPrefixes:['MCV','PS','UA','XUA']});
});
it('rejects dynamic source metadata instead of executing or silently guessing it',()=>{
 for(const code of [fixture().replace("Parser.SRC_A='ABOOK'","Parser.SRC_A=fetch('private')"),fixture().replace("='Different abbreviation'","=(()=>'invented')()")])expect(()=>extractClassFilterSourceMetadata(code)).toThrow('static strings');
});
it('rejects ambiguous abbreviations, missing source metadata and unclassified nonstandard IDs',()=>{
 for(const code of [fixture()+"Parser.SOURCE_JSON_TO_ABV[Parser.SRC_A]='Changed';",fixture().replace("Parser.SRC_PS_PREFIX='PS';",''),fixture().replace('new Set([Parser.SRC_B])',"new Set(['UNKNOWN'])"),fixture().replace('Parser.SOURCE_JSON_TO_ABV={};','')])expect(()=>extractClassFilterSourceMetadata(code)).toThrow();
});
it('keeps separate source IDs even when they have the same display abbreviation and rejects case collisions',()=>{
 expect(Object.keys(extractClassFilterSourceMetadata(fixture()).abbreviations)).toEqual(['ABOOK','BBOOK']);
 expect(()=>extractClassFilterSourceMetadata(fixture()+"Parser.SOURCE_JSON_TO_ABV['abook']='Conflict';")).toThrow('Case-colliding');
});
