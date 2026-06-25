#!/usr/bin/env bash
# Re-sync the carbon copy in site/ from the CodeKit source project, excluding non-web files.
# Usage: pnpm refresh   (or: bash scripts/refresh.sh /path/to/source)
set -euo pipefail

SRC="${1:-/Users/cortex/Development/faunapoolen}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/site"

if [ ! -f "$SRC/index.html" ]; then
  echo "Source not found or not generated: $SRC (run CodeKit there first)" >&2
  exit 1
fi

rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.translation-cache' \
  --exclude '*.kit' --exclude '*.py' --exclude 'config.codekit3' \
  --exclude '*.code-workspace' --exclude 'requirements.txt' \
  --exclude 'translate_site.config.json' --exclude '.gitignore' \
  --exclude '.DS_Store' --exclude 'CNAME' \
  --exclude 'AGENTS.md' --exclude 'AGENTS.html' \
  --exclude 'README.md' --exclude 'README.html' \
  --exclude 'TRANSLATION_PLAN.md' --exclude 'TRANSLATION_PLAN.html' \
  "$SRC/" "$DEST/"

echo "Synced $SRC -> $DEST"
echo "Restart the server to be safe: launchctl kickstart -k gui/\$(id -u)/com.faunapoolen.server"
