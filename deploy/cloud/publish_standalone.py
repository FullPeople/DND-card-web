"""Promote only the standalone frontends and private-account backend in place."""
import argparse, contextlib, hashlib, json, os, pathlib, re, shutil, sqlite3, sys, time, urllib.request
from stage_two import digest, tree, db_digest, run, wait_json
from update_stage_two import exchange

P=pathlib.Path
ROOT=P('/var/www/dnd-center'); SERVICE=P('/opt/dnd-card-cloud')
DB=P('/var/lib/dnd-card-cloud/cards.sqlite'); LAB_DB=P('/var/lib/dnd-card-cloud-lab2/cards.sqlite')
NGINX=P('/etc/nginx/sites-available/dnd-center-retired.conf')
DROPIN=P('/etc/systemd/system/dnd-card-cloud.service.d/40-standalone-private-cloud.conf')
RECEIPTS=P('/root/codex-release-receipts')
REQUIRED={'web.yml','cloud-migration.yml','dot-deploy-contract.yml','standalone-cloud-production.yml'}
LIMITS='''[Service]
ExecStart=
ExecStart=/opt/dnd-card-cloud/runtime/bin/node --max-old-space-size=192 /opt/dnd-card-cloud/current/launcher.mjs
LoadCredential=qq.env:/etc/dnd-card-cloud-qq.env
MemoryHigh=256M
MemoryMax=384M
CPUQuota=50%
TasksMax=32
'''

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.standalone-new')
    assert not temporary.exists()
    with temporary.open('w') as stream:
        stream.write(value if isinstance(value,str) else json.dumps(value,sort_keys=True,indent=2));stream.flush();os.fsync(stream.fileno())
    os.chmod(temporary,0o600 if path.suffix=='.json' else 0o644);os.replace(temporary,path)

def api(path):
    request=urllib.request.Request('https://api.github.com/repos/FullPeople/DND-card-web/'+path,headers={'User-Agent':'standalone-private-cloud-release','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=20) as response:return json.load(response)

def verify_ci(manifest):
    commit=manifest['commit'];assert api('git/ref/heads/main')['object']['sha']==commit,'Current main differs'
    verified=set()
    for ident in manifest['ciRuns']:
        assert isinstance(ident,int)
        value=api('actions/runs/'+str(ident))
        assert value['head_sha']==commit and value['head_branch']=='main' and value['event'] in ['push','workflow_dispatch']
        assert value['head_repository']['full_name']=='FullPeople/DND-card-web'
        assert value['status']=='completed' and value['conclusion']=='success'
        page=1;jobs=[]
        while True:
            data=api('actions/runs/'+str(ident)+'/jobs?per_page=100&page='+str(page));jobs+=data['jobs']
            if len(jobs)>=data['total_count']:break
            page+=1;assert page<=10
        assert jobs and all(job['status']=='completed' and job['conclusion']=='success' for job in jobs)
        verified.add(value['path'].split('/')[-1])
    assert REQUIRED<=verified,'Missing exact-commit production checks'

def checked_payload(stage,manifest):
    assert manifest['scope']=='standalone-private-cloud-production'
    assert re.fullmatch('[a-f0-9]{40}',manifest['commit']) and re.fullmatch('standalone-1\\.0\\.[0-9]+',manifest['version'])
    assert set(manifest['tools'])=={'publish_standalone.py','stage_two.py','update_stage_two.py'}
    for name,sha in manifest['tools'].items():assert digest(P(__file__).parent/name)==sha,'Sealed publisher changed'
    for relative,sha in manifest['files'].items():
        path=stage/relative
        assert '\\' not in relative and '..' not in P(relative).parts
        assert not path.is_symlink() and path.resolve().is_relative_to(stage)
        assert relative.split('/')[0] in ['card','library','server'] and not re.search(r'private-|\.sqlite|\.env(?:$|\.)|LOCAL-ONLY',relative)
        assert digest(path)==sha
    assert {name.replace('\\','/') for name in tree(stage)}==set(manifest['files'])|{'manifest.json'}
    assert {p for p in manifest['files'] if p.startswith('server/')}=={'server/server.mjs','server/launcher.mjs','server/release.json','server/backup.mjs'}
    assert manifest['files']['server/backup.mjs']==manifest['baseline']['backupScriptSha256']
    for folder in ['card','library','server']:
        release=json.loads((stage/folder/'release.json').read_text())
        assert release['sourceCommit']==manifest['commit'] and release['version']==manifest['version'] and release['scope']==manifest['scope']
    for folder in ['card','library']:
        profile=json.loads((stage/folder/'cloud-profile.json').read_text())
        assert profile['scope']==manifest['scope'] and profile['cloudFeaturesEnabled'] is True and profile['originalStorageNamespaces'] is True and profile['owlbearEnabled'] is False
        assert 'data-cloud-lab' not in (stage/folder/'index.html').read_text()

def database_snapshot(path):
    tables={}
    with contextlib.closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)) as db:
        db.execute('BEGIN')
        for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
            sha=hashlib.sha256();count=0
            for row in db.execute('SELECT * FROM "'+name.replace('"','""')+'" ORDER BY rowid'):
                sha.update(repr(row).encode());count+=1
            tables[name]={'count':count,'sha256':sha.hexdigest()}
        assert db.execute('PRAGMA quick_check').fetchone()[0]=='ok'
    return tables

def unchanged_tables(before,after):
    assert all(after.get(name)==value for name,value in before.items()),'An existing database table changed'

def copy_database(source,target):
    assert not target.exists() and source.resolve()!=target.resolve()
    with contextlib.closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src,contextlib.closing(sqlite3.connect(target)) as dst:
        src.backup(dst,pages=64,sleep=.05)
        assert dst.execute('PRAGMA quick_check').fetchone()[0]=='ok'
    os.chmod(target,0o600)

def protected_site():
    return {str(p.relative_to(ROOT)):digest(p) for p in sorted(ROOT.rglob('*')) if p.is_file() and not any(p.is_relative_to(ROOT/folder) for folder in ['card','library'])}

def protected():
    plugin_roots=[P('/var/www/obr-plugins')/name for name in ['suite','suite-dev']]
    assert all(path.is_dir() for path in plugin_roots),'Expected Owlbear roots are missing'
    return {'site':protected_site(),'owlbear':{str(path):tree(path) for path in plugin_roots},'nginx':digest(NGINX),
      'backupScript':digest(SERVICE/'current/backup.mjs'),'baseService':digest(P('/etc/systemd/system/dnd-card-cloud.service')),
      'backupUnits':{name:digest(P('/etc/systemd/system')/name) for name in ['dnd-card-cloud-backup.service','dnd-card-cloud-backup.timer']},
      'labDatabase':db_digest(LAB_DB),'labPid':run('systemctl','show','--property=MainPID','--value','dnd-card-cloud-lab2.service')}

def memory_available():
    return int(re.search(r'^MemAvailable:\s+(\d+)',P('/proc/meminfo').read_text(),re.M)[1])*1024

def overlay(old,source,next_path):
    assert not old.is_symlink() and not next_path.exists()
    shutil.copytree(old,next_path)
    for file in source.rglob('*'):
        if file.is_file():
            dest=next_path/file.relative_to(source);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,dest)
    for relative,sha in tree(old).items():
        normalized=relative.replace('\\','/')
        if normalized.startswith('assets/') and normalized!='assets/automation-progress.audit.json':assert digest(next_path/relative)==sha,'Previously loaded asset changed'

def point(target):
    assert target.parent==SERVICE/'releases' and target.is_dir() and not target.is_symlink()
    temporary=SERVICE/'current-standalone-new';assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target);os.replace(temporary,SERVICE/'current')

def restart():
    run('systemctl','daemon-reload');run('systemctl','restart','dnd-card-cloud.service')

def verify_health(version):
    health=wait_json(('curl','-fsS','http://127.0.0.1:5014/api/health'),lambda h:h.get('version')==version.replace('standalone-','') and h.get('qqLogin')=='ready')
    assert all(health.get(key) is True for key in ['accountPrivate','accountLibrariesPrivate','cloudFeaturesEnabled','standaloneOnly'])
    assert all(health.get(key) is False for key in ['temporaryUpload','publicDirectory','pluginConnections'])
    return health

def restore_runtime(previous,original_dropin,switched,exchanged):
    for current,peer in reversed(exchanged):exchange(current,peer)
    if switched:
        if original_dropin is None:
            if DROPIN.exists():DROPIN.unlink()
        else:write(DROPIN,original_dropin)
        point(previous);restart()

def preflight(stage,manifest):
    checked_payload(stage,manifest);verify_ci(manifest)
    assert memory_available()>=384*1024*1024,'Insufficient memory headroom'
    assert (SERVICE/'current').is_symlink() and (SERVICE/'current').resolve().parent==SERVICE/'releases'
    for folder in ['card','library']:
        assert digest(ROOT/folder/'release.json')==manifest['baseline'][folder+'ReleaseSha256']
    assert not DROPIN.exists(),'Existing standalone override requires inspection'
    assert digest(NGINX)==manifest['baseline']['nginxSha256']
    assert digest(SERVICE/'current/backup.mjs')==manifest['baseline']['backupScriptSha256']
    original=database_snapshot(DB);assert original['cards']['count']==manifest['baseline']['cards']
    needed=sum(p.stat().st_size for folder in ['card','library'] for p in (ROOT/folder).rglob('*') if p.is_file())*3+DB.stat().st_size*3+1024**3
    assert shutil.disk_usage(ROOT).free>needed,'Insufficient fresh-backup space'
    return original

def publish(stage,seal,apply=False):
    stage=stage.resolve();assert digest(stage/'manifest.json')==seal,'Manifest seal changed'
    manifest=json.loads((stage/'manifest.json').read_text());commit=manifest['commit']
    receipt=RECEIPTS/('standalone-cloud-'+commit+'.json');marker=receipt.with_suffix('.pending.json')
    if receipt.exists():return json.loads(receipt.read_text())
    assert not marker.exists(),'Inspect the durable marker before any retry'
    if not apply:
        original=preflight(stage,manifest)
        return {'status':'preflight-passed','commit':commit,'cards':original['cards']['count'],'memoryAvailable':memory_available()}
    import fcntl
    with open('/run/lock/obr-static-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        original=preflight(stage,manifest);before=protected();identity=(DB.stat().st_dev,DB.stat().st_ino)
        previous=(SERVICE/'current').resolve();original_dropin=DROPIN.read_text() if DROPIN.exists() else None
        backup=P('/root/codex-backups')/('standalone-cloud-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-'+commit[:8]);backup.mkdir(mode=0o700)
        for folder in ['card','library']:shutil.copytree(ROOT/folder,backup/folder)
        shutil.copytree(previous,backup/'backend');shutil.copy2(P('/etc/systemd/system/dnd-card-cloud.service'),backup/'original.service')
        copy_database(DB,backup/'cards.sqlite');unchanged_tables(original,database_snapshot(backup/'cards.sqlite'))
        write(backup/'protected-before.json',before);write(backup/'database-before.json',original)
        release=SERVICE/'releases'/('standalone-cloud-'+commit[:12]);assert not release.exists();shutil.copytree(stage/'server',release)
        probe=backup/'schema-probe.sqlite';copy_database(backup/'cards.sqlite',probe)
        run(str(SERVICE/'runtime/bin/node'),'--max-old-space-size=192','--input-type=module','-e',"const {CloudStore}=await import(process.argv[1]);const store=new CloudStore(process.argv[2]);store.close();",(release/'server.mjs').as_uri(),str(probe))
        unchanged_tables(original,database_snapshot(probe))
        for path in [probe,P(str(probe)+'-wal'),P(str(probe)+'-shm')]:
            assert path.parent==backup
            if path.exists():path.unlink()
        peers={name:ROOT.parent/('.standalone-'+name+'-'+commit[:12]) for name in ['card','library']}
        for name,peer in peers.items():overlay(ROOT/name,stage/name,peer)
        assert api('git/ref/heads/main')['object']['sha']==commit and memory_available()>=384*1024*1024
        write(marker,{'commit':commit,'backup':str(backup),'previousBackend':str(previous),'peers':{k:str(v) for k,v in peers.items()},'phase':'prepared'})
        switched=False;exchanged=[];committed=False
        try:
            switched=True;write(DROPIN,LIMITS);point(release);restart();health=verify_health(manifest['version'])
            unchanged_tables(original,database_snapshot(DB));assert (DB.stat().st_dev,DB.stat().st_ino)==identity
            write(marker,{'commit':commit,'backup':str(backup),'previousBackend':str(previous),'phase':'backend-ready','peers':{k:str(v) for k,v in peers.items()}})
            for name,peer in peers.items():exchange(ROOT/name,peer);exchanged.append((ROOT/name,peer))
            for name in ['card','library']:
                assert json.loads(run('curl','-fsS','--resolve','dnd.center:443:127.0.0.1','https://dnd.center/'+name+'/release.json'))['sourceCommit']==commit
            assert protected()==before,'Non-target state changed'
            assert (DB.stat().st_dev,DB.stat().st_ino)==identity
            database_snapshot(DB)
            for name,peer in peers.items():
                retained=backup/('exchanged-'+name);os.rename(peer,retained)
                exchanged=[(current,retained if previous_peer==peer else previous_peer) for current,previous_peer in exchanged]
            result={'status':'published-standalone-private-cloud','commit':commit,'version':manifest['version'],'backup':str(backup),'entry':'https://dnd.center/card/','databaseNotReplaced':True,'originalTablesUnchangedAtActivation':True,'productionCards':original['cards']['count'],'testDatabaseNotCopied':True,'owlbearUnchanged':True,'nginxUnchanged':True,'labUnchanged':True,'backendMemoryMaxBytes':384*1024*1024,'memoryAvailableAfter':memory_available()}
            write(receipt,result);committed=True;marker.rename(backup/'completed.json');return result
        except Exception:
            if not committed:
                restore_runtime(previous,original_dropin,switched,exchanged)
                write(backup/'failure.json',{'commit':commit,'databaseNeverRestoredOrReplaced':True,'runtimeRestored':True});marker.rename(backup/'failed.json')
            raise

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('stage',type=P);parser.add_argument('--seal',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    assert args.stage.resolve().is_relative_to(P('/root/codex-release-packages'))
    print(json.dumps(publish(args.stage,args.seal,args.apply)))
