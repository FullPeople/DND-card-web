"""Build a commit-bound static data archive, excluding the site home and backend."""
import argparse
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

spec = importlib.util.spec_from_file_location('production_common', Path(__file__).with_name('production_common.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def public_json(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        c.require(response.geturl() == url, 'unexpected-redirect')
        data = response.read(65537)
    c.require(len(data) <= 65536, 'public-response-too-large')
    return c.json_unique(data), data


def validate_context(source, ci, baseline, version):
    c.require(os.environ.get('GITHUB_REPOSITORY') == c.REPOSITORY
              and os.environ.get('GITHUB_REF') == 'refs/heads/main'
              and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'workflow-context-denied')
    c.require(c.SHA.fullmatch(source) and source == os.environ.get('GITHUB_SHA'), 'workflow-source-mismatch')
    c.require(c.HASH.fullmatch(baseline) and c.VERSION.fullmatch(version), 'invalid-release-input')
    # The same public gate is used on both sides of the SSH connection.
    request = {'sha': source, 'ci_run_ids': ci}
    c.require(len(ci.split(',')) == 3 and len(set(ci.split(','))) == 3
              and all(c.NUMBER.fullmatch(value) for value in ci.split(',')), 'invalid-ci-runs')
    return c.verify_ci(request, os.environ.get('GITHUB_TOKEN'))


def package(root, output, source, version, backend_version, qq_login='pending', cloud_mode='temporary-ip'):
    c.require(c.SHA.fullmatch(source) and c.VERSION.fullmatch(version), 'invalid-release-input')
    c.require(qq_login in ('pending', 'ready'), 'invalid-qq-login-policy')
    c.require(cloud_mode in ('temporary-ip','account-private') and (cloud_mode!='account-private' or qq_login=='ready'),'invalid-cloud-mode')
    c.require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip() == source,
              'checkout-source-mismatch')
    c.require(not subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], cwd=root, text=True).strip(),
              'tracked-source-dirty')
    c.require(not output.exists(), 'artifact-output-exists')
    output.mkdir(parents=True)
    candidate = output / 'frontends'
    candidate.mkdir()
    for name in c.TARGETS:
        built = root / 'dist-cloud' / name
        c.require(built.is_dir() and not built.is_symlink(), 'build-output-missing')
        for file in built.rglob('*'):
            c.require(not file.is_symlink() and (file.is_dir() or file.is_file()), 'build-symlink-denied')
        shutil.copytree(built, candidate / name)
        (candidate / name / 'release.json').write_text(json.dumps({
            'version': version, 'sourceCommit': source, 'sourceRepository': c.REPOSITORY,
            'targets': list(c.TARGETS), 'backendVersion': backend_version, 'qqLogin': qq_login,
            **({'cloudMode':cloud_mode} if cloud_mode=='account-private' else {}),
        }, sort_keys=True) + '\n')
    source_zip = candidate / 'card/source.zip'
    subprocess.run(['git', 'archive', '--format=zip', '--output=' + str(source_zip), source], cwd=root, check=True)
    shutil.copyfile(source_zip, candidate / 'library/source.zip')
    files = {}
    for file in sorted(candidate.rglob('*')):
        if file.is_file():
            name = file.relative_to(candidate).as_posix()
            c.safe_path(name)
            files[name] = c.sha_file(file)
    metadata = {'format': 2, 'targets': list(c.TARGETS), 'sourceCommit': source,
                'sourceRepository': c.REPOSITORY, 'version': version, 'backendVersion': backend_version,
                'qqLogin': qq_login, 'files': files, 'publisherHashes': {
                    name: c.sha_file(root / 'deploy/cloud' / name) for name in ('frontend.py', 'publish.py')}}
    if cloud_mode=='account-private':metadata.update(format=3,cloudMode=cloud_mode)
    (candidate / 'artifact.json').write_text(json.dumps(metadata, sort_keys=True) + '\n')
    archive = output / 'deployment.tar.gz'
    with archive.open('xb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as packed:
            for file in sorted(candidate.rglob('*')):
                if file.is_file():
                    info = packed.gettarinfo(str(file), arcname=file.relative_to(candidate).as_posix())
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ''
                    info.mode = 0o644
                    with file.open('rb') as stream:
                        packed.addfile(info, stream)
    c.require(archive.stat().st_size <= c.MAX_ARCHIVE, 'archive-too-large')
    c.inspect_archive(archive)
    result = {'sha256': c.sha_file(archive), 'bytes': archive.stat().st_size, 'sourceCommit': source,
              'version': version, 'targets': list(c.TARGETS)}
    (output / 'build-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    shutil.rmtree(candidate)
    return result


def use_prepared(root, output, source, version, historical=False):
    receipt = c.json_unique((output / 'build-receipt.json').read_bytes())
    c.require(historical or receipt['sourceCommit'] == source, 'approved-source-differs')
    c.require(receipt['version'] == version and receipt['targets'] == list(c.TARGETS), 'approved-version-differs')
    archive = output / 'deployment.tar.gz'
    c.require(archive.stat().st_size == receipt['bytes'], 'approved-archive-size-differs')
    metadata, _ = c.inspect_archive(archive, receipt['sha256'])
    c.require(metadata['sourceCommit'] == receipt['sourceCommit'] and metadata['version'] == version, 'approved-metadata-differs')
    if not historical:
        c.require(metadata['publisherHashes'] == {name: c.sha_file(root / 'deploy/cloud' / name)
                  for name in ('frontend.py', 'publish.py')}, 'approved-publisher-differs')
    return receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--use-prepared', action='store_true')
    args = parser.parse_args()
    source, ci, baseline, version = (os.environ.get(key, '') for key in (
        'SOURCE_SHA', 'CI_RUN_IDS', 'EXPECTED_RELEASE_SHA256', 'RELEASE_VERSION'))
    operation = os.environ.get('DEPLOY_OPERATION', 'preflight')
    if operation in ('status', 'inventory'):
        c.require(os.environ.get('GITHUB_REPOSITORY') == c.REPOSITORY and os.environ.get('GITHUB_REF') == 'refs/heads/main'
                  and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' and source == os.environ.get('GITHUB_SHA'), 'workflow-context-denied')
    else: validate_context(source, ci, baseline, version)
    if args.validate_only:
        print(json.dumps({'ok': True, 'sourceCommit': source, 'requiredCI': list(c.POLICY['ci_paths'])}))
        return
    if args.use_prepared:
        result = use_prepared(Path.cwd(), Path.cwd() / '.deployment', source, version, historical=operation in ('status', 'recover'))
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('archive_sha256=' + result['sha256'] + '\narchive_bytes=' + str(result['bytes']) + '\n')
        print(json.dumps(result)); return
    _, raw = public_json('https://dnd.center/card/release.json')
    c.require(hashlib.sha256(raw).hexdigest() == baseline, 'online-baseline-changed')
    health, _ = public_json('https://dnd.center/api/health')
    mode='account-private' if health.get('accountPrivate') is True else 'temporary-ip'
    private=(health.get('permissionsVersion')==1 and health.get('accountLibrariesPrivate') is True
             and health.get('temporaryUpload') is False and health.get('publicDirectory') is False
             and health.get('quotaScope')=='account' and health.get('qqLogin')=='ready')
    c.require(health.get('qqLogin') in ('pending','ready') and
              (private if mode=='account-private' else health.get('temporaryUpload') is True and health.get('quotaScope')=='ip'), 'backend-policy-changed')
    args=(Path.cwd(),Path.cwd()/'.deployment',source,version,health['version'],health['qqLogin'])
    result=package(*args,cloud_mode=mode) if mode=='account-private' else package(*args)
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('archive_sha256=' + result['sha256'] + '\narchive_bytes=' + str(result['bytes']) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
