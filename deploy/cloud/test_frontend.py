"""Synthetic Linux filesystem checks for static publication and database preservation."""
from pathlib import Path
import importlib.util,json,sqlite3,tarfile,tempfile,unittest
from contextlib import ExitStack
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('frontend',Path(__file__).with_name('frontend.py'));u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)

class FrontendTests(unittest.TestCase):
 def fixture(self,root):
  front=root/'site';(front/'card').mkdir(parents=True);(front/'card/index.html').write_text('old card');(front/'card/release.json').write_text(json.dumps({'version':'standalone-1.0.253','sourceCommit':'b'*40}))
  database=root/'cards.sqlite'
  with sqlite3.connect(database) as db:db.executescript('CREATE TABLE accounts(id);CREATE TABLE cards(id);CREATE TABLE temporary_cards(id);INSERT INTO temporary_cards VALUES("original");')
  stack=ExitStack();self.addCleanup(stack.close)
  for name,value in [('ROOT',front),('DB',database),('RECEIPTS',root/'receipts')]:stack.enter_context(patch.object(u,name,value))
  stack.enter_context(patch.object(u,'protected',return_value={'other-service':'unchanged','cloud-backend':'unchanged'}))
  stack.enter_context(patch.object(u.m,'command',return_value='active'))
  stack.enter_context(patch.object(u.m,'wait_http',return_value=b'old card'))
  self.verify=stack.enter_context(patch.object(u,'verify'))
  package=root/'package';package.mkdir();baseline=u.snapshot();(package/'baseline.json').write_text(json.dumps(baseline));(package/'publish.py').write_bytes(Path(u.m.__file__).read_bytes())
  candidate=root/'candidate';(candidate/'card').mkdir(parents=True);(candidate/'card/index.html').write_text('new card');(candidate/'card/release.json').write_text(json.dumps({'version':'standalone-1.0.254','sourceCommit':'a'*40}))
  with tarfile.open(package/'frontend.tar.gz','w:gz') as archive:
   for file in candidate.rglob('*'):
    if file.is_file():archive.add(file,arcname=file.relative_to(candidate).as_posix())
  manifest={'release':'dnd-center-ui254-test','version':'standalone-1.0.254','previousVersion':'standalone-1.0.253','previousSourceCommit':'b'*40,'sourceCommit':'a'*40,'backendVersion':'1.0.253','backendChanged':False,'playerDataChanged':False,'publisherSha256':u.sha(Path(u.__file__)),'baselineSha256':u.sha(package/'baseline.json'),'packageFiles':{name:u.sha(package/name) for name in ['frontend.tar.gz','publish.py']},'frontendFiles':u.tree(candidate)}
  (package/'manifest.json').write_text(json.dumps(manifest));return package,u.sha(package/'manifest.json'),manifest
 def test_publish_and_rollback_keep_new_database_records_and_backend(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));before=u.DB.read_bytes();result=u.apply(package,digest)
   self.assertFalse(result['backendChanged']);self.assertEqual(before,u.DB.read_bytes());self.assertEqual((u.ROOT/'card/index.html').read_text(),'new card')
   with sqlite3.connect(u.DB) as db:db.execute('INSERT INTO temporary_cards VALUES("after-release")')
   self.assertEqual(u.rollback(package,digest)['status'],'rolled-back');self.assertEqual(u.database_check()['temporary_cards'],2);self.assertEqual((u.ROOT/'card/index.html').read_text(),'old card')
 def test_upload_during_staging_does_not_block_or_lose_card(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));original=u.m.unpack
   def concurrent_upload(*args):
    original(*args)
    with sqlite3.connect(u.DB) as db:db.execute('INSERT INTO temporary_cards VALUES("during-stage")')
   with patch.object(u.m,'unpack',side_effect=concurrent_upload):self.assertEqual(u.apply(package,digest)['status'],'published')
   self.assertEqual(u.database_check()['temporary_cards'],2)
 def test_failure_restores_complete_frontend(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));before=u.tree(u.ROOT);self.verify.side_effect=RuntimeError('HTTP not ready')
   with self.assertRaisesRegex(RuntimeError,'HTTP not ready'):u.apply(package,digest)
   self.assertEqual(u.tree(u.ROOT),before);self.assertEqual(json.loads(u.receipt_path(manifest).read_text())['status'],'failed-restored');self.assertEqual(u.database_check()['temporary_cards'],1)
 def test_live_drift_refuses_publication_before_backup(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));(u.ROOT/'card/index.html').write_text('external release')
   with self.assertRaisesRegex(RuntimeError,'baseline drift'):u.apply(package,digest)
   self.assertFalse((package/'backup').exists())
 def test_changed_protected_backend_refuses_rollback(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));u.apply(package,digest)
   with patch.object(u,'protected',return_value={'cloud-backend':'external release'}):
    with self.assertRaisesRegex(RuntimeError,'Protected drift'):u.rollback(package,digest)
   self.assertEqual((u.ROOT/'card/index.html').read_text(),'new card')
 def test_changed_package_refuses_publication(self):
  with tempfile.TemporaryDirectory() as folder:
   package,digest,manifest=self.fixture(Path(folder));(package/'publish.py').write_text('changed helper')
   with self.assertRaisesRegex(RuntimeError,'Package changed'):u.apply(package,digest)
   self.assertFalse((package/'backup').exists())
if __name__=='__main__':unittest.main()
