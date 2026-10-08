"""Deployment boundary, transport and real-filesystem transition regressions."""
from contextlib import ExitStack
import copy
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import time
from types import SimpleNamespace
import unittest
import sys
from unittest.mock import patch
import zipfile

import production_common as c
import server_production as server
import server_entry as entry
import build_production as build
import admin_install_production as admin
import runner_production as runner

NOW = 1000000


def request():
    return {'operation': 'publish', 'target': 'dnd-center', 'sha': 'a' * 40,
            'ci_run_ids': '123,124,125', 'expected_release_sha256': 'b' * 64,
            'oidc': 'NEVER_ECHO_TOKEN', 'archive_sha256': 'c' * 64,
            'archive_bytes': 1024, 'run_id': '456', 'run_attempt': '1'}


def claims(now=NOW):
    return {'iss': 'https://token.actions.githubusercontent.com',
            'aud': 'https://obr.dnd.center/dot-deploy',
            'repository': 'FullPeople/DND-card-web', 'repository_id': '1378484252',
            'repository_owner_id': '166210040', 'ref': 'refs/heads/main', 'ref_type': 'branch',
            'sub': 'repo:FullPeople@166210040/DND-card-web@1378484252:environment:production-card',
            'environment': 'production-card', 'event_name': 'workflow_dispatch',
            'runner_environment': 'github-hosted',
            'workflow_ref': 'FullPeople/DND-card-web/.github/workflows/dot-deploy-production.yml@refs/heads/main',
            'sha': 'a' * 40, 'workflow_sha': 'a' * 40, 'run_id': '456', 'run_attempt': '1',
            'iat': now - 30, 'nbf': now - 30, 'exp': now + 300}


def source_zip(sha='a' * 40, content=b'license'):
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.comment = sha.encode()
        archive.writestr('LICENSE', content)
    return output.getvalue()


def archive_data(path, extra=None, symlink=False, duplicate=False, omitted=None):
    release = json.dumps({'version': 'standalone-1.0.257', 'sourceCommit': 'a' * 40}).encode()
    files = {'card/index.html': b'new card', 'library/index.html': b'new library',
             'card/release.json': release, 'library/release.json': release,
             'card/sw.js': b'new worker', 'card/source.zip': source_zip(), 'library/source.zip': source_zip(),
             'card/standalone-audit.json': b'{"singlePlayer":true,"multiplayerModules":[]}',
             'card/assets/new-123.js': b'new hashed asset'}
    if extra:
        files.update(extra)
    if omitted:
        del files[omitted]
    metadata = {'format': 1, 'targets': ['card', 'library'], 'sourceCommit': 'a' * 40,
                'sourceRepository': 'FullPeople/DND-card-web', 'version': 'standalone-1.0.257',
                'backendVersion': '1.0.253', 'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
                'publisherHashes': {name: c.sha_file(Path(__file__).parents[2] / 'deploy/cloud' / name)
                                    for name in ('frontend.py', 'publish.py')}}
    with tarfile.open(path, 'w:gz') as archive:
        for name, data in {'artifact.json': json.dumps(metadata).encode(), **files}.items():
            member = tarfile.TarInfo(name); member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
        if duplicate:
            member = tarfile.TarInfo('card/index.html'); member.size = 4
            archive.addfile(member, io.BytesIO(b'evil'))
        if symlink:
            member = tarfile.TarInfo('card/link'); member.type = tarfile.SYMTYPE; member.linkname = '/etc/shadow'
            archive.addfile(member)
    return metadata


class IdentityTests(unittest.TestCase):
    def test_exact_identity_and_preflight_operation(self):
        self.assertEqual(c.authorize(request(), claims(), NOW)['branch'], 'main')
        data = request(); data['operation'] = 'preflight'
        c.authorize(data, claims(), NOW)

    def test_wrong_identity_workflow_commit_and_approval_environment(self):
        for key, value in [('repository', 'FullPeople/obr-suite'), ('repository_id', '1'),
                           ('repository_owner_id', '1'), ('ref', 'refs/heads/dev'), ('ref_type', 'tag'),
                           ('sub', 'repo:FullPeople/DND-card-web:environment:production-card'),
                           ('environment', 'unprotected'), ('runner_environment', 'self-hosted'),
                           ('event_name', 'push'), ('workflow_sha', 'b' * 40), ('sha', 'b' * 40),
                           ('workflow_ref', 'FullPeople/DND-card-web/.github/workflows/dot-deploy-preflight.yml@refs/heads/main'),
                           ('run_id', '999'), ('run_attempt', '2')]:
            with self.subTest(key=key):
                changed = claims(); changed[key] = value
                with self.assertRaises(c.Denied): c.authorize(request(), changed, NOW)

    def test_expired_or_missing_claims(self):
        for key, value in [('exp', NOW), ('iat', NOW - 601), ('nbf', NOW + 100), ('iat', True)]:
            changed = claims(); changed[key] = value
            with self.subTest(key=key), self.assertRaises(c.Denied): c.authorize(request(), changed, NOW)
        changed = claims(); del changed['environment']
        with self.assertRaises(c.Denied): c.authorize(request(), changed, NOW)

    def test_commands_paths_extra_fields_duplicate_ci_and_oversize_denied(self):
        for key, value in [('operation', 'shell'), ('operation', 'rollback'), ('target', 'card'),
                           ('target', '/var/www/dnd-center'), ('command', 'id'), ('archive_bytes', True),
                           ('archive_bytes', c.MAX_ARCHIVE + 1), ('ci_run_ids', '123,123,125'),
                           ('ci_run_ids', '123'), ('sha', 'main'), ('run_id', '../../root')]:
            changed = request(); changed[key] = value
            with self.subTest(key=key), self.assertRaises(c.Denied): c.check_request(changed)

    def test_all_three_exact_ci_workflows_required_and_skipped_jobs_rejected(self):
        responses = [{'object': {'sha': 'a' * 40}}]
        for path in c.POLICY['ci_paths']:
            responses += [{'repository': {'full_name': c.REPOSITORY}, 'head_sha': 'a' * 40,
                           'head_branch': 'main', 'path': path, 'status': 'completed',
                           'conclusion': 'success', 'event': 'workflow_dispatch'},
                          {'jobs': [{'status': 'completed', 'conclusion': 'success'}], 'total_count': 1}]
        responses += [{'object': {'sha': 'a' * 40}}]
        with patch.object(c.legacy, 'get_json', side_effect=responses):
            self.assertEqual(len(c.verify_ci(request())['runs']), 3)
        for mutation in ('wrong-sha', 'skipped', 'missing-cloud'):
            changed = copy.deepcopy(responses)
            if mutation == 'wrong-sha': changed[1]['head_sha'] = 'b' * 40
            if mutation == 'skipped': changed[2]['jobs'][0]['conclusion'] = 'skipped'
            if mutation == 'missing-cloud': changed[3]['path'] = c.POLICY['ci_paths'][0]
            with self.subTest(mutation=mutation), patch.object(c.legacy, 'get_json', side_effect=changed), self.assertRaises(c.legacy.Denied):
                c.verify_ci(request())


class ArtifactTests(unittest.TestCase):
    def test_hashes_and_extraction_ignore_incoming_permission_bits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); archive = root / 'artifact.tgz'; expected = archive_data(archive)
            metadata, size = c.inspect_archive(archive, c.sha_file(archive))
            self.assertEqual(metadata, expected); self.assertGreater(size, 0)
            c.extract_frontends(archive, root / 'candidate')
            self.assertEqual((root / 'candidate/card/index.html').read_bytes(), b'new card')
            self.assertEqual((root / 'candidate/card/index.html').stat().st_mode & 0o777, 0o644)

    def test_paths_links_duplicates_and_missing_second_target_denied(self):
        for options in ({'extra': {'index.html': b'home'}}, {'extra': {'card/../../etc/shadow': b'evil'}},
                        {'extra': {'card/assets/../index.html': b'evil'}}, {'symlink': True}, {'duplicate': True},
                        {'omitted': 'library/index.html'}, {'extra': {'card/assets': b'collision'}}):
            with self.subTest(options=options), tempfile.TemporaryDirectory() as directory:
                archive = Path(directory) / 'artifact.tgz'; archive_data(archive, **options)
                with self.assertRaises(c.Denied): c.inspect_archive(archive)

    def test_expansion_limit_and_wrong_archive_hash_denied(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'artifact.tgz'; archive_data(archive)
            with self.assertRaises(c.Denied): c.inspect_archive(archive, 'f' * 64)
            with patch.object(c, 'MAX_EXPANDED', 20), self.assertRaises(c.Denied): c.inspect_archive(archive)

    def test_stream_truncation_trailing_bytes_and_hash_mismatch_denied(self):
        for stream, size, digest in [(b'a', 2, hashlib.sha256(b'a').hexdigest()),
                                     (b'ab', 1, hashlib.sha256(b'a').hexdigest()), (b'ab', 2, 'f' * 64)]:
            with self.subTest(stream=stream), tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(server.c.Denied):
                    server.receive(io.BytesIO(stream), Path(directory) / 'upload', size, digest)

    def test_full_source_contents_not_just_the_zip_comment(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'source.zip'; path.write_bytes(source_zip())
            commit = {'sha': 'a' * 40, 'tree': {'sha': 'b' * 40}}
            tree = {'sha': 'b' * 40, 'truncated': False, 'tree': [{'path': 'LICENSE', 'type': 'blob',
                    'sha': hashlib.sha1(b'blob 7\0license').hexdigest()}]}
            with patch.object(server.c.legacy, 'get_json', side_effect=[commit, tree]):
                server.check_source_archive(path, 'a' * 40)
            path.write_bytes(source_zip(content=b'changed'))
            with patch.object(server.c.legacy, 'get_json', side_effect=[commit, tree]), self.assertRaises(server.c.Denied):
                server.check_source_archive(path, 'a' * 40)


class PublicationTests(unittest.TestCase):
    def fixture(self, root):
        front = root / 'site'; front.mkdir()
        for name in c.TARGETS:
            (front / name).mkdir(); (front / name / 'index.html').write_text('old ' + name)
            (front / name / 'release.json').write_text(json.dumps({'version': 'standalone-1.0.256', 'sourceCommit': 'b' * 40}))
        (front / 'card/assets').mkdir(); (front / 'card/assets/old-abc.js').write_text('old hashed asset')
        (front / 'index.html').write_text('homepage'); (front / '3-dragon').mkdir()
        (front / '3-dragon/index.html').write_text('independent dragon')
        packages = root / 'packages'; packages.mkdir(); lock = root / 'lock'; lock.touch()
        db = root / 'cards.sqlite'
        import sqlite3
        with sqlite3.connect(db) as connection:
            connection.executescript('CREATE TABLE accounts(id); CREATE TABLE cards(id); CREATE TABLE temporary_cards(id); INSERT INTO temporary_cards VALUES("original");')
        publisher = c.load('fixture_frontend', Path(__file__).parents[2] / 'deploy/cloud/frontend.py')
        stack = ExitStack(); self.addCleanup(stack.close)
        for module, key, value in [(server, 'ROOT', front), (server, 'PACKAGES', packages), (server, 'LOCK', lock),
                                   (server, 'PUBLISHER_DIR', Path(__file__).parents[2] / 'deploy/cloud'),
                                   (publisher, 'ROOT', front), (publisher, 'DB', db), (publisher, 'RECEIPTS', root / 'receipts')]:
            stack.enter_context(patch.object(module, key, value))
        stack.enter_context(patch.object(publisher, 'protected', return_value={'cloud-backend': 'preserved'}))
        stack.enter_context(patch.object(publisher.m, 'command', return_value='active'))
        stack.enter_context(patch.object(publisher.m, 'wait_http', return_value=b'old card'))
        self.verify = stack.enter_context(patch.object(publisher, 'verify'))
        stack.enter_context(patch.object(server.c, 'load', return_value=publisher))
        stack.enter_context(patch.object(server.c, 'verify_ci', return_value={'exactSha': 'a' * 40, 'runs': []}))
        archive = root / 'incoming.tgz'; archive_data(archive)
        data = request(); data.update(archive_bytes=archive.stat().st_size, archive_sha256=c.sha_file(archive),
                                      expected_release_sha256=c.sha_file(front / 'card/release.json'))
        commit = {'sha': 'a' * 40, 'tree': {'sha': 'b' * 40}}
        tree = {'sha': 'b' * 40, 'truncated': False, 'tree': [{'path': 'LICENSE', 'type': 'blob', 'sha': hashlib.sha1(b'blob 7\0license').hexdigest()}]}
        stack.enter_context(patch.object(server.c.legacy, 'get_json', side_effect=[commit, tree]))
        return publisher, data, archive

    def test_authenticated_upload_calls_fixed_publisher_and_preserves_other_sites_assets_and_database(self):
        with tempfile.TemporaryDirectory() as directory:
            publisher, data, archive = self.fixture(Path(directory)); inode = publisher.ROOT.stat().st_ino
            before_db = publisher.DB.read_bytes(); outside = publisher.outside(publisher.tree(publisher.ROOT))
            result = server.publish(data, claims(int(time.time())), io.BytesIO(archive.read_bytes()))
            self.assertEqual(result['status'], 'published'); self.assertTrue(result['onlineVersionWrites'])
            self.assertEqual((publisher.ROOT / 'card/index.html').read_text(), 'new card')
            self.assertEqual((publisher.ROOT / 'card/assets/old-abc.js').read_text(), 'old hashed asset')
            self.assertEqual(outside, publisher.outside(publisher.tree(publisher.ROOT)))
            self.assertEqual(inode, publisher.ROOT.stat().st_ino); self.assertEqual(before_db, publisher.DB.read_bytes())
            package = Path(result['package']); self.assertTrue((package / 'backup/frontend/library').is_dir())
            self.assertFalse((package / 'incoming.tar.gz').exists())
            self.assertEqual(publisher.rollback(package, result['manifestSha256'])['status'], 'rolled-back')

    def test_artifact_preflight_never_switches_online_files(self):
        with tempfile.TemporaryDirectory() as directory:
            publisher, data, archive = self.fixture(Path(directory)); before = publisher.tree(publisher.ROOT)
            data['operation'] = 'preflight'
            result = server.publish(data, claims(int(time.time())), io.BytesIO(archive.read_bytes()))
            self.assertEqual(result['status'], 'artifact-preflight-passed')
            self.assertFalse(result['onlineVersionWrites']); self.assertEqual(before, publisher.tree(publisher.ROOT))
            self.assertFalse((Path(result['package']) / 'backup').exists())

    def test_failure_after_switch_restores_both_targets_and_keeps_home_and_database(self):
        with tempfile.TemporaryDirectory() as directory:
            publisher, data, archive = self.fixture(Path(directory)); before = publisher.tree(publisher.ROOT)
            self.verify.side_effect = RuntimeError('not ready')
            with self.assertRaisesRegex(RuntimeError, 'not ready'):
                server.publish(data, claims(int(time.time())), io.BytesIO(archive.read_bytes()))
            self.assertEqual(before, publisher.tree(publisher.ROOT)); self.assertEqual(publisher.database_check()['temporary_cards'], 1)
            record = json.loads(next(publisher.RECEIPTS.glob('*.json')).read_text())
            self.assertEqual(record['status'], 'failed-restored')

    def test_baseline_drift_and_replayed_attempt_cannot_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            publisher, data, archive = self.fixture(Path(directory)); data['expected_release_sha256'] = 'f' * 64
            with self.assertRaisesRegex(server.c.Denied, 'online-baseline-changed'):
                server.publish(data, claims(int(time.time())), io.BytesIO(archive.read_bytes()))
            self.assertEqual((publisher.ROOT / 'card/index.html').read_text(), 'old card')
            with self.assertRaisesRegex(server.c.Denied, 'deployment-attempt-already-received'):
                server.publish(data, claims(int(time.time())), io.BytesIO(archive.read_bytes()))


class RunnerAndInstallerTests(unittest.TestCase):
    def test_existing_identity_is_reused_and_unrestricted_or_multiple_keys_rejected(self):
        old = 'restrict,command="' + admin.OLD_COMMAND + '" ssh-ed25519 AAAA existing\n'
        changed = admin.upgraded_key(old)
        self.assertEqual(changed, old.replace(admin.OLD_COMMAND, admin.NEW_COMMAND))
        for raw in ('ssh-ed25519 AAAA\n', old + old, old.replace('restrict,', '')):
            with self.assertRaises(RuntimeError): admin.upgraded_key(raw)

    def test_transport_streams_framed_artifact_and_never_includes_token_in_report(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'artifact'; archive.write_bytes(b'binary\0artifact')
            # A real local subprocess substitutes only for the SSH transport.
            code = 'import sys,json; h=json.loads(sys.stdin.buffer.readline()); b=sys.stdin.buffer.read(); print(json.dumps({"ok":True,"bytes":len(b)}))'
            result = runner.transfer([sys.executable, '-c', code], {'oidc': 'NEVER_ECHO_TOKEN'}, archive)
            self.assertEqual(result['bytes'], len(archive.read_bytes())); self.assertNotIn('NEVER_ECHO_TOKEN', json.dumps(result))

    def test_legacy_dispatch_is_compatible_and_invalid_requests_do_not_echo_secrets(self):
        legacy = c.legacy
        data = {'operation': 'preflight', 'target': 'card', 'oidc': 'NEVER_ECHO_TOKEN'}
        fake = type('Input', (), {'buffer': io.BytesIO(json.dumps(data).encode())})()
        output = io.StringIO()
        with patch.object(entry, 'load', return_value=legacy), patch.object(legacy, 'verify_token', return_value={}), \
             patch.object(legacy, 'authorize', return_value={}), patch.object(legacy, 'verify_ci', return_value={}), \
             patch.object(legacy, 'inventory', return_value={'onlineVersionWrites': False}), \
             patch.object(entry.sys, 'stdin', fake), patch.object(entry.sys, 'argv', ['server_entry.py']), patch('sys.stdout', output):
            self.assertEqual(entry.main(), 0)
        self.assertFalse(json.loads(output.getvalue())['result']['onlineVersionWrites'])
        output = io.StringIO(); fake.buffer = io.BytesIO(b'{"oidc":"NEVER_ECHO_TOKEN","operation":"shell"}')
        with patch.object(entry.sys, 'stdin', fake), patch.object(entry.sys, 'argv', ['server_entry.py']), patch('sys.stdout', output):
            self.assertEqual(entry.main(), 1)
        self.assertNotIn('NEVER_ECHO_TOKEN', output.getvalue())

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
            result = build.package(root, root / 'out', sha, 'standalone-1.0.257', '1.0.253')
            metadata, _ = build.c.inspect_archive(root / 'out/deployment.tar.gz', result['sha256'])
            self.assertNotIn('index.html', metadata['files'])
            destination = root / 'extracted'; build.c.extract_frontends(root / 'out/deployment.tar.gz', destination)
            with zipfile.ZipFile(destination / 'card/source.zip') as archive:
                self.assertEqual(archive.comment.decode(), sha); self.assertEqual(archive.namelist(), ['LICENSE'])


class InstallationTransitionTests(unittest.TestCase):
    def fixture(self, root):
        lib = root / 'lib'; lib.mkdir(); (lib / 'server_preflight.py').write_text('legacy identity policy')
        keys, ssh, sudo = (root / name for name in ('authorized_keys', 'ssh.conf', 'sudoers'))
        keys.write_text('existing restricted public key'); ssh.write_text('old SSH policy'); sudo.write_text('old sudo policy')
        source = root / 'source.py'; source.write_text('fixed helper fixture')
        source_files = {str(lib / name): source for name in ('server_entry.py', 'server_production.py', 'production_common.py')}
        source_files.update({str(lib / 'production' / name): source for name in ('frontend.py', 'publish.py')})
        policies = {keys: (b'same identity with new forced command', 0o644),
                    ssh: (b'new isolated SSH policy', 0o644), sudo: (b'new fixed sudo policy', 0o440)}
        lock = root / 'lock'; lock.touch()
        stack = ExitStack(); self.addCleanup(stack.close)
        stack.enter_context(patch.object(admin, 'LIB', lib))
        stack.enter_context(patch.object(admin, 'BACKUPS', root / 'backups'))
        stack.enter_context(patch.object(admin, 'prepare', return_value=(root, source_files, policies)))
        original_open = Path.open
        def opening(path, *args, **kwargs):
            if str(path) == '/run/lock/obr-static-release.lock': path = lock
            return original_open(path, *args, **kwargs)
        stack.enter_context(patch.object(Path, 'open', opening))
        stack.enter_context(patch.object(admin.os, 'chown'))
        stack.enter_context(patch.object(admin, 'command', return_value=''))
        stack.enter_context(patch.object(admin, 'effective', return_value='unchanged unrelated users'))
        stack.enter_context(patch.object(admin.subprocess, 'run', return_value=SimpleNamespace(stdout='active\n')))
        publisher = SimpleNamespace(snapshot=lambda: {'frontend': {'index.html': 'home'}, 'release': {'version': 'old'}, 'protected': {'backend': 'same'}},
                                    m=SimpleNamespace(digest=lambda value: 'fixture-digest'))
        stack.enter_context(patch.object(admin, 'load_publisher', return_value=publisher))
        self.isolation = stack.enter_context(patch.object(admin, 'isolation'))
        return lib, policies

    def test_install_preserves_legacy_helper_and_records_checked_revision(self):
        with tempfile.TemporaryDirectory() as directory:
            lib, policies = self.fixture(Path(directory))
            result = admin.install('a' * 40, True)
            self.assertEqual(result['status'], 'installed'); self.assertFalse(result['onlineVersionWrites'])
            self.assertEqual((lib / 'server_preflight.py').read_text(), 'legacy identity policy')
            self.assertEqual((lib / 'production/frontend.py').stat().st_mode & 0o777, 0o644)
            for path, (content, _) in policies.items(): self.assertEqual(path.read_bytes(), content)
            self.assertTrue((Path(result['backup']) / 'installation.json').is_file())

    def test_failed_isolation_restores_existing_key_ssh_and_sudo_and_removes_new_grant(self):
        with tempfile.TemporaryDirectory() as directory:
            lib, policies = self.fixture(Path(directory)); before = {path: path.read_bytes() for path in policies}
            self.isolation.side_effect = RuntimeError('effective policy differs')
            with self.assertRaisesRegex(RuntimeError, 'effective policy differs'): admin.install('a' * 40, True)
            for path, content in before.items(): self.assertEqual(path.read_bytes(), content)
            self.assertFalse((lib / 'server_entry.py').exists()); self.assertFalse((lib / 'production').exists())
            self.assertEqual((lib / 'server_preflight.py').read_text(), 'legacy identity policy')


if __name__ == '__main__':
    unittest.main(verbosity=2)
