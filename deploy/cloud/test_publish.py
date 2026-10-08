"""Linux synthetic-directory checks. No real service, website or database writes."""
import ctypes, importlib.util, json, tarfile, tempfile, unittest, threading, hashlib
from http.server import BaseHTTPRequestHandler,HTTPServer
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('migration_publisher',Path(__file__).with_name('publish.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PublisherTests(unittest.TestCase):
    def test_preserved_external_release_requires_exact_before_after_and_scope(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder);live=root/'suite-dev';backup=root/'suite-dev-before-external-test';live.mkdir();backup.mkdir();(live/'index').write_text('new');(backup/'index').write_text('old')
            original={'static:suite-dev':m.digest(m.tree(backup)),'service':'unchanged'};current={**original,'static:suite-dev':m.digest(m.tree(live))}
            external={'release':'external-test','status':'published','writesPlayerData':False,'backendChanged':False,'targets':{'suite-dev':{'backup':str(backup),'published':True,'expectedFiles':m.tree(live)}}}
            with patch.object(m,'OLD',root/'card'),patch.object(m,'protected',return_value=current):
                self.assertEqual(m.resume_guard(original,original,external),current)
                with self.assertRaises(RuntimeError):m.resume_guard(original,original)
                (live/'unexpected').write_text('drift')
                with self.assertRaises(RuntimeError):m.resume_guard(original,original,external)
            with patch.object(m,'protected',return_value={**current,'service':'changed'}):
                with self.assertRaises(RuntimeError):m.resume_guard(original,original,external)
    def test_resume_refuses_other_receipts_and_protected_drift_without_writes(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder);baseline={'protected':{'guard':'original'}};(root/'baseline.json').write_text(json.dumps(baseline))
            manifest={'release':m.KEY,'baselineSha256':m.sha(root/'baseline.json'),'publisherSha256':m.sha(Path(m.__file__)),'packageFiles':{}};(root/'manifest.json').write_text(json.dumps(manifest))
            receipt=root/'receipt.json'
            for status in ['published','failed-restored']:
                receipt.write_text(json.dumps({'release':m.KEY,'status':status,'protectedBefore':baseline['protected']}));before=m.tree(root)
                with patch.object(m,'JOURNAL',receipt),patch.object(m,'protected',return_value={'guard':'changed'}):
                    with self.assertRaisesRegex(RuntimeError,'Only this restored|Protected-state drift'):m.resume_restored(root,m.sha(root/'manifest.json'))
                self.assertEqual(m.tree(root),before)
    def test_reload_waits_for_exact_new_http_bytes(self):
        calls=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                calls.append(1);self.send_response(410 if len(calls)==1 else 200);self.end_headers();self.wfile.write(b'old' if len(calls)<3 else b'new')
        server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            self.assertEqual(m.wait_http('http://127.0.0.1:'+str(server.server_port),expected_sha=hashlib.sha256(b'new').hexdigest()),b'new');self.assertEqual(len(calls),3)
        finally:server.shutdown();server.server_close();thread.join()
    def test_atomic_exchange_and_recovery(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            a=Path(folder)/'a';b=Path(folder)/'b';a.mkdir();b.mkdir();(a/'card').write_text('old');(b/'card').write_text('new');m.exchange(a,b)
            self.assertEqual((a/'card').read_text(),'new');self.assertEqual((b/'card').read_text(),'old');m.exchange(a,b);self.assertEqual((a/'card').read_text(),'old')
    def test_archive_exact_hashes(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder);source=root/'source';source.mkdir();(source/'index.html').write_text('test');archive=root/'frontend.tar.gz'
            with tarfile.open(archive,'w:gz') as z:z.add(source/'index.html',arcname='index.html')
            m.unpack(archive,root/'stage',m.tree(source));self.assertEqual(m.tree(source),m.tree(root/'stage'))
            with self.assertRaises(RuntimeError):m.unpack(archive,root/'bad',{'index.html':'0'*64})
    def test_archive_escape_and_symlink_denied(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder)
            for name,typ in [('../escape',tarfile.REGTYPE),('link',tarfile.SYMTYPE)]:
                archive=root/('unsafe-'+str(typ)+'.tgz')
                with tarfile.open(archive,'w:gz') as z:
                    item=tarfile.TarInfo(name);item.type=typ;item.linkname='/etc/passwd';z.addfile(item)
                with self.assertRaises(RuntimeError):m.unpack(archive,root/('stage-'+str(typ)),{})
    def test_source_tree_symlink_denied(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder);(root/'linked').symlink_to('/etc/passwd')
            with self.assertRaises(RuntimeError):m.tree(root)
    def test_manifest_mismatch_has_no_writes(self):
        with tempfile.TemporaryDirectory(prefix='dnd-publisher-') as folder:
            root=Path(folder);(root/'manifest.json').write_text('{}')
            with self.assertRaises(RuntimeError):m.preflight(root,'0'*64)
            self.assertEqual(list(root.iterdir()),[root/'manifest.json'])

if __name__=='__main__':unittest.main()
