"""Exercise the two-target publisher only under a unique synthetic temporary root."""
import sys
if sys.platform!='linux':
    print('Synthetic atomic exchange checks require Linux; run these on the deployment host or CI.');sys.exit(0)
import pathlib,tempfile,importlib.util,json,hashlib,zipfile,tarfile,io,sqlite3
spec=importlib.util.spec_from_file_location('candidate_publisher',pathlib.Path(__file__).with_name('suite_links.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
results=[]
def setup(root):
    m.ROOT=root/'static';m.ROOT.mkdir();m.KEY='synthetic-followup251';m.JOURNAL=root/'journal.json'
    (root/'untouched-dnd-center.txt').write_text('unchanged site')
    database=sqlite3.connect(root/'new-cards.sqlite');database.execute('CREATE TABLE cards(id TEXT)');database.execute("INSERT INTO cards VALUES('before')");database.commit();database.close()
    m.protected=lambda:{'synthetic-sentinel':m.sha(root/'untouched-dnd-center.txt')}
    archives=root/'package';archives.mkdir()
    commits={k:c*40 for k,c in [('web','a'),('suite','b'),('suiteStable','c'),('data','d')]}
    sources={};source_bytes={}
    for repo in ('web','suite','suiteStable'):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,'w') as z:z.writestr('source.txt','authored synthetic fixture');z.comment=commits[repo].encode()
        source_bytes[repo]=stream.getvalue();sources[repo]={'sha256':hashlib.sha256(source_bytes[repo]).hexdigest()}
    baseline={'sites':{},'protected':m.protected()};receipt={'release':m.KEY,'commits':commits,'sources':sources,'targets':{},'backendChanged':False,'playerDataChanged':False}
    for target in m.TARGETS:
        live=m.ROOT/target;live.mkdir();(live/'index.html').write_text('old synthetic '+target);(live/'preserved.js').write_text('historical asset')
        baseline['sites'][target]=m.tree(live)
        repo={'card':'web','suite-dev':'suite','suite':'suiteStable'}[target]
        metadata={'channel':target,'version':'synthetic-new','sourceCommit':commits[repo],'sourceCommits':commits,'completeFrontend':True,'backendChanged':False}
        files={'index.html':('new synthetic '+target).encode(),'source.zip':source_bytes[repo],'release.json':json.dumps(metadata).encode()}
        path=archives/(target+'.tar.gz')
        with tarfile.open(path,'w:gz') as z:
            for name,data in files.items():i=tarfile.TarInfo(name);i.size=len(data);z.addfile(i,io.BytesIO(data))
        receipt['targets'][target]={'archive':path.name,'sha256':m.sha(path),'version':'synthetic-new','sourceAliases':{'source.zip':repo},'files':{name:hashlib.sha256(data).hexdigest() for name,data in files.items()},'bytes':path.stat().st_size}
    (archives/'server-baseline.json').write_text(json.dumps(baseline));receipt['baselineSha256']=m.sha(archives/'server-baseline.json');receipt['publisherSha256']=m.sha(pathlib.Path(m.__file__));(archives/'package-receipt.json').write_text(json.dumps(receipt));m.PACKAGE_SHA=m.sha(archives/'package-receipt.json')
    return archives,baseline
with tempfile.TemporaryDirectory(prefix='web-fixes250-synthetic-') as td:
    root=pathlib.Path(td)
    normal=root/'normal';normal.mkdir();archives,baseline=setup(normal);before=m.tree(m.ROOT)
    m.preflight(archives);assert m.tree(m.ROOT)==before and not m.JOURNAL.exists();results.append('read-only preflight has no writes')
    changed=m.ROOT/m.TARGETS[0]/'index.html';changed.write_text('concurrent synthetic change')
    try:m.preflight(archives);raise AssertionError('drift accepted')
    except ValueError as e:assert 'Concurrent frontend change' in str(e)
    changed.write_text('old synthetic '+m.TARGETS[0]);results.append('concurrent target drift rejected')
    original=m.exchange;calls=[]
    def tracked(a,b):
        for n in m.TARGETS:assert m.tree(m.ROOT/(n+'-before-'+m.KEY))==baseline['sites'][n]
        if not calls:
            database=sqlite3.connect(normal/'new-cards.sqlite');database.execute("INSERT INTO cards VALUES('during-publication')");database.commit();database.close()
        calls.append(a.name);return original(a,b)
    m.exchange=tracked;m.apply(archives);assert calls==list(m.TARGETS);results.append('both complete backups precede the first real atomic exchange')
    changed.write_text('late synthetic change')
    try:m.rollback(archives);raise AssertionError('rollback drift accepted')
    except ValueError as e:assert 'Current site changed' in str(e)
    changed.write_text('new synthetic '+m.TARGETS[0]);m.rollback(archives)
    assert all(m.tree(m.ROOT/n)==baseline['sites'][n] for n in m.TARGETS);results.append('guarded two-target rollback restores each exact tree')
    database=sqlite3.connect(normal/'new-cards.sqlite');assert database.execute('SELECT COUNT(*) FROM cards').fetchone()[0]==2;database.close();results.append('cards saved during publication survive staging and rollback')
    failure=root/'failure';failure.mkdir();archives,baseline=setup(failure);count=[0]
    def fail_second(a,b):
        count[0]+=1
        if count[0]==2:raise OSError('authored synthetic second-cutover failure')
        return original(a,b)
    m.exchange=fail_second
    try:m.apply(archives);raise AssertionError('failure ignored')
    except OSError:pass
    assert all(m.tree(m.ROOT/n)==baseline['sites'][n] for n in m.TARGETS)
    assert m.read(m.JOURNAL)['status']=='rolled-back';results.append('second-cutover failure automatically restores the first target')
    for path in ('../escape','/absolute','assets/../escape','assets\\escape','assets//duplicate'):
        try:m.safe_name(path);raise AssertionError('unsafe path accepted')
        except ValueError:pass
    results.append('archive traversal and noncanonical paths rejected')
print(json.dumps({'syntheticOnly':True,'productionWrites':False,'passed':len(results),'checks':results},indent=2))
