"""Linux synthetic-directory checks. No real service, website or database writes."""
import ctypes, importlib.util, json, tarfile, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('migration_publisher',Path(__file__).with_name('publish.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PublisherTests(unittest.TestCase):
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
