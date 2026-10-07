"""Static-only dnd.center release with sealed inputs, atomic swap and guarded rollback."""
from pathlib import Path
import argparse, fcntl, importlib.util, json, os, re, shutil, sqlite3
from datetime import datetime, timezone

spec=importlib.util.spec_from_file_location('migration',Path(__file__).with_name('publish.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path('/var/www/dnd-center')
SERVICE=Path('/opt/dnd-card-cloud')
UNIT=Path('/etc/systemd/system/dnd-card-cloud.service')
DB=Path('/var/lib/dnd-card-cloud/cards.sqlite')
RECEIPTS=Path('/root/codex-release-receipts')
require,sha,tree=m.require,m.sha,m.tree

def protected():
    current=(SERVICE/'current').resolve()
    require(current.parent==SERVICE/'releases','Unexpected backend target')
    return {**m.protected(),'old-card':m.digest(tree(m.OLD)),
      'dnd-nginx':sha(m.CONFIG),'cloud-backend-target':str(current),
      'cloud-backend':m.digest(tree(current)),'cloud-unit':sha(UNIT),
      'cloud-runtime':sha(SERVICE/'runtime/bin/node'),
      'cloud-state':m.command('systemctl','show','dnd-card-cloud.service','-p','ActiveState','-p','ActiveEnterTimestampMonotonic','-p','NRestarts'),
      **{name:sha(Path('/etc/systemd/system')/name) for name in ['dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']}}

def database_check():
    with sqlite3.connect('file:'+str(DB)+'?mode=ro',uri=True) as db:
        require(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok','SQLite integrity failed')
        return {name:db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0] for name in ['accounts','cards','temporary_cards']}

def snapshot():
    return {'protected':protected(),'frontend':tree(ROOT),'release':json.loads((ROOT/'card/release.json').read_text())}

def receipt_path(manifest): return RECEIPTS/(manifest['release']+'.json')
def write_receipt(manifest,record):
    path=receipt_path(manifest);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');os.replace(temporary,path)

def binding(package,manifest_hash):
    require(sha(package/'manifest.json')==manifest_hash,'Manifest changed')
    manifest=json.loads((package/'manifest.json').read_text())
    require(re.fullmatch(r'dnd-center-[a-z0-9-]{1,80}',manifest['release']),'Invalid release key')
    require(manifest['publisherSha256']==sha(Path(__file__)),'Publisher changed')
    require(manifest['baselineSha256']==sha(package/'baseline.json'),'Baseline changed')
    for name,digest in manifest['packageFiles'].items():
        require(re.fullmatch(r'[a-zA-Z0-9_.-]+',name) and sha(package/name)==digest,'Package changed: '+name)
    require(manifest['packageFiles'].get('publish.py')==sha(Path(m.__file__)),'Shared publisher changed')
    require(manifest['backendChanged'] is False and manifest['playerDataChanged'] is False,'Unsupported release scope')
    require(re.fullmatch(r'[a-f0-9]{40}',manifest['sourceCommit']),'Invalid source binding')
    return manifest,json.loads((package/'baseline.json').read_text())

def preflight(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    require(not receipt_path(manifest).exists(),'Existing receipt requires review')
    require(snapshot()==baseline,'Live baseline drift; stopped')
    require(baseline['release']['version']==manifest['previousVersion'] and baseline['release']['sourceCommit']==manifest['previousSourceCommit'],'Unexpected release baseline')
    require(shutil.disk_usage(ROOT).free>200_000_000,'Insufficient staging and backup space')
    require(m.command('systemctl','is-active','dnd-card-cloud.service')=='active','Backend inactive')
    database_check()
    return manifest,baseline

def verify(manifest):
    resolve=['--resolve','dnd.center:443:127.0.0.1']
    for path in ['index.html','card/index.html','library/index.html','card/sw.js','card/release.json','library/release.json']:
        url='https://dnd.center/'+('' if path=='index.html' else path.replace('/index.html','/'))
        m.wait_http(url,resolve,manifest['frontendFiles'][path])
    health=json.loads(m.wait_http('https://dnd.center/api/health',resolve))
    require(health['version']==manifest['backendVersion'] and health.get('temporaryUpload') is True and health.get('quotaScope')=='ip' and health.get('qqLogin')=='pending','API policy changed')

def stage_path(manifest,kind): return ROOT.parent/('.dnd-center-'+kind+'-'+manifest['release'])

def apply(package,manifest_hash):
    manifest,baseline=preflight(package,manifest_hash)
    backup=package/'backup';require(not backup.exists(),'Backup already exists');backup.mkdir(mode=0o700)
    shutil.copytree(ROOT,backup/'frontend');require(tree(backup/'frontend')==baseline['frontend'],'Backup mismatch')
    stage=stage_path(manifest,'stage');m.unpack(package/'frontend.tar.gz',stage,manifest['frontendFiles'])
    release=json.loads((stage/'card/release.json').read_text())
    require(release['version']==manifest['version'] and release['sourceCommit']==manifest['sourceCommit'],'Application binding mismatch')
    require(snapshot()==baseline,'Drift during staging; stopped')
    record={'release':manifest['release'],'status':'prepared','at':datetime.now(timezone.utc).isoformat(),'sourceCommit':manifest['sourceCommit'],'protectedBefore':baseline['protected'],'frontendFiles':manifest['frontendFiles'],'backup':str(backup),'backendChanged':False,'databaseReplaced':False,'databaseBefore':database_check()}
    write_receipt(manifest,record);switched=False
    try:
        m.exchange(ROOT,stage);switched=True;verify(manifest)
        require(tree(ROOT)==manifest['frontendFiles'] and protected()==baseline['protected'],'Post-publication drift')
        record.update(status='published',protectedAfter=protected(),databaseAfter=database_check(),finishedAt=datetime.now(timezone.utc).isoformat());write_receipt(manifest,record)
        return {'status':'published','version':manifest['version'],'sourceCommit':manifest['sourceCommit'],'protectedItems':len(record['protectedAfter']),'receipt':str(receipt_path(manifest)),'databasePreserved':True,'backendChanged':False}
    except Exception:
        if switched:
            require(tree(ROOT)==manifest['frontendFiles'],'External frontend drift; automatic restore refused')
            m.exchange(ROOT,stage)
        m.wait_http('https://dnd.center/card/',['--resolve','dnd.center:443:127.0.0.1'],baseline['frontend']['card/index.html'])
        require(protected()==baseline['protected'],'Protected drift during recovery')
        record.update(status='failed-restored',databaseAfter=database_check());write_receipt(manifest,record);raise

def rollback(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash);record=json.loads(receipt_path(manifest).read_text())
    require(record['status']=='published','Release is not published')
    require(protected()==record['protectedAfter'],'Protected drift; rollback refused')
    require(tree(ROOT)==record['frontendFiles'],'Live frontend drift; rollback refused')
    backup=package/'backup'/'frontend';require(tree(backup)==baseline['frontend'],'Backup drift')
    stage=stage_path(manifest,'rollback');require(not stage.exists(),'Rollback stage exists');shutil.copytree(backup,stage)
    require(tree(ROOT)==record['frontendFiles'] and protected()==record['protectedAfter'],'Drift during rollback preparation')
    m.exchange(ROOT,stage)
    m.wait_http('https://dnd.center/card/',['--resolve','dnd.center:443:127.0.0.1'],baseline['frontend']['card/index.html'])
    require(tree(ROOT)==baseline['frontend'] and protected()==record['protectedAfter'],'Rollback verification failed')
    record.update(status='rolled-back',databaseAfterRollback=database_check(),rolledBackAt=datetime.now(timezone.utc).isoformat());write_receipt(manifest,record)
    return {'status':'rolled-back','version':manifest['previousVersion'],'databasePreserved':True,'backendChanged':False}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--capture',action='store_true');parser.add_argument('--manifest-sha');parser.add_argument('--apply',action='store_true');parser.add_argument('--rollback',action='store_true');args=parser.parse_args()
    require(sum([args.capture,args.apply,args.rollback])<=1,'Choose one action')
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if args.capture:result=snapshot()
        else:
            require(args.manifest_sha is not None,'Manifest SHA required')
            if args.apply:result=apply(args.package,args.manifest_sha)
            elif args.rollback:result=rollback(args.package,args.manifest_sha)
            else:preflight(args.package,args.manifest_sha);result={'status':'preflight-passed'}
        print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
