import contextlib, importlib.util, pathlib, sqlite3, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('stage_two',pathlib.Path(__file__).with_name('stage_two.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StageTwoTests(unittest.TestCase):
 def test_waits_for_new_workers_and_never_accepts_a_wrong_policy(self):
  with patch.object(m,'run',side_effect=[m.subprocess.CalledProcessError(22,'curl'),'{"qqLogin":"disabled"}','{"qqLogin":"ready"}']) as read,patch.object(m.time,'sleep'):
   self.assertEqual(m.wait_json(('curl','test'),lambda value:value.get('qqLogin')=='ready',3),{'qqLogin':'ready'})
   self.assertEqual(read.call_count,3)
  with patch.object(m,'run',return_value='{"qqLogin":"disabled"}'),patch.object(m.time,'sleep'):
   with self.assertRaises(RuntimeError):m.wait_json(('curl','test'),lambda value:value.get('qqLogin')=='ready',3)
 def test_routes_preserve_production_and_only_dispatch_the_exact_marker(self):
  old='server {\n    location ^~ /api/ { proxy_pass http://127.0.0.1:5014; }\n}\n'
  result=m.nginx_patch(old)
  self.assertIn('default 5014; stage2 5015;',result)
  self.assertIn('location = /api/auth/qq/callback',result)
  self.assertIn('location ^~ /cloud-lab/api/',result)
  self.assertIn('    location ^~ /api/ { proxy_pass http://127.0.0.1:5014; }',result)
  self.assertNotIn('5015;',old)
  with self.assertRaises(RuntimeError):m.nginx_patch(result)
 def test_copies_permanent_data_without_sessions_or_touching_source(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);source=root/'source.sqlite';target=root/'copy.sqlite'
   schema='CREATE TABLE accounts(id,subject);CREATE TABLE cards(id,owner_id,body);CREATE TABLE editors(card_id,qq);CREATE TABLE account_editors(card_id,account_id);CREATE TABLE qq_profiles(account_id,nickname,avatar);CREATE TABLE cloud_ids(id);CREATE TABLE sessions(token_hash,account_id);CREATE TABLE temporary_cards(id,body);'
   for path in [source,target]:
    with contextlib.closing(sqlite3.connect(path)) as db:db.executescript(schema)
   with contextlib.closing(sqlite3.connect(source)) as db:
    db.execute('INSERT INTO accounts VALUES(?,?)',('owner','qq:verified'))
    db.execute('INSERT INTO cards VALUES(?,?,?)',('ABCDEF','owner','{"name":"synthetic"}'))
    db.execute('INSERT INTO sessions VALUES(?,?)',('original-session','owner'))
    db.execute('INSERT INTO temporary_cards VALUES(?,?)',('GHIJKL','{}'));db.commit()
   before=m.db_digest(source);m.copy_permanent(source,target)
   self.assertEqual(m.db_digest(source),before)
   with contextlib.closing(sqlite3.connect(target)) as db:
    self.assertEqual(db.execute('SELECT * FROM cards').fetchall(),[('ABCDEF','owner','{"name":"synthetic"}')])
    self.assertEqual(db.execute('SELECT count(*) FROM sessions').fetchone()[0],0)
    self.assertEqual(db.execute('SELECT count(*) FROM temporary_cards').fetchone()[0],0)
if __name__=='__main__':unittest.main()
