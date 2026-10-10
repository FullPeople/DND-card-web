"""Static-only dnd.center release with sealed inputs, atomic swap and guarded rollback."""
from pathlib import Path
import argparse, fcntl, importlib.util, json, os, re, shutil, sqlite3, tempfile
from datetime import datetime, timezone

spec=importlib.util.spec_from_file_location('migration',Path(__file__).with_name('publish.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ROOT=Path('/var/www/dnd-center')
TARGETS=('card','library')
SERVICE=Path('/opt/dnd-card-cloud')
UNIT=Path('/etc/systemd/system/dnd-card-cloud.service')
DB=Path('/var/lib/dnd-card-cloud/cards.sqlite')
RECEIPTS=Path('/root/codex-release-receipts')
require,sha=m.require,m.sha

def tree(path):
    for item in path.rglob('*'):
        require(not item.is_symlink() and (item.is_file() or item.is_dir()),'Unsafe static tree entry')
    return m.tree(path)

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

def owned(files):
    return {name:digest for name,digest in files.items() if name.split('/',1)[0] in TARGETS}

def outside(files):
    return {name:digest for name,digest in files.items() if name.split('/',1)[0] not in TARGETS}

def target_files(files,name):
    return {path[len(name)+1:]:digest for path,digest in files.items() if path.startswith(name+'/')}

def receipt_path(manifest): return RECEIPTS/(manifest['release']+'.json')
def sync_directory(path):
    descriptor=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(descriptor)
    finally:os.close(descriptor)

def durable_json(path,record):
    path.parent.mkdir(parents=True,exist_ok=True)
    descriptor,name=tempfile.mkstemp(prefix='.'+path.name+'.',dir=path.parent)
    try:
        with os.fdopen(descriptor,'w') as stream:
            json.dump(record,stream,ensure_ascii=False,sort_keys=True,indent=2)
            stream.write('\n');stream.flush();os.fsync(stream.fileno())
        os.replace(name,path);sync_directory(path.parent)
    finally:
        if os.path.exists(name):os.unlink(name)

def write_receipt(manifest,record):durable_json(receipt_path(manifest),record)

def sync_tree(path):
    for file in path.rglob('*'):
        require(not file.is_symlink(),'Linked durable input')
        if file.is_file():
            with file.open('rb') as stream:os.fsync(stream.fileno())
        else:require(file.is_dir(),'Special durable input')
    for directory in sorted((p for p in path.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):sync_directory(directory)
    sync_directory(path);sync_directory(path.parent)


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
    require(manifest.get('targets')==list(TARGETS),'Explicit card/library publication scope required')
    require(manifest['frontendFiles']==owned(manifest['frontendFiles']),'Artifact outside card/library scope')
    require(all(name+'/index.html' in manifest['frontendFiles'] for name in TARGETS),'Incomplete scoped artifact')
    return manifest,json.loads((package/'baseline.json').read_text())

def preflight(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    require(not receipt_path(manifest).exists(),'Existing receipt requires review')
    require(snapshot()==baseline,'Live baseline drift; stopped')
    require(baseline['release']['version']==manifest['previousVersion'] and baseline['release']['sourceCommit']==manifest['previousSourceCommit'],'Unexpected release baseline')
    require(shutil.disk_usage(ROOT).free>200_000_000,'Insufficient staging and backup space')
    require(m.command('systemctl','is-active','dnd-card-cloud.service')=='active','Backend inactive')
    verify_policy(manifest)
    database_check()
    return manifest,baseline

def verify_policy(manifest):
    expected=manifest.get('qqLogin','pending')
    require(expected in ('pending','ready'),'Invalid sealed QQ login state')
    health=json.loads(m.wait_http('https://dnd.center/api/health',['--resolve','dnd.center:443:127.0.0.1']))
    mode=manifest.get('cloudMode','temporary-ip')
    require(mode in ('temporary-ip','account-private'),'Invalid sealed cloud mode')
    require(health['version']==manifest['backendVersion'] and health.get('qqLogin')==expected,'API policy changed')
    if mode=='account-private':
        require(expected=='ready' and health.get('permissionsVersion')==1 and health.get('accountLibrariesPrivate') is True
          and health.get('accountPrivate') is True and health.get('temporaryUpload') is False
          and health.get('publicDirectory') is False and health.get('quotaScope')=='account','Private API policy changed')
    else:require(health.get('temporaryUpload') is True and health.get('quotaScope')=='ip','API policy changed')

def verify(manifest):
    resolve=['--resolve','dnd.center:443:127.0.0.1']
    for path in ['card/index.html','library/index.html','card/sw.js','card/release.json','library/release.json']:
        url='https://dnd.center/'+('' if path=='index.html' else path.replace('/index.html','/'))
        m.wait_http(url,resolve,manifest['frontendFiles'][path])
    verify_policy(manifest)

def stage_path(manifest,kind): return ROOT.parent/('.dnd-center-'+kind+'-'+manifest['release'])

def read_record(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    record=json.loads(receipt_path(manifest).read_text())
    require(record.get('manifestSha256')==manifest_hash and record.get('release')==manifest['release']
      and record.get('sourceCommit')==manifest['sourceCommit'] and record.get('targets')==list(TARGETS)
      and record.get('frontendFiles')==manifest['frontendFiles']
      and record.get('protectedBefore')==baseline['protected'],'Receipt binding differs')
    return manifest,baseline,record

def inspect_targets(manifest,baseline):
    result={}
    for name in TARGETS:
        try:
            files=tree(ROOT/name)
            state='baseline' if files==target_files(baseline['frontend'],name) else 'candidate' if files==target_files(manifest['frontendFiles'],name) else 'drift'
            result[name]={'state':state,'sha256':m.digest(files)}
        except Exception:result[name]={'state':'drift','sha256':None}
    return result

def status(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    path=receipt_path(manifest)
    if path.exists():_,_,record=read_record(package,manifest_hash)
    else:record={'status':'artifact-preflight-passed'}
    targets=inspect_targets(manifest,baseline)
    protected_matches=protected()==baseline['protected']
    states={item['state'] for item in targets.values()}
    terminal=record['status'] in ('published','failed-restored','rolled-back','artifact-preflight-passed')
    desired='candidate' if record['status']=='published' else 'baseline'
    coherent=states=={desired} and protected_matches
    return {'status':record['status'] if coherent else 'recovery-required','recordedStatus':record['status'],
      'targetsState':targets,'protectedMatches':protected_matches,'recoveryNeeded':not terminal or not coherent,
      'manifestSha256':manifest_hash,'sourceCommit':manifest['sourceCommit'],
      'receipt':str(path),'version':manifest['version'] if desired=='candidate' else manifest['previousVersion'],
      'databasePreserved':True,'backendChanged':False}

def checkpoint(manifest,record,name,operation,result):
    record['targetJournal'][name]={'operation':operation,'result':result,'at':datetime.now(timezone.utc).isoformat()}
    write_receipt(manifest,record)

def exchange_durable(a,b):
    m.exchange(a,b)
    sync_directory(a.parent);sync_directory(b.parent)

def verify_restored(baseline):
    for name in TARGETS:
        m.wait_http('https://dnd.center/'+name+'/', ['--resolve','dnd.center:443:127.0.0.1'],baseline['frontend'][name+'/index.html'])

def recover(package,manifest_hash,rollback_request=False):
    manifest,baseline,record=read_record(package,manifest_hash)
    require(protected()==baseline['protected'],'Protected drift; rollback refused')
    backup=package/'backup/frontend'
    if any(value['state']!='baseline' for value in inspect_targets(manifest,baseline).values()):
        require(tree(backup)==owned(baseline['frontend']),'Backup drift')
    preserved=outside(tree(ROOT))
    record.setdefault('targetJournal',{})
    record['status']='recovering';write_receipt(manifest,record)
    failures={}
    # A failed target must not prevent restoration of the other target. Hashes,
    # rather than a possibly stale journal result, resolve interrupted renames.
    for name in reversed(TARGETS):
        try:
            require(protected()==baseline['protected'],'Protected drift; rollback refused')
            live=tree(ROOT/name);old=target_files(baseline['frontend'],name);new=target_files(manifest['frontendFiles'],name)
            require(live in (old,new),'External frontend drift; recovery refused')
            if live!=old:
                stage=stage_path(manifest,'recovery')/name
                if stage.exists():require(tree(stage) in (old,new),'Recovery stage drift')
                if not stage.exists() or tree(stage)!=old:
                    if stage.exists():shutil.rmtree(stage)
                    stage.parent.mkdir(exist_ok=True)
                    shutil.copytree(backup/name,stage);sync_tree(stage)
                checkpoint(manifest,record,name,'restore','intent')
                require(tree(ROOT/name)==new and tree(stage)==old and protected()==baseline['protected'],'Drift before recovery exchange')
                exchange_durable(ROOT/name,stage)
            checkpoint(manifest,record,name,'restore','restored')
        except Exception as error:
            failures[name]=type(error).__name__
            record['targetJournal'][name]={'operation':'restore','result':'failed','errorType':type(error).__name__}
            try:write_receipt(manifest,record)
            except OSError:pass
    if not failures:
        try:
            verify_restored(baseline)
            require(owned(tree(ROOT))==owned(baseline['frontend']) and outside(tree(ROOT))==preserved
              and protected()==baseline['protected'],'Scoped recovery mismatch')
            record.update(status='rolled-back' if rollback_request or record.get('recoveryGoal')=='rollback' else 'failed-restored',
              databaseAfterRecovery=database_check(),externalFrontendAfterRecovery=preserved,finishedAt=datetime.now(timezone.utc).isoformat())
            write_receipt(manifest,record)
        except Exception as error:failures['verification']=type(error).__name__
    if failures:
        record.update(status='recovery-required',recoveryFailures=failures)
        write_receipt(manifest,record)
        raise RuntimeError('Recovery incomplete; hash-guarded retry required')
    return status(package,manifest_hash)

def apply(package,manifest_hash):
    manifest,baseline=binding(package,manifest_hash)
    if receipt_path(manifest).exists():return status(package,manifest_hash)
    manifest,baseline=preflight(package,manifest_hash)
    record={'release':manifest['release'],'manifestSha256':manifest_hash,'status':'preparing','at':datetime.now(timezone.utc).isoformat(),
      'sourceCommit':manifest['sourceCommit'],'protectedBefore':baseline['protected'],'frontendFiles':manifest['frontendFiles'],
      'backup':str(package/'backup'),'backendChanged':False,'databaseReplaced':False,'databaseBefore':database_check(),
      'targets':list(TARGETS),'preservedFrontend':outside(baseline['frontend']),'targetJournal':{}}
    write_receipt(manifest,record)
    try:
        backup=package/'backup';require(not backup.exists(),'Backup already exists');backup.mkdir(mode=0o700)
        (backup/'frontend').mkdir()
        for name in TARGETS:shutil.copytree(ROOT/name,backup/'frontend'/name)
        require(tree(backup/'frontend')==owned(baseline['frontend']),'Backup mismatch');sync_tree(backup)
        stage=stage_path(manifest,'stage');m.unpack(package/'frontend.tar.gz',stage,manifest['frontendFiles']);sync_tree(stage)
        release=json.loads((stage/'card/release.json').read_text())
        require(release['version']==manifest['version'] and release['sourceCommit']==manifest['sourceCommit'],'Application binding mismatch')
        require(snapshot()==baseline,'Drift during staging; stopped')
        record['status']='prepared';write_receipt(manifest,record)
        for name in TARGETS:
            checkpoint(manifest,record,name,'publish','intent')
            require(tree(ROOT/name)==target_files(baseline['frontend'],name) and tree(stage/name)==target_files(manifest['frontendFiles'],name)
              and protected()==baseline['protected'],'Concurrent target publication')
            exchange_durable(ROOT/name,stage/name)
            checkpoint(manifest,record,name,'publish','switched')
        verify(manifest)
        live=tree(ROOT)
        require(owned(live)==manifest['frontendFiles'] and outside(live)==record['preservedFrontend'] and protected()==baseline['protected'],'Post-publication drift')
        record.update(status='published',protectedAfter=protected(),databaseAfter=database_check(),finishedAt=datetime.now(timezone.utc).isoformat());write_receipt(manifest,record)
        return status(package,manifest_hash)
    except Exception:
        # Storage failure can prevent recording compensation. Leave the last
        # durable intent intact so status/recover can reconcile physical hashes.
        try:recover(package,manifest_hash)
        except Exception:pass
        raise

def rollback(package,manifest_hash):
    manifest,baseline,record=read_record(package,manifest_hash)
    if record['status']=='rolled-back':return status(package,manifest_hash)
    if record['status']=='published':
        require(protected()==record['protectedAfter'],'Protected drift; rollback refused')
        require(owned(tree(ROOT))==record['frontendFiles'],'Live frontend drift; rollback refused')
    record['recoveryGoal']='rollback';write_receipt(manifest,record)
    return recover(package,manifest_hash,rollback_request=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True);parser.add_argument('--capture',action='store_true');parser.add_argument('--manifest-sha');parser.add_argument('--apply',action='store_true');parser.add_argument('--rollback',action='store_true');parser.add_argument('--status',action='store_true');parser.add_argument('--recover',action='store_true');args=parser.parse_args()
    require(sum([args.capture,args.apply,args.rollback,args.status,args.recover])<=1,'Choose one action')
    with open('/run/lock/obr-static-release.lock','rb') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if args.capture:result=snapshot()
        else:
            require(args.manifest_sha is not None,'Manifest SHA required')
            if args.apply:result=apply(args.package,args.manifest_sha)
            elif args.rollback:result=rollback(args.package,args.manifest_sha)
            elif args.status:result=status(args.package,args.manifest_sha)
            elif args.recover:result=recover(args.package,args.manifest_sha)
            else:preflight(args.package,args.manifest_sha);result={'status':'preflight-passed'}
        print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
