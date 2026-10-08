import {describe,it,expect} from 'vitest';
import {parsePaletteSettings,hexToHsv,hsvToHex} from '../src/platform/paletteSettings';
const settings={format:'dnd-card-palette',version:1,appearance:{ui:{background:'#112233'},wiki:{tableHeading:'#AABBCC'}},card:{palette:{paper:'#eeeeee'},components:{abilities:{surface:'#123456'}}}};
describe('portable palette files',()=>{
 it('round-trips browser and component colors without any character data',()=>{expect(parsePaletteSettings(JSON.stringify(settings))).toEqual(settings);expect(Object.keys(parsePaletteSettings(JSON.stringify({...settings,card:undefined})))).toEqual(['format','version','appearance']);});
 it.each([null,{...settings,version:2},{...settings,appearance:{ui:{background:'red'},wiki:{}}},{...settings,appearance:{ui:{unknown:'#112233'},wiki:{}}},{...settings,card:{palette:{paper:'#123'},components:{}}},{...settings,card:{palette:{},components:{unknown:{ink:'#123456'}}}}])('rejects invalid settings before mutation: %j',value=>{expect(()=>parsePaletteSettings(JSON.stringify(value))).toThrow();});
 it.each(['#000000','#FFFFFF','#6633AA','#CBDBCA','#123456','#FF0000'])('keeps exact RGB colors through the picker: %s',color=>expect(hsvToHex(hexToHsv(color))).toBe(color));
});
