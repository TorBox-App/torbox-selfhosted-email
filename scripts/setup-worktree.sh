#!/usr/bin/env zsh
# Setup a git worktree with env files, .claude context, and ai-notes.
# Uses symlinks so updates in any worktree are reflected everywhere.
#
# Usage: ./scripts/setup-worktree.sh <branch> [path]
#   branch: branch name to checkout (created if doesn't exist)
#   path:   worktree directory (default: ../wraps.<branch>)

set -euo pipefail

MAIN_TREE="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
BRANCH="${1:?Usage: setup-worktree.sh <branch> [path]}"
WORKTREE="${2:-$(dirname "$MAIN_TREE")/wraps.${BRANCH}}"

# --- Create worktree ---
if [[ -d "$WORKTREE" ]]; then
  echo "Worktree already exists at $WORKTREE"
else
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    git worktree add "$WORKTREE" "$BRANCH"
  else
    git worktree add -b "$BRANCH" "$WORKTREE"
  fi
  echo "Created worktree at $WORKTREE"
fi

# --- Symlink env files ---
ENV_FILES=(
  "apps/web/.env.local"
  "apps/web/.env.test"
  "apps/website/.env"
  "apps/website/.env.local"
)

linked=0
for f in "${ENV_FILES[@]}"; do
  src="$MAIN_TREE/$f"
  dst="$WORKTREE/$f"
  if [[ -f "$src" && ! -e "$dst" ]]; then
    mkdir -p "$(dirname "$dst")"
    ln -s "$src" "$dst"
    ((linked++))
  fi
done
echo "Linked $linked env file(s)"

# --- Symlink shared directories (.claude, ai-notes, notes) ---
shared_linked=0
for d in .claude ai-notes notes; do
  src="$MAIN_TREE/$d"
  dst="$WORKTREE/$d"
  if [[ -d "$src" ]]; then
    if [[ -L "$dst" ]]; then
      continue  # already symlinked
    fi
    # Remove the git-created directory if present (worktree copies tracked files)
    [[ -d "$dst" ]] && rm -rf "$dst"
    ln -s "$src" "$dst"
    ((shared_linked++))
  fi
done
echo "Linked $shared_linked shared dir(s)"

# --- Install dependencies ---
echo "Installing dependencies..."
(cd "$WORKTREE" && pnpm install --frozen-lockfile)

echo ""
echo "Ready: $WORKTREE"
echo "  cd $WORKTREE"
