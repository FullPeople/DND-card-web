"""Fixed dnd.center front-end publisher. No uploaded code is ever executed."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import tarfile
import zipfile

import importlib.util
spec = importlib.util.spec_from_file_location('production_common', Path(__file__).with_name('production_common.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
require = c.require
PUBLISHER_DIR = Path(__file__).parent / 'production'
PACKAGES = Path('/root/codex-release-packages')
LOCK = Path('/run/lock/obr-static-release.lock')
ROOT = Path('/var/www/dnd-center')


def receive(stream, destination, size, digest):
    h = hashlib.sha256()
    remaining = size
    with destination.open('xb') as output:
        while remaining:
            chunk = stream.read(min(1024 * 1024, remaining))
            require(chunk, 'truncated-artifact-upload')
            output.write(chunk)
            h.update(chunk)
            remaining -= len(chunk)
        output.flush(); os.fsync(output.fileno())
    require(not stream.read(1), 'trailing-artifact-bytes')
    require(h.hexdigest() == digest, 'archive-hash-mismatch')


def check_application(frontends, metadata):
    for name in c.TARGETS:
        release = c.json_unique((frontends / name / 'release.json').read_bytes())
        require(release.get('sourceCommit') == metadata['sourceCommit']
                and release.get('version') == metadata['version'], 'application-binding-mismatch')
        if metadata['format'] >= 2:
            require(release.get('backendVersion') == metadata['backendVersion']
                    and release.get('qqLogin') == c.qq_policy(metadata), 'application-policy-binding-mismatch')
        if metadata['format']==3:
            require(release.get('cloudMode')==c.cloud_policy(metadata),'application-cloud-binding-mismatch')
    audit = c.json_unique((frontends / 'card/standalone-audit.json').read_bytes())
    require(audit.get('singlePlayer') is True and audit.get('multiplayerModules') == [], 'standalone-audit-failed')
    require(c.sha_file(frontends / 'card/source.zip') == c.sha_file(frontends / 'library/source.zip'), 'source-archives-differ')


def check_source_archive(path, sha):
    # Check the complete git-archive against the public immutable Git tree. Merely
    # putting a commit string into release.json or a ZIP comment is insufficient.
    api = 'https://api.github.com/repos/' + c.REPOSITORY
    commit = c.legacy.get_json(api + '/git/commits/' + sha)
    require(commit.get('sha') == sha, 'source-commit-unavailable')
    tree_sha = commit['tree']['sha']
    require(isinstance(tree_sha, str) and c.SHA.fullmatch(tree_sha), 'source-tree-unavailable')
    tree = c.legacy.get_json(api + '/git/trees/' + tree_sha + '?recursive=1')
    require(tree.get('truncated') is False and tree.get('sha') == tree_sha, 'source-tree-unavailable')
    expected = {entry['path']: entry['sha'] for entry in tree['tree'] if entry['type'] == 'blob'}
    require(expected and not any(entry['type'] == 'commit' for entry in tree['tree']), 'source-submodules-unsupported')
    actual, total = {}, 0
    with zipfile.ZipFile(path) as archive:
        require(archive.comment == sha.encode(), 'source-archive-commit-differs')
        for entry in archive.infolist():
            if entry.is_dir():
                continue
            require(entry.filename in expected and entry.filename not in actual and not entry.flag_bits & 1,
                    'source-archive-file-denied')
            total += entry.file_size
            require(total <= c.MAX_EXPANDED, 'source-archive-expanded-size-denied')
            digest = hashlib.sha1(('blob ' + str(entry.file_size) + '\0').encode())
            with archive.open(entry) as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
            actual[entry.filename] = digest.hexdigest()
    require(actual == expected, 'source-archive-content-differs')


def preserve_assets(frontends):
    # Keep older hashed chunks and downloads needed by already-open browser tabs.
    for name in c.TARGETS:
        for directory in ('assets', 'downloads'):
            source = ROOT / name / directory
            if not source.exists():
                continue
            require(source.is_dir() and not source.is_symlink(), 'unsafe-historical-assets')
            for old in sorted(source.rglob('*')):
                require(not old.is_symlink() and (old.is_dir() or old.is_file()), 'unsafe-historical-assets')
                if old.is_file():
                    target = frontends / name / directory / old.relative_to(source)
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(old, target)
                        target.chmod(0o644)


def make_package(package, frontends, metadata, baseline, publisher, request):
    for name in ('frontend.py', 'publish.py'):
        shutil.copyfile(PUBLISHER_DIR / name, package / name)
    (package / 'baseline.json').write_text(json.dumps(baseline, sort_keys=True) + '\n')
    with tarfile.open(package / 'frontend.tar.gz', 'w:gz') as archive:
        for file in sorted(frontends.rglob('*')):
            if file.is_file():
                archive.add(file, arcname=file.relative_to(frontends).as_posix(), recursive=False)
    manifest = {
        'release': package.name, 'targets': list(c.TARGETS), 'version': metadata['version'],
        'previousVersion': baseline['release']['version'], 'previousSourceCommit': baseline['release']['sourceCommit'],
        'sourceCommit': request['sha'], 'backendVersion': metadata['backendVersion'],
        'qqLogin': c.qq_policy(metadata),
        **({'cloudMode':c.cloud_policy(metadata)} if metadata['format']==3 else {}),
        'backendChanged': False, 'playerDataChanged': False,
        'publisherSha256': c.sha_file(PUBLISHER_DIR / 'frontend.py'),
        'baselineSha256': c.sha_file(package / 'baseline.json'),
        'packageFiles': {name: c.sha_file(package / name) for name in ('frontend.tar.gz', 'publish.py')},
        'frontendFiles': publisher.tree(frontends),
    }
    (package / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True) + '\n')
    return c.sha_file(package / 'manifest.json')


def durable_json(path, record):
    import tempfile
    descriptor, name = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as output:
            json.dump(record, output, sort_keys=True)
            output.write('\n'); output.flush(); os.fsync(output.fileno())
        os.replace(name, path)
        sync_directory(path.parent)
    finally:
        if os.path.exists(name): os.unlink(name)


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(descriptor)
    finally: os.close(descriptor)


def request_binding(request):
    # Never persist the OIDC token. Status/recovery change only the operation;
    # all immutable attempt, source, baseline and artifact fields must match.
    return {key: value for key, value in request.items() if key not in ('oidc', 'operation', 'run_id', 'run_attempt', 'lookup_run_id', 'lookup_run_attempt')}


def package_for(run_id, attempt):
    require(c.NUMBER.fullmatch(run_id) and c.NUMBER.fullmatch(attempt), 'invalid-attempt-reference')
    path = PACKAGES / ('dnd-center-actions-' + run_id + '-' + attempt)
    require(not path.is_symlink() and path.resolve() == path, 'unsafe-attempt-path')
    return path


def replay_status(package, request, publisher):
    require((package / 'request.json').is_file(), 'attempt-binding-unavailable')
    record = c.json_unique((package / 'request.json').read_bytes())
    expected = request_binding(request)
    actual = record['binding']
    if request.get('lookup_run_id'):
        expected = {key: value for key, value in expected.items() if key not in ('sha', 'ci_run_ids')}
        actual = {key: value for key, value in actual.items() if key not in ('sha', 'ci_run_ids')}
    require(actual == expected, 'deployment-attempt-binding-differs')
    pointer = package / 'transaction.json'
    if not pointer.exists() or record['operation'] == 'preflight' and not (package / 'result.json').is_file():
        return {'status': 'attempt-incomplete', 'onlineVersionWrites': False,
                'sourceCommit': record['binding']['sha'], 'archiveSha256': request['archive_sha256'],
                'recoveryNeeded': False, 'package': str(package)}
    transaction = c.json_unique(pointer.read_bytes())
    prepared = package_for(transaction['runId'], transaction['attempt'])
    result = publisher.status(prepared, transaction['manifestSha256'])
    return {**result, 'onlineVersionWrites': result['recordedStatus'] == 'published',
            'archiveSha256': request['archive_sha256'], 'package': str(prepared)}


def inventory():
    files = {str(PUBLISHER_DIR.parent / name): c.sha_file(PUBLISHER_DIR.parent / name)
             for name in ('server_entry.py', 'server_production.py', 'production_common.py', 'server_preflight.py')}
    files.update({str(PUBLISHER_DIR / name): c.sha_file(PUBLISHER_DIR / name) for name in ('frontend.py', 'publish.py')})
    marker = PUBLISHER_DIR.parent / 'installation.json'
    revision = c.json_unique(marker.read_bytes()).get('reviewedRevision') if marker.is_file() else None
    return {'status': 'installation-inventory', 'reviewedRevision': revision, 'installedFileHashes': files,
            'releaseHashes': {name: c.sha_file(ROOT / name / 'release.json') for name in c.TARGETS},
            'onlineVersionWrites': False, 'persistentServerWrites': False}


def publish(request, claims, stream):
    c.authorize(request, claims)
    require(ROOT.is_dir() and ROOT.resolve() == ROOT, 'static-root-denied')
    require(LOCK.is_file() and not LOCK.is_symlink(), 'existing-lock-required')
    require(PACKAGES.is_dir() and PACKAGES.resolve() == PACKAGES, 'package-root-denied')
    publisher = c.load('installed_frontend', PUBLISHER_DIR / 'frontend.py')
    require(publisher.ROOT == ROOT and publisher.TARGETS == c.TARGETS, 'installed-publisher-scope-differs')
    with LOCK.open('rb') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise c.Denied('publisher-lock-busy')
        base = {'target': 'dnd-center', 'targets': list(c.TARGETS), 'sourceCommit': request['sha']}
        if request['operation'] == 'inventory':
            require(not stream.read(1), 'trailing-request-bytes')
            return {**base, **inventory()}
        package = package_for(request.get('lookup_run_id') or request['run_id'], request.get('lookup_run_attempt') or request['run_attempt'])
        if request['operation'] in ('status', 'recover'):
            require(not stream.read(1), 'trailing-request-bytes')
            result = replay_status(package, request, publisher)
            if request['operation'] == 'recover':
                c.verify_ci(request); c.authorize(request, claims)
                require((package / 'transaction.json').exists(), 'unsealed-attempt-cannot-recover')
                require(result.get('recordedStatus') in ('preparing', 'prepared', 'recovering', 'recovery-required', 'failed-restored'), 'completed-release-recovery-denied')
                transaction = c.json_unique((package / 'transaction.json').read_bytes())
                prepared = package_for(transaction['runId'], transaction['attempt'])
                if result['recordedStatus'] != 'failed-restored': publisher.recover(prepared, transaction['manifestSha256'])
                result = replay_status(package, request, publisher)
            return {**base, **result, 'publicationRecorded': result['onlineVersionWrites'],
                    'onlineVersionWrites': request['operation'] == 'recover',
                    'persistentServerWrites': request['operation'] == 'recover'}
        if package.exists():
            # Consume and hash a duplicate stream without replacing any files.
            digest = hashlib.sha256(); remaining = request['archive_bytes']
            while remaining:
                chunk = stream.read(min(remaining, 1024 * 1024)); require(chunk, 'truncated-artifact-upload')
                digest.update(chunk); remaining -= len(chunk)
            require(not stream.read(1) and digest.hexdigest() == request['archive_sha256'], 'archive-hash-mismatch')
            result = replay_status(package, request, publisher)
            original = c.json_unique((package / 'request.json').read_bytes())
            require(original['operation'] == request['operation'], 'deployment-attempt-operation-differs')
            return {**base, **result, 'publicationRecorded': result['onlineVersionWrites'],
                    'onlineVersionWrites': False, 'persistentServerWrites': False}
        ci = c.verify_ci(request)
        require(shutil.disk_usage(PACKAGES).free > request['archive_bytes'] + 300 * 1024 * 1024, 'insufficient-upload-space')
        package.mkdir(mode=0o700); sync_directory(PACKAGES)
        durable_json(package / 'request.json', {'binding': request_binding(request), 'operation': request['operation']})
        upload = package / 'incoming.tar.gz'
        receive(stream, upload, request['archive_bytes'], request['archive_sha256'])
        metadata, expanded = c.inspect_archive(upload, request['archive_sha256'])
        require(metadata['sourceCommit'] == request['sha'], 'artifact-source-mismatch')
        for name, digest in metadata['publisherHashes'].items():
            require(c.sha_file(PUBLISHER_DIR / name) == digest, 'installed-publisher-differs')
        require(c.sha_file(ROOT / 'card/release.json') == request['expected_release_sha256'], 'online-baseline-changed')
        if request['operation'] == 'publish':
            require(request.get('prepared_run_id') and request.get('prepared_manifest_sha256'), 'approved-preflight-required')
            prepared = package_for(request['prepared_run_id'], request['prepared_run_attempt'])
            require(prepared != package, 'self-preflight-reference-denied')
            prior = c.json_unique((prepared / 'request.json').read_bytes())
            binding = request_binding(request)
            common = ('sha', 'ci_run_ids', 'expected_release_sha256', 'archive_sha256', 'archive_bytes', 'target')
            require(prior['operation'] == 'preflight' and all(prior['binding'][key] == binding[key] for key in common), 'approved-artifact-binding-differs')
            approved_result = c.json_unique((prepared / 'result.json').read_bytes())
            require(approved_result.get('status') == 'artifact-preflight-passed' and approved_result.get('archiveSha256') == request['archive_sha256'], 'completed-preflight-required')
            sealed = c.json_unique((prepared / 'transaction.json').read_bytes())
            manifest_hash = request['prepared_manifest_sha256']
            require(sealed == {'runId': request['prepared_run_id'], 'attempt': request['prepared_run_attempt'], 'manifestSha256': manifest_hash}, 'approved-manifest-differs')
            approved, baseline = publisher.binding(prepared, manifest_hash)
            live_bytes = sum(p.stat().st_size for name in c.TARGETS for p in (ROOT / name).rglob('*') if p.is_file())
            needed = 3 * expanded + 4 * live_bytes + 300 * 1024 * 1024
            require(shutil.disk_usage(ROOT).free > needed and shutil.disk_usage(PACKAGES).free > needed, 'insufficient-backup-stage-space')
            publisher.preflight(prepared, manifest_hash)
        else:
            baseline = publisher.snapshot()
            live_bytes = sum(p.stat().st_size for name in c.TARGETS for p in (ROOT / name).rglob('*') if p.is_file())
            needed = 3 * expanded + 4 * live_bytes + 300 * 1024 * 1024
            require(shutil.disk_usage(ROOT).free > needed and shutil.disk_usage(PACKAGES).free > needed, 'insufficient-backup-stage-space')
            candidate = package / 'candidate'
            c.extract_frontends(upload, candidate)
            check_application(candidate, metadata)
            check_source_archive(candidate / 'card/source.zip', request['sha'])
            require(publisher.tree(candidate) == metadata['files'], 'extracted-artifact-differs')
            preserve_assets(candidate)
            manifest_hash = make_package(package, candidate, metadata, baseline, publisher, request)
            publisher.sync_tree(package)
            publisher.preflight(package, manifest_hash)
            prepared = package
        transaction = {'runId': request.get('prepared_run_id') or request['run_id'],
                       'attempt': request.get('prepared_run_attempt') or request['run_attempt'], 'manifestSha256': manifest_hash}
        durable_json(package / 'transaction.json', transaction)
        c.authorize(request, claims); c.verify_ci(request)
        if request['operation'] == 'publish': result = publisher.apply(prepared, manifest_hash)
        else: result = {'status': 'artifact-preflight-passed', 'version': metadata['version']}
        result = {**base, **result, 'ci': ci, 'archiveSha256': request['archive_sha256'], 'manifestSha256': manifest_hash,
                  'package': str(prepared), 'onlineVersionWrites': request['operation'] == 'publish', 'persistentServerWrites': True}
        # Publication success is durable before optional cleanup. A lost response
        # or cleanup failure is resolved by read-only status, never a second swap.
        durable_json(package / 'result.json', result)
        try:
            if (package / 'candidate').exists(): shutil.rmtree(package / 'candidate')
            upload.unlink()
        except OSError: result['cleanupPending'] = True
        return result
