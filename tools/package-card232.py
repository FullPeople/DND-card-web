"""Package the verified standalone tree and exact tracked Git source for /card only."""
from pathlib import Path
import argparse, hashlib, io, json, subprocess, tarfile, zipfile

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    git = lambda *args: subprocess.check_output(['git', '-C', str(root), *args])
    assert not git('status', '--porcelain', '--untracked-files=no').strip(), 'Tracked workspace must be clean'
    commit = git('rev-parse', 'HEAD').decode().strip()
    assert json.loads((root/'package.json').read_text())['version'] == '0.1.25'
    baseline = json.loads(args.baseline.read_text())
    assert baseline['versions']['card/release.json'] == 'standalone-1.0.230'
    assert baseline['sources']['card/source.zip']['commit'] == '1d5c87cd9cfd1aab4bae1dbb564457bb3c5d0cc8'
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    payload = {p.relative_to(root/'dist-standalone').as_posix(): p.read_bytes()
               for p in sorted((root/'dist-standalone').rglob('*')) if p.is_file()}
    assert {'index.html', 'sw.js', 'standalone-audit.json'} <= payload.keys()
    audit = json.loads(payload['standalone-audit.json'])
    assert audit['singlePlayer'] is True and not audit['multiplayerModules']
    source = git('archive', '--format=zip', commit)
    with zipfile.ZipFile(io.BytesIO(source)) as z:
        assert z.comment.decode() == commit and z.testzip() is None
        assert not any(any(x in n.split('/') for x in ['.local-evidence', 'node_modules', 'local-rules', '.env']) for n in z.namelist())
    payload['source.zip'] = source
    payload['release.json'] = (json.dumps({'version':'standalone-1.0.232', 'announcementVersion':'0.1.25', 'sourceCommit':commit}, indent=2)+'\n').encode()
    hashes = {n:hashlib.sha256(data).hexdigest() for n,data in payload.items()}
    payload['release232-hashes.json'] = (json.dumps(hashes, indent=2)+'\n').encode()
    archive = out/'card232.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for name,data in payload.items():
            info = tarfile.TarInfo(name); info.size=len(data); info.mode=0o644
            tar.addfile(info, io.BytesIO(data))
    receipt={'release':232, 'staticOnly':True, 'webCommit':commit,
             'version':'standalone-1.0.232', 'announcementVersion':'0.1.25',
             'archive':archive.name, 'sha256':digest(archive),
             'hashes':hashes, 'manifestSha256':hashlib.sha256(payload['release232-hashes.json']).hexdigest(),
             'baseline':baseline}
    (out/'package-receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps({'commit':commit, 'files':len(payload), 'archiveBytes':archive.stat().st_size, 'sha256':receipt['sha256']}))

if __name__ == '__main__': main()
