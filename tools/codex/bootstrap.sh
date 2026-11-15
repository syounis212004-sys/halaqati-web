#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$repo_root"
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if(major < 22 || (major === 22 && minor < 12)) throw Error("Node >=22.12 required; use Node 24 LTS")'
npm ci --prefix tools/codex --no-fund
python3 tools/codex/install-skills.py
python3 -m venv "${HALAQATI_TOOLS:-$HOME/.local/share/halaqati}/sql-venv"
"${HALAQATI_TOOLS:-$HOME/.local/share/halaqati}/sql-venv/bin/pip" install -r tools/codex/requirements-sql.txt
if [[ -d web-src ]]; then
  npm ci --prefix web-src --no-fund
else
  python3 tools/codex/install-android.py
  python3 tools/codex/native-source.py extract
fi
if [[ ! -x /usr/bin/chromium ]]; then
  tools/codex/node_modules/.bin/playwright install chromium
fi
echo "Setup complete. Read AGENTS.md and tools/codex/README.md."
