"""Emit OpenAPI 3.1 using JSON syntax (a strict YAML subset)."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
S={'type':'string'}
I={'type':'integer','minimum':1,'maximum':9007199254740991}
def obj(props,required=None): return {'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':False}
def ref(name): return {'$ref':'#/components/schemas/'+name}
def array(item):return {'type':'array','items':item}
document=json.loads((ROOT/'backend/examples/character.json').read_text())
batch={'operationId':'20000000-0000-4000-8000-000000000001','clientId':'30000000-0000-4000-8000-000000000001','baseRevision':1,'operations':[{'op':'inc','path':'/runtime/hp','value':-5}]}
snapshot={'id':'40000000-0000-4000-8000-000000000001','ownerId':'50000000-0000-4000-8000-000000000001','system':'dnd5e','schemaVersion':1,'revision':1,'document':document,'createdAt':'2026-10-01T00:00:00Z','updatedAt':'2026-10-01T00:00:00Z'}
result={'characterId':snapshot['id'],'revision':2,**batch,'origin':'web','touchedPaths':['/runtime/hp'],'updatedAt':'2026-10-01T00:01:00Z','rebased':False}
operation_schema=json.loads((ROOT/'backend/schemas/protocol/operation.v1.json').read_text())
character_schema=json.loads((ROOT/'backend/schemas/character/v1.json').read_text())
# Rebase local references when embedding under OpenAPI components.
def rebase(x):
    if isinstance(x,dict): return {k:('#/components/schemas/Character/$defs/'+v[8:] if k=='$ref' and v.startswith('#/$defs/') else rebase(v)) for k,v in x.items() if k not in ['$id','$schema']}
    if isinstance(x,list):return [rebase(v) for v in x]
    return x
metadata={k:({'const':v} if k in ['system','schemaVersion'] else I if k=='revision' else S) for k,v in snapshot.items() if k!='document'}
schemas={
 'Character':rebase(character_schema), 'OperationBatch':{k:v for k,v in operation_schema.items() if k not in ['$id','$schema']},
 'Snapshot':obj({**metadata,'document':ref('Character')}),'CharacterSummary':obj(metadata),
 'OperationResult':obj({'characterId':S,'revision':I,'baseRevision':I,'operationId':S,'clientId':S,'origin':S,'operations':operation_schema['properties']['operations'],'touchedPaths':array(S),'updatedAt':S,'rebased':{'type':'boolean'}}),
 'Conflict':obj({'path':S,'serverValue':{},'clientValue':{},'serverExists':{'type':'boolean'}}),
 'Error':obj({'code':{'enum':['validation_error','unauthorized','forbidden','not_found','revision_conflict','schema_mismatch','resync_required','duplicate_operation','invalid_operation','invalid_path','payload_too_large','rate_limited','internal_error']},'message':S,'currentRevision':I,'baseRevision':I,'conflicts':array(ref('Conflict'))},['code','message']),
 'Identity':obj({'id':S,'name':S}),
 'Delta':obj({'characterId':S,'currentRevision':I,'operations':array(ref('OperationResult'))}),
 'Permissions':obj({'permissions':array(obj({'userId':S,'role':{'enum':['owner','editor','viewer']}}))}),
 'CreateRequest':obj({'document':ref('Character')})
}
def response(schema,description='Success',example=None):
    media={'schema':schema}
    if example is not None:media['example']=example
    return {'description':description,'content':{'application/json':media}}
errors={str(code):response(ref('Error'),name) for code,name in [(401,'Unauthorized'),(403,'Forbidden'),(404,'Not found'),(409,'Conflict or resync required'),(413,'Payload too large'),(422,'Validation error'),(429,'Rate limited'),(500,'Internal error')]}
paths={}
def add(method,path,operation_id,summary,status=200,schema=None,example=None,body=None,body_example=None,parameters=None,public=False):
    op={'operationId':operation_id,'summary':summary,'responses':dict(errors)}
    op['responses'][str(status)]=response(schema,example=example) if schema else {'description':'Success, no response body'}
    if public:op['security']=[]
    params=[]
    for name in ['id','userId']:
        if '{'+name+'}' in path:params.append({'name':name,'in':'path','required':True,'schema':{'type':'string','format':'uuid'}})
    params.extend(parameters or [])
    if params:op['parameters']=params
    if body:
        media={'schema':body}
        if body_example is not None:media['example']=body_example
        op['requestBody']={'required':True,'content':{'application/json':media}}
    paths.setdefault(path,{})[method]=op
add('get','/health','health','Process readiness after database migration',schema=obj({'status':{'const':'ok'}}),example={'status':'ok'},public=True)
add('get','/api/v1/me','me','Authenticated identity',schema=ref('Identity'))
add('post','/api/v1/session','sessionCreate','Exchange Bearer token for HttpOnly SameSite=Strict session cookie',schema=ref('Identity'))
paths['/api/v1/session']['post']['security']=[{'bearerAuth':[]}]
paths['/api/v1/session']['post']['responses']['200']['headers']={'Set-Cookie':{'schema':S,'description':'dnd_session token; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=86400; Secure when configured'}}
add('delete','/api/v1/session','sessionDelete','Clear browser cookie; does not revoke provisioning token',status=204)
add('get','/api/v1/characters','charactersList','Permission-filtered metadata only',schema=obj({'characters':array(ref('CharacterSummary')),'limit':I,'offset':{'type':'integer','minimum':0}}),parameters=[{'name':'limit','in':'query','schema':{'type':'integer','default':50,'minimum':1,'maximum':100}},{'name':'offset','in':'query','schema':{'type':'integer','default':0,'minimum':0}}])
add('post','/api/v1/characters','characterCreate','Create/import native Character v1; new server UUID and revision 1',201,ref('Snapshot'),snapshot,ref('CreateRequest'),{'document':document})
add('get','/api/v1/characters/{id}','characterSnapshot','Owner/editor/viewer snapshot',schema=ref('Snapshot'),example=snapshot)
add('post','/api/v1/characters/{id}/operations','operationSubmit','Owner/editor operation batch; same request ID returns original result',schema=ref('OperationResult'),example=result,body=ref('OperationBatch'),body_example=batch)
add('get','/api/v1/characters/{id}/operations','operationDelta','Permission-checked contiguous retained history',schema=ref('Delta'),example={'characterId':snapshot['id'],'currentRevision':2,'operations':[result]},parameters=[{'name':'afterRevision','in':'query','required':True,'schema':I}])
add('get','/api/v1/characters/{id}/permissions','permissionsList','Owner only',schema=ref('Permissions'))
add('put','/api/v1/characters/{id}/permissions/{userId}','permissionSet','Owner grants editor/viewer to a provisioned user',204,body=obj({'role':{'enum':['editor','viewer']}}),body_example={'role':'editor'})
add('delete','/api/v1/characters/{id}/permissions/{userId}','permissionDelete','Owner revokes member; affected sockets disconnect',204)
add('get','/api/v1/ws','websocket','Authenticated WebSocket upgrade; see docs/protocol/WEBSOCKET.md',101)
paths['/api/v1/ws']['get']['responses']['400']={'description':'Invalid WebSocket handshake (transport-level response)'}
api={'openapi':'3.1.0','info':{'title':'DND Character Backend','version':'1.0.0','description':'Snapshot + stable-ID operations. Protocol v1. Default limits documented in backend/README.md. JSON syntax is valid YAML.'},'servers':[{'url':'http://127.0.0.1:8080'}],'security':[{'bearerAuth':[]},{'sessionCookie':[]}],'paths':paths,'components':{'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer'},'sessionCookie':{'type':'apiKey','in':'cookie','name':'dnd_session'}},'schemas':schemas}}
(ROOT/'openapi.yaml').write_text(json.dumps(api,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
