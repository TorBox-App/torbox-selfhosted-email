#!/usr/bin/env zsh
# CLI deployment verification test
# Deploys via wraps CLI through 3 phases, verifying resources at each step

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

export AWS_PROFILE="$AWS_PROFILE_CLI"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

DOMAIN="$WRAPS_TEST_DOMAIN"
REGION="$WRAPS_TEST_REGION"

# Use local CLI build (not globally installed wraps)
REPO_ROOT="${ROOT_DIR:h:h}"
wraps() { node "${REPO_ROOT}/packages/cli/dist/cli.js" "$@"; }

printf "\n%s\n" "============================================"
printf "  CLI Deployment Test\n"
printf "  Domain: %s  Region: %s\n" "$DOMAIN" "$REGION"
printf "  Profile: %s\n" "$AWS_PROFILE"
printf "%s\n\n" "============================================"

# Helper: extract JSON from mixed CLI output (clack text + JSON)
# Some commands output interactive text even in --json mode
extract_json() {
  grep -E '^\{' | tail -1
}

# Helper: create DKIM CNAME records in Route53 for the test domain
# JSON mode skips DNS management, so we do it manually
create_dkim_records() {
  local domain="$1" region="$2"
  local zone_id tokens

  zone_id=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${domain}.'].Id" \
    --output text 2>/dev/null | sed 's|/hostedzone/||')

  [[ -z "$zone_id" ]] && { printf "${YELLOW}  No hosted zone for ${domain}, skipping DNS${NC}\n"; return 0; }

  tokens=$(aws sesv2 get-email-identity \
    --email-identity "$domain" \
    --region "$region" \
    --query 'DkimAttributes.Tokens' \
    --output json 2>/dev/null)

  [[ -z "$tokens" || "$tokens" == "null" ]] && return 0

  local changes="[]"
  for token in $(echo "$tokens" | jq -r '.[]'); do
    changes=$(echo "$changes" | jq \
      --arg name "${token}._domainkey.${domain}" \
      --arg value "${token}.dkim.amazonses.com" \
      '. + [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": $name,
          "Type": "CNAME",
          "TTL": 300,
          "ResourceRecords": [{"Value": $value}]
        }
      }]')
  done

  aws route53 change-resource-record-sets \
    --hosted-zone-id "$zone_id" \
    --change-batch "{\"Changes\": $changes}" \
    --query 'ChangeInfo.Id' --output text &>/dev/null

  printf "${CYAN}  Created DKIM DNS records for ${domain}${NC}\n"
}

# ─── Phase 1: Base deploy (starter preset — no events, no SMTP) ──────

printf "${YELLOW}Phase 1: Base deploy (starter preset)${NC}\n"

wraps email init \
  --provider aws \
  --region "$REGION" \
  --domain "$DOMAIN" \
  --preset starter \
  --quick \
  --json

# Create DKIM DNS records (JSON mode skips DNS management)
create_dkim_records "$DOMAIN" "$REGION"

reset_counters
verify_base "$DOMAIN" "$REGION"

# Verify events are NOT deployed in starter
section "Phase 1: Verify no event resources"

if aws dynamodb describe-table \
  --table-name wraps-email-history \
  --region "$REGION" &>/dev/null; then
  fail "DynamoDB table should not exist in starter preset"
else
  pass "No DynamoDB table (expected for starter)"
fi

if aws sqs get-queue-url \
  --queue-name wraps-email-events \
  --region "$REGION" &>/dev/null; then
  fail "SQS queue should not exist in starter preset"
else
  pass "No SQS queue (expected for starter)"
fi

if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist in starter preset"
else
  pass "No SMTP user (expected for starter)"
fi

summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }

# ─── Phase 1b: CLI command tests (status, verify, test) ──────────────

printf "\n${YELLOW}Phase 1b: CLI commands after base deploy${NC}\n"
reset_counters

# status
section "Phase 1b: email status"
STATUS_OUT=$(wraps email status --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$STATUS_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email status succeeds"
else
  fail "email status failed" "$STATUS_OUT"
fi

if echo "$STATUS_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "email status reports correct region"
else
  fail "email status region mismatch"
fi

if echo "$STATUS_OUT" | jq -e --arg d "$DOMAIN" '.data.domains[] | select(.domain == $d)' &>/dev/null; then
  pass "email status includes domain $DOMAIN"
else
  fail "email status missing domain $DOMAIN"
fi

if echo "$STATUS_OUT" | jq -e '.data.resources.configSetName == "wraps-email-tracking"' &>/dev/null; then
  pass "email status reports config set"
else
  fail "email status missing config set"
fi

# domains verify
section "Phase 1b: email domains verify"
VERIFY_OUT=$(wraps email domains verify --json --domain "$DOMAIN" 2>/dev/null | extract_json) || true

if echo "$VERIFY_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email domains verify succeeds"
else
  fail "email domains verify failed" "$VERIFY_OUT"
fi

if echo "$VERIFY_OUT" | jq -e '.data.dkimStatus == "SUCCESS" or .data.dkimStatus == "PENDING"' &>/dev/null; then
  typeset dkim_s
  dkim_s=$(echo "$VERIFY_OUT" | jq -r '.data.dkimStatus')
  pass "email domains verify DKIM status: $dkim_s"
else
  fail "email domains verify DKIM unexpected status"
fi

if echo "$VERIFY_OUT" | jq -e '.data.dnsRecords | length > 0' &>/dev/null; then
  pass "email domains verify returns DNS records"
else
  fail "email domains verify missing DNS records"
fi

summary || { printf "${RED}Phase 1b FAILED${NC}\n"; exit 1; }

# ─── Phase 2: Upgrade to production preset (adds events) ─────────────

printf "\n${YELLOW}Phase 2: Upgrade to production (adds events)${NC}\n"

wraps email upgrade \
  --region "$REGION" \
  --action preset \
  --preset production \
  --yes \
  --json

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"

# Verify SMTP still not deployed
section "Phase 2: Verify no SMTP"
if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist after events upgrade"
else
  pass "No SMTP user (expected)"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 2b: Config sync (idempotent redeploy) ─────────────────────

printf "\n${YELLOW}Phase 2b: Config sync${NC}\n"

CONFIG_OUT=$(wraps email config --json --yes --region "$REGION" 2>/dev/null | extract_json) || true

reset_counters
section "Phase 2b: email config sync"

if echo "$CONFIG_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email config sync succeeds"
else
  fail "email config sync failed" "$CONFIG_OUT"
fi

if echo "$CONFIG_OUT" | jq -e '.data.updated == true' &>/dev/null; then
  pass "email config reports updated"
else
  fail "email config did not report updated"
fi

if echo "$CONFIG_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "email config reports correct region"
else
  fail "email config region mismatch"
fi

# Verify resources still intact after sync
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"

summary || { printf "${RED}Phase 2b FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Add SMTP credentials ───────────────────────────────────

printf "\n${YELLOW}Phase 3: Add SMTP credentials${NC}\n"

wraps email upgrade \
  --region "$REGION" \
  --action smtp-credentials \
  --yes \
  --json

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_smtp

summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }

# ─── Phase 3b: Full status check + bounce test ───────────────────────

printf "\n${YELLOW}Phase 3b: Full status + bounce scenario test${NC}\n"
reset_counters

section "Phase 3b: email status (full deployment)"
STATUS_FULL=$(wraps email status --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$STATUS_FULL" | jq -e '.data.resources.tableName == "wraps-email-history"' &>/dev/null; then
  pass "email status reports DynamoDB table"
else
  fail "email status missing DynamoDB table"
fi

if echo "$STATUS_FULL" | jq -e '.data.resources.roleArn != null' &>/dev/null; then
  pass "email status reports role ARN"
else
  fail "email status missing role ARN"
fi

# Test success scenario (SES simulator)
section "Phase 3b: email test success scenario"
TEST_OUT=$(wraps email test --json --scenario success --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$TEST_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email test succeeds (simulator)"
else
  fail "email test failed" "$TEST_OUT"
fi

if echo "$TEST_OUT" | jq -e '.data.messageId != null and .data.messageId != ""' &>/dev/null; then
  pass "email test returned messageId"
else
  fail "email test missing messageId"
fi

if echo "$TEST_OUT" | jq -e '.data.isSimulator == true' &>/dev/null; then
  pass "email test used simulator address"
else
  fail "email test isSimulator not true"
fi

# Test bounce scenario (verifies event pipeline can handle bounces)
section "Phase 3b: email test bounce scenario"
BOUNCE_OUT=$(wraps email test --json --scenario bounce --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$BOUNCE_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email test bounce succeeds"
else
  fail "email test bounce failed" "$BOUNCE_OUT"
fi

if echo "$BOUNCE_OUT" | jq -e '.data.to | contains("bounce@simulator")' &>/dev/null; then
  pass "email test sent to bounce simulator"
else
  fail "email test bounce address mismatch"
fi

summary || { printf "${RED}Phase 3b FAILED${NC}\n"; exit 1; }

# ─── Phase 4: Idempotent re-deploy (same preset, nothing should change) ──

printf "\n${YELLOW}Phase 4: Idempotent re-deploy (production preset again)${NC}\n"

wraps email upgrade \
  --region "$REGION" \
  --action preset \
  --preset production \
  --yes \
  --json

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_smtp

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Teardown ─────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

wraps email destroy \
  --region "$REGION" \
  --force \
  --json

reset_counters
verify_teardown "$DOMAIN" "$REGION"

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}CLI deployment test PASSED${NC}\n"
