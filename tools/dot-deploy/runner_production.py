"""Authenticated binary upload to the one fixed forced command; never logs secrets."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import urllib.request

spec = importlib.util.spec_from_file_location('production_common', Path(__file__).with_name('production_common.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
HOST = 'obr.dnd.center'
USER = 'obr-deploy'
FINGERPRINT = 'SHA256:bS1JRj3+1zJntm+ZOKtjlRhK7MjAAOEdKOdnKq+2yco'


def transfer(command, envelope, archive):
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    sink = process.stdin
    process.stdin = None  # communicate drains stdout while the writer streams stdin.
    failures = []

    def write():
        try:
            with sink:
                sink.write(json.dumps(envelope, separators=(',', ':')).encode() + b'\n')
                with archive.open('rb') as source:
                    while chunk := source.read(1024 * 1024):
                        sink.write(chunk)
        except (BrokenPipeError, OSError):
            failures.append(True)

    writer = threading.Thread(target=write, daemon=True)
    writer.start()
    try:
        stdout, _ = process.communicate(timeout=600)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        raise c.Denied('ssh-transfer-timeout')
    finally:
        writer.join(timeout=5)
    c.require(len(stdout) <= 16384 and not writer.is_alive(), 'invalid-server-response')
    report = c.json_unique(stdout)
    if process.returncode != 0 or report.get('ok') is not True or failures:
        error = report.get('error', 'ssh-transfer-failed')
        if not isinstance(error, str) or not re.fullmatch(r'[a-z-]{1,90}', error):
            error = 'ssh-transfer-failed'
        raise c.Denied(error)
    return report


def run():
    c.require(os.environ.get('GITHUB_REPOSITORY') == c.REPOSITORY
              and os.environ.get('GITHUB_REF') == 'refs/heads/main'
              and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch', 'workflow-context-denied')
    archive = Path('.deployment/deployment.tar.gz')
    sha, size = os.environ.get('ARCHIVE_SHA256', ''), os.environ.get('ARCHIVE_BYTES', '')
    c.require(c.HASH.fullmatch(sha) and size.isdigit() and c.sha_file(archive) == sha
              and archive.stat().st_size == int(size), 'downloaded-artifact-differs')
    key, known = os.environ.get('DEPLOY_SSH_KEY', ''), os.environ.get('DEPLOY_KNOWN_HOSTS', '').strip()
    c.require(key and re.fullmatch(r'obr\.dnd\.center ssh-ed25519 [A-Za-z0-9+/=]+', known), 'deployment-identity-missing')
    source = os.environ.get('SOURCE_SHA', '')
    c.require(source == os.environ.get('GITHUB_SHA'), 'workflow-source-mismatch')
    envelope = {'operation': os.environ.get('DEPLOY_OPERATION', ''), 'target': 'dnd-center', 'sha': source,
                'ci_run_ids': os.environ.get('CI_RUN_IDS', ''),
                'expected_release_sha256': os.environ.get('EXPECTED_RELEASE_SHA256', ''),
                'oidc': '', 'archive_sha256': sha, 'archive_bytes': int(size),
                'run_id': os.environ.get('GITHUB_RUN_ID', ''), 'run_attempt': os.environ.get('GITHUB_RUN_ATTEMPT', '')}
    c.check_request(envelope)
    c.verify_ci(envelope, os.environ.get('GITHUB_TOKEN'))
    url = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL', '')
    parsed = urllib.parse.urlparse(url)
    c.require(parsed.scheme == 'https' and parsed.hostname
              and parsed.hostname.endswith('.actions.githubusercontent.com'), 'invalid-oidc-endpoint')
    url += ('&' if '?' in url else '?') + 'audience=' + urllib.parse.quote(c.legacy.AUDIENCE, safe='')
    request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request, timeout=20) as response:
        envelope['oidc'] = json.load(response)['value']
    with tempfile.TemporaryDirectory(prefix='dnd-publish-', dir=os.environ['RUNNER_TEMP']) as directory:
        private, hosts = Path(directory) / 'identity', Path(directory) / 'known_hosts'
        private.write_text(key.rstrip() + '\n'); private.chmod(0o600)
        hosts.write_text(known + '\n'); hosts.chmod(0o600)
        fingerprint = subprocess.run(['ssh-keygen', '-lf', str(hosts), '-E', 'sha256'], capture_output=True, text=True, timeout=10)
        c.require(fingerprint.returncode == 0 and len(fingerprint.stdout.splitlines()) == 1
                  and fingerprint.stdout.split()[1] == FINGERPRINT, 'ssh-host-key-differs')
        command = ['ssh', '-F', '/dev/null', '-T', '-p', '22', '-i', str(private),
                   '-o', 'IdentitiesOnly=yes', '-o', 'IdentityAgent=none', '-o', 'BatchMode=yes',
                   '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no',
                   '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + str(hosts),
                   '-o', 'GlobalKnownHostsFile=/dev/null', '-o', 'ClearAllForwardings=yes',
                   '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2',
                   USER + '@' + HOST, 'dnd-center-frontends-v1']
        report = transfer(command, envelope, archive)
    result = report.get('result', {})
    c.require(result.get('target') == 'dnd-center' and result.get('targets') == list(c.TARGETS)
              and result.get('sourceCommit') == source and result.get('archiveSha256') == sha
              and result.get('onlineVersionWrites') == (envelope['operation'] == 'publish'), 'server-receipt-differs')
    output = Path('.deployment/receipt.json')
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
        summary.write('dnd.center `' + result['status'] + '` for `' + source + '`. Targets: `card/`, `library/`.\n')
    return 0


def main():
    try:
        return run()
    except Exception as error:
        code = str(error) if type(error).__name__ == 'Denied' else 'runner-deployment-unavailable'
        if not re.fullmatch(r'[a-z-]{1,90}', code):
            code = 'runner-deployment-unavailable'
        print(json.dumps({'ok': False, 'error': code}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
