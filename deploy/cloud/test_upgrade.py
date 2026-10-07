"""Synthetic Linux upgrade/rollback tests; never connects to production."""
from pathlib import Path
import importlib.util,json,sqlite3,tarfile,tempfile,unittest
from contextlib import ExitStack
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('upgrade',Path(__file__).with_name('upgrade.py'));u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)

class UpgradeTests(unittest.TestCase):
 def fixture(self,root):
  service=root/'service';old=service/'releases'/'old';old.mkdir(parents=True);(old/'server.mjs').write_text('old backend');(service/'current').symlink_to(old)
  front=root/'site';(front/'card').mkdir(parents=True);(front/'card/release.json').write_text(json.dumps({'version':'standalone-1.0.252'}));(front/'card/index.html').write_text('old card')
  unit=root/'cloud.service';unit.write_text('old unit');db=root/'cards.sqlite'
  with sqlite3.connect(db) as conn:conn.executescript('CREATE TABLE accounts(id); CREATE TABLE cards(id); INSERT INTO cards VALUES("original");')
  stack=ExitStack();self.addCleanup(stack.close)
  for name,value in [('SERVICE',service),('ROOT',front),('UNIT',unit),('DB',db),('JOURNAL',root/'receipt.json')]:stack.enter_context(patch.object(u,name,value))
  stack.enter_context(patch.object(u,'protected',return_value={'other-service':'unchanged'}))
  stack.enter_context(patch.object(u.m,'command',side_effect=lambda *args:'active' if args[0]=='systemctl' else 'v24.9.0'))
  stack.enter_context(patch.object(u,'restart'))
  stack.enter_context(patch.object(u.m,'wait_http',side_effect=lambda url,*args:b'{"temporaryUpload":true,"version":"1.0.252"}' if url.endswith('health') else b'old card'))
  stack.enter_context(patch.object(u,'verify'))
  baseline=u.snapshot();package=root/'package';package.mkdir();(package/'baseline.json').write_text(json.dumps(baseline));(package/'dnd-card-cloud.service').write_text('new unit')
  stage=root/'new';(stage/'card').mkdir(parents=True);(stage/'card/index.html').write_text('new card');(stage/'card/release.json').write_text(json.dumps({'version':'standalone-1.0.253','sourceCommit':'a'*40}));backend=root/'backend';backend.mkdir();(backend/'server.mjs').write_text('new backend')
  for folder,name in [(stage,'frontend'),(backend,'backend')]:
   with tarfile.open(package/(name+'.tar.gz'),'w:gz') as archive:
    for file in folder.rglob('*'):
     if file.is_file():archive.add(file,arcname=file.relative_to(folder).as_posix())
  manifest={'release':u.KEY,'sourceCommit':'a'*40,'publisherSha256':u.sha(Path(u.__file__)),'baselineSha256':u.sha(package/'baseline.json'),'packageFiles':{name:u.sha(package/name) for name in ['dnd-card-cloud.service','frontend.tar.gz','backend.tar.gz']},'frontendFiles':u.tree(stage),'backendFiles':u.tree(backend)};(package/'manifest.json').write_text(json.dumps(manifest))
  # Keep all stages inside the synthetic root, including exchange destinations.
  original_unpack=u.m.unpack
  def unpack(archive,destination,expected):
   if str(destination).startswith('/var/www/'):destination=root/'upgrade-stage'
   return original_unpack(archive,destination,expected)
  # Path creation used by the publisher is redirected without affecting pathlib elsewhere.
  original_path=u.Path
  def scoped_path(value):
   if str(value).startswith('/var/www/.dnd-center-stage-'):return root/'upgrade-stage'
   if str(value).startswith('/var/www/.dnd-center-rollback-'):return root/'rollback-stage'
   return original_path(value)
  stack.enter_context(patch.object(u,'Path',side_effect=scoped_path))
  return package,u.sha(package/'manifest.json'),baseline
 def test_upgrade_then_rollback_preserves_new_player_records(self):
  with tempfile.TemporaryDirectory(prefix='dnd-upgrade-') as folder:
   root=Path(folder);package,digest,baseline=self.fixture(root);self.assertEqual(u.apply(package,digest)['status'],'published');self.assertEqual((u.ROOT/'card/index.html').read_text(),'new card')
   with sqlite3.connect(u.DB) as db:db.execute('INSERT INTO cards VALUES("after-publish")')
   self.assertEqual(u.rollback(package,digest)['status'],'rolled-back');self.assertEqual((u.ROOT/'card/index.html').read_text(),'old card');self.assertEqual(u.database_check()['cards'],2);self.assertEqual(u.UNIT.read_text(),'old unit')
 def test_failed_readiness_restores_both_targets_and_keeps_database(self):
  with tempfile.TemporaryDirectory(prefix='dnd-upgrade-') as folder:
   root=Path(folder);package,digest,baseline=self.fixture(root)
   with patch.object(u,'verify',side_effect=RuntimeError('readiness failed')):
    with self.assertRaisesRegex(RuntimeError,'readiness failed'):u.apply(package,digest)
   self.assertEqual(u.tree(u.ROOT),baseline['frontend']);self.assertEqual(str((u.SERVICE/'current').resolve()),baseline['backendTarget']);self.assertEqual(u.database_check()['cards'],1);self.assertEqual(json.loads(u.JOURNAL.read_text())['status'],'failed-restored')
 def test_live_drift_is_denied_before_backups_or_service_changes(self):
  with tempfile.TemporaryDirectory(prefix='dnd-upgrade-') as folder:
   root=Path(folder);package,digest,baseline=self.fixture(root);(u.ROOT/'card/index.html').write_text('external change')
   with self.assertRaisesRegex(RuntimeError,'baseline drift'):u.apply(package,digest)
   self.assertFalse((package/'backup').exists());self.assertEqual(u.UNIT.read_text(),'old unit');self.assertFalse(u.JOURNAL.exists())
if __name__=='__main__':unittest.main()
