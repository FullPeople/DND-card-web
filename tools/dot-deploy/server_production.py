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
    require(not stream.read(1), 'trailing-artifact-bytes')
    require(h.hexdigest() == digest, 'archive-hash-mismatch')


def check_application(frontends, metadata):
    for name in c.TARGETS:
        release = c.json_unique((frontends / name / 'release.json').read_bytes())
        require(release.get('sourceCommit') == metadata['sourceCommit']
                and release.get('version') == metadata['version'], 'application-binding-mismatch')
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
        'backendChanged': False, 'playerDataChanged': False,
        'publisherSha256': c.sha_file(PUBLISHER_DIR / 'frontend.py'),
        'baselineSha256': c.sha_file(package / 'baseline.json'),
        'packageFiles': {name: c.sha_file(package / name) for name in ('frontend.tar.gz', 'publish.py')},
        'frontendFiles': publisher.tree(frontends),
    }
    (package / 'manifest.json').write_text(json.dumps(manifest, sort_keys=True) + '\n')
    return c.sha_file(package / 'manifest.json')


def publish(request, claims, stream):
    c.authorize(request, claims)
    ci = c.verify_ci(request)
    require(ROOT.is_dir() and ROOT.resolve() == ROOT, 'static-root-denied')
    require(LOCK.is_file() and not LOCK.is_symlink(), 'existing-lock-required')
    require(PACKAGES.is_dir() and PACKAGES.resolve() == PACKAGES, 'package-root-denied')
    require(shutil.disk_usage(PACKAGES).free > request['archive_bytes'] + 300 * 1024 * 1024, 'insufficient-upload-space')
    key = 'dnd-center-actions-' + request['run_id'] + '-' + request['run_attempt']
    package = PACKAGES / key
    require(not package.exists(), 'deployment-attempt-already-received')
    # Both the incoming data and the eventual frozen rollback package are root-only.
    package.mkdir(mode=0o700)
    upload = package / 'incoming.tar.gz'
    receive(stream, upload, request['archive_bytes'], request['archive_sha256'])
    metadata, expanded = c.inspect_archive(upload, request['archive_sha256'])
    require(metadata['sourceCommit'] == request['sha'], 'artifact-source-mismatch')
    for name, digest in metadata['publisherHashes'].items():
        require(c.sha_file(PUBLISHER_DIR / name) == digest, 'installed-publisher-differs')
    publisher = c.load('installed_frontend', PUBLISHER_DIR / 'frontend.py')
    require(publisher.ROOT == ROOT and publisher.TARGETS == c.TARGETS, 'installed-publisher-scope-differs')
    with LOCK.open('rb') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise c.Denied('publisher-lock-busy')
        require(c.sha_file(ROOT / 'card/release.json') == request['expected_release_sha256'], 'online-baseline-changed')
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
        # Revalidate the short-lived identity and exact CI immediately before any switch.
        c.authorize(request, claims)
        c.verify_ci(request)
        require(c.sha_file(ROOT / 'card/release.json') == request['expected_release_sha256'], 'online-baseline-changed')
        publisher.preflight(package, manifest_hash)
        if request['operation'] == 'publish':
            result = publisher.apply(package, manifest_hash)
        else:
            result = {'status': 'artifact-preflight-passed', 'version': metadata['version']}
        # The frozen package retains only what the installed publisher needs for recovery.
        shutil.rmtree(candidate)
        upload.unlink()
    return {**result, 'target': 'dnd-center', 'targets': list(c.TARGETS), 'sourceCommit': request['sha'],
            'ci': ci, 'archiveSha256': request['archive_sha256'], 'manifestSha256': manifest_hash,
            'package': str(package), 'onlineVersionWrites': request['operation'] == 'publish',
            'persistentServerWrites': True}
