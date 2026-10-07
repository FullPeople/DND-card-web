"""Scoped upgrade of the existing dnd.center cloud service; SQLite is never replaced."""
from pathlib import Path
import argparse, fcntl, importlib.util, json, os, re, shutil, sqlite3, subprocess
from datetime import datetime, timezone
spec=importlib.util.spec_from_file_location('cloud_migration',Path(__file__).with_name('publish.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
KEY='dnd-center-temporary253-20261007'
ROOT=Path('/var/www/dnd-center')
SERVICE=Path('/opt/dnd-card-cloud')
UNIT=Path('/etc/systemd/system/dnd-card-cloud.service')
DB=Path('/var/lib/dnd-card-cloud/cards.sqlite')
JOURNAL=Path('/root/codex-release-receipts')/(KEY+'.json')
require,sha,tree=m.require,m.sha,m.tree

def protected():
    return {**m.protected(),'old-card':m.digest(tree(m.OLD)),'dnd-nginx':sha(m.CONFIG),'backup-service':sha(Path('/etc/systemd/system/dnd-card-cloud-backup.service')),'backup-timer':sha(Path('/etc/systemd/system/dnd-card-cloud-backup.timer'))}
def database_check():
    with sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True) as db:
        require(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok','SQLite integrity check failed')
        return {name:db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0] for name in ['accounts','cards','temporary_cards'] if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(name,)).fetchone()}
def snapshot():
    target=(SERVICE/'current').resolve();require(target.parent==SERVICE/'releases','Unexpected current backend path')
    require(m.command('systemctl','is-active','dnd-card-cloud.service')=='active','Cloud service is not active')
    return {'protected':protected(),'frontend':tree(ROOT),'backendTarget':str(target),'backend':tree(target),'unit':sha(UNIT),'release':json.loads((ROOT/'card/release.json').read_text()),'database':database_check()}
def write_receipt(value):
    JOURNAL.parent.mkdir(parents=True,exist_ok=True);temporary=JOURNAL.with_suffix('.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');os.replace(temporary,JOURNAL)
def switch_backend(target):
    require(target.parent==SERVICE/'releases' and target.is_dir() and not target.is_symlink(),'Unsafe backend target')
    temporary=SERVICE/('current-'+KEY);require(not temporary.exists() and not temporary.is_symlink(),'Backend switch path already exists');temporary.symlink_to(target);os.replace(temporary,SERVICE/'current')
def restart():
    subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','dnd-card-cloud.service'],check=True)
def verify(manifest):
    resolve=['--resolve','dnd.center:443:127.0.0.1']
    for path in ['index.html','card/index.html','library/index.html','card/sw.js','card/release.json']:
        url='https://dnd.center/'+('' if path=='index.html' else path.replace('/index.html','/'))
        m.wait_http(url,resolve,manifest['frontendFiles'][path])
    health=json.loads(m.wait_http('https://dnd.center/api/health',resolve))
    require(health.get('temporaryUpload') is True and health['version']=='1.0.253' and health.get('quotaScope')=='ip','New API policy differs')
    require(json.loads(m.wait_http('https://dnd.center/api/cards',resolve)).get('cards') is not None,'Public directory unavailable')
def binding(package,manifest_hash):
    require(sha(package/'manifest.json')==manifest_hash,'Manifest hash changed')
    manifest=json.loads((package/'manifest.json').read_text())
    require(manifest['release']==KEY and manifest['publisherSha256']==sha(Path(__file__)),'Publisher binding mismatch')
    for name,digest in manifest['packageFiles'].items():require('/' not in name and sha(package/name)==digest,'Package mismatch: '+name)
    require(manifest['baselineSha256']==sha(package/'baseline.json'),'Baseline binding mismatch')
    return manifest,json.loads((package/'baseline.json').read_text())
def preflight(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    require(not JOURNAL.exists(),'A previous upgrade receipt requires review')
    require(snapshot()==baseline,'Live baseline drift; stopped')
    require(baseline['release']['version']=='standalone-1.0.252','Unexpected frontend baseline')
    require(shutil.disk_usage(ROOT).free>200_000_000,'Insufficient disk space for stage and fresh backups')
    require(m.command(str(SERVICE/'runtime/bin/node'),'--version')=='v24.9.0','Runtime changed')
    return manifest,baseline

def apply(package,manifest_hash):
    manifest,baseline=preflight(package,manifest_hash);backup=package/'backup';require(not backup.exists(),'Backup already exists');backup.mkdir(mode=0o700)
    shutil.copytree(ROOT,backup/'frontend');shutil.copytree(Path(baseline['backendTarget']),backup/'backend');shutil.copy2(UNIT,backup/'cloud.service')
    require(tree(backup/'frontend')==baseline['frontend'] and tree(backup/'backend')==baseline['backend'] and sha(backup/'cloud.service')==baseline['unit'],'Fresh backup mismatch')
    with sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True) as source,sqlite3.connect(backup/'cards.sqlite') as destination:source.backup(destination)
    os.chmod(backup/'cards.sqlite',0o600)
    stage=Path('/var/www/.dnd-center-stage-'+KEY);release=SERVICE/'releases'/KEY
    m.unpack(package/'frontend.tar.gz',stage,manifest['frontendFiles']);m.unpack(package/'backend.tar.gz',release,manifest['backendFiles'])
    require(json.loads((stage/'card/release.json').read_text())['sourceCommit']==manifest['sourceCommit'],'Application source binding differs')
    require(snapshot()==baseline,'Drift during staging; stopped')
    record={'release':KEY,'status':'prepared','at':datetime.now(timezone.utc).isoformat(),'sourceCommit':manifest['sourceCommit'],'backup':str(backup),'protectedBefore':baseline['protected'],'frontendFiles':manifest['frontendFiles'],'backendFiles':manifest['backendFiles'],'previousBackend':baseline['backendTarget'],'previousUnit':baseline['unit'],'newUnit':sha(package/'dnd-card-cloud.service'),'databaseBefore':baseline['database'],'databaseBackupSha256':sha(backup/'cards.sqlite'),'databaseReplaced':False}
    write_receipt(record);front_switched=False;backend_switched=False
    try:
        require(protected()==baseline['protected'],'Protected drift before switch')
        shutil.copy2(package/'dnd-card-cloud.service',UNIT);switch_backend(release);backend_switched=True;restart()
        require(json.loads(m.wait_http('http://127.0.0.1:5014/api/health')).get('temporaryUpload') is True,'Backend readiness failed')
        m.exchange(ROOT,stage);front_switched=True;verify(manifest)
        require(tree(ROOT)==manifest['frontendFiles'] and tree(release)==manifest['backendFiles'] and protected()==baseline['protected'],'Post-switch drift')
        record.update(status='published',protectedAfter=protected(),databaseAfter=database_check(),finishedAt=datetime.now(timezone.utc).isoformat());write_receipt(record)
        return {'status':'published','version':'standalone-1.0.253','sourceCommit':manifest['sourceCommit'],'protectedItems':len(record['protectedAfter']),'receipt':str(JOURNAL),'databasePreserved':True}
    except Exception:
        if front_switched:m.exchange(ROOT,stage)
        shutil.copy2(backup/'cloud.service',UNIT)
        if backend_switched:switch_backend(Path(baseline['backendTarget']))
        restart();m.wait_http('https://dnd.center/card/',['--resolve','dnd.center:443:127.0.0.1'],baseline['frontend']['card/index.html'])
        require(protected()==baseline['protected'],'Protected state changed during failure recovery')
        record.update(status='failed-restored',databasePreserved=True);write_receipt(record);raise

def rollback(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash);record=json.loads(JOURNAL.read_text());backup=package/'backup'
    require(record['status']=='published','Upgrade is not published')
    require(protected()==record['protectedAfter'],'Protected state drift; rollback refused')
    require(tree(ROOT)==record['frontendFiles'] and tree((SERVICE/'current').resolve())==record['backendFiles'] and sha(UNIT)==record['newUnit'],'Live application drift; rollback refused')
    require(tree(backup/'frontend')==baseline['frontend'] and tree(backup/'backend')==baseline['backend'] and sha(backup/'cloud.service')==baseline['unit'],'Backup drift')
    require(tree(Path(record['previousBackend']))==baseline['backend'],'Previous backend drift')
    stage=Path('/var/www/.dnd-center-rollback-'+KEY);require(not stage.exists(),'Rollback stage exists');shutil.copytree(backup/'frontend',stage)
    m.exchange(ROOT,stage);shutil.copy2(backup/'cloud.service',UNIT);switch_backend(Path(record['previousBackend']));restart()
    require(json.loads(m.wait_http('http://127.0.0.1:5014/api/health'))['version']=='1.0.252','Previous backend readiness failed')
    m.wait_http('https://dnd.center/card/',['--resolve','dnd.center:443:127.0.0.1'],baseline['frontend']['card/index.html'])
    require(protected()==record['protectedAfter'],'Protected state changed during rollback')
    record.update(status='rolled-back',databasePreserved=True,databaseAfterRollback=database_check(),rolledBackAt=datetime.now(timezone.utc).isoformat());write_receipt(record)
    return {'status':'rolled-back','databasePreserved':True,'temporaryUploadsDisabled':True}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--capture',action='store_true');parser.add_argument('--manifest-sha');parser.add_argument('--apply',action='store_true');parser.add_argument('--rollback',action='store_true');args=parser.parse_args()
    require(args.package.resolve()==Path('/root/codex-release-packages')/KEY,'Unexpected package directory')
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if args.capture:result=snapshot()
        else:
            require(bool(re.fullmatch('[a-f0-9]{64}',args.manifest_sha or '')),'Exact manifest hash required')
            if args.apply:result=apply(args.package,args.manifest_sha)
            elif args.rollback:result=rollback(args.package,args.manifest_sha)
            else:manifest,baseline=preflight(args.package,args.manifest_sha);result={'preflightPassed':True,'onlineWrites':False,'sourceCommit':manifest['sourceCommit'],'protectedItems':len(baseline['protected'])}
        print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
