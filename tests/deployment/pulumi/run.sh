#!/usr/bin/env zsh
# Pulumi deployment verification test
# Deploys via Pulumi component through 3 phases, verifying resources at each step

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"
APP_DIR="$SCRIPT_DIR/app"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

export AWS_PROFILE="$AWS_PROFILE_PULUMI"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

DOMAIN="$WRAPS_TEST_DOMAIN"
REGION="$WRAPS_TEST_REGION"
STACK_NAME="deployment-test"

printf "\n%s\n" "============================================"
printf "  Pulumi Deployment Test\n"
printf "  Domain: %s  Region: %s\n" "$DOMAIN" "$REGION"
printf "  Profile: %s\n" "$AWS_PROFILE"
printf "%s\n\n" "============================================"

# Install deps if needed
if [[ ! -d "$APP_DIR/node_modules" ]]; then
  printf "Installing Pulumi app dependencies...\n"
  (cd "$APP_DIR" && npm install)
fi

# Initialize stack
(cd "$APP_DIR" && pulumi stack select "$STACK_NAME" 2>/dev/null || pulumi stack init "$STACK_NAME")
(cd "$APP_DIR" && pulumi config set aws:region "$REGION")
(cd "$APP_DIR" && pulumi config set domain "$DOMAIN")

# ─── Phase 1: Base deploy (domain only) ──────────────────────────────

printf "${YELLOW}Phase 1: Base deploy (domain only)${NC}\n"

(cd "$APP_DIR" && pulumi config set events false)
(cd "$APP_DIR" && pulumi config set smtp false)
(cd "$APP_DIR" && pulumi up --yes)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_iam_no_events_policy
verify_console_access_role

section "Phase 1: Verify no event resources"
if aws dynamodb describe-table --table-name wraps-email-history --region "$REGION" &>/dev/null; then
  fail "DynamoDB table should not exist"
else
  pass "No DynamoDB table (expected)"
fi
if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist"
else
  pass "No SMTP user (expected)"
fi

summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }

# ─── Phase 2: Add events ─────────────────────────────────────────────

printf "\n${YELLOW}Phase 2: Add events${NC}\n"

(cd "$APP_DIR" && pulumi config set events true)
(cd "$APP_DIR" && pulumi up --yes)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_console_access_role

section "Phase 2: Verify no SMTP"
if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist"
else
  pass "No SMTP user (expected)"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Add SMTP ───────────────────────────────────────────────

printf "\n${YELLOW}Phase 3: Add SMTP${NC}\n"

(cd "$APP_DIR" && pulumi config set smtp true)
(cd "$APP_DIR" && pulumi up --yes)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_smtp
verify_console_access_role

summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }

# ─── Phase 4: Add webhook ────────────────────────────────────────────

printf "\n${YELLOW}Phase 4: Add webhook${NC}\n"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
(cd "$APP_DIR" && pulumi config set webhookSecret test-webhook-secret-key)
(cd "$APP_DIR" && pulumi config set webhookAccountId "$AWS_ACCOUNT_ID")
(cd "$APP_DIR" && pulumi up --yes)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_smtp
verify_webhook "$REGION"
verify_console_access_role

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Phase 5: Idempotent re-deploy ───────────────────────────────────

printf "\n${YELLOW}Phase 5: Idempotent re-deploy (same config)${NC}\n"

(cd "$APP_DIR" && pulumi up --yes)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_smtp
verify_webhook "$REGION"
verify_console_access_role

summary || { printf "${RED}Phase 5 FAILED${NC}\n"; exit 1; }

# ─── Teardown ─────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

pre_teardown_rename_archive

(cd "$APP_DIR" && pulumi destroy --yes)
(cd "$APP_DIR" && pulumi stack rm "$STACK_NAME" --yes)

reset_counters
verify_teardown "$DOMAIN" "$REGION"

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}Pulumi deployment test PASSED${NC}\n"
