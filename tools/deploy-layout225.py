"""Guarded static layout deployment. Default read-only; --apply uses atomic exchange."""
from pathlib import Path, PurePosixPath
import argparse, ctypes, hashlib, json, os, shutil, subprocess, tarfile, tempfile, zipfile, io
ROOT=Path('/var/www/obr-plugins')
MANIFESTS={'card':'release.json','suite-dev':'manifest-dev.json','suite':'manifest.json'}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def tree(p):
    assert p.is_dir() and not p.is_symlink(),str(p)
    result={}
    for f in sorted(p.rglob('*')):
        assert not f.is_symlink(),str(f)
        if f.is_file():result[f.relative_to(p).as_posix()]=sha(f)
    return result
def valid_name(n):
    p=PurePosixPath(n);assert n and not p.is_absolute() and '..' not in p.parts and '\\' not in n and ':' not in n and p.as_posix()==n,n
def allowed(site,n):
    if site=='card':return n.startswith(('assets/','dice/','support/')) or n in ['index.html','sw.js','exe_icon.png','favicon.svg','owner-step1.png','owner-step2.png','owner-step3.png','standalone-audit.json','third-party-licenses.txt','LICENSE.txt','release.json','source.zip','layout225-hashes.json']
    return n.startswith('card-viewer/') or site=='suite-dev' and n.startswith('workbench/') or n in [MANIFESTS[site],'source.zip','suite-source.zip','layout225-hashes.json']
def started(n):
    assert subprocess.check_output(['systemctl','is-active',n],text=True).strip()=='active'
    return subprocess.check_output(['systemctl','show',n,'-p','ActiveEnterTimestampMonotonic'],text=True)
def protected():
    paths=[Path('/etc/nginx/sites-enabled/obr-plugins').resolve(),Path('/opt/obr-three-dragon/server.mjs')]+[Path('/opt/obr-workbench-relay-dev')/n for n in ['server.mjs','documents.mjs','patches.mjs']]
    return {'files':{str(p):sha(p) for p in paths},'services':{n:started(n) for n in ['obr-workbench-relay-dev','obr-three-dragon']},'sites':{n:tree(ROOT/n) for n in ['dice-lab-dev','three-dragon-ante-dev']}}
def exchange(a,b):
    assert a.parent==ROOT and b.parent==ROOT and a.is_dir() and b.is_dir()
    lib=ctypes.CDLL(None,use_errno=True)
    if lib.renameat2(-100,os.fsencode(a),-100,os.fsencode(b),2):raise OSError(ctypes.get_errno(),'Atomic exchange failed')
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--archives',type=Path,default=Path(__file__).parent);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    receipt=json.loads((args.archives/'package-receipt.json').read_text());assert receipt['release']==225 and receipt['staticOnly'] is True
    assert set(receipt['targets'])==set(MANIFESTS)
    baseline=receipt['baseline'];assert all(json.loads((ROOT/n/m).read_text())['version']==baseline['versions'][n] for n,m in MANIFESTS.items()),'Online version changed'
    assert all(sha(ROOT/n)==h for n,h in baseline['hashes'].items()),'Online source changed'
    assert not (ROOT/'layout225-deployment.json').exists()
    before={n:tree(ROOT/n) for n in MANIFESTS};guard=protected();inventories={}
    for name,target in receipt['targets'].items():
        assert not (ROOT/(name+'-before-layout225')).exists()
        archive=args.archives/target['archive'];assert sha(archive)==target['sha256']
        with tarfile.open(archive) as tar:
            members=tar.getmembers();names=[m.name for m in members];assert len(names)==len(set(names))
            expected={**target['hashes'],'layout225-hashes.json':target['manifestSha256']};assert set(names)==set(expected)
            for m in members:
                valid_name(m.name);assert m.isfile() and allowed(name,m.name),m.name
                data=tar.extractfile(m).read();assert hashlib.sha256(data).hexdigest()==expected[m.name],m.name
                if m.name.endswith('source.zip'):
                    with zipfile.ZipFile(io.BytesIO(data)) as z:assert z.comment.decode()==receipt['suiteCommit' if m.name.endswith('suite-source.zip') else 'webCommit'] and z.testzip() is None
            assert json.loads(tar.extractfile(MANIFESTS[name]).read())['version']==receipt['versions'][name]
            inventories[name]=expected
    report={'release':225,'versions':receipt['versions'],'webCommit':receipt['webCommit'],'suiteCommit':receipt['suiteCommit'],'verifiedFiles':{n:len(v) for n,v in inventories.items()},'unchangedFiles':{n:len(set(before[n])-set(inventories[n])) for n in MANIFESTS},'staticOnly':True,'playerDataWritten':False,'servicesRestarted':False,'realRoomVerified':False}
    if not args.apply:print(json.dumps({**report,'preflightPassed':True,'writes':False},indent=2));return
    stages={};swapped=[]
    try:
        for name in MANIFESTS:
            stage=Path(tempfile.mkdtemp(prefix='.layout225-'+name+'-',dir=ROOT));stages[name]=stage
            shutil.copytree(ROOT/name,stage,dirs_exist_ok=True)
            with tarfile.open(args.archives/receipt['targets'][name]['archive']) as tar:
                for m in tar.getmembers():
                    dest=stage/m.name;assert dest.resolve().is_relative_to(stage)
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    with tar.extractfile(m) as src,dest.open('wb') as dst:shutil.copyfileobj(src,dst)
                    os.chmod(dest,0o644)
            for d in [stage]+[p for p in stage.rglob('*') if p.is_dir()]:os.chmod(d,0o755)
            assert tree(stage)=={**before[name],**inventories[name]},'Staging mismatch'
        assert all(tree(ROOT/n)==v for n,v in before.items()),'Concurrent publication'
        assert protected()==guard,'Protected service/site changed'
        for name in MANIFESTS:exchange(ROOT/name,stages[name]);swapped.append(name)
        assert all(tree(ROOT/n)=={**before[n],**inventories[n]} for n in MANIFESTS)
        assert protected()==guard
        for name in MANIFESTS:
            assert tree(stages[name])==before[name]
            backup=ROOT/(name+'-before-layout225');stages[name].rename(backup);stages[name]=backup
        report.update(applied=True,backups={n:str(p) for n,p in stages.items()},nginxUnchanged=True,protectedSites={n:len(v) for n,v in guard['sites'].items()})
        (ROOT/'layout225-deployment.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
    except BaseException:
        for name in reversed(swapped):exchange(ROOT/name,stages[name])
        raise
if __name__=='__main__':main()
