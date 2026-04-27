#!/usr/bin/env zsh
# Print the production DATABASE_URL for use in analysis or tooling.
# Usage: eval "$(scripts/db-prod-url.sh)"  — exports DATABASE_URL into current shell
# Or:    scripts/db-prod-url.sh            — prints export statement for inspection
set -euo pipefail

ENV_FILE="apps/web/.env.production.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Ensure you have the production env file." >&2
  exit 1
fi

LINE=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1)
if [[ -z "$LINE" ]]; then
  echo "ERROR: DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

# Extract value after DATABASE_URL=, stripping optional surrounding quotes
URL="${LINE#DATABASE_URL=}"
URL="${URL#\"}"
URL="${URL%\"}"
URL="${URL#\'}"
URL="${URL%\'}"

echo "export DATABASE_URL='$URL'"
