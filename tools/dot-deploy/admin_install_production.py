"""Administrator-only upgrade of the existing identity to one fixed dispatcher."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
LIB = Path('/usr/local/libexec/obr-deploy')
KEYS = Path('/var/lib/obr-deploy/.ssh/authorized_keys')
SSH_CONFIG = Path('/etc/ssh/obr-deploy-preflight.conf')
SUDOERS = Path('/etc/sudoers.d/obr-deploy-preflight')
BACKUPS = Path('/root/codex-backups')
OLD_COMMAND = '/usr/bin/sudo -n /usr/bin/python3 -I -B ' + str(LIB / 'server_preflight.py')
NEW_COMMAND = '/usr/bin/sudo -n /usr/bin/python3 -I -B ' + str(LIB / 'server_entry.py')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def command(*args, cwd=None):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=30)
    require(result.returncode == 0, 'Command failed: ' + args[0])
    return result.stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def secure(path, directory=False):
    require(path.exists() and not path.is_symlink(), 'Missing or linked administrator-managed path: ' + str(path))
    s = path.stat()
    require(s.st_uid == 0 and not s.st_mode & 0o022
            and (stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode)),
            'Administrator ownership/permissions required: ' + str(path))


def upgraded_key(raw):
    # Preserve the existing public key and comment byte-for-byte, changing only
    # its fixed command. No second identity or unrestricted alternate key.
    pattern = r'restrict,command="' + re.escape(OLD_COMMAND) + r'" ssh-ed25519 [A-Za-z0-9+/=]+(?: [^\r\n]+)?\n?'
    require(re.fullmatch(pattern, raw) is not None, 'Expected exactly one existing restricted ed25519 key')
    return raw.replace(OLD_COMMAND, NEW_COMMAND)


def effective(user):
    return command('/usr/sbin/sshd', '-T', '-C', 'user=' + user + ',host=obr.dnd.center,addr=127.0.0.1')


def isolation(expected):
    data = dict(line.split(' ', 1) for line in effective('obr-deploy').splitlines())
    required = {'authenticationmethods': 'publickey', 'passwordauthentication': 'no',
                'kbdinteractiveauthentication': 'no', 'authorizedkeyscommand': 'none',
                'authorizedkeysfile': str(KEYS), 'forcecommand': expected, 'disableforwarding': 'yes',
                'permittty': 'no', 'permittunnel': 'no', 'permituserrc': 'no', 'permituserenvironment': 'no'}
    require(all(data.get(key) == value for key, value in required.items()), 'Effective obr-deploy isolation differs')


def replace(path, content, mode):
    descriptor, name = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.chmod(mode)
        os.chown(temporary, 0, 0)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def prepare(revision):
    require(os.geteuid() == 0, 'Run this installer as the server administrator')
    require(re.fullmatch(r'[a-f0-9]{40}', revision), 'Full reviewed installation commit SHA required')
    root = HERE.parent.parent
    require(command('git', 'rev-parse', 'HEAD', cwd=root).strip() == revision, 'Checkout does not match reviewed revision')
    source_files = {str(LIB / name): HERE / name for name in
                    ('server_entry.py', 'server_production.py', 'production_common.py')}
    source_files.update({str(LIB / 'production' / name): root / 'deploy/cloud' / name
                         for name in ('frontend.py', 'publish.py')})
    for source in [*source_files.values(), HERE / 'server_preflight.py', Path(__file__)]:
        require(source.is_file() and not source.is_symlink(), 'Installation source missing or linked')
        committed = subprocess.run(['git', 'show', revision + ':' + source.relative_to(root).as_posix()],
                                   cwd=root, capture_output=True, timeout=30)
        require(committed.returncode == 0 and committed.stdout == source.read_bytes(), 'Installation source differs from reviewed commit')
    for directory in (LIB, KEYS.parent, KEYS.parent.parent, Path('/var/www/dnd-center')):
        secure(directory, directory=True)
    for path in (KEYS, SSH_CONFIG, SUDOERS, LIB / 'server_preflight.py', Path('/run/lock/obr-static-release.lock')):
        secure(path)
    require(sha(LIB / 'server_preflight.py') == sha(HERE / 'server_preflight.py'), 'Installed legacy identity policy differs; reconcile it before upgrading')
    for destination in source_files:
        require(not Path(destination).exists(), 'Production entry already installed; review instead of overwriting it')
    require(not (LIB / 'production').exists(), 'Production publisher directory already exists')
    account = command('getent', 'passwd', 'obr-deploy').strip().split(':')
    require(len(account) == 7 and account[2] != '0' and account[5] == '/var/lib/obr-deploy', 'Unexpected deployment account')
    require(command('passwd', '-S', 'obr-deploy').split()[1] == 'L', 'Deployment account password must remain locked')
    key = upgraded_key(KEYS.read_text())
    ssh = SSH_CONFIG.read_text()
    require(ssh.count(OLD_COMMAND) == 1 and NEW_COMMAND not in ssh, 'Unexpected SSH include; manual reconciliation required')
    old_rule = 'obr-deploy ALL=(root) NOPASSWD: /usr/bin/python3 -I -B ' + str(LIB / 'server_preflight.py')
    rules = [line.strip() for line in SUDOERS.read_text().splitlines() if line.strip() and not line.lstrip().startswith('#')]
    require(rules == [old_rule], 'Existing sudo grant differs from the single fixed command')
    isolation(OLD_COMMAND)
    command('/usr/sbin/sshd', '-t')
    command('visudo', '-cf', str(SUDOERS))
    sudo = '# Root-owned fixed dispatcher; no arguments, shell or SETENV.\n' + old_rule.replace('server_preflight.py', 'server_entry.py') + '\n'
    policy_files = {KEYS: (key.encode(), 0o644), SSH_CONFIG: (ssh.replace(OLD_COMMAND, NEW_COMMAND).encode(), 0o644),
                    SUDOERS: (sudo.encode(), 0o440)}
    return root, source_files, policy_files


def load_publisher(root):
    spec = importlib.util.spec_from_file_location('installation_frontend', root / 'deploy/cloud/frontend.py')
    publisher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(publisher)
    return publisher


def install(revision, apply):
    root, source_files, policy_files = prepare(revision)
    result = {'reviewedRevision': revision, 'targets': ['/var/www/dnd-center/card', '/var/www/dnd-center/library'],
              'newSecretNames': [], 'identityReused': True, 'productionEntry': str(LIB / 'server_entry.py'),
              'installedFileHashes': {path: sha(source) for path, source in source_files.items()},
              'onlineVersionWrites': False}
    if not apply:
        return {**result, 'status': 'installation-preflight-passed'}
    import fcntl
    lock_path = Path('/run/lock/obr-static-release.lock')
    with lock_path.open('rb') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Recheck mutable policy and key state under the same lock used by publishers.
        _, source_files, policy_files = prepare(revision)
        publisher = load_publisher(root)
        before = publisher.snapshot()
        other_users = {user: effective(user) for user in ('root', 'sync')}
        backup = BACKUPS / ('dnd-production-entry-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        backup.mkdir(mode=0o700, parents=True, exist_ok=False)
        for path in policy_files:
            shutil.copyfile(path, backup / path.name)
            (backup / path.name).chmod(0o600)
        original_modes = {path: stat.S_IMODE(path.stat().st_mode) for path in policy_files}
        service = next((name for name in ('ssh', 'sshd') if subprocess.run(
            ['systemctl', 'is-active', name], capture_output=True, text=True).stdout.strip() == 'active'), None)
        require(service is not None, 'Active SSH service not found')
        installed = []
        try:
            (LIB / 'production').mkdir(mode=0o755)
            for destination, source in source_files.items():
                path = Path(destination)
                replace(path, source.read_bytes(), 0o644)
                installed.append(path)
            for path, (content, mode) in policy_files.items():
                replace(path, content, mode)
            command('visudo', '-cf', str(SUDOERS))
            command('/usr/sbin/sshd', '-t')
            isolation(NEW_COMMAND)
            require(all(effective(user) == value for user, value in other_users.items()), 'Root/sync SSH policy changed')
            after = publisher.snapshot()
            excluded = {str(SUDOERS)}
            require(before['frontend'] == after['frontend'] and before['release'] == after['release']
                    and {key: value for key, value in before['protected'].items() if key not in excluded}
                    == {key: value for key, value in after['protected'].items() if key not in excluded}, 'Production state changed during installation')
            command('systemctl', 'reload', service)
            isolation(NEW_COMMAND)
            result.update(status='installed', backup=str(backup), sshService=service,
                          frontendSha256=publisher.m.digest(after['frontend']))
            (backup / 'installation.json').write_text(json.dumps(result, indent=2) + '\n')
            return result
        except Exception:
            for path in policy_files:
                replace(path, (backup / path.name).read_bytes(), original_modes[path])
            command('visudo', '-cf', str(SUDOERS))
            command('/usr/sbin/sshd', '-t')
            command('systemctl', 'reload', service)
            for path in installed:
                path.unlink()
            if (LIB / 'production').exists():
                (LIB / 'production').rmdir()
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-revision', required=True)
    parser.add_argument('--apply', action='store_true', help='Install the reviewed persistent publication grant; default checks only')
    args = parser.parse_args()
    try:
        print(json.dumps(install(args.expected_revision, args.apply), indent=2))
        return 0
    except Exception as error:
        # This program reads only administrator policy/public-key data, no private keys.
        print(json.dumps({'ok': False, 'error': str(error)}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
