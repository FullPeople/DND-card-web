"""Two explicitly authorized Owlbear frontend targets. Default read-only; all full backups precede any atomic swap."""
from pathlib import Path, PurePosixPath
import importlib.util
import argparse, ctypes, hashlib, json, os, shutil, subprocess, sys, tarfile, zipfile, fcntl, re
from datetime import datetime, timezone
ROOT=Path('/var/www/obr-plugins')
TARGETS=('suite-dev','suite')
KEY=PACKAGE_SHA=JOURNAL=None
def require(ok, message):
    if not ok: raise ValueError(message)
def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def tree(p):
    require(p.is_dir() and not p.is_symlink(),'Missing/linked static tree '+str(p))
    result={}
    for f in sorted(p.rglob('*')):
        require(not f.is_symlink(),'Linked static file '+str(f))
        if f.is_file(): result[f.relative_to(p).as_posix()]=sha(f)
    return result
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,value):
    temporary=p.with_name(p.name+'.tmp')
    require(not temporary.exists(),'Unfinished receipt '+str(temporary))
    with temporary.open('x',encoding='utf-8') as f:
        json.dump(value,f,ensure_ascii=False,indent=2); f.write('\n'); f.flush(); os.fsync(f.fileno())
    temporary.replace(p)
def safe_name(s):
    p=PurePosixPath(s)
    require(bool(s) and not p.is_absolute() and '..' not in p.parts and '\\' not in s and ':' not in s and p.as_posix()==s and s!='.','Unsafe archive path '+s)
    return s
def protected():
    spec=importlib.util.spec_from_file_location('cloud_frontend',Path(__file__).with_name('frontend.py'))
    frontend=importlib.util.module_from_spec(spec);spec.loader.exec_module(frontend)
    result=frontend.protected()
    for name in TARGETS: result.pop('static:'+name,None)
    result['dnd-center-frontend']=frontend.m.digest(frontend.tree(frontend.ROOT))
    frontend.database_check()
    return result

def exchange(a,b):
    require(a.parent==ROOT and b.parent==ROOT and not a.is_symlink() and not b.is_symlink(),'Exchange outside exact static root')
    libc=ctypes.CDLL(None,use_errno=True); fn=getattr(libc,'renameat2',None)
    require(fn is not None,'No atomic renameat2; refusing non-atomic fallback')
    fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]; fn.restype=ctypes.c_int
    if fn(-100,os.fsencode(a),-100,os.fsencode(b),2)!=0:
        e=ctypes.get_errno(); raise OSError(e,os.strerror(e))
def archive_check(path,target,record,receipt):
    require(sha(path)==record['sha256'],'Archive changed '+target)
    with tarfile.open(path) as z:
        members=z.getmembers(); names=[safe_name(m.name) for m in members]
        require(len(names)==len(set(names)) and all(m.isfile() for m in members),'Links or duplicate members')
        require(set(names)==set(record['files']),'Archive inventory mismatch')
        for m in members:
            h=hashlib.sha256()
            with z.extractfile(m) as f:
                for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
            require(h.hexdigest()==record['files'][m.name],'Archive content changed '+m.name)
        version=json.loads(z.extractfile('release.json').read())
        require(version['channel']==target and version['version']==record['version'] and version['completeFrontend'] is True and version['backendChanged'] is False,'Wrong target release')
        require(version['sourceCommits']==receipt['commits'],'Wrong source tuple '+target)
        source_key={'card':'web','suite-dev':'suite','suite':'suiteStable'}[target]
        require(version['sourceCommit']==receipt['commits'][source_key],'Wrong runtime source '+target)
        for alias,repo in record['sourceAliases'].items():
            require(record['files'][alias]==receipt['sources'][repo]['sha256'],'Source alias binding '+alias)
            with zipfile.ZipFile(z.extractfile(alias)) as source:
                require(source.comment.decode('ascii')==receipt['commits'][repo] and source.testzip() is None,'Source ZIP integrity '+alias)
def preflight(archives):
    require(ROOT.resolve()==ROOT and ROOT.is_dir() and not ROOT.is_symlink(),'Unexpected static root')
    require(sha(archives/'package-receipt.json')==PACKAGE_SHA,'Not the exact reviewed package receipt')
    receipt=read(archives/'package-receipt.json'); baseline=read(archives/'server-baseline.json')
    require(sha(Path(__file__))==receipt['publisherSha256'] and sha(archives/'server-baseline.json')==receipt['baselineSha256'],'Publisher or captured baseline changed')
    require(receipt['release']==KEY and set(receipt['targets'])==set(TARGETS) and receipt['backendChanged'] is False and receipt['playerDataChanged'] is False,'Wrong approved scope')
    require(protected()==baseline['protected'],'Protected backend/service baseline changed')
    require(not JOURNAL.exists() and not JOURNAL.with_name(JOURNAL.name+'.tmp').exists(),'Release receipt already exists')
    for n in TARGETS:
        for prefix in [n+'-before-'+KEY,'.'+n+'-stage-'+KEY,'.'+n+'-retired-'+KEY]: require(not (ROOT/prefix).exists(),'Recovery/stage path already exists '+prefix)
        require(tree(ROOT/n)==baseline['sites'][n],'Concurrent frontend change '+n)
        archive_check(archives/receipt['targets'][n]['archive'],n,receipt['targets'][n],receipt)
    bytes_needed=sum(sum((ROOT/n/p).stat().st_size for p in baseline['sites'][n]) for n in TARGETS)*2+sum(r['bytes'] for r in receipt['targets'].values())
    require(shutil.disk_usage(ROOT).free>bytes_needed+300*1024*1024,'Insufficient space for all backups and stages')
    require(getattr(ctypes.CDLL(None),'renameat2',None) is not None,'Atomic exchange unavailable')
    return receipt,baseline
def apply(archives):
    receipt,baseline=preflight(archives)
    JOURNAL.parent.mkdir(parents=True,exist_ok=True)
    record={'release':KEY,'status':'preparing','at':datetime.now(timezone.utc).isoformat(),'commits':receipt['commits'],'targets':{},'protectedBefore':baseline['protected'],'writesPlayerData':False,'backendChanged':False,'atomicCutover':'renameat2 RENAME_EXCHANGE'}
    write(JOURNAL,record)
    stages={}; changed=[]
    try:
        # Every full backup is created and hash-verified before any cutover.
        for n in TARGETS:
            backup=ROOT/(n+'-before-'+KEY); shutil.copytree(ROOT/n,backup)
            require(tree(backup)==baseline['sites'][n],'Incomplete full backup '+n)
            record['targets'][n]={'backup':str(backup),'backupFiles':len(baseline['sites'][n]),'version':receipt['targets'][n]['version']}
            write(JOURNAL,record)
        for n in TARGETS:
            stage=ROOT/('.'+n+'-stage-'+KEY); shutil.copytree(ROOT/n,stage); stages[n]=stage
            with tarfile.open(archives/receipt['targets'][n]['archive']) as z:
                for m in z.getmembers():
                    dest=stage/safe_name(m.name); dest.parent.mkdir(parents=True,exist_ok=True)
                    with z.extractfile(m) as inp, dest.open('wb') as out: shutil.copyfileobj(inp,out)
                    os.chmod(dest,0o644)
            expected={**baseline['sites'][n],**receipt['targets'][n]['files']}
            require(tree(stage)==expected,'Full stage mismatch '+n)
            record['targets'][n]['expectedFiles']=expected
        require(protected()==baseline['protected'],'Protected baseline changed while staging')
        require(all(tree(ROOT/n)==baseline['sites'][n] for n in TARGETS),'Concurrent change before publication')
        record['status']='cutover'; write(JOURNAL,record)
        for n in TARGETS:
            require(tree(ROOT/n)==baseline['sites'][n],'Concurrent change at cutover '+n)
            exchange(ROOT/n,stages[n]); changed.append(n)
            require(tree(ROOT/n)==record['targets'][n]['expectedFiles'],'Published tree mismatch '+n)
            record['targets'][n]['published']=True; write(JOURNAL,record)
        require(protected()==baseline['protected'],'Protected service/backend changed')
        for n in TARGETS:
            require(tree(ROOT/n)==record['targets'][n]['expectedFiles'],'Final full tree mismatch '+n)
            require(tree(ROOT/(n+'-before-'+KEY))==baseline['sites'][n],'Backup changed '+n)
        for n in TARGETS:
            retired=ROOT/('.'+n+'-retired-'+KEY); stages[n].rename(retired)
            record['targets'][n]['retiredOriginal']=str(retired)
        record.update(status='published',protectedAfter=protected(),finishedAt=datetime.now(timezone.utc).isoformat())
        write(JOURNAL,record)
        return {'status':record['status'],'receipt':str(JOURNAL),'versions':{n:receipt['targets'][n]['version'] for n in TARGETS},'backups':{n:record['targets'][n]['backup'] for n in TARGETS}}
    except BaseException as cause:
        errors=[]
        for n in reversed(changed):
            try:
                old=Path(record['targets'][n].get('retiredOriginal',str(stages[n])))
                exchange(ROOT/n,old)
                require(tree(ROOT/n)==baseline['sites'][n],'Rollback mismatch '+n)
            except BaseException as e: errors.append(n+': '+str(e))
        record.update(status='rollback-incomplete' if errors else 'rolled-back' if changed else 'preparation-failed',error=str(cause),rollbackErrors=errors)
        write(JOURNAL,record)
        if errors: raise RuntimeError('Preserved recovery paths require inspection: '+str(errors)) from cause
        raise
def rollback(archives):
    baseline=read(archives/'server-baseline.json'); record=read(JOURNAL)
    require(record['status']=='published' and protected()==record['protectedAfter'],'Rollback state changed')
    stages={}; changed=[]
    for n in TARGETS:
        require(tree(ROOT/n)==record['targets'][n]['expectedFiles'],'Current site changed since release '+n)
        backup=Path(record['targets'][n]['backup']); require(backup==ROOT/(n+'-before-'+KEY) and tree(backup)==baseline['sites'][n],'Backup changed')
        stage=ROOT/('.'+n+'-rollback-'+KEY); require(not stage.exists(),'Rollback stage exists')
        shutil.copytree(backup,stage); require(tree(stage)==baseline['sites'][n],'Rollback copy incomplete'); stages[n]=stage
    try:
        for n in TARGETS: exchange(ROOT/n,stages[n]); changed.append(n)
        require(all(tree(ROOT/n)==baseline['sites'][n] for n in TARGETS),'Rollback verification failed')
        require(protected()==record['protectedAfter'],'Protected backend changed')
    except BaseException:
        for n in reversed(changed): exchange(ROOT/n,stages[n])
        raise
    record['status']='manually-rolled-back'; write(JOURNAL,record)
    return {'status':record['status'],'backupsRetained':True,'failedReleaseRetained':[str(p) for p in stages.values()]}
def main():
    global KEY, PACKAGE_SHA, JOURNAL
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archives',type=Path,required=True)
    parser.add_argument('--receipt-sha')
    flags=parser.add_mutually_exclusive_group()
    flags.add_argument('--capture',action='store_true')
    flags.add_argument('--apply',action='store_true')
    flags.add_argument('--rollback',action='store_true')
    args=parser.parse_args()
    if args.capture:
        with open('/run/lock/obr-static-release.lock','a') as lock:
            try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError: raise RuntimeError('Concurrent deployment holds obr-static-release.lock; stopped')
            path=args.archives/'server-baseline.json'
            require(not path.exists(),'Captured baseline already exists')
            require(ROOT.resolve()==ROOT and not ROOT.is_symlink(),'Unexpected static root')
            baseline={'protected':protected(),'sites':{n:tree(ROOT/n) for n in TARGETS},'releases':{n:read(ROOT/n/'release.json') for n in TARGETS}}
            write(path,baseline)
            print(json.dumps({'captured':True,'productionWrites':False,'protectedItems':len(baseline['protected'])}))
        return
    require(args.receipt_sha and re.fullmatch('[a-f0-9]{64}',args.receipt_sha),'Invalid receipt hash')
    PACKAGE_SHA=args.receipt_sha
    require(sha(args.archives/'package-receipt.json')==PACKAGE_SHA,'Receipt changed')
    reviewed=read(args.archives/'package-receipt.json')
    require(sha(Path(__file__))==reviewed['publisherSha256'] and sha(args.archives/'server-baseline.json')==reviewed['baselineSha256'],'Publisher or baseline differs from sealed receipt')
    KEY=read(args.archives/'package-receipt.json')['release']
    require(re.fullmatch('[a-z0-9][a-z0-9-]{5,90}',KEY),'Invalid release key')
    JOURNAL=Path('/root/codex-release-receipts')/(KEY+'.json')
    with open('/run/lock/obr-static-release.lock','a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise RuntimeError('Concurrent deployment holds obr-static-release.lock; stopped')
        if args.rollback: result=rollback(args.archives)
        elif args.apply: result=apply(args.archives)
        else:
            receipt,baseline=preflight(args.archives)
            result={'preflightPassed':True,'writes':False,'targets':{n:len(receipt['targets'][n]['files']) for n in TARGETS},'fullTargetBackupRequired':True,'servicesUnchanged':True}
        print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
