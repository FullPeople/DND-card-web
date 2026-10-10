"""Sealed QQ backend upgrade; existing frontend and player database are preserved."""
from pathlib import Path
import argparse,importlib.util,json,os,re,shutil,sqlite3,subprocess,tempfile
from datetime import datetime,timezone

guard=Path(__file__).with_name('publish.py')
if not guard.exists():guard=Path(__file__).parent.parent/'cloud/publish.py'
spec=importlib.util.spec_from_file_location('guard',guard)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path('/var/www/dnd-center');SERVICE=Path('/opt/dnd-card-cloud')
UNIT=Path('/etc/systemd/system/dnd-card-cloud.service');DB=Path('/var/lib/dnd-card-cloud/cards.sqlite')
RECEIPTS=Path('/root/codex-release-receipts')
require,sha,tree=m.require,m.sha,m.tree

def protected():
    return {**m.protected(),'old-card':m.digest(tree(m.OLD)),'dnd-nginx':sha(m.CONFIG),
      **{name:sha(Path('/etc/systemd/system')/name) for name in ['dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']}}
def database():
    with sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True) as db:
        require(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok','SQLite integrity failed')
        return {name:db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0] for name in ['accounts','cards','temporary_cards']}
def snapshot():
    current=(SERVICE/'current').resolve();require(current.parent==SERVICE/'releases','Unexpected backend pointer')
    stat=DB.stat()
    return {'protected':protected(),'frontend':tree(ROOT),'backendTarget':str(current),'backend':tree(current),'unit':sha(UNIT),'databaseIdentity':[stat.st_dev,stat.st_ino]}
def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);fd,name=tempfile.mkstemp(dir=path.parent,prefix='.'+path.name)
    with os.fdopen(fd,'w') as stream:json.dump(data,stream,ensure_ascii=False,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
    os.replace(name,path)
def bind(package,seal):
    require(sha(package/'manifest.json')==seal,'Manifest changed');d=json.loads((package/'manifest.json').read_text())
    require(re.fullmatch(r'dnd-center-qq-backend-[a-z0-9-]+',d['release']) and re.fullmatch(r'[a-f0-9]{40}',d['sourceCommit']),'Invalid source/release')
    require(d['publisherSha256']==sha(Path(__file__)) and d['baselineSha256']==sha(package/'baseline.json'),'Publisher/baseline changed')
    for name,value in d['packageFiles'].items():require(re.fullmatch(r'[a-zA-Z0-9_.-]+',name) and sha(package/name)==value,'Package changed')
    require(d['packageFiles']['publish.py']==sha(Path(m.__file__)),'Guard changed')
    require(set(d['backendFiles'])=={'server.mjs','backup.mjs'} and d['databaseReplaced'] is False,'Invalid scope')
    require(d.get('cloudMode','temporary-ip') in ['temporary-ip','account-private'],'Invalid cloud mode')
    return d,json.loads((package/'baseline.json').read_text())
def preflight(package,seal):
    d,b=bind(package,seal);require(not(RECEIPTS/(d['release']+'.json')).exists(),'Existing receipt');require(snapshot()==b,'Live baseline drift')
    require(shutil.disk_usage(ROOT).free>200000000,'Insufficient backup space');require(m.command('systemctl','is-active','dnd-card-cloud')=='active','Backend inactive');database()
    if d.get('cloudMode')=='account-private':
        health=json.loads(m.wait_http('http://127.0.0.1:5014/api/health'))
        require(health.get('accountLibrariesPrivate') is True and health.get('permissionsVersion')==1,'Publish the privacy-ready backend in temporary mode first')
    return d,b
def switch(target,key):
    require(target.parent==SERVICE/'releases' and target.is_dir() and not target.is_symlink(),'Unsafe backend target');pointer=SERVICE/('current-'+key)
    require(not pointer.exists() and not pointer.is_symlink(),'Switch pointer already exists');pointer.symlink_to(target);os.replace(pointer,SERVICE/'current')
def restart():
    subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','dnd-card-cloud'],check=True)
def verify(cloud_mode='temporary-ip',backend_version='1.0.261'):
    health=json.loads(m.wait_http('http://127.0.0.1:5014/api/health'));require(health['version']==backend_version and health['qqOAuthSupported'] is True,'QQ backend health differs')
    if cloud_mode=='account-private':
        require(health.get('qqLogin')=='ready' and health.get('permissionsVersion')==1 and health.get('accountPrivate') is True and health.get('temporaryUpload') is False and health.get('publicDirectory') is False and health.get('quotaScope')=='account','Private account policy differs')
    else:require(health.get('temporaryUpload') is True,'Temporary upload policy differs')
    return health
def apply(package,seal):
    d,b=preflight(package,seal);key=d['release'];backup=package/'backup';require(not backup.exists(),'Backup exists');backup.mkdir(mode=0o700)
    shutil.copytree(Path(b['backendTarget']),backup/'backend');shutil.copy2(UNIT,backup/'cloud.service')
    require(tree(backup/'backend')==b['backend'] and sha(backup/'cloud.service')==b['unit'],'Fresh backup differs')
    with sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True) as source,sqlite3.connect(backup/'cards.sqlite') as target:source.backup(target)
    os.chmod(backup/'cards.sqlite',0o600)
    release=SERVICE/'releases'/key;m.unpack(package/'backend.tar.gz',release,d['backendFiles']);require(snapshot()==b,'Drift during staging')
    record={'release':key,'sourceCommit':d['sourceCommit'],'status':'prepared','backup':str(backup),'previousBackend':b['backendTarget'],'databaseReplaced':False,'databaseBefore':database(),'at':datetime.now(timezone.utc).isoformat()};receipt=RECEIPTS/(key+'.json');write(receipt,record)
    switched=False
    try:
        shutil.copy2(package/'dnd-card-cloud.service',UNIT);switch(release,key);switched=True;restart();health=verify(d.get('cloudMode','temporary-ip'),d.get('backendVersion','1.0.261'))
        require(protected()==b['protected'] and tree(ROOT)==b['frontend'] and tree(release)==d['backendFiles'],'Protected drift after switch')
        record.update(status='published',protectedAfter=protected(),frontendPreserved=True,newUnit=sha(UNIT),backendFiles=d['backendFiles'],databaseAfter=database(),qqLogin=health['qqLogin'],cloudMode=d.get('cloudMode','temporary-ip'),finishedAt=datetime.now(timezone.utc).isoformat());write(receipt,record)
    except Exception:
        shutil.copy2(backup/'cloud.service',UNIT)
        if switched:switch(Path(b['backendTarget']),key+'-restore')
        restart();m.wait_http('http://127.0.0.1:5014/api/health');require(protected()==b['protected'] and tree(ROOT)==b['frontend'],'Failure recovery drift')
        record.update(status='failed-restored');write(receipt,record);raise
    return {name:record[name] for name in ['status','release','sourceCommit','backup','databaseReplaced','frontendPreserved','qqLogin']}
def rollback(package,seal):
    d,b=bind(package,seal);receipt=RECEIPTS/(d['release']+'.json');r=json.loads(receipt.read_text())
    require(r['status']=='published' and protected()==r['protectedAfter'],'Rollback protection drift')
    require(tree(ROOT)==b['frontend'] and tree((SERVICE/'current').resolve())==r['backendFiles'] and sha(UNIT)==r['newUnit'],'Rollback live drift')
    require(tree(Path(b['backendTarget']))==b['backend'] and sha(package/'backup/cloud.service')==b['unit'],'Rollback backup drift')
    shutil.copy2(package/'backup/cloud.service',UNIT);switch(Path(b['backendTarget']),d['release']+'-rollback');restart();m.wait_http('http://127.0.0.1:5014/api/health')
    r.update(status='rolled-back',databaseReplaced=False);write(receipt,r);return {'status':'rolled-back','databaseReplaced':False}
if __name__=='__main__':
    import fcntl
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--capture',action='store_true');p.add_argument('--seal');p.add_argument('--apply',action='store_true');p.add_argument('--rollback',action='store_true');a=p.parse_args()
    require(a.package.resolve().parent==Path('/root/codex-release-packages'),'Invalid package root')
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        result=snapshot() if a.capture else rollback(a.package,a.seal) if a.rollback else apply(a.package,a.seal) if a.apply else {'preflightPassed':bool(preflight(a.package,a.seal))}
        print(json.dumps(result,ensure_ascii=False,indent=2))
