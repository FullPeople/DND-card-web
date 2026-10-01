"""Deterministic public JSON Schema generator. No frontend files are modified."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'schemas'
S = {'type': 'string'}
N = {'type': 'number', 'minimum': -9007199254740991, 'maximum': 9007199254740991}
B = {'type': 'boolean'}
def integer(lo=0, hi=9007199254740991): return {'type': 'integer', 'minimum': lo, 'maximum': hi}
def enum(*values): return {'enum': list(values)}
def arr(items=S, maximum=10000, unique=False):
    result = {'type': 'array', 'items': items, 'maxItems': maximum}
    if unique: result['uniqueItems'] = True
    return result
def obj(properties, required=(), extra=False): return {'type': 'object', 'properties': properties, 'required': list(required), 'additionalProperties': extra}
def mapping(item): return {'type': 'object', 'additionalProperties': item, 'maxProperties': 10000}
def ref(name): return {'$ref': '#/$defs/' + name}
def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha']
entry = obj({'id': S, 'kind': enum('class','subclass','race','background','feat','spell','item','feature','condition','rule','monster'), 'name': {'type':'string','maxLength':300}, 'english':S, 'source':S, 'edition':enum('2014','2024','both'), 'packId':S, 'revision':S, 'page':N, 'entries':arr({}), 'raw':mapping({}), 'effects':arr(obj({'op':enum('add','set','proficiency'), 'target':S, 'value':N,'skill':S}, ['op'])), 'choices':arr(mapping({}),200), 'dependencies':arr()}, ['id','kind','name','english','source','edition','packId','revision','entries','raw'], True)
selection = obj({'id':{'type':'string','minLength':1,'maxLength':2000},'entry':ref('entry'),'quantity':integer(1,100000),'level':integer(1,20),'equipped':B,'attuned':B,'weaponAbility':enum(*abilities),'requirementId':S,'parentId':S,'grantKey':S,'section':enum('features','heritage'),'catalogReview':obj({'edition':enum('2014','2024'),'entryId':S,'source':S,'kind':entry['properties']['kind']},['edition','entryId','source','kind'])}, ['id','entry','quantity','level','equipped'], True)
resource = obj({'current':dict(N,minimum=0),'max':dict(N,minimum=0),'name':S,'type':S,'icon':S,'order':N,'automatic':B,'unlimited':B,'locked':B},['current','max'],True)
image = obj({'data':{'type':'string','maxLength':650000,'pattern':'^data:image/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$'},'x':dict(N,minimum=-300,maximum=300),'y':dict(N,minimum=-300,maximum=300),'zoom':dict(N,minimum=1,maximum=5),'frameWidth':dict(N,exclusiveMinimum=0,maximum=2000),'frameHeight':dict(N,exclusiveMinimum=0,maximum=2000)},['data','x','y','zoom'])
special = obj({'mode':enum('locked','uses'),'max':integer(1,100),'recovery':enum('long','short','manual'),'label':S,'manualSource':obj({'ownerId':S},['ownerId']),'sourceGrant':obj({'ownerId':S,'key':S,'usageKey':S,'resourceKey':S,'canUseSlots':B,'ability':enum(*abilities),'active':B,'reason':S,'usage':enum('slot','free','ritual','check'),'castLevel':integer(1,9)},['ownerId','key','active','usage'],True)},['mode'],True)
spell = obj({'mode':enum('known','prepared'),'modeOverride':B,'ability':enum(*abilities),'abilityOverride':B,'abilityClassId':S,'capacity':integer(0,100),'capacityAdjustment':integer(-100,100),'attackBonus':dict(N,minimum=-100,maximum=100),'dcBonus':dict(N,minimum=-100,maximum=100),'prepared':arr(S,3000),'cantrips':mapping(arr(S,3000)),'cantripCapacityAdjustments':mapping(integer(-100,100)),'sourceCantripCapacities':mapping(integer(0,100)),'sourceCapacityAdjustments':mapping(integer(-100,100)),'knownCapacityAdjustment':integer(-100,100),'special':mapping(special),'slots':{'type':'object','patternProperties':{'^[1-9]$':obj({'max':integer(0,30),'used':integer(0,30)},['max','used'])},'additionalProperties':False}},['mode','ability','capacity','attackBonus','dcBonus','prepared','slots'],True)
pack = obj({'schemaVersion':{'const':1},'id':S,'name':S,'version':S,'author':S,'editions':arr(enum('2014','2024')),'requires':arr(obj({'id':S,'version':S},['id','version'])),'conflicts':arr(),'entries':arr(ref('entry'),3000)},['schemaVersion','id','name','version','editions','requires','conflicts','entries'],True)
props = {
 'schemaVersion':{'const':1},'id':{'type':'string','minLength':1},'revision':integer(1),'name':{'type':'string','maxLength':300},'player':S,'edition':enum('2014','2024'),'createdAt':S,'updatedAt':S,
 'abilities':obj({a:integer(1,100) for a in abilities},abilities),'baseHp':dict(N,minimum=0),
 'identity':obj({k:S for k in ['gender','alignment','age','description']},['gender','alignment','age','description'],True),'biography':mapping({'type':'string','maxLength':100000}),
 'portrait':image,'illustration':image,'palette':obj({k:{'type':'string','pattern':'^#[0-9a-fA-F]{6}$'} for k in ['paper','surface','frame','heading','ink','badge']}),
 'selections':arr(ref('selection'),3000),'answers':mapping(arr()),'reviewed':arr(),'notes':S,
 'profile':obj({'enabledSources':arr(),'optional':obj({'feats':B,'multiclass':B,'legacy':B},['feats','multiclass','legacy'],True),'exceptions':mapping(S),'disabledEntries':arr(S,100000),'autoSourceDefaults':arr(),'sourceConflicts':obj({'mode':enum('latest','manual','all'),'selected':mapping(arr())},['mode','selected'])},['enabledSources','optional','exceptions'],True),
 'runtime':obj({'hp':N,'tempHp':N,'inspiration':N,'resources':mapping(resource),'deathSaves':obj({'success':integer(0,3),'failure':integer(0,3)},['success','failure']),'sourceSpellSpent':mapping(integer(0,100)),'automationActions':obj({'version':integer(1),'sequence':integer(),'last':mapping({})},['version','sequence'],True)},['hp','tempHp','inspiration','resources'],True),
 'inventory':obj({'capacityAdjustment':{'type':'string','maxLength':180},'displayEquipment':arr(),'displayAttunement':arr(),'positions':mapping(integer(0,9999)),'view':enum('grid','list'),'order':arr(S,10000,True),'attunementLimit':integer(0,30),'coins':obj({k:dict(N,minimum=0,maximum=1000000) for k in ['cp','sp','ep','gp','pp']},['cp','sp','ep','gp','pp']),'grantedCoins':mapping(dict(N,minimum=0))},['view','order','attunementLimit','coins'],True),
 'spellSettings':spell,'backgroundChoices':mapping(obj({'abilities':obj({a:integer(0,10) for a in abilities}),'equipment':mapping(S)},extra=True)),
 'hpProgression':obj({'mode':enum('average','rolled'),'rolls':mapping(arr({'anyOf':[integer(1,100),{'type':'null'}]},20))},['mode','rolls']),
 'rulePacks':arr(pack,100),'quickbar':arr(S,100,True),'quickbarCopies':arr(obj({'id':S,'entry':ref('entry')},['id','entry'],True),100),'quickbarActions':arr(obj({k:S for k in ['id','name','attack','damage']},['id','name','attack','damage'],True),100),
 'quickbarLayout':obj({'order':arr(S,3000),'hidden':arr(S,3000),'widgets':mapping(obj({'style':enum('bar','ring','square','icon'),'x':N,'y':N,'w':N,'h':N,'page':N},extra=True))},['order','hidden'],True),
 'proficiencies':mapping(B),'expertise':mapping(B),'jackOfAllTrades':B,'training':mapping(S),'size':enum('T','S','M','L','H','G'),'sheetBonuses':mapping(dict(N,minimum=-9999,maximum=9999)),'skillBonuses':mapping(integer(-9999,9999)),
 'dismissedFeatures':arr(),'featureLayout':obj({'order':arr(S,10000,True),'expanded':arr(S,10000,True),'detailsExpanded':arr()},['order','expanded'],True),
 'adjustments':arr(obj({'id':S,'target':S,'value':dict(N,minimum=-10000,maximum=10000),'reason':{'type':'string','minLength':1}},['id','target','value','reason'],True)),
 'externalSnapshot':mapping({}),'locked':B,'automation':obj({'protocol':integer(1),'enabled':B,'rulesVersion':S,'spellSets':mapping(integer(0,1000)),'spellAbilities':mapping(enum(*abilities)),'spellUsageModes':mapping(enum('shared','each')),'spellChoices':mapping(arr(S,100,True))},['protocol'],True)
}
character = obj(props, ['schemaVersion','id','revision','name','player','edition','createdAt','updatedAt','abilities','baseHp','identity','selections','answers','reviewed','profile','notes','runtime'], True)
known_automation = props['automation']
known_automation['properties']['protocol'] = {'const': 2}
known_automation['required'] = ['protocol','enabled','rulesVersion']
props['automation'] = {'anyOf':[known_automation, obj({'protocol':dict(integer(1), **{'not':{'const':2}})}, ['protocol'], True)]}
character.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://dnd-card.local/schemas/character/v1.json','$defs':{'entry':entry,'selection':selection},'description':'Character v1; stable-ID arrays are preserved. Additional imported fields are retained, not interpreted as rules.'})
write('character/v1.json',character)
pointer={'type':'string','minLength':2,'maxLength':4096,'pattern':'^/(?:[^~]|~[01])+$'}
entity={'type':'string','minLength':1,'maxLength':2000}
operations=[]
for op in ['set','unset','inc','entity.upsert','entity.delete','order.move']:
    p={'op':{'const':op},'path':pointer}; required=['op','path']
    if op in ['set','inc','entity.upsert']: p['value']=N if op=='inc' else {'type':'object'} if op=='entity.upsert' else {};required+=['value']
    if op.startswith('entity.') or op=='order.move':p['entityId']=entity;required+=['entityId']
    if op=='order.move':p['beforeId']={'anyOf':[entity,{'type':'null'}]}
    operations.append(obj(p,required))
batch=obj({'operationId':{'type':'string','format':'uuid'},'clientId':{'type':'string','format':'uuid'},'baseRevision':integer(1),'operations':dict(arr({'oneOf':operations},128),minItems=1)},['operationId','clientId','baseRevision','operations'])
batch.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://dnd-card.local/schemas/protocol/operation.v1.json'})
write('protocol/operation.v1.json',batch)
