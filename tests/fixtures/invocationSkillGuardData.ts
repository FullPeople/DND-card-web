// Prose-free mechanical projections independently checked against the frozen
// https://5e.kiwee.top/data/ inputs (not the production evidence registry):
// class/class-warlock.json: 34721a04db792923cf0a19fbab3f90616093d9f6519a7cfe6f81a9eb52e775d4
// optionalfeatures.json: 031970dfac1770a548549bd30535319c2493c47ebeaedfdb6a601651bbfc3844
// spells/spells-phb.json: e1f2221020cfb5d31995c99b78dc09435c9962476ef1cef81b52399e6df0263d
// Unrelated class progressions/features and publisher prose are intentionally absent.
export const invocationSkillGuardData={
 class:[{name:'魔契师',ENG_name:'Warlock',source:'PHB',edition:'classic',casterProgression:'pact',hd:{number:1,faces:8},spellcastingAbility:'cha',classFeatures:['魔能祈唤|魔契师||2'],optionalfeatureProgression:[{name:'魔能祈唤',ENG_name:'Eldritch Invocations',featureType:['EI'],progression:[0,2,2,2,3,3,4,4,5,5,5,6,6,6,7,7,7,8,8,8]}]}],
 classFeature:[{name:'魔能祈唤',ENG_name:'Eldritch Invocations',source:'PHB',className:'魔契师',classSource:'PHB',level:2,entries:[]}],
 optionalfeature:[
  {name:'诱导话术',ENG_name:'Beguiling Influence',source:'PHB',featureType:['EI'],skillProficiencies:[{deception:true,persuasion:true}],entries:[]},
  {name:'魔能视界',ENG_name:'Eldritch Sight',source:'PHB',featureType:['EI'],additionalSpells:[{innate:{_:['侦测魔法']}}],entries:[]},
 ],
 spell:[{name:'侦测魔法',ENG_name:'Detect Magic',source:'PHB',level:1}],
};
