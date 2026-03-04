#!/usr/bin/env zsh
# CDK deployment verification test
# Deploys via CDK construct through 5 phases, verifying resources at each step

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"
APP_DIR="$SCRIPT_DIR/app"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

export AWS_PROFILE="$AWS_PROFILE_CDK"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

DOMAIN="$WRAPS_TEST_DOMAIN"
REGION="$WRAPS_TEST_REGION"

printf "\n%s\n" "============================================"
printf "  CDK Deployment Test\n"
printf "  Domain: %s  Region: %s\n" "$DOMAIN" "$REGION"
printf "  Profile: %s\n" "$AWS_PROFILE"
printf "%s\n\n" "============================================"

# Install deps if needed
if [[ ! -d "$APP_DIR/node_modules" ]]; then
  printf "Installing CDK app dependencies...\n"
  (cd "$APP_DIR" && npm install)
fi

# Bootstrap CDK if needed
(cd "$APP_DIR" && npx cdk bootstrap 2>/dev/null || true)

write_config() {
  cat > "$APP_DIR/config.json" <<CONF
$1
CONF
}

# ─── Phase 1: Base deploy (domain only, no events, no SMTP) ──────────

printf "${YELLOW}Phase 1: Base deploy (domain only)${NC}\n"

write_config "{
  \"domain\": \"$DOMAIN\"
}"

(cd "$APP_DIR" && npx cdk deploy --require-approval never)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_iam_no_events_policy

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

write_config "{
  \"domain\": \"$DOMAIN\",
  \"events\": {
    \"storeHistory\": true,
    \"retention\": \"90days\"
  }
}"

(cd "$APP_DIR" && npx cdk deploy --require-approval never)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy

section "Phase 2: Verify no SMTP"
if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist"
else
  pass "No SMTP user (expected)"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Add SMTP ───────────────────────────────────────────────

printf "\n${YELLOW}Phase 3: Add SMTP${NC}\n"

write_config "{
  \"domain\": \"$DOMAIN\",
  \"events\": {
    \"storeHistory\": true,
    \"retention\": \"90days\"
  },
  \"smtp\": {
    \"enabled\": true
  }
}"

(cd "$APP_DIR" && npx cdk deploy --require-approval never)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_smtp

summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }

# ─── Phase 4: Add webhook ────────────────────────────────────────────

printf "\n${YELLOW}Phase 4: Add webhook${NC}\n"

write_config "{
  \"domain\": \"$DOMAIN\",
  \"events\": {
    \"storeHistory\": true,
    \"retention\": \"90days\"
  },
  \"smtp\": {
    \"enabled\": true
  },
  \"webhook\": {
    \"awsAccountNumber\": \"886375649429\",
    \"webhookSecret\": \"test-webhook-secret-key\",
    \"webhookUrl\": \"https://api.wraps.dev\"
  }
}"

(cd "$APP_DIR" && npx cdk deploy --require-approval never)

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy
verify_smtp
verify_webhook "$REGION"

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Teardown ─────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

(cd "$APP_DIR" && npx cdk destroy --force)

reset_counters
verify_teardown "$DOMAIN" "$REGION"

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}CDK deployment test PASSED${NC}\n"
