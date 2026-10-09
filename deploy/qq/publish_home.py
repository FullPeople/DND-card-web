import argparse, hashlib, importlib.util, json, os, re, shutil, tarfile, tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
ROOT=Path('/var/www/dnd-center')
STAGES=Path('/var/www')
BACKUPS=Path('/var/backups/dnd-center-home')
RECEIPTS=Path('/root/codex-release-receipts')
ALLOWED={'index.html','assets','scene','vendor','licenses','downloads'}
def require(value,message):
    if not value:raise RuntimeError(message)
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def tree(path):
    require(path.is_dir() and not path.is_symlink(),'Unsafe tree')
    files={}
    for p in sorted(path.rglob('*')):
        require(not p.is_symlink(),'Unexpected symlink')
        if p.is_file():files[p.relative_to(path).as_posix()]=sha(p)
    return files
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def now():return datetime.now(timezone.utc).isoformat()
def protected():
    spec=importlib.util.spec_from_file_location('guard',Path(__file__).with_name('guard-frontend.py'))
    guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
    db=Path('/var/lib/dnd-card-cloud/cards.sqlite').stat()
    return {**guard.protected(),'apex-card':digest(tree(ROOT/'card')),'apex-library':digest(tree(ROOT/'library')),'databaseIdentity':{'device':db.st_dev,'inode':db.st_ino,'mode':db.st_mode}}
def manifest(package,seal):
    require(sha(package/'release.json')==seal,'Manifest seal mismatch')
    m=json.loads((package/'release.json').read_text())
    require(re.fullmatch(r'dnd-center-home-[A-Za-z0-9-]+',m['release']),'Invalid release')
    require(m['files'] and 'index.html' in m['files'],'Missing homepage')
    for name in m['files']:
        path=PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and path.parts[0] in ALLOWED and '\\' not in name,'Archive path outside homepage scope')
    require(sha(package/'homepage.tar.gz')==m['archiveSHA256'],'Archive hash mismatch')
    with tarfile.open(package/'homepage.tar.gz') as archive:
        members=archive.getmembers()
        require(len(members)==len(m['files']) and {p.name for p in members}==set(m['files']) and all(p.isfile() for p in members),'Unexpected archive member')
        for p in members:require(hashlib.sha256(archive.extractfile(p).read()).hexdigest()==m['files'][p.name],'Archived file hash mismatch')
    return m
def preflight(m):
    require(ROOT.is_dir() and ROOT.resolve()==ROOT and not ROOT.is_symlink(),'Unexpected homepage root')
    require(sha(ROOT/'index.html')==m['expectedOldIndex'],'Online homepage changed; stopped')
    for name in set(m['files'])-{'index.html'}:
        target=ROOT/name;require(not target.exists() and not target.is_symlink(),'Existing homepage asset: '+name)
        require(all(not parent.is_symlink() for parent in target.parents),'Linked asset parent')
    require(shutil.disk_usage(ROOT).free>m['bytes']+100*1024*1024,'Insufficient server space')
    return {'indexSHA256':sha(ROOT/'index.html'),'protected':protected(),'release':m['release']}
def journal(m,record):
    RECEIPTS.mkdir(parents=True,exist_ok=True)
    path=RECEIPTS/(m['release']+'.json');temporary=path.with_suffix('.tmp')
    temporary.write_text(json.dumps(record,indent=2)+'\n');os.replace(temporary,path)
    return path
def restore_index(backup,expected):
    require(sha(ROOT/'index.html')==expected,'Homepage drift; restore refused')
    temporary=ROOT/'.homepage-restore.tmp';require(not temporary.exists(),'Restore file already exists')
    shutil.copy2(backup/'index.html',temporary);os.replace(temporary,ROOT/'index.html')
def publish(package,m,baseline):
    require(preflight(m)==baseline,'Server baseline changed; stopped')
    stage=STAGES/('.dnd-center-home-stage-'+m['release']);backup=BACKUPS/m['release']
    require(not stage.exists() and not backup.exists() and not (RECEIPTS/(m['release']+'.json')).exists(),'Release already prepared')
    stage.mkdir();backup.mkdir(parents=True)
    shutil.copy2(ROOT/'index.html',backup/'index.html');require(sha(backup/'index.html')==baseline['indexSHA256'],'Incomplete homepage backup')
    with tarfile.open(package/'homepage.tar.gz') as archive:
        for member in archive.getmembers():
            target=stage/member.name;target.parent.mkdir(parents=True,exist_ok=True)
            with target.open('wb') as stream:shutil.copyfileobj(archive.extractfile(member),stream)
            target.chmod(0o644)
    require(tree(stage)==m['files'],'Extracted assets mismatch')
    record={'release':m['release'],'status':'prepared','at':now(),'backup':str(backup),'newFiles':m['files'],'previousIndexSHA256':baseline['indexSHA256'],'newIndexSHA256':m['files']['index.html'],'protectedBefore':baseline['protected'],'backendChanged':False,'databaseTouched':False,'nginxChanged':False}
    journal(m,record)
    try:
        require(preflight(m)==baseline,'Server changed during staging; stopped')
        for name in sorted(set(m['files'])-{'index.html'}):
            target=ROOT/name;target.parent.mkdir(parents=True,exist_ok=True);require(not target.exists(),'Concurrent asset collision');os.rename(stage/name,target)
        require(sha(ROOT/'index.html')==baseline['indexSHA256'] and protected()==baseline['protected'],'Server changed before homepage cutover')
        os.replace(stage/'index.html',ROOT/'index.html')
        require(all((ROOT/name).is_file() and sha(ROOT/name)==expected for name,expected in m['files'].items()),'Published asset mismatch')
        after=protected();require(after==baseline['protected'],'Protected state changed after publication')
        record.update(status='published',protectedAfter=after,finishedAt=now());path=journal(m,record)
        return {'status':'published','receipt':str(path),'backup':str(backup),'files':len(m['files']),'protectedItems':len(after),'protectedUnchanged':True}
    except Exception:
        current=sha(ROOT/'index.html')
        if current==m['files']['index.html']:restore_index(backup,current)
        record.update(status='failed-restored' if sha(ROOT/'index.html')==baseline['indexSHA256'] else 'failed-drift',failedAt=now(),assetsRetained=True);journal(m,record)
        raise
def rollback(m):
    record=json.loads((RECEIPTS/(m['release']+'.json')).read_text())
    require(record['status']=='published','Release is not current')
    require(protected()==record['protectedAfter'],'Protected drift; rollback refused')
    require(all(sha(ROOT/name)==value for name,value in record['newFiles'].items()),'Published homepage assets changed; rollback refused')
    backup=BACKUPS/m['release'];require(sha(backup/'index.html')==record['previousIndexSHA256'],'Backup hash changed')
    restore_index(backup,record['newIndexSHA256']);record.update(status='rolled-back',assetsRetained=True,rolledBackAt=now());journal(m,record)
    return {'status':'rolled-back','databaseTouched':False,'assetsRetained':True}
def self_test():
    global ROOT,STAGES,BACKUPS,RECEIPTS,protected
    test_parent=Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='home-publisher-test-',dir=test_parent) as folder:
        base=Path(folder).resolve();require(base.parent==test_parent,'Unexpected synthetic test directory');ROOT=base/'site';STAGES=base;BACKUPS=base/'backups';RECEIPTS=base/'receipts';ROOT.mkdir()
        (ROOT/'index.html').write_text('original');(ROOT/'card').mkdir();(ROOT/'card/original.txt').write_text('keep');(ROOT/'library').mkdir()
        protected=lambda:{'card':digest(tree(ROOT/'card')),'library':digest(tree(ROOT/'library'))}
        package=base/'package';package.mkdir();source=base/'new.html';source.write_text('new');asset=base/'asset.js';asset.write_text('asset')
        with tarfile.open(package/'homepage.tar.gz','w:gz') as archive:archive.add(source,arcname='index.html');archive.add(asset,arcname='assets/asset.js')
        m={'release':'dnd-center-home-test','expectedOldIndex':sha(ROOT/'index.html'),'files':{'index.html':sha(source),'assets/asset.js':sha(asset)},'archiveSHA256':sha(package/'homepage.tar.gz'),'bytes':8}
        (package/'release.json').write_text(json.dumps(m));seal=sha(package/'release.json');m=manifest(package,seal);baseline=preflight(m)
        (ROOT/'index.html').write_text('external')
        try:publish(package,m,baseline);raise AssertionError('Baseline drift accepted')
        except RuntimeError:pass
        require((ROOT/'index.html').read_text()=='external','External homepage overwritten')
        (ROOT/'index.html').write_text('original');result=publish(package,m,baseline)
        require(result['status']=='published' and (ROOT/'card/original.txt').read_text()=='keep','Scoped publish failed')
        require(rollback(m)['status']=='rolled-back' and (ROOT/'index.html').read_text()=='original' and (ROOT/'assets/asset.js').read_text()=='asset','Rollback failed')
    return {'selfTests':['sealed archive validation','reject changed online homepage','publish with protected directories intact','atomic homepage rollback keeping assets'],'passed':4}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path);parser.add_argument('--seal');parser.add_argument('--baseline',type=Path);parser.add_argument('--apply',action='store_true');parser.add_argument('--rollback',action='store_true');parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test:print(json.dumps(self_test()));raise SystemExit(0)
    import fcntl
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        m=manifest(args.package,args.seal)
        if args.rollback:result=rollback(m)
        elif args.apply:require(args.baseline is not None,'Missing baseline');result=publish(args.package,m,json.loads(args.baseline.read_text()))
        else:result={'preflightPassed':True,'onlineWrites':False,'baseline':preflight(m)}
        print(json.dumps(result,indent=2))
