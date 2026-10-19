import pathlib, sys, tempfile, unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import update_stage_two as m

class FrontendUpdateTests(unittest.TestCase):
 @unittest.skipUnless(sys.platform=='linux','renameat2 is the Linux publication primitive')
 def test_atomic_exchange_and_rollback(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);a=root/'a';b=root/'b';a.mkdir();b.mkdir();(a/'index').write_text('old');(b/'index').write_text('new')
   m.exchange(a,b);self.assertEqual((a/'index').read_text(),'new');m.exchange(a,b);self.assertEqual((a/'index').read_text(),'old')
 def test_old_hashed_assets_remain_available_and_only_entry_changes(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);old=root/'old';stage=root/'stage';new=root/'next'
   for target in [old,stage]:
    for folder in ['card','library']:(target/folder/'assets').mkdir(parents=True)
   (old/'card/assets/previous.js').write_text('previous');(old/'card/index.html').write_text('before')
   (stage/'card/assets/current.js').write_text('current');(stage/'card/index.html').write_text('after')
   m.overlay(old,stage,new)
   self.assertEqual((new/'card/assets/previous.js').read_text(),'previous');self.assertEqual((new/'card/assets/current.js').read_text(),'current')
   self.assertEqual((old/'card/index.html').read_text(),'before');self.assertEqual((new/'card/index.html').read_text(),'after')
 def test_only_unversioned_audit_metadata_may_change_at_an_existing_asset_path(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);old=root/'old';stage=root/'stage'
   for target in [old,stage]:
    for folder in ['card','library']:(target/folder/'assets').mkdir(parents=True)
   for target,value in [(old,'before'),(stage,'after')]:
    (target/'card/assets/automation-progress.audit.json').write_text(value)
   m.overlay(old,stage,root/'allowed');self.assertEqual((root/'allowed/card/assets/automation-progress.audit.json').read_text(),'after')
   (old/'card/assets/immutable-12345678.js').write_text('old');(stage/'card/assets/immutable-12345678.js').write_text('different')
   with self.assertRaises(AssertionError):m.overlay(old,stage,root/'rejected')
 def test_payload_rejects_database_and_backend_files(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);(root/'server').mkdir();(root/'server/server.mjs').write_text('forbidden')
   manifest={'scope':'standalone-private-cloud-stage2-frontend-update','commit':'a'*40,'files':{'server/server.mjs':m.digest(root/'server/server.mjs')}}
   with self.assertRaises(AssertionError):m.checked_payload(root,manifest)
 def test_payload_rejects_parent_traversal(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);stage=root/'stage';stage.mkdir();(root/'outside').write_text('private')
   manifest={'scope':'standalone-private-cloud-stage2-frontend-update','commit':'a'*40,'files':{'card/../../outside':m.digest(root/'outside')}}
   with self.assertRaises(AssertionError):m.checked_payload(stage,manifest)

if __name__=='__main__':unittest.main()
