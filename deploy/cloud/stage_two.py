"""Publish ONLY the isolated QQ lab, with a fresh backup and durable receipt."""
import contextlib, hashlib, json, os, pathlib, shutil, sqlite3, subprocess, sys, time
P=pathlib.Path
def run(*args): return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()
def digest(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
 return h.hexdigest()
def atomic_write(path,text):
 temp=path.with_name(path.name+'.cloud-lab2-new')
 if temp.exists():raise RuntimeError('Unfinished lab write exists; inspect before retrying')
 temp.write_text(text);os.chmod(temp,0o644);os.replace(temp,path)
def tree(path,exclude=None):
 return {str(p.relative_to(path)):digest(p) for p in sorted(path.rglob('*')) if p.is_file() and not(exclude and p.is_relative_to(exclude))}
def db_digest(path):
 h=hashlib.sha256()
 with contextlib.closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)) as db:
  db.execute('BEGIN')
  for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
   h.update(name.encode())
   for row in db.execute('SELECT * FROM "'+name.replace('"','""')+'" ORDER BY rowid'):h.update(repr(row).encode())
 return h.hexdigest()
def copy_permanent(source,target):
 # The source is opened read-only. Sessions, temporary uploads, room grants and
 # plugin credentials are never copied into the test database.
 with contextlib.closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)) as src,contextlib.closing(sqlite3.connect(target)) as dst:
  src.execute('BEGIN');dst.execute('PRAGMA foreign_keys=ON')
  for table in ['accounts','cards','editors','account_editors','qq_profiles','cloud_ids']:
   columns=[r[1] for r in dst.execute('PRAGMA table_info('+table+')')]
   if not src.execute('SELECT 1 FROM sqlite_master WHERE type="table" AND name=?',(table,)).fetchone():continue
   fields=','.join('"'+c+'"' for c in columns)
   statement='INSERT OR IGNORE INTO '+table+'('+fields+') VALUES('+','.join('?' for _ in columns)+')'
   dst.executemany(statement,src.execute('SELECT '+fields+' FROM '+table))
  dst.commit()
  assert dst.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
  assert dst.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
def nginx_patch(original):
 anchor='    location ^~ /api/ {'
 if original.count(anchor)!=1 or 'cloud-lab' in original:raise RuntimeError('Unexpected nginx baseline; no changes applied')
 proxy='''        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 35s;
        proxy_send_timeout 35s;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        access_log off;
'''
 addition='''    location = /cloud-lab { return 308 /cloud-lab/card/; }
    location = /cloud-lab/ { return 308 /cloud-lab/card/; }
    location ^~ /cloud-lab/api/ {
        limit_req zone=dnd_cloud_api burst=40 nodelay;
        limit_req_status 429;
        rewrite ^/cloud-lab(/api/.*)$ $1 break;
        proxy_pass http://127.0.0.1:5015;
'''+proxy+'''    }
    location = /api/auth/qq/callback {
        limit_req zone=dnd_cloud_api burst=40 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:$dnd_stage2_callback_port;
'''+proxy+'''    }
    location ^~ /cloud-lab/ {
        add_header Cache-Control "no-cache, must-revalidate" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        try_files $uri $uri/ =404;
    }
'''
 return 'map $arg_cloud_lab $dnd_stage2_callback_port { default 5014; stage2 5015; }\n'+original.replace(anchor,addition+anchor)
UNIT='''[Unit]
Description=Isolated standalone QQ/private-library test copy
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=3
[Service]
Type=simple
User=dnd-card-cloud
Group=dnd-card-cloud
LoadCredential=qq.env:/etc/dnd-card-cloud-qq.env
ExecStart=/opt/dnd-card-cloud/runtime/bin/node --max-old-space-size=192 /opt/dnd-card-cloud-lab2/launcher.mjs
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
InaccessiblePaths=/var/lib/dnd-card-cloud
ReadWritePaths=/var/lib/dnd-card-cloud-lab2
MemoryHigh=256M
MemoryMax=384M
CPUQuota=50%
TasksMax=32
[Install]
WantedBy=multi-user.target
'''
def publish(stage):
 import fcntl
 stage=stage.resolve();manifest=json.loads((stage/'manifest.json').read_text())
 assert manifest['scope']=='standalone-private-cloud-stage2' and len(manifest['commit'])==40
 receipt=P('/root/codex-release-receipts/cloud-lab2-'+manifest['commit']+'.json')
 if receipt.exists():print(receipt.read_text());return
 for relative,sha in manifest['files'].items():
  p=stage/relative
  assert p.resolve().is_relative_to(stage) and relative.split('/')[0] in ['card','library','server','launcher.mjs'] and digest(p)==sha
 config=P('/etc/nginx/sites-available/dnd-center-retired.conf');original=config.read_text()
 assert digest(config)==manifest['nginxBaselineSha256']
 patched=nginx_patch(original)
 site=P('/var/www/dnd-center');public=site/'cloud-lab';backend=P('/opt/dnd-card-cloud-lab2');database=P('/var/lib/dnd-card-cloud-lab2');unit=P('/etc/systemd/system/dnd-card-cloud-lab2.service');source=P('/var/lib/dnd-card-cloud/cards.sqlite')
 assert not any(p.exists() for p in [public,backend,database,unit])
 lock=open('/run/lock/obr-static-release.lock','a')
 with lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  backup=P('/root/codex-backups/cloud-lab2-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));backup.mkdir(mode=0o700)
  shutil.copy2(config,backup/'nginx.conf')
  before={'site':tree(site),'database':db_digest(source),'nginx':digest(config)}
  (backup/'before.json').write_text(json.dumps(before));pending=backup/'pending.json';pending.write_text(json.dumps({'commit':manifest['commit'],'targetsPreviouslyAbsent':True}))
  started=False;config_changed=False
  try:
   database.mkdir(mode=0o700);backend.mkdir(mode=0o755);public.mkdir(mode=0o755)
   for folder in ['card','library']:shutil.copytree(stage/folder,public/folder)
   shutil.copytree(stage/'server',backend/'server');shutil.copy2(stage/'launcher.mjs',backend/'launcher.mjs')
   # Fresh schema from this exact source, then insert permanent data only.
   code="const m=await import('file:///opt/dnd-card-cloud-lab2/server/server.mjs');new m.CloudStore('/var/lib/dnd-card-cloud-lab2/cards.sqlite').close();"
   run('/opt/dnd-card-cloud/runtime/bin/node','--input-type=module','-e',code)
   copy_permanent(source,database/'cards.sqlite');run('chown','-R','dnd-card-cloud:dnd-card-cloud',str(database));os.chmod(database/'cards.sqlite',0o600)
   atomic_write(unit,UNIT);run('systemctl','daemon-reload');run('systemctl','start',unit.name);started=True
   for attempt in range(20):
    try:health=json.loads(run('curl','-fsS','http://127.0.0.1:5015/api/health'));break
    except subprocess.CalledProcessError:
     if attempt==19:raise
     time.sleep(.5)
   assert health['qqLogin']=='ready' and health['accountPrivate'] is True
   atomic_write(config,patched);config_changed=True;run('nginx','-t');run('systemctl','reload','nginx')
   html=run('curl','-fsS','--resolve','dnd.center:443:127.0.0.1','https://dnd.center/cloud-lab/card/');assert 'data-cloud-lab="stage2"' in html
   session=json.loads(run('curl','-fsS','--resolve','dnd.center:443:127.0.0.1','https://dnd.center/cloud-lab/api/session'));assert session['authenticated'] is False and session['qqLogin']=='ready'
   production=json.loads(run('curl','-sS','--resolve','dnd.center:443:127.0.0.1','https://dnd.center/api/session'));assert production['error']=='cloud_disabled'
   assert tree(site,public)==before['site'] and db_digest(source)==before['database']
   run('systemctl','enable',unit.name)
   result={'status':'published-isolated-lab','commit':manifest['commit'],'backup':str(backup),'entry':'https://dnd.center/cloud-lab/card/','productionUnchanged':True,'realQQLoginAccepted':False}
   receipt.parent.mkdir(exist_ok=True);receipt.write_text(json.dumps(result,indent=2));pending.rename(backup/'completed.json');print(json.dumps(result))
  except Exception:
   if config_changed:shutil.copy2(backup/'nginx.conf',config);run('nginx','-t');run('systemctl','reload','nginx')
   if started:run('systemctl','stop',unit.name)
   (backup/'failed.json').write_text(json.dumps({'commit':manifest['commit'],'rollback':'nginx restored; lab artifacts retained privately for inspection'}))
   raise
if __name__=='__main__':publish(P(sys.argv[1]))
