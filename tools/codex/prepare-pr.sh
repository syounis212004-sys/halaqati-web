#!/usr/bin/env bash
set -euo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
branch="$(git branch --show-current)"
if [[ -z "$branch" || "$branch" == main || "$branch" == master ]]; then
  echo 'Use an independent feature/setup branch before preparing a PR.' >&2
  exit 1
fi
mkdir -p .codex-work
{
  echo '## Change'
  echo 'Configure a reusable Codex development workflow, instructions, trusted skills, and isolated PR checks for this repository.'
  echo
  echo '## Validation'
  echo 'See tools/codex/VERIFICATION.md for observed checks and pre-existing failures. Setup does not change application functionality.'
  echo
  echo '## Scope'
  git diff --stat origin/main...HEAD
  git diff --stat
  echo
  echo 'Push and merge require the repository owner’s approval.'
} > .codex-work/pr-body.md
echo "Prepared $PWD/.codex-work/pr-body.md for $branch"
echo 'After explicit push approval: git push -u origin HEAD'
echo 'Then prepare a draft PR with: gh pr create --draft --base main --body-file .codex-work/pr-body.md'
