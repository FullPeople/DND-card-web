"""Package the reviewed screen layout as a static card overlay; no publication."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, tarfile, zipfile

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p, data):
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def tree(p):
    return {f.relative_to(p).as_posix():sha(f) for f in sorted(p.rglob('*')) if f.is_file()}
def source(repo, dest):
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    assert not subprocess.check_output(['git','diff','HEAD','--','src','public'],cwd=repo), 'Uncommitted runtime source'
    subprocess.run(['git','archive','--format=zip','--output='+str(dest),commit],cwd=repo,check=True)
    with zipfile.ZipFile(dest) as z:
        assert z.comment.decode()==commit and z.testzip() is None
        for n in z.namelist():
            assert not any(part in ['node_modules','.local-evidence','evidence','local-rules','.cache'] or part.startswith('.env') and part!='.env.example' for part in Path(n).parts), n
    return commit

def main():
    p=argparse.ArgumentParser();p.add_argument('--suite',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--baseline',type=Path,required=True);a=p.parse_args()
    web=Path(__file__).resolve().parents[1];out=a.out.resolve();assert not out.exists();out.mkdir(parents=True)
    baseline=json.loads(a.baseline.read_text(encoding='utf-8-sig'))
    assert baseline['versions']['card']=='standalone-1.0.223' and baseline['versions']['suite']=='1.3.14'
    wc=source(web,out/'source.zip');sc=source(a.suite,out/'suite-source.zip')
    audit=json.loads((web/'dist-standalone/standalone-audit.json').read_text());assert audit['singlePlayer'] and not audit['multiplayerModules']
    targets={}
    for name in ['card','suite-dev','suite']:
        folder=out/name;folder.mkdir()
        if name=='card':
            shutil.copytree(web/'dist-standalone',folder,dirs_exist_ok=True)
            shutil.copy2(web/'LICENSE',folder/'LICENSE.txt')
            shutil.copy2(out/'source.zip',folder/'source.zip')
            write(folder/'release.json',{'version':'standalone-1.0.225','announcementVersion':'0.1.21','sourceCommit':wc})
            (folder/'downloads').mkdir()
            with zipfile.ZipFile(folder/'downloads/DND-Card-Standalone-225.zip','w',zipfile.ZIP_DEFLATED) as z:
                for f in sorted(folder.rglob('*')):
                    if f.is_file() and 'downloads' not in f.relative_to(folder).parts:z.write(f,f.relative_to(folder).as_posix())
        else:
            for sub in (['workbench','card-viewer'] if name=='suite-dev' else ['card-viewer']):
                shutil.copytree(web/'dist',folder/sub)
                for file in ['source.zip','suite-source.zip']:shutil.copy2(out/file,folder/sub/file)
                shutil.copy2(web/'LICENSE',folder/sub/'LICENSE')
                if sub=='card-viewer':shutil.copy2(web/'.local-evidence/legacy-bridge.js',folder/sub/'bridge.js')
            for file in ['source.zip','suite-source.zip']:shutil.copy2(out/file,folder/file)
            manifest='manifest-dev.json' if name=='suite-dev' else 'manifest.json'
            shutil.copy2(a.suite/'public'/manifest,folder/manifest)
        files=tree(folder);write(folder/'layout225-hashes.json',files)
        archive=out/(name+'-layout225.tar.gz')
        with tarfile.open(archive,'w:gz') as tar:
            for f in sorted(folder.rglob('*')):
                if f.is_file():tar.add(f,arcname=f.relative_to(folder).as_posix(),recursive=False)
        targets[name]={'archive':archive.name,'sha256':sha(archive),'files':len(files),'hashes':files,'manifestSha256':sha(folder/'layout225-hashes.json')}
    receipt={'release':225,'webCommit':wc,'suiteCommit':sc,'baseline':baseline,'versions':{'card':'standalone-1.0.225','suite-dev':'1.0.225-dev','suite':'1.3.15'},'targets':targets,'staticOnly':True}
    write(out/'package-receipt.json',receipt)
    print(json.dumps({k:v for k,v in receipt.items() if k not in ['targets','baseline']},indent=2))
    print(json.dumps({n:{k:v for k,v in t.items() if k!='hashes'} for n,t in targets.items()},indent=2))
if __name__=='__main__':main()
