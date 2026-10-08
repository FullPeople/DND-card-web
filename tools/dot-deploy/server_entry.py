"""Single forced SSH command; legacy checks and fixed dnd.center publication only."""
import importlib.util
import json
from pathlib import Path
import sys


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    legacy = load('server_preflight')
    try:
        legacy.require(len(sys.argv) == 1, 'arguments-denied')
        # The production protocol is a bounded JSON line followed by binary bytes.
        # Legacy clients send only JSON and EOF; their exact protocol still works.
        raw = sys.stdin.buffer.readline(32769)
        legacy.require(len(raw) <= 32768, 'request-too-large')
        request = legacy.json_unique(raw)
        legacy.require(isinstance(request, dict), 'invalid-request')
        if request.get('target') in legacy.POLICIES:
            legacy.require(request.get('operation') == 'preflight', 'operation-not-allowed')
            legacy.require(not sys.stdin.buffer.read(1), 'trailing-request-bytes')
            claims = legacy.verify_token(request.get('oidc'))
            policy = legacy.authorize(request, claims)
            ci = legacy.verify_ci(request, policy)
            result = {**legacy.inventory(request), 'ci': ci}
        else:
            production = load('server_production')
            production.c.check_request(request)
            claims = legacy.verify_token(request.get('oidc'))
            result = production.publish(request, claims, sys.stdin.buffer)
        print(json.dumps({'ok': True, 'result': result}, sort_keys=True))
        return 0
    except Exception as error:
        # Duplicate module loads have distinct Denied classes; allow only typed,
        # bounded, machine error codes, never raw exception/HTTP/secret contents.
        code = str(error) if type(error).__name__ == 'Denied' else 'deployment-unavailable'
        import re
        if not re.fullmatch(r'[a-z-]{1,90}', code):
            code = 'deployment-unavailable'
        print(json.dumps({'ok': False, 'error': code}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
