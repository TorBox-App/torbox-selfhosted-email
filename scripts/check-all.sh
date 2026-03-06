#!/usr/bin/env zsh
# check-all.sh — Agent-friendly CI check pipeline
# Runs all checks, suppresses verbose output on success, surfaces errors clearly.
# Usage: ./scripts/check-all.sh [--verbose]

set -euo pipefail

VERBOSE=false
[[ "${1:-}" == "--verbose" ]] && VERBOSE=true

LOGDIR=$(mktemp -d)
trap 'rm -rf "$LOGDIR"' EXIT

# Force turbo to use streaming output (TUI mode hangs when stdout is redirected)
export TURBO_UI=stream

typeset -a STEPS CMDS
STEPS=(lint typecheck baseline build test)
CMDS=(
  "pnpm check:errors"
  "pnpm typecheck"
  "pnpm test:baseline"
  "pnpm build"
  "pnpm test"
)

typeset -a RESULTS
PASS=0
FAIL=0
FAILED_STEP=""

for i in {1..${#STEPS}}; do
  step=${STEPS[$i]}
  cmd=${CMDS[$i]}
  logfile="$LOGDIR/$step.log"

  printf "%-12s " "$step"

  if $VERBOSE; then
    if eval "$cmd" 2>&1 | tee "$logfile"; then
      echo ":: PASS $step"
      RESULTS+=("PASS $step")
      (( ++PASS ))
    else
      echo ":: FAIL $step"
      RESULTS+=("FAIL $step")
      (( ++FAIL ))
      FAILED_STEP=$step
      break
    fi
  else
    if eval "$cmd" > "$logfile" 2>&1; then
      echo "PASS"
      RESULTS+=("PASS $step")
      (( ++PASS ))
    else
      echo "FAIL"
      RESULTS+=("FAIL $step")
      (( ++FAIL ))
      FAILED_STEP=$step
      break
    fi
  fi
done

echo ""
echo "--- check:all summary ---"
for r in "${RESULTS[@]}"; do
  echo "  $r"
done

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "FAILED: $FAILED_STEP"
  echo ""
  logfile="$LOGDIR/$FAILED_STEP.log"
  total=$(wc -l < "$logfile")
  # Show last 80 lines of the failed step (where errors live)
  echo "--- $FAILED_STEP output (last 80 of $total lines) ---"
  tail -80 "$logfile"
  echo "--- end $FAILED_STEP output ---"
  echo ""
  echo "Full log: $logfile (available until script exits)"
  echo "Re-run with: ${CMDS[${STEPS[(i)$FAILED_STEP]}]}"
  exit 1
fi

echo ""
echo "ALL CHECKS PASSED ($PASS/$PASS)"
