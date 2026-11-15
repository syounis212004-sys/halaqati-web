#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$repo_root"
browser_args=()
if [[ -n "${CHROMIUM_PATH:-}" ]]; then
  browser_args+=(--executable-path "$CHROMIUM_PATH")
elif [[ -x /usr/bin/chromium ]]; then
  browser_args+=(--executable-path /usr/bin/chromium)
fi
mkdir -p .codex-work/mcp
exec node tools/codex/node_modules/@playwright/mcp/cli.js --headless --isolated --block-service-workers --caps devtools --output-dir "$repo_root/.codex-work/mcp" "${browser_args[@]}" "$@"
