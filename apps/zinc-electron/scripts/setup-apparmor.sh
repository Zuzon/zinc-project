#!/bin/sh
# One-time dev setup for Ubuntu 23.10+, which blocks unprivileged user
# namespaces. Chromium's sandbox needs them; without them Electron falls back
# to the setuid chrome-sandbox helper and aborts, because npm installs it
# without root ownership. This grants them to this checkout's Electron binary,
# the same way Ubuntu's own profiles do for chrome and code.
set -eu

electron="$(cd "$(dirname "$0")/../../.." && pwd)/node_modules/electron/dist/electron"
profile=/etc/apparmor.d/zinc-electron-dev

if [ ! -x "$electron" ]; then
  echo "Electron not found at $electron; run npm install first." >&2
  exit 1
fi

sudo tee "$profile" >/dev/null <<EOF
# Lets the zinc-project dev Electron use user namespaces for its sandbox.
abi <abi/4.0>,
include <tunables/global>

profile zinc-electron-dev "$electron" flags=(unconfined) {
  userns,

  include if exists <local/zinc-electron-dev>
}
EOF
sudo apparmor_parser -r "$profile"
echo "Installed $profile for $electron"
