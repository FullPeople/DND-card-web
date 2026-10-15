"""Pause the separate homepage QQ initializer without changing its artwork."""
from pathlib import Path
import fcntl,gzip,hashlib,json,os,re,shutil,sys,urllib.request
from datetime import datetime,timezone
p=Path(__file__).resolve().parent;root=Path('/var/www/dnd-center');key='homepage-cloud295-20261015'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
def record(value):
 temp=p/'published.tmp';temp.write_text(json.dumps(value,indent=2)+'\n');os.replace(temp,p/'published.json')
with open('/run/lock/obr-static-release.lock','a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 assert p.parent==Path('/root/codex-release-packages') and len(sys.argv)==2 and sha(p/'manifest.json')==sys.argv[1]
 manifest=json.loads((p/'manifest.json').read_text())
 assert manifest['publisherSha256']==sha(Path(__file__)) and manifest['release']==key
 assert not (p/'published.json').exists()
 asset=manifest['asset'];assert re.fullmatch(r'assets/index-cloud295-[a-f0-9]{12}\.js',asset)
 assert set(manifest['files'])=={'index.html','index.html.gz',asset,asset+'.gz'}
 assert sha(root/'index.html')==manifest['oldIndexSha256'] and sha(root/'assets/index-BK9-n3kZ.js')==manifest['oldAssetSha256']
 protected={path:sha(Path(path)) for path in ['/var/www/dnd-center/wiki/release.json','/var/www/dnd-center/card/release.json','/var/www/dnd-center/library/release.json','/var/www/obr-plugins/suite-dev/release.json','/var/www/obr-plugins/suite/release.json','/etc/systemd/system/dnd-card-cloud.service','/opt/obr-workbench-relay-dev/server.mjs','/opt/obr-three-dragon/server.mjs']}
 assert json.loads((root/'card/release.json').read_text())['version']=='standalone-1.0.295'
 assert json.loads(Path('/var/www/obr-plugins/suite-dev/release.json').read_text())['version']=='1.0.295-dev'
 assert json.loads(Path('/var/www/obr-plugins/suite/release.json').read_text())['version']=='1.3.32'
 for name,digest in manifest['files'].items():assert sha(p/'files'/name)==digest
 for name in ['index.html',asset]:assert gzip.decompress((p/'files'/(name+'.gz')).read_bytes())==(p/'files'/name).read_bytes()
 html=(p/'files/index.html').read_text();script=(p/'files'/asset).read_text()
 assert '/api/auth/qq/' not in html and '/api/session' not in script and '/api/logout' not in script
 assert 'id="library" class="entry entry-library" aria-disabled="true"' in html and 'class="qq-session" hidden' in html
 before={name:sha(root/name) for name in manifest['files']}
 assert before[asset] is None and before[asset+'.gz'] is None
 backup=p/'backup';backup.mkdir(mode=0o700)
 for name,digest in before.items():
  if digest:
   dest=backup/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/name,dest);assert sha(dest)==digest
 changed=[]
 try:
  for name in [asset,asset+'.gz','index.html.gz','index.html']:
   target=root/name;temp=target.with_name(target.name+'.cloud295.new');assert not temp.exists()
   shutil.copyfile(p/'files'/name,temp);temp.chmod(0o644);os.replace(temp,target);changed.append(name)
  assert all(sha(root/name)==digest for name,digest in manifest['files'].items())
  assert all(sha(Path(path))==digest for path,digest in protected.items())
  for name in ['index.html',asset]:
   with urllib.request.urlopen('https://dnd.center/'+name+'?verify=cloud295',timeout=15) as response:assert hashlib.sha256(response.read()).hexdigest()==manifest['files'][name]
 except BaseException:
  for name in reversed(changed):
   if before[name] is None:(root/name).unlink()
   else:shutil.copy2(backup/name,root/name)
  assert all(sha(root/name)==digest for name,digest in before.items());raise
 result={'status':'published','release':key,'files':manifest['files'],'baseline':before,'oldAssetPreserved':True,'backup':str(backup),'protectedPreserved':True,'dataChanged':False,'QQSessionRequestsInControlledCheck':0,'realBrowserAcceptance':False,'finishedAt':datetime.now(timezone.utc).isoformat()}
 record(result);print(json.dumps(result))
