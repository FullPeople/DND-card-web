import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile

import build_production as build
import production_common as c


class FrontendPackageBuildTests(unittest.TestCase):
    def test_package_includes_only_two_frontends_and_exact_tracked_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            (root / 'LICENSE').write_text('license'); (root / 'private-untracked.txt').write_text('not public')
            subprocess.run(['git', 'add', 'LICENSE'], cwd=root, check=True)
            subprocess.run(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], cwd=root, check=True)
            sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
            for name in c.TARGETS:
                (root / 'dist-cloud' / name).mkdir(parents=True)
                (root / 'dist-cloud' / name / 'index.html').write_text('candidate')
            (root / 'dist-cloud/index.html').write_text('must not publish this homepage')
            (root / 'dist-cloud/card/sw.js').write_text('worker')
            (root / 'dist-cloud/card/standalone-audit.json').write_text('{"singlePlayer":true,"multiplayerModules":[]}')
            (root / 'deploy/cloud').mkdir(parents=True)
            for name in ('frontend.py', 'publish.py'): (root / 'deploy/cloud' / name).write_text('fixed publisher fixture')
            for policy in ('pending', 'ready'):
                output = root / ('out-' + policy)
                result = build.package(root, output, sha, 'standalone-1.0.257', '1.0.253', policy)
                metadata, _ = build.c.inspect_archive(output / 'deployment.tar.gz', result['sha256'])
                self.assertEqual(metadata['format'], 2)
                self.assertEqual(metadata['qqLogin'], policy)
                self.assertNotIn('index.html', metadata['files'])
                destination = root / ('extracted-' + policy)
                build.c.extract_frontends(output / 'deployment.tar.gz', destination)
                for target in c.TARGETS:
                    self.assertEqual(json.loads((destination / target / 'release.json').read_text())['qqLogin'], policy)
                with zipfile.ZipFile(destination / 'card/source.zip') as archive:
                    self.assertEqual(archive.comment.decode(), sha); self.assertEqual(archive.namelist(), ['LICENSE'])
            private_output = root / 'out-private'
            with self.assertRaisesRegex(build.c.Denied, 'private-frontend-profile-missing'):
                build.package(root, private_output, sha, 'standalone-1.0.303', '1.0.303', 'ready', cloud_mode='account-private')
            self.assertFalse(private_output.exists())
            profile = {'scope': 'standalone-private-cloud-production', 'cloudFeaturesEnabled': True,
                       'accountLibrariesPrivate': True, 'originalStorageNamespaces': True,
                       'owlbearEnabled': False, 'apiBase': '/api/'}
            for target in c.TARGETS:
                (root / 'dist-cloud' / target / 'cloud-profile.json').write_text(json.dumps({**profile, 'cloudFeaturesEnabled': False}))
            with self.assertRaisesRegex(build.c.Denied, 'private-frontend-profile-invalid'):
                build.package(root, private_output, sha, 'standalone-1.0.303', '1.0.303', 'ready', cloud_mode='account-private')
            self.assertFalse(private_output.exists())
            for target in c.TARGETS:
                (root / 'dist-cloud' / target / 'cloud-profile.json').write_text(json.dumps(profile))
            result = build.package(root, private_output, sha, 'standalone-1.0.303', '1.0.303', 'ready', cloud_mode='account-private')
            metadata, _ = build.c.inspect_archive(private_output / 'deployment.tar.gz', result['sha256'])
            self.assertEqual(metadata['format'], 3)
            self.assertEqual(metadata['cloudMode'], 'account-private')
            self.assertEqual([name for name in metadata['files'] if name.endswith('/cloud-profile.json')],
                             ['card/cloud-profile.json', 'library/cloud-profile.json'])



if __name__ == "__main__":
    unittest.main()
