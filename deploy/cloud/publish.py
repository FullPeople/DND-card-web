"""Scoped DND Center migration. Capture/preflight are read-only; apply requires a sealed manifest."""
from pathlib import Path, PurePosixPath
import argparse, ctypes, fcntl, hashlib, json, os, re, shutil, subprocess, tarfile, time, sqlite3
from datetime import datetime, timezone

KEY='dnd-center-migration252-20261007'
NEW=Path('/var/www/dnd-center')
OLD=Path('/var/www/obr-plugins/card')
CONFIG=Path('/etc/nginx/sites-available/dnd-center-retired.conf')
SERVICE=Path('/opt/dnd-card-cloud')
JOURNAL=Path('/root/codex-release-receipts')/(KEY+'.json')

def require(value,message):
    if not value: raise RuntimeError(message)
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()
def tree(path):
    require(path.is_dir() and not path.is_symlink(),'Unsafe tree: '+str(path))
    result={}
    for f in sorted(path.rglob('*')):
        require(not f.is_symlink(),'Linked file: '+str(f))
        if f.is_file(): result[f.relative_to(path).as_posix()]=sha(f)
    return result
def digest(value): return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def command(*args): return subprocess.check_output(args,text=True).strip()
def wait_http(url,resolve=(),expected_sha=None):
    for attempt in range(20):
        response=subprocess.run(['curl','-fsS','--max-time','10',*resolve,url],capture_output=True)
        if response.returncode==0 and response.stdout and (expected_sha is None or hashlib.sha256(response.stdout).hexdigest()==expected_sha): return response.stdout
        if attempt<19: time.sleep(1)
    raise RuntimeError('New HTTP response did not become ready: '+url)
def protected():
    result={}
    for name in ['obr-character-cards','obr-three-dragon','obr-workbench-relay-dev','pm2-root','coturn']:
        result['service:'+name]=command('systemctl','show',name,'-p','ActiveState','-p','ActiveEnterTimestampMonotonic','-p','NRestarts')
    for name in ['suite','suite-dev','three-dragon-ante','three-dragon-ante-dev','studio','focus','full-suite-en','bestiary','5e-search','initiative','character-cards','map-notes']:
        path=OLD.parent/name
        if path.is_dir(): result['static:'+name]=digest(tree(path))
    for file in OLD.parent.iterdir():
        if file.is_file(): result[str(file)]=sha(file)
    for path in [Path('/etc/dnd-card-cloud-qq.env'),Path('/etc/nginx/sites-enabled/obr-plugins'),Path('/etc/ssh/sshd_config'),Path('/root/.ssh/authorized_keys'),Path('/usr/local/libexec/obr-deploy/server_preflight.py'),Path('/etc/sudoers.d/obr-deploy-preflight'),*[Path('/etc/systemd/system')/(name+'.service') for name in ['obr-character-cards','obr-three-dragon','obr-workbench-relay-dev']],*[Path('/opt/obr-workbench-relay-dev')/name for name in ['server.mjs','documents.mjs','patches.mjs']],Path('/opt/obr-three-dragon/server.mjs'),Path('/opt/obr-three-dragon/service.mjs')]:
        if path.exists(): result[str(path)]=sha(path)
    for path in Path('/etc/nginx/sites-enabled').iterdir():
        if path.resolve()!=CONFIG.resolve() and path.is_file(): result['nginx:'+str(path)]=sha(path)
    return result
def snapshot():
    return {'protected':protected(),'old':tree(OLD),'retiredConfig':sha(CONFIG),'newExists':NEW.exists(),'backendExists':SERVICE.exists(),'cloudUnitsExist':any((Path('/etc/systemd/system')/name).exists() for name in ['dnd-card-cloud.service','dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']),'cloudDatabaseExists':Path('/var/lib/dnd-card-cloud').exists(),'cloudBackupsExist':Path('/var/backups/dnd-card-cloud').exists(),'oldRelease':json.loads((OLD/'release.json').read_text())}
def exchange(a,b):
    require(a.is_dir() and b.is_dir() and not a.is_symlink() and not b.is_symlink(),'Unsafe atomic exchange')
    fn=getattr(ctypes.CDLL(None,use_errno=True),'renameat2',None);require(fn is not None,'Atomic exchange unavailable')
    require(fn(-100,os.fsencode(a),-100,os.fsencode(b),2)==0,'Atomic exchange failed')
def unpack(archive,destination,expected):
    require(not destination.exists(),'Staging path exists')
    with tarfile.open(archive) as z:
        seen=set()
        for member in z.getmembers():
            path=PurePosixPath(member.name);require(not path.is_absolute() and '..' not in path.parts and (member.isdir() or member.isfile()),'Unsafe archive member')
            if member.isfile(): require(member.name not in seen,'Duplicate file');seen.add(member.name)
        destination.mkdir(parents=True);z.extractall(destination,filter='data')
    require(tree(destination)==expected,'Staged artifact hashes differ')
def journal(value):
    JOURNAL.parent.mkdir(parents=True,exist_ok=True);temporary=JOURNAL.with_suffix('.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');os.replace(temporary,JOURNAL)
def preflight(package,manifest_hash):
    require(sha(package/'manifest.json')==manifest_hash,'Manifest hash changed')
    manifest=json.loads((package/'manifest.json').read_text());baseline=json.loads((package/'baseline.json').read_text())
    require(manifest['release']==KEY and sha(package/'baseline.json')==manifest['baselineSha256'] and sha(Path(__file__))==manifest['publisherSha256'],'Package binding mismatch')
    for name,expected in manifest['packageFiles'].items():
        require('/' not in name and sha(package/name)==expected,'Package file mismatch: '+name)
    require(not JOURNAL.exists(),'An existing migration receipt requires review')
    require(snapshot()==baseline,'Live baseline drift; stopped')
    require(not baseline['newExists'] and not baseline['backendExists'],'This first migration requires absent new roots')
    require(not baseline['cloudUnitsExist'] and not baseline['cloudDatabaseExists'] and not baseline['cloudBackupsExist'],'Unexpected existing cloud service/data; stopped')
    require(baseline['oldRelease']['version']=='standalone-1.0.251','Unexpected old release')
    require(shutil.disk_usage('/var/www').free>700_000_000,'Insufficient disk for full backups')
    return manifest,baseline
def apply(package,manifest_hash):
    manifest,baseline=preflight(package,manifest_hash)
    backup=package/'backup';require(not backup.exists(),'Backup path exists');backup.mkdir()
    shutil.copytree(OLD,backup/'card');require(tree(backup/'card')==baseline['old'],'Full old-card backup mismatch');shutil.copy2(CONFIG,backup/'dnd-center.conf')
    newstage=Path('/var/www/.dnd-center-stage-'+KEY);oldstage=OLD.parent/('.card-migration-stage-'+KEY)
    unpack(package/'frontend.tar.gz',newstage,manifest['frontendFiles'])
    shutil.copytree(OLD,oldstage)
    # Keep the original complete card application, saved-data origin and assets.
    # A dismissible migration notice is additive; it never redirects or clears data.
    html=(oldstage/'index.html').read_text();html=html.replace('</body>','<script src="./migration-notice.js"></script></body>');(oldstage/'index.html').write_text(html)
    shutil.copy2(package/'migration-notice.js',oldstage/'migration-notice.js')
    worker=(oldstage/'sw.js').read_text();worker,n=re.subn(r'(const CACHE = PREFIX \+ )[^;]+;',lambda m:m[1]+json.dumps('migration252-'+sha(oldstage/'index.html')[:12])+';',worker,count=1);require(n==1,'Old worker cache pattern differs');(oldstage/'sw.js').write_text(worker)
    old_expected={**baseline['old'],**{name:sha(oldstage/name) for name in ['index.html','sw.js','migration-notice.js']}};require(tree(oldstage)==old_expected,'Old site changed outside migration notice')
    require(snapshot()==baseline,'Drift while creating backups/staging')
    record={'release':KEY,'status':'prepared','at':datetime.now(timezone.utc).isoformat(),'backup':str(backup),'sourceCommit':manifest['sourceCommit'],'protectedBefore':baseline['protected'],'newFiles':manifest['frontendFiles'],'oldFiles':old_expected,'backendFiles':manifest['backendFiles'],'oldBefore':baseline['old'],'oldConfigSha256':baseline['retiredConfig'],'newConfigSha256':sha(package/'nginx.conf'),'oldStage':str(oldstage),'playerDataWritten':False}
    journal(record);switched_old=False;switched_new=False;nginx_changed=False
    try:
        SERVICE.mkdir();(SERVICE/'releases').mkdir();runtime=SERVICE/'runtime';runtime.mkdir()
        require(sha(Path('/root/dnd-center-node-v24.9.0.tar.xz'))=='f52ec50e959d72d5c680d9731420b2661cd2a8070e94c7369b6ddfcd8b7278be','Node runtime checksum differs')
        subprocess.run(['tar','-xJf','/root/dnd-center-node-v24.9.0.tar.xz','--strip-components=1','-C',str(runtime)],check=True)
        require(command(str(runtime/'bin/node'),'--version')=='v24.9.0','Wrong runtime')
        release=SERVICE/'releases'/KEY;unpack(package/'backend.tar.gz',release,manifest['backendFiles']);(SERVICE/'current').symlink_to(release)
        Path('/var/backups/dnd-card-cloud').mkdir(mode=0o700)
        for name in ['dnd-card-cloud.service','dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']:
            require(not (Path('/etc/systemd/system')/name).exists(),'Existing cloud unit');shutil.copy2(package/name,Path('/etc/systemd/system')/name)
        subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','enable','--now','dnd-card-cloud.service','dnd-card-cloud-backup.timer'],check=True)
        require(json.loads(command('curl','-fsS','--retry','5','--retry-connrefused','--retry-delay','1','http://127.0.0.1:5014/api/health'))['qqLogin']=='pending','API unhealthy')
        subprocess.run(['systemctl','start','dnd-card-cloud-backup.service'],check=True)
        require(protected()==baseline['protected'],'Protected state changed before switch')
        newstage.rename(NEW);switched_new=True
        exchange(OLD,oldstage);switched_old=True
        shutil.copy2(package/'nginx.conf',CONFIG);nginx_changed=True
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
        verify_https(manifest)
        require(tree(NEW)==manifest['frontendFiles'] and tree(OLD)==old_expected,'Post-switch tree mismatch')
        require(protected()==baseline['protected'],'Protected state changed after switch')
        record.update(status='published',protectedAfter=protected(),finishedAt=datetime.now(timezone.utc).isoformat());journal(record)
        return {'status':'published','version':'standalone-1.0.252','receipt':str(JOURNAL),'backup':str(backup),'cloudLogin':'pending','protectedItems':len(baseline['protected'])}
    except Exception:
        if nginx_changed: shutil.copy2(backup/'dnd-center.conf',CONFIG)
        if switched_old: exchange(OLD,oldstage)
        if switched_new: NEW.rename(Path('/var/www/.dnd-center-failed-'+KEY))
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
        subprocess.run(['systemctl','disable','--now','dnd-card-cloud.service','dnd-card-cloud-backup.timer'],check=False)
        record['status']='failed-restored';journal(record);raise
def verify_https(manifest):
    resolve=['--resolve','dnd.center:443:127.0.0.1']
    for path,file in [('/','index.html'),('/card/','card/index.html'),('/library/','library/index.html')]:
        wait_http('https://dnd.center'+path,resolve,manifest['frontendFiles'][file])
    require(json.loads(wait_http('https://dnd.center/api/health',resolve))['qqLogin']=='pending','API unhealthy after reload')
def resume_guard(original,prior,external=None):
    require(original==prior,'Original protection evidence differs')
    current=protected()
    if current==original:return original
    require(external is not None,'Protected-state drift; stopped')
    changed={key for key in set(current)|set(original) if current.get(key)!=original.get(key)}
    require(changed=={'static:suite-dev'},'Changes extend beyond the separately published Suite')
    require(external['status']=='published' and set(external['targets'])=={'suite-dev'} and external['writesPlayerData'] is False and external['backendChanged'] is False,'External release is not a completed static-only Suite publication')
    target=external['targets']['suite-dev'];backup=OLD.parent/('suite-dev-before-'+external['release'])
    require(Path(target['backup'])==backup and digest(tree(backup))==original['static:suite-dev'],'External release backup does not match the original protected Suite')
    require(target['published'] is True and tree(OLD.parent/'suite-dev')==target['expectedFiles'],'External release live Suite does not match its receipt')
    expected={**original,'static:suite-dev':digest(target['expectedFiles'])};require(current==expected,'External release does not explain all protected drift')
    return expected
def resume_restored(package,manifest_hash):
    require(sha(package/'manifest.json')==manifest_hash,'Manifest changed');manifest=json.loads((package/'manifest.json').read_text());baseline=json.loads((package/'baseline.json').read_text());record=json.loads(JOURNAL.read_text())
    require(manifest['release']==KEY and sha(package/'baseline.json')==manifest['baselineSha256'] and sha(Path(__file__))==manifest['publisherSha256'],'Package binding mismatch')
    for name,expected in manifest['packageFiles'].items(): require('/' not in name and sha(package/name)==expected,'Package file mismatch: '+name)
    require(record['release']==KEY and record['status']=='failed-restored','Only this restored first migration can resume')
    external=None;preserved=manifest.get('preservedExternalRelease')
    if preserved:
        path=Path(preserved['path']);require(path.parent==JOURNAL.parent and path!=JOURNAL and sha(path)==preserved['sha256'],'External release receipt binding differs');external=json.loads(path.read_text())
    guard=resume_guard(baseline['protected'],record['protectedBefore'],external)
    require(tree(OLD)==baseline['old']==record['oldBefore'] and sha(CONFIG)==baseline['retiredConfig']==record['oldConfigSha256'],'Original site/config is not exactly restored')
    require(not NEW.exists(),'New site unexpectedly exists')
    backup=package/'backup';require(Path(record['backup'])==backup and tree(backup/'card')==baseline['old'] and sha(backup/'dnd-center.conf')==baseline['retiredConfig'],'Original recovery backup differs')
    failed=Path('/var/www/.dnd-center-failed-'+KEY);oldstage=OLD.parent/('.card-migration-stage-'+KEY)
    require(tree(failed)==record['newFiles'] and Path(record['oldStage'])==oldstage and tree(oldstage)==record['oldFiles'],'Restored staging tree differs')
    require(record['backendFiles']==manifest['backendFiles'] and tree(SERVICE/'releases'/KEY)==manifest['backendFiles'] and (SERVICE/'current').is_symlink() and (SERVICE/'current').resolve()==SERVICE/'releases'/KEY,'Prepared backend differs')
    for name in ['dnd-card-cloud.service','dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']:
        require(sha(Path('/etc/systemd/system')/name)==manifest['packageFiles'][name],'Prepared unit differs')
    for name in ['dnd-card-cloud.service','dnd-card-cloud-backup.timer']:
        require(command('systemctl','show',name,'-p','ActiveState','--value')=='inactive','Prepared service is not stopped')
    archive=Path('/root/dnd-center-node-v24.9.0.tar.xz');require(sha(archive)=='f52ec50e959d72d5c680d9731420b2661cd2a8070e94c7369b6ddfcd8b7278be','Runtime archive differs')
    with tarfile.open(archive) as z: expected_node=hashlib.sha256(z.extractfile('node-v24.9.0-linux-x64/bin/node').read()).hexdigest()
    require(not (SERVICE/'runtime/bin/node').is_symlink() and sha(SERVICE/'runtime/bin/node')==expected_node,'Prepared Node differs')
    with sqlite3.connect('file:/var/lib/dnd-card-cloud/cards.sqlite?mode=ro',uri=True) as db:
        require(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok','Prepared database is damaged')
        require(all(db.execute('SELECT COUNT(*) FROM '+name).fetchone()[0]==0 for name in ['accounts','cards','sessions']),'Unexpected first-migration account/card data; stopped')
    require(shutil.disk_usage('/var/www').free>700_000_000,'Insufficient staging space')
    newstage=Path('/var/www/.dnd-center-resume-stage-'+KEY);unpack(package/'frontend.tar.gz',newstage,manifest['frontendFiles'])
    require(sha(oldstage/'migration-notice.js')==manifest['packageFiles']['migration-notice.js'],'Migration notice changed; stopped')
    require(protected()==guard and tree(OLD)==baseline['old'] and sha(CONFIG)==baseline['retiredConfig'],'Drift during resume preparation')
    previous={key:record[key] for key in ['sourceCommit','at','status','newFiles','newConfigSha256']};record.update(status='resume-prepared',sourceCommit=manifest['sourceCommit'],newFiles=manifest['frontendFiles'],newConfigSha256=sha(package/'nginx.conf'),previousAttempt=previous,resumeProtectedBefore=guard,preservedExternalRelease=preserved,publisherRevision=manifest.get('publisherRevision'));journal(record)
    switched_old=False;switched_new=False;nginx_changed=False
    try:
        subprocess.run(['systemctl','enable','--now','dnd-card-cloud.service','dnd-card-cloud-backup.timer'],check=True)
        require(json.loads(wait_http('http://127.0.0.1:5014/api/health'))['qqLogin']=='pending','Prepared API unhealthy')
        subprocess.run(['systemctl','start','dnd-card-cloud-backup.service'],check=True)
        require(protected()==guard,'Protected state changed before resume switch')
        newstage.rename(NEW);switched_new=True;exchange(OLD,oldstage);switched_old=True;shutil.copy2(package/'nginx.conf',CONFIG);nginx_changed=True
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True);verify_https(manifest)
        require(tree(NEW)==manifest['frontendFiles'] and tree(OLD)==record['oldFiles'] and protected()==guard,'Resume post-switch verification failed')
        record.update(status='published',protectedAfter=protected(),finishedAt=datetime.now(timezone.utc).isoformat());journal(record)
        return {'status':'published','version':'standalone-1.0.252','receipt':str(JOURNAL),'backup':str(backup),'cloudLogin':'pending','protectedItems':len(baseline['protected']),'resumedRestoredAttempt':True}
    except Exception:
        if nginx_changed:shutil.copy2(backup/'dnd-center.conf',CONFIG)
        if switched_old:exchange(OLD,oldstage)
        if switched_new:NEW.rename(Path('/var/www/.dnd-center-resume-failed-'+KEY))
        subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True);subprocess.run(['systemctl','disable','--now','dnd-card-cloud.service','dnd-card-cloud-backup.timer'],check=False)
        record['status']='resume-failed-restored';journal(record);raise
def rollback(package,manifest_hash):
    require(sha(package/'manifest.json')==manifest_hash,'Manifest changed');manifest=json.loads((package/'manifest.json').read_text());require(sha(Path(__file__))==manifest['publisherSha256'],'Publisher changed')
    record=json.loads(JOURNAL.read_text());backup=Path(record['backup']);require(record['status']=='published','Release is not published')
    require(protected()==record['protectedAfter'],'Protected-state drift, rollback refused')
    require(tree(NEW)==record['newFiles'] and tree(OLD)==record['oldFiles'] and tree(SERVICE/'releases'/KEY)==record['backendFiles'],'Live-tree drift, rollback refused')
    require(sha(CONFIG)==record['newConfigSha256'] and sha(backup/'dnd-center.conf')==record['oldConfigSha256'] and tree(backup/'card')==record['oldBefore'],'Backup/config drift, rollback refused')
    restore=OLD.parent/('.card-migration-rollback-'+KEY);require(not restore.exists(),'Rollback stage exists');shutil.copytree(backup/'card',restore);exchange(OLD,restore)
    shutil.copy2(backup/'dnd-center.conf',CONFIG);subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
    subprocess.run(['systemctl','disable','--now','dnd-card-cloud.service','dnd-card-cloud-backup.timer'],check=True)
    NEW.rename(Path('/var/www/.dnd-center-rolled-back-'+KEY));require(protected()==record['protectedAfter'],'Protected state differs after rollback')
    record.update(status='rolled-back',rolledBackAt=datetime.now(timezone.utc).isoformat(),databasePreserved=True);journal(record);return {'status':'rolled-back','databasePreserved':True}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--capture',action='store_true');parser.add_argument('--manifest-sha');parser.add_argument('--apply',action='store_true');parser.add_argument('--resume-restored',action='store_true');parser.add_argument('--rollback',action='store_true');args=parser.parse_args()
    require(args.package.resolve()==Path('/root/codex-release-packages')/KEY,'Unexpected package directory')
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if args.capture: result=snapshot()
        else:
            require(bool(re.fullmatch('[a-f0-9]{64}',args.manifest_sha or '')),'Exact manifest hash required')
            if args.resume_restored:result=resume_restored(args.package,args.manifest_sha)
            elif args.apply: result=apply(args.package,args.manifest_sha)
            elif args.rollback: result=rollback(args.package,args.manifest_sha)
            else: manifest,baseline=preflight(args.package,args.manifest_sha);result={'preflightPassed':True,'onlineWrites':False,'sourceCommit':manifest['sourceCommit'],'protectedItems':len(baseline['protected'])}
        print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
