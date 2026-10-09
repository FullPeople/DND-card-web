"""Public deployment contract shared by the runner and the fixed server helper."""
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import tarfile
import urllib.request


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


legacy = load('fixed_preflight', Path(__file__).with_name('server_preflight.py'))
require, Denied, json_unique = legacy.require, legacy.Denied, legacy.json_unique
REPOSITORY = 'FullPeople/DND-card-web'
WORKFLOW = '.github/workflows/dot-deploy-production.yml'
TARGETS = ('card', 'library')
POLICY = {**legacy.POLICIES['card'], 'ci_paths': (
    '.github/workflows/web.yml',
    '.github/workflows/cloud-migration.yml',
    '.github/workflows/dot-deploy-contract.yml',
)}
MAX_ARCHIVE = 128 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
MAX_FILES = 10000
HASH = re.compile(r'[a-f0-9]{64}')
SHA = re.compile(r'[a-f0-9]{40}')
NUMBER = re.compile(r'[1-9][0-9]{0,19}')
VERSION = re.compile(r'standalone-1\.0\.[1-9][0-9]{0,7}')


def sha_file(path):
    return legacy.sha_file(Path(path))


def check_request(request):
    fields = {'operation', 'target', 'sha', 'ci_run_ids', 'expected_release_sha256',
              'oidc', 'archive_sha256', 'archive_bytes', 'run_id', 'run_attempt'}
    reference = {'prepared_run_id', 'prepared_run_attempt', 'prepared_manifest_sha256'}
    lookup = {'lookup_run_id', 'lookup_run_attempt'}
    require(isinstance(request, dict) and set(request) in (fields, fields | reference, fields | reference | lookup), 'invalid-request-fields')
    if reference <= set(request):
        for key, pattern in [('prepared_run_id', NUMBER), ('prepared_run_attempt', NUMBER), ('prepared_manifest_sha256', HASH)]:
            require(isinstance(request[key], str) and (request[key] == '' or pattern.fullmatch(request[key])), 'invalid-prepared-reference')
        require(all(request[key] == '' for key in reference) or all(request[key] for key in reference), 'incomplete-prepared-reference')
    if lookup <= set(request):
        require(all(isinstance(request[key], str) and (request[key] == '' or NUMBER.fullmatch(request[key])) for key in lookup), 'invalid-lookup-reference')
        require(bool(request['lookup_run_id']) == bool(request['lookup_run_attempt']), 'incomplete-lookup-reference')
        require(not request['lookup_run_id'] or request['operation'] in ('status', 'recover'), 'lookup-operation-denied')
    require(not request.get('prepared_run_id') or request['operation'] in ('publish', 'status', 'recover'), 'prepared-operation-denied')
    require(request['operation'] in ('preflight', 'publish', 'status', 'recover', 'inventory'), 'operation-not-allowed')
    require(request['target'] == 'dnd-center', 'target-not-allowed')
    for key, pattern in [('sha', SHA), ('expected_release_sha256', HASH),
                         ('archive_sha256', HASH), ('run_id', NUMBER), ('run_attempt', NUMBER)]:
        require(isinstance(request[key], str) and pattern.fullmatch(request[key]), 'invalid-' + key.replace('_', '-'))
    ci = request['ci_run_ids']
    require(isinstance(ci, str) and re.fullmatch(r'[1-9][0-9]{0,19}(,[1-9][0-9]{0,19}){2}', ci), 'invalid-ci-runs')
    require(len(set(ci.split(','))) == 3, 'duplicate-ci-runs')
    require(type(request['archive_bytes']) is int and (0 < request['archive_bytes'] <= MAX_ARCHIVE or request['operation'] == 'inventory' and request['archive_bytes'] == 0), 'invalid-archive-size')


def authorize(request, claims, now=None):
    import time
    check_request(request)
    expected = {
        'iss': legacy.ISSUER, 'aud': legacy.AUDIENCE,
        'repository': REPOSITORY, 'repository_id': '1378484252',
        'repository_owner_id': '166210040', 'ref': 'refs/heads/main', 'ref_type': 'branch',
        'sub': 'repo:FullPeople@166210040/DND-card-web@1378484252:environment:production-card',
        'environment': 'production-card', 'event_name': 'workflow_dispatch',
        'runner_environment': 'github-hosted',
        'workflow_ref': REPOSITORY + '/' + WORKFLOW + '@refs/heads/main',
        'sha': request['sha'], 'workflow_sha': request['sha'],
        'run_id': request['run_id'], 'run_attempt': request['run_attempt'],
    }
    require(all(claims.get(key) == value for key, value in expected.items()), 'oidc-scope-denied')
    now = int(time.time()) if now is None else now
    for field in ('iat', 'nbf', 'exp'):
        require(type(claims.get(field)) is int, 'invalid-token-time')
    require(claims['nbf'] <= now + 30 and claims['iat'] <= now + 30 and claims['exp'] > now
            and now - claims['iat'] <= 600 and 0 < claims['exp'] - claims['iat'] <= 900,
            'token-expired-or-future')
    return POLICY


def verify_ci(request, token=None):
    def get(url):
        if token is None:
            return legacy.get_json(url)
        require(url.startswith('https://api.github.com/repos/' + REPOSITORY + '/'), 'ci-api-origin-denied')
        query = urllib.request.Request(url, headers={
            'Accept': 'application/vnd.github+json', 'User-Agent': 'dnd-fixed-deployment/1',
            'Authorization': 'Bearer ' + token})
        with urllib.request.urlopen(query, timeout=15) as response:
            require(response.geturl() == url, 'unexpected-redirect')
            raw = response.read(4 * 1024 * 1024 + 1)
        require(len(raw) <= 4 * 1024 * 1024, 'response-too-large')
        return json_unique(raw)

    api = 'https://api.github.com/repos/' + REPOSITORY
    require(get(api + '/git/ref/heads/main')['object']['sha'] == request['sha'], 'branch-head-changed')
    checked, paths = [], set()
    for run_id in request['ci_run_ids'].split(','):
        run = get(api + '/actions/runs/' + run_id)
        path = run.get('path')
        require(path in POLICY['ci_paths'] and path not in paths
                and run.get('repository', {}).get('full_name') == REPOSITORY
                and run.get('head_sha') == request['sha'] and run.get('head_branch') == 'main'
                and run.get('status') == 'completed' and run.get('conclusion') == 'success'
                and run.get('event') in ('push', 'workflow_dispatch'), 'full-ci-not-successful-for-exact-sha')
        jobs, page = [], 1
        while True:
            data = get(api + '/actions/runs/' + run_id + '/jobs?filter=latest&per_page=100&page=' + str(page))
            jobs.extend(data['jobs'])
            if len(jobs) >= data['total_count']:
                break
            require(page < 10 and data['jobs'], 'incomplete-ci-jobs')
            page += 1
        require(jobs and len(jobs) == data['total_count']
                and all(job.get('status') == 'completed' and job.get('conclusion') == 'success' for job in jobs),
                'ci-job-failed-skipped-or-incomplete')
        checked.append({'runId': run_id, 'jobs': len(jobs), 'workflow': path})
        paths.add(path)
    require(paths == set(POLICY['ci_paths']), 'required-ci-workflow-missing')
    require(get(api + '/git/ref/heads/main')['object']['sha'] == request['sha'], 'branch-head-changed')
    return {'runs': checked, 'exactSha': request['sha']}


def safe_path(name):
    path = PurePosixPath(name)
    require(isinstance(name, str) and name == path.as_posix() and not path.is_absolute()
            and len(name) <= 240 and len(path.parts) >= 2 and path.parts[0] in TARGETS
            and all(re.fullmatch(r'[\w.-]+', part) and part not in ('.', '..')
                    and len(part.encode('utf-8')) <= 255 for part in path.parts),
            'artifact-path-denied')
    return path


def qq_policy(metadata):
    # Historical format-1 artifacts had only the pending policy. Never infer
    # readiness from a missing field when replaying or recovering an old attempt.
    value = metadata.get('qqLogin', 'pending')
    require(isinstance(value, str) and value in ('pending', 'ready'), 'invalid-qq-login-policy')
    return value


def inspect_archive(archive, expected_sha=None):
    """Validate every regular member before creating files; never use extractall."""
    if expected_sha is not None:
        require(sha_file(archive) == expected_sha, 'archive-hash-mismatch')
    sizes, hashes, metadata, total = {}, {}, None, 0
    with tarfile.open(archive, 'r:gz') as packed:
        for member in packed:
            require(len(sizes) < MAX_FILES and member.isfile() and member.name not in sizes,
                    'artifact-member-denied')
            require(0 <= member.size <= MAX_EXPANDED, 'artifact-size-denied')
            total += member.size
            require(total <= MAX_EXPANDED, 'artifact-expanded-size-denied')
            sizes[member.name] = member.size
            if member.name != 'artifact.json':
                safe_path(member.name)
            else:
                require(member.size <= 4 * 1024 * 1024, 'artifact-metadata-too-large')
            stream = packed.extractfile(member)
            digest = hashlib.sha256()
            content = bytearray() if member.name == 'artifact.json' else None
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                if content is not None:
                    content.extend(chunk)
            if content is not None:
                metadata = json_unique(bytes(content))
            else:
                hashes[member.name] = digest.hexdigest()
    fields = {
        'format', 'targets', 'sourceCommit', 'sourceRepository', 'version',
        'backendVersion', 'files', 'publisherHashes'}
    require(isinstance(metadata, dict) and type(metadata.get('format')) is int
            and ((metadata['format'] == 1 and set(metadata) == fields)
                 or (metadata['format'] == 2 and set(metadata) == fields | {'qqLogin'})), 'invalid-artifact-metadata')
    qq_policy(metadata)
    require(metadata['targets'] == list(TARGETS)
            and metadata['sourceRepository'] == REPOSITORY, 'artifact-scope-denied')
    require(isinstance(metadata['sourceCommit'], str) and SHA.fullmatch(metadata['sourceCommit']), 'invalid-artifact-sha')
    require(isinstance(metadata['version'], str) and VERSION.fullmatch(metadata['version']), 'invalid-artifact-version')
    require(isinstance(metadata['backendVersion'], str)
            and re.fullmatch(r'1\.0\.[0-9]{1,8}', metadata['backendVersion']), 'invalid-backend-version')
    require(metadata['files'] == hashes, 'artifact-file-hashes-mismatch')
    require(set(metadata['publisherHashes']) == {'frontend.py', 'publish.py'}
            and all(isinstance(value, str) and HASH.fullmatch(value) for value in metadata['publisherHashes'].values()),
            'invalid-publisher-hashes')
    for target in TARGETS:
        require(all(target + '/' + name in hashes for name in ('index.html', 'release.json', 'source.zip')),
                'incomplete-artifact')
    require('card/sw.js' in hashes and 'card/standalone-audit.json' in hashes, 'incomplete-standalone-artifact')
    # File/directory collisions would make creation order significant.
    for name in hashes:
        require(all(parent.as_posix() not in hashes for parent in PurePosixPath(name).parents), 'artifact-path-collision')
    return metadata, total


def extract_frontends(archive, destination):
    require(not destination.exists(), 'artifact-destination-exists')
    destination.mkdir(mode=0o700)
    with tarfile.open(archive, 'r:gz') as packed:
        for member in packed:
            if member.name == 'artifact.json':
                continue
            path = safe_path(member.name)
            target = destination.joinpath(*path.parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as output, packed.extractfile(member) as stream:
                while chunk := stream.read(1024 * 1024):
                    output.write(chunk)
            # Incoming tar ownership, permission bits and executable flags are ignored.
            target.chmod(0o644)
