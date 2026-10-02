"""Read-only preflight by default. --apply exchanges only /card after full hash checks."""
from pathlib import Path, PurePosixPath
import argparse, ctypes, hashlib, io, json, os, shutil, subprocess, tarfile, tempfile, zipfile

ROOT=Path('/var/www/obr-plugins')
VERSION='standalone-1.0.232'

def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for data in iter(lambda:f.read(1048576),b''):h.update(data)
    return h.hexdigest()

def tree(p):
    assert p.is_dir() and not p.is_symlink(),str(p)
    result={}
    for f in sorted(p.rglob('*')):
        assert not f.is_symlink(),str(f)
        if f.is_file():result[f.relative_to(p).as_posix()]=sha(f)
    return result

def valid_name(n):
    p=PurePosixPath(n)
    assert n and not p.is_absolute() and '..' not in p.parts and '\\' not in n and ':' not in n and p.as_posix()==n,n
    assert n.startswith(('assets/','dice/','support/')) or n in ['index.html','sw.js','exe_icon.png','favicon.svg','owner-step1.png','owner-step2.png','owner-step3.png','standalone-audit.json','third-party-licenses.txt','LICENSE.txt','release.json','source.zip','release232-hashes.json'],n

def protected():
    paths=[Path('/etc/nginx/sites-enabled/obr-plugins').resolve(),Path('/opt/obr-three-dragon/server.mjs')]+[Path('/opt/obr-workbench-relay-dev')/n for n in ['server.mjs','documents.mjs','patches.mjs']]
    services={n:subprocess.check_output(['systemctl','show',n,'-p','ActiveState','-p','ActiveEnterTimestampMonotonic'],text=True).strip() for n in ['obr-workbench-relay-dev','obr-three-dragon']}
    assert all('ActiveState=active' in s for s in services.values())
    return {'files':{str(p):sha(p) for p in paths},'services':services,
            'sites':{n:tree(ROOT/n) for n in ['suite','suite-dev','dice-lab-dev','three-dragon-ante-dev']}}

def exchange(a,b):
    assert a.parent==ROOT and b.parent==ROOT and a.is_dir() and b.is_dir() and not a.is_symlink() and not b.is_symlink()
    lib=ctypes.CDLL(None,use_errno=True)
    if lib.renameat2(-100,os.fsencode(a),-100,os.fsencode(b),2):raise OSError(ctypes.get_errno(),'Atomic exchange failed')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archives',type=Path,required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    receipt=json.loads((args.archives/'package-receipt.json').read_text())
    assert receipt['release']==232 and receipt['staticOnly'] is True and receipt['version']==VERSION
    baseline=receipt['baseline'];live=ROOT/'card';backup=ROOT/'card-before-232';record=ROOT/'release232-deployment.json'
    assert not backup.exists() and not record.exists(), 'Release already deployed'
    assert json.loads((live/'release.json').read_text())['version']=='standalone-1.0.230'
    before=tree(live);guard=protected()
    assert before==baseline['sites']['card'], 'Card baseline changed'
    assert guard['files']==baseline['protectedFiles'] and guard['services']==baseline['services'], 'Service baseline changed'
    assert all(v==baseline['sites'][n] for n,v in guard['sites'].items()), 'Protected website changed'
    archive=args.archives/receipt['archive'];assert archive.name=='card232.tar.gz' and sha(archive)==receipt['sha256']
    expected={**receipt['hashes'],'release232-hashes.json':receipt['manifestSha256']}
    with tarfile.open(archive) as tar:
        members=tar.getmembers();names=[m.name for m in members]
        assert len(names)==len(set(names)) and set(names)==set(expected), 'Unexpected archive entries'
        for m in members:
            valid_name(m.name);assert m.isfile(),m.name
            data=tar.extractfile(m).read();assert hashlib.sha256(data).hexdigest()==expected[m.name],m.name
            if m.name=='source.zip':
                with zipfile.ZipFile(io.BytesIO(data)) as z:assert z.comment.decode()==receipt['webCommit'] and z.testzip() is None
        assert json.loads(tar.extractfile('release232-hashes.json').read())==receipt['hashes']
        assert json.loads(tar.extractfile('release.json').read())=={'version':VERSION,'announcementVersion':'0.1.25','sourceCommit':receipt['webCommit']}
        audit=json.loads(tar.extractfile('standalone-audit.json').read());assert audit['singlePlayer'] is True and not audit['multiplayerModules']
    report={'release':232,'version':VERSION,'announcementVersion':'0.1.25','webCommit':receipt['webCommit'],
            'verifiedFiles':len(expected),'preservedFiles':len(set(before)-set(expected)),
            'staticOnly':True,'playerDataWritten':False,'servicesRestarted':False,
            'protectedFilesUnchanged':True,'protectedSites':{n:len(v) for n,v in guard['sites'].items()},'realRoomVerified':False}
    if not args.apply:print(json.dumps({**report,'preflightPassed':True,'writes':False},indent=2));return
    stage=Path(tempfile.mkdtemp(prefix='.card232-',dir=ROOT));swapped=False
    try:
        shutil.copytree(live,stage,dirs_exist_ok=True)
        with tarfile.open(archive) as tar:
            for m in tar.getmembers():
                dest=stage/m.name;assert dest.resolve().is_relative_to(stage)
                dest.parent.mkdir(parents=True,exist_ok=True)
                with tar.extractfile(m) as src,dest.open('wb') as dst:shutil.copyfileobj(src,dst)
                os.chmod(dest,0o644)
        for d in [stage]+[p for p in stage.rglob('*') if p.is_dir()]:os.chmod(d,0o755)
        assert tree(stage)=={**before,**expected}, 'Staging mismatch'
        assert tree(live)==before and protected()==guard, 'Concurrent change before swap'
        exchange(live,stage);swapped=True
        assert tree(live)=={**before,**expected} and tree(stage)==before
        assert protected()==guard, 'Protected services/sites changed after swap'
        stage.rename(backup);stage=backup
        report.update(applied=True,backup=str(backup),previousVersion='standalone-1.0.230')
        record.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report,indent=2))
    except BaseException:
        if swapped:exchange(live,stage)
        raise

if __name__=='__main__':main()
