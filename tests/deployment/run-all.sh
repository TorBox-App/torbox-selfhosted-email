#!/usr/bin/env zsh
# Run all 3 deployment tests in parallel
# Each uses a separate AWS profile/account to avoid resource conflicts

set -euo pipefail

SCRIPT_DIR="${0:A:h}"

source "$SCRIPT_DIR/config.sh"
[[ -f "$SCRIPT_DIR/config.local.sh" ]] && source "$SCRIPT_DIR/config.local.sh"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

printf "\n${CYAN}============================================${NC}\n"
printf "  Wraps Deployment Verification Suite\n"
printf "  Domain: %s  Region: %s\n" "$WRAPS_TEST_DOMAIN" "$WRAPS_TEST_REGION"
printf "  Profiles: CLI=%s  CDK=%s  Pulumi=%s\n" "$AWS_PROFILE_CLI" "$AWS_PROFILE_CDK" "$AWS_PROFILE_PULUMI"
printf "${CYAN}============================================${NC}\n\n"

# Parse flags
SEQUENTIAL=false
METHODS=()
for arg in "$@"; do
  case "$arg" in
    --sequential) SEQUENTIAL=true ;;
    cli|cdk|pulumi) METHODS+=("$arg") ;;
    *) printf "Unknown arg: %s\nUsage: run-all.sh [--sequential] [cli] [cdk] [pulumi]\n" "$arg"; exit 1 ;;
  esac
done

# Default: all methods
if (( ${#METHODS[@]} == 0 )); then
  METHODS=(cli cdk pulumi)
fi

typeset -A PIDS
typeset -A RESULTS

run_test() {
  local method=$1
  local log_file="$LOG_DIR/${method}-${TIMESTAMP}.log"
  printf "Starting %s test (log: %s)\n" "$method" "$log_file"
  "$SCRIPT_DIR/$method/run.sh" > "$log_file" 2>&1
}

if $SEQUENTIAL; then
  for method in "${METHODS[@]}"; do
    printf "\n${CYAN}Running %s test...${NC}\n" "$method"
    if run_test "$method"; then
      RESULTS[$method]="PASS"
      printf "${GREEN}%s: PASS${NC}\n" "$method"
    else
      RESULTS[$method]="FAIL"
      printf "${RED}%s: FAIL${NC} (see %s)\n" "$method" "$LOG_DIR/${method}-${TIMESTAMP}.log"
    fi
  done
else
  # Launch in parallel
  for method in "${METHODS[@]}"; do
    run_test "$method" &
    PIDS[$method]=$!
  done

  # Wait and collect results
  for method in "${METHODS[@]}"; do
    if wait ${PIDS[$method]}; then
      RESULTS[$method]="PASS"
    else
      RESULTS[$method]="FAIL"
    fi
  done
fi

# Summary
printf "\n${CYAN}============================================${NC}\n"
printf "  Results\n"
printf "${CYAN}============================================${NC}\n"

HAS_FAILURE=false
for method in "${METHODS[@]}"; do
  if [[ "${RESULTS[$method]}" == "PASS" ]]; then
    printf "${GREEN}  %s: PASS${NC}\n" "$method"
  else
    printf "${RED}  %s: FAIL${NC}  → %s\n" "$method" "$LOG_DIR/${method}-${TIMESTAMP}.log"
    HAS_FAILURE=true
  fi
done

printf "\nLogs: %s\n" "$LOG_DIR"

if $HAS_FAILURE; then
  printf "\n${RED}Some tests failed.${NC}\n"
  exit 1
else
  printf "\n${GREEN}All tests passed.${NC}\n"
  exit 0
fi
