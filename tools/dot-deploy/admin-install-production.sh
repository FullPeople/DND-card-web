#!/bin/sh
# Run only from an administrator's checkout of the reviewed full commit SHA.
# Default: installation checks. --apply: install the fixed persistent publication grant.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /usr/bin/python3 -I -B "$script_dir/admin_install_production.py" "$@"
