import contextlib, json, os, pathlib, sqlite3, tempfile, unittest
from unittest.mock import patch
import publish_standalone as p
P=pathlib.Path

class ProductionRelease(unittest.TestCase):
    def files(self,root):return {name.replace('\\','/'):sha for name,sha in p.tree(root).items() if name!='manifest.json'}
    def payload(self,root):
        root.mkdir();release={'scope':'standalone-private-cloud-production','version':'standalone-1.0.303','sourceCommit':'a'*40}
        for folder in ['card','library','server']:
            (root/folder).mkdir();(root/folder/'release.json').write_text(json.dumps(release))
        for folder in ['card','library']:
            (root/folder/'index.html').write_text('production HTML');(root/folder/'cloud-profile.json').write_text(json.dumps({'scope':release['scope'],'cloudFeaturesEnabled':True,'originalStorageNamespaces':True,'owlbearEnabled':False}))
        for name in ['server.mjs','launcher.mjs','backup.mjs']:(root/'server'/name).write_text('owned source')
        result={'scope':release['scope'],'commit':release['sourceCommit'],'version':release['version'],'files':self.files(root),'tools':{name:p.digest(P(p.__file__).parent/name) for name in ['publish_standalone.py','stage_two.py','update_stage_two.py']},'baseline':{'backupScriptSha256':p.digest(root/'server/backup.mjs')}}
        (root/'manifest.json').write_text(json.dumps(result));return result

    def test_payload_rejects_database_files_modified_publishers_and_test_profiles(self):
        with tempfile.TemporaryDirectory() as folder:
            root=P(folder)/'payload';manifest=self.payload(root);p.checked_payload(root,manifest)
            corrupt={**manifest,'tools':{**manifest['tools'],'publish_standalone.py':'0'*64}}
            with self.assertRaises(AssertionError):p.checked_payload(root,corrupt)
            forbidden=root/'server/private.sqlite';forbidden.write_text('must not be deployed')
            with self.assertRaises(AssertionError):p.checked_payload(root,{**manifest,'files':self.files(root)})
            forbidden.unlink();profile=root/'card/cloud-profile.json';data=json.loads(profile.read_text());data['originalStorageNamespaces']=False;profile.write_text(json.dumps(data))
            with self.assertRaises(AssertionError):p.checked_payload(root,{**manifest,'files':self.files(root)})

    def database(self,path):
        with contextlib.closing(sqlite3.connect(path)) as db:db.executescript("CREATE TABLE cards(id TEXT,body TEXT);INSERT INTO cards VALUES('original','private character');CREATE TABLE sessions(token TEXT);INSERT INTO sessions VALUES('private session');")

    def test_coherent_backup_preserves_original_and_session_without_replacing_it(self):
        with tempfile.TemporaryDirectory() as folder:
            source=P(folder)/'original.sqlite';target=P(folder)/'backup.sqlite';self.database(source);inode=source.stat().st_ino
            before=p.database_snapshot(source);p.copy_database(source,target)
            self.assertEqual(before,p.database_snapshot(target));self.assertEqual(source.stat().st_ino,inode)
            with contextlib.closing(sqlite3.connect(source)) as db:db.execute("INSERT INTO cards VALUES('new','saved after backup')");db.commit()
            self.assertEqual(p.database_snapshot(source)['cards']['count'],2);self.assertEqual(p.database_snapshot(target)['cards']['count'],1)
            with self.assertRaises(AssertionError):p.copy_database(target,source)

    def test_existing_rows_cannot_be_changed_but_new_compatible_tables_are_allowed(self):
        before={'cards':{'count':1,'sha256':'original'}}
        p.unchanged_tables(before,{**before,'directory':{'count':1,'sha256':'derived'}})
        with self.assertRaises(AssertionError):p.unchanged_tables(before,{'cards':{'count':1,'sha256':'overwritten'}})

    def test_old_hashed_resources_remain_available(self):
        with tempfile.TemporaryDirectory() as folder:
            root=P(folder);old=root/'old';source=root/'candidate';next_path=root/'next'
            (old/'assets').mkdir(parents=True);source.mkdir();(old/'assets/old-hash.js').write_text('old JS');(old/'index.html').write_text('old HTML');(source/'index.html').write_text('new HTML')
            p.overlay(old,source,next_path)
            self.assertEqual((next_path/'assets/old-hash.js').read_text(),'old JS');self.assertEqual((next_path/'index.html').read_text(),'new HTML')
            self.assertEqual((old/'index.html').read_text(),'old HTML')

    def test_old_asset_hash_collision_is_rejected_without_changing_the_live_tree(self):
        with tempfile.TemporaryDirectory() as folder:
            root=P(folder);old=root/'old';source=root/'candidate';(old/'assets').mkdir(parents=True);(source/'assets').mkdir(parents=True)
            (old/'assets/old-hash.js').write_text('original');(source/'assets/old-hash.js').write_text('different')
            with self.assertRaises(AssertionError):p.overlay(old,source,root/'next')
            self.assertEqual((old/'assets/old-hash.js').read_text(),'original')

    @unittest.skipIf(os.name=='nt','renameat2 exchange is verified on Linux CI')
    def test_partial_frontend_failure_restores_both_pages_backend_and_limits_without_reverting_saved_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root=P(folder);service=root/'service';previous=service/'releases/old';candidate=service/'releases/new';previous.mkdir(parents=True);candidate.mkdir();(service/'current').symlink_to(candidate)
            current=root/'card';peer=root/'card-peer';current.mkdir();peer.mkdir();(current/'index.html').write_text('new');(peer/'index.html').write_text('old')
            dropin=root/'limits.conf';dropin.write_text('new limits');dbfile=root/'cards.sqlite';self.database(dbfile);inode=dbfile.stat().st_ino
            with contextlib.closing(sqlite3.connect(dbfile)) as db:db.execute("INSERT INTO cards VALUES('new','saved during deployment')");db.commit()
            with patch.object(p,'SERVICE',service),patch.object(p,'DROPIN',dropin),patch.object(p,'restart') as restart:
                p.restore_runtime(previous,None,True,[(current,peer)])
                restart.assert_called_once();self.assertEqual((service/'current').resolve(),previous);self.assertFalse(dropin.exists())
            self.assertEqual((current/'index.html').read_text(),'old');self.assertEqual(dbfile.stat().st_ino,inode);self.assertEqual(p.database_snapshot(dbfile)['cards']['count'],2)

    def ci_reply(self,change=None):
        workflows=sorted(p.REQUIRED)
        def api(path):
            if path=='git/ref/heads/main':return {'object':{'sha':'a'*40}}
            if '/jobs?' in path:return {'total_count':1,'jobs':[{'status':'completed','conclusion':'success'}]}
            value={'head_sha':'a'*40,'head_branch':'main','event':'push','head_repository':{'full_name':'FullPeople/DND-card-web'},'status':'completed','conclusion':'success','path':'.github/workflows/'+workflows[int(path.split('/')[-1])-1]}
            return {**value,**(change or {})}
        return api

    def test_ci_requires_the_exact_current_main_all_workflows_and_all_jobs(self):
        manifest={'commit':'a'*40,'ciRuns':[1,2,3,4]}
        with patch.object(p,'api',side_effect=self.ci_reply()):p.verify_ci(manifest)
        for change in [{'head_sha':'b'*40},{'head_branch':'other'},{'event':'pull_request'},{'conclusion':'failure'}]:
            with patch.object(p,'api',side_effect=self.ci_reply(change)),self.assertRaises(AssertionError):p.verify_ci(manifest)
        with patch.object(p,'api',side_effect=self.ci_reply()),self.assertRaises(AssertionError):p.verify_ci({**manifest,'ciRuns':[1,2,3]})
        good=self.ci_reply()
        with patch.object(p,'api',side_effect=lambda path:{'total_count':1,'jobs':[{'status':'completed','conclusion':'skipped'}]} if '/jobs?' in path else good(path)),self.assertRaises(AssertionError):p.verify_ci(manifest)

    def test_low_memory_refuses_before_any_service_or_database_operation(self):
        with patch.object(p,'checked_payload'),patch.object(p,'verify_ci'),patch.object(p,'memory_available',return_value=200*1024**2),self.assertRaisesRegex(AssertionError,'memory'):
            p.preflight(P('/unused'),{})

    def test_health_rejects_public_mode_or_reenabled_plugin_connections(self):
        valid={'version':'1.0.303','qqLogin':'ready','accountPrivate':True,'accountLibrariesPrivate':True,'cloudFeaturesEnabled':True,'standaloneOnly':True,'temporaryUpload':False,'publicDirectory':False,'pluginConnections':False}
        with patch.object(p,'wait_json',return_value=valid):p.verify_health('standalone-1.0.303')
        for change in [{'pluginConnections':True},{'publicDirectory':True},{'accountLibrariesPrivate':False}]:
            with patch.object(p,'wait_json',return_value={**valid,**change}),self.assertRaises(AssertionError):p.verify_health('standalone-1.0.303')

if __name__=='__main__':unittest.main()
