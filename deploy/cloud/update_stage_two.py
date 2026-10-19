"""Atomic frontend-only update of an existing lab; never restart or copy its database."""
import contextlib, ctypes, json, os, pathlib, shutil, sqlite3, sys, time
from stage_two import digest, tree, db_digest, run, atomic_write
P=pathlib.Path

def checked_payload(stage, manifest):
 assert manifest['scope']=='standalone-private-cloud-stage2-frontend-update'
 assert len(manifest['commit'])==40 and all(c in '0123456789abcdef' for c in manifest['commit'])
 for relative,sha in manifest['files'].items():
  path=stage/relative
  assert not path.is_symlink() and path.resolve().is_relative_to(stage)
  assert relative.split('/')[0] in ['card','library'] and digest(path)==sha
 assert set(tree(stage))==set(manifest['files'])|{'manifest.json'}
 assert {'card/index.html','card/release.json','library/index.html','library/release.json'}<=set(manifest['files'])

def overlay(old,stage,next_path):
 shutil.copytree(old,next_path)
 for folder in ['card','library']:
  for source in (stage/folder).rglob('*'):
   if source.is_file():
    destination=next_path/source.relative_to(stage);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)
 # Previously loaded tabs can still request their exact hashed JS/CSS files.
 mutable={'card/assets/automation-progress.audit.json','library/assets/automation-progress.audit.json'}
 for relative,sha in tree(old).items():
  normalized=relative.replace('\\','/')
  if '/assets/' in '/'+normalized and normalized not in mutable:assert digest(next_path/relative)==sha

def exchange(a,b):
 libc=ctypes.CDLL(None,use_errno=True)
 if libc.renameat2(-100,os.fsencode(a),-100,os.fsencode(b),2)!=0:
  code=ctypes.get_errno();raise OSError(code,os.strerror(code))

def publish(stage):
 import fcntl
 stage=stage.resolve();manifest=json.loads((stage/'manifest.json').read_text());checked_payload(stage,manifest)
 commit=manifest['commit'];receipt=P('/root/codex-release-receipts/cloud-lab2-frontend-'+commit+'.json')
 if receipt.exists():print(receipt.read_text());return
 marker=receipt.with_suffix('.pending.json')
 if marker.exists():raise RuntimeError('Inspect the durable frontend update marker before any retry')
 site=P('/var/www/dnd-center');public=site/'cloud-lab';backend=P('/opt/dnd-card-cloud-lab2');database=P('/var/lib/dnd-card-cloud-lab2/cards.sqlite')
 config=P('/etc/nginx/sites-available/dnd-center-retired.conf');formal=P('/var/lib/dnd-card-cloud/cards.sqlite')
 assert public.is_dir() and not public.is_symlink() and database.is_file()
 lock=open('/run/lock/obr-static-release.lock','a')
 with lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  assert digest(public/'card/index.html')==manifest['previousCardIndexSha256']
  assert digest(public/'library/index.html')==manifest['previousLibraryIndexSha256']
  pid=run('systemctl','show','--property=MainPID','--value','dnd-card-cloud-lab2.service');assert pid!='0'
  identity=(database.stat().st_dev,database.stat().st_ino)
  before={'formal':tree(site,public),'formalDatabase':db_digest(formal),'nginx':digest(config),'backend':tree(backend),'pid':pid}
  required=sum(p.stat().st_size for p in public.rglob('*') if p.is_file())*3+256*1024*1024
  assert shutil.disk_usage(site).free>required
  backup=P('/root/codex-backups/cloud-lab2-frontend-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));backup.mkdir(mode=0o700)
  shutil.copytree(public,backup/'cloud-lab');(backup/'protected-before.json').write_text(json.dumps(before))
  next_path=site/('.cloud-lab-next-'+commit[:12]);assert not next_path.exists();overlay(public,stage,next_path)
  marker.write_text(json.dumps({'commit':commit,'backup':str(backup),'exchangePeer':str(next_path)}))
  switched=False;committed=False;peer=next_path
  try:
   exchange(public,next_path);switched=True
   for folder in ['card','library']:
    release=json.loads(run('curl','-fsS','--resolve','dnd.center:443:127.0.0.1','https://dnd.center/cloud-lab/'+folder+'/release.json'))
    assert release['sourceCommit']==commit
   assert tree(site,public)=={**before['formal'],**{str(p.relative_to(site)):digest(p) for p in next_path.rglob('*') if p.is_file()}}
   assert db_digest(formal)==before['formalDatabase'] and digest(config)==before['nginx'] and tree(backend)==before['backend']
   assert run('systemctl','show','--property=MainPID','--value','dnd-card-cloud-lab2.service')==pid
   assert (database.stat().st_dev,database.stat().st_ino)==identity
   with contextlib.closing(sqlite3.connect(database.as_uri()+'?mode=ro',uri=True)) as db:assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
   # Retain the exchanged old tree privately. It is never a site payload.
   retained=backup/'exchanged-old-tree';os.rename(next_path,retained);peer=retained
   assert tree(site,public)==before['formal']
   result={'status':'published-isolated-lab-frontend-update','commit':commit,'backup':str(backup),'entry':'https://dnd.center/cloud-lab/card/?intro=0','productionUnchanged':True,'backendNotRestarted':True,'databaseNotReplaced':True,'oldAssetsRetained':True}
   atomic_write(receipt,json.dumps(result,indent=2));committed=True;marker.rename(backup/'completed.json')
   print(json.dumps(result))
  except Exception:
   if not committed:
    if switched:exchange(public,peer)
    marker.rename(backup/'failed.json')
   raise

if __name__=='__main__':publish(P(sys.argv[1]))
