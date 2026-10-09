"""QQ backend release checks with a real SQLite database and atomic symlink swap."""
from pathlib import Path
from contextlib import ExitStack
from unittest.mock import patch
import importlib.util,json,sqlite3,tarfile,tempfile,unittest
spec=importlib.util.spec_from_file_location('qq_release',Path(__file__).with_name('publish_backend.py'))
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
class BackendTests(unittest.TestCase):
 def fixture(self,root):
  site=root/'site';site.mkdir();(site/'index.html').write_text('original homepage')
  service=root/'backend';old=service/'releases/old';old.mkdir(parents=True);(old/'server.mjs').write_text('old server');(old/'backup.mjs').write_text('backup');(service/'current').symlink_to(old)
  unit=root/'unit';unit.write_text('old unit');db=root/'cards.sqlite'
  with sqlite3.connect(db) as conn:conn.executescript('CREATE TABLE accounts(id);CREATE TABLE cards(id);CREATE TABLE temporary_cards(id);INSERT INTO temporary_cards VALUES("existing");')
  stack=ExitStack();self.addCleanup(stack.close)
  for name,value in [('ROOT',site),('SERVICE',service),('UNIT',unit),('DB',db),('RECEIPTS',root/'receipts')]:stack.enter_context(patch.object(u,name,value))
  stack.enter_context(patch.object(u,'protected',return_value={'other-sites':'preserved'}));stack.enter_context(patch.object(u.m,'command',return_value='active'))
  self.restart=stack.enter_context(patch.object(u,'restart'));self.verify=stack.enter_context(patch.object(u,'verify',return_value={'qqLogin':'pending'}));stack.enter_context(patch.object(u.m,'wait_http',return_value=b'{}'))
  package=root/'package';package.mkdir();(package/'baseline.json').write_text(json.dumps(u.snapshot()));(package/'publish.py').write_bytes(Path(u.m.__file__).read_bytes());(package/'dnd-card-cloud.service').write_text('new unit')
  candidate=root/'candidate';candidate.mkdir();(candidate/'server.mjs').write_text('new server');(candidate/'backup.mjs').write_text('backup')
  with tarfile.open(package/'backend.tar.gz','w:gz') as tar:
   for file in candidate.iterdir():tar.add(file,arcname=file.name)
  manifest={'release':'dnd-center-qq-backend-test','sourceCommit':'a'*40,'databaseReplaced':False,'publisherSha256':u.sha(Path(u.__file__)),'baselineSha256':u.sha(package/'baseline.json'),'packageFiles':{name:u.sha(package/name) for name in ['publish.py','backend.tar.gz','dnd-card-cloud.service']},'backendFiles':u.tree(candidate)}
  (package/'manifest.json').write_text(json.dumps(manifest));return package,u.sha(package/'manifest.json')
 def test_publish_rollback_preserve_existing_and_new_uploads(self):
  with tempfile.TemporaryDirectory() as folder:
   package,seal=self.fixture(Path(folder));inode=u.DB.stat().st_ino;front=u.tree(u.ROOT)
   self.assertEqual(u.apply(package,seal)['status'],'published');self.assertEqual((u.SERVICE/'current/server.mjs').read_text(),'new server')
   with sqlite3.connect(u.DB) as db:db.execute('INSERT INTO temporary_cards VALUES("new upload")')
   self.assertEqual(u.rollback(package,seal)['status'],'rolled-back');self.assertEqual(u.database()['temporary_cards'],2);self.assertEqual(u.DB.stat().st_ino,inode);self.assertEqual(u.tree(u.ROOT),front)
 def test_restart_failure_restores_unit_and_backend(self):
  with tempfile.TemporaryDirectory() as folder:
   package,seal=self.fixture(Path(folder));self.verify.side_effect=RuntimeError('not ready')
   with self.assertRaisesRegex(RuntimeError,'not ready'):u.apply(package,seal)
   self.assertEqual((u.SERVICE/'current/server.mjs').read_text(),'old server');self.assertEqual(u.UNIT.read_text(),'old unit');self.assertEqual(u.database()['temporary_cards'],1)
 def test_frontend_drift_prevents_switch(self):
  with tempfile.TemporaryDirectory() as folder:
   package,seal=self.fixture(Path(folder));(u.ROOT/'index.html').write_text('concurrent homepage')
   with self.assertRaisesRegex(RuntimeError,'baseline drift'):u.apply(package,seal)
   self.assertFalse((package/'backup').exists());self.restart.assert_not_called()
 def test_upload_during_staging_remains(self):
  with tempfile.TemporaryDirectory() as folder:
   package,seal=self.fixture(Path(folder));unpack=u.m.unpack
   def concurrent(*args):
    unpack(*args)
    with sqlite3.connect(u.DB) as db:db.execute('INSERT INTO temporary_cards VALUES("concurrent upload")')
   with patch.object(u.m,'unpack',side_effect=concurrent):u.apply(package,seal)
   self.assertEqual(u.database()['temporary_cards'],2)
 def test_tampered_package_prevents_backup(self):
  with tempfile.TemporaryDirectory() as folder:
   package,seal=self.fixture(Path(folder));(package/'dnd-card-cloud.service').write_text('modified unit')
   with self.assertRaisesRegex(RuntimeError,'Package changed'):u.apply(package,seal)
   self.assertFalse((package/'backup').exists())
if __name__=='__main__':unittest.main()
