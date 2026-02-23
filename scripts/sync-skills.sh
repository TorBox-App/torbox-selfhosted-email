#!/usr/bin/env zsh
# Sync SKILL.md files from the skills repo into website public dir
# Usage: ./scripts/sync-skills.sh [skills-repo-path]

set -euo pipefail

SKILLS_SRC="${1:-../skills/skills}"
DEST="apps/website/public/.well-known/skills"

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "error: skills source not found at $SKILLS_SRC"
  echo "usage: $0 [path-to-skills/skills]"
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"

count=0
for skill_dir in "$SKILLS_SRC"/*(N/); do
  name="${skill_dir:t}"
  if [[ -f "$skill_dir/SKILL.md" ]]; then
    mkdir -p "$DEST/$name"
    cp "$skill_dir/SKILL.md" "$DEST/$name/SKILL.md"
    (( ++count ))
  fi
done

echo "synced $count skills to $DEST"
