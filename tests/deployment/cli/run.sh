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
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

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
verify_iam_no_events_policy
verify_console_access_role

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

# doctor (starter — should find resources, all healthy, no orphans)
section "Phase 1b: email doctor"
DOCTOR_OUT=$(wraps email doctor --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$DOCTOR_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email doctor succeeds"
else
  fail "email doctor failed" "$DOCTOR_OUT"
fi

if echo "$DOCTOR_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "email doctor reports correct region"
else
  fail "email doctor region mismatch"
fi

if echo "$DOCTOR_OUT" | jq -e '.data.totalResources >= 2' &>/dev/null; then
  typeset dr_count
  dr_count=$(echo "$DOCTOR_OUT" | jq -r '.data.totalResources')
  pass "email doctor found $dr_count resources (starter)"
else
  fail "email doctor found too few resources"
fi

if echo "$DOCTOR_OUT" | jq -e '[.data.resources[] | select(.status != "pass")] | length == 0' &>/dev/null; then
  pass "email doctor all resources healthy (no orphans)"
else
  fail "email doctor found unhealthy or orphaned resources"
fi

# check (deliverability audit — DKIM may still be PENDING)
section "Phase 1b: email check"
CHECK_OUT=$(wraps email check --json --domain "$DOMAIN" --quick 2>/dev/null | extract_json) || true

if echo "$CHECK_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email check succeeds"
else
  fail "email check failed" "$CHECK_OUT"
fi

if echo "$CHECK_OUT" | jq -e '.data.score.finalScore | type == "number"' &>/dev/null; then
  typeset check_score check_grade
  check_score=$(echo "$CHECK_OUT" | jq -r '.data.score.finalScore')
  check_grade=$(echo "$CHECK_OUT" | jq -r '.data.score.grade')
  pass "email check score: $check_score/100 (grade $check_grade)"
else
  fail "email check missing score"
fi

if echo "$CHECK_OUT" | jq -e '.data.spf != null' &>/dev/null; then
  pass "email check includes SPF results"
else
  fail "email check missing SPF results"
fi

if echo "$CHECK_OUT" | jq -e '.data.dkim != null' &>/dev/null; then
  pass "email check includes DKIM results"
else
  fail "email check missing DKIM results"
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
verify_iam_events_policy
verify_console_access_role

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
verify_iam_events_policy
verify_console_access_role

summary || { printf "${RED}Phase 2b FAILED${NC}\n"; exit 1; }

# ─── Phase 2c: Add and verify a subdomain ────────────────────────────

SUBDOMAIN="notifications.${DOMAIN}"

printf "\n${YELLOW}Phase 2c: Add subdomain (${SUBDOMAIN})${NC}\n"

wraps email domains add \
  --domain "$SUBDOMAIN" \
  --region "$REGION" \
  --yes \
  --json

# Create DKIM DNS records for the subdomain
create_dkim_records "$SUBDOMAIN" "$REGION"

reset_counters

section "Phase 2c: domains add"

# Verify SES identity was created
if aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" &>/dev/null; then
  pass "SES identity $SUBDOMAIN exists"
else
  fail "SES identity $SUBDOMAIN not found"
fi

# Verify config set is linked
typeset sub_cs
sub_cs=$(aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" \
  --query 'ConfigurationSetName' \
  --output text 2>/dev/null)

if [[ "$sub_cs" == "wraps-email-tracking" ]]; then
  pass "Subdomain linked to wraps-email-tracking config set"
else
  fail "Subdomain config set mismatch: $sub_cs"
fi

# Verify MAIL FROM is configured (domains add --yes defaults to mail.{domain})
typeset sub_mailfrom
sub_mailfrom=$(aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" \
  --query 'MailFromAttributes.MailFromDomain' \
  --output text 2>/dev/null)

if [[ "$sub_mailfrom" == "mail.${SUBDOMAIN}" ]]; then
  pass "Subdomain MAIL FROM configured: $sub_mailfrom"
else
  fail "Subdomain MAIL FROM expected mail.${SUBDOMAIN}, got: $sub_mailfrom"
fi

# domains verify
section "Phase 2c: domains verify (subdomain)"
SUB_VERIFY=$(wraps email domains verify --json --domain "$SUBDOMAIN" 2>/dev/null | extract_json) || true

if echo "$SUB_VERIFY" | jq -e '.success == true' &>/dev/null; then
  pass "email domains verify succeeds for subdomain"
else
  fail "email domains verify failed for subdomain" "$SUB_VERIFY"
fi

if echo "$SUB_VERIFY" | jq -e '.data.dkimStatus == "SUCCESS" or .data.dkimStatus == "PENDING"' &>/dev/null; then
  typeset sub_dkim
  sub_dkim=$(echo "$SUB_VERIFY" | jq -r '.data.dkimStatus')
  pass "Subdomain DKIM status: $sub_dkim"
else
  fail "Subdomain DKIM unexpected status"
fi

# domains list — should include both primary and subdomain
section "Phase 2c: domains list"
LIST_OUT=$(wraps email domains list --json 2>/dev/null | extract_json) || true

if echo "$LIST_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email domains list succeeds"
else
  fail "email domains list failed" "$LIST_OUT"
fi

if echo "$LIST_OUT" | jq -e --arg d "$DOMAIN" '[.data.domains[] | select(.domain == $d)] | length > 0' &>/dev/null; then
  pass "domains list includes primary domain"
else
  fail "domains list missing primary domain"
fi

if echo "$LIST_OUT" | jq -e --arg d "$SUBDOMAIN" '[.data.domains[] | select(.domain == $d)] | length > 0' &>/dev/null; then
  pass "domains list includes subdomain"
else
  fail "domains list missing subdomain"
fi

# Remove subdomain
section "Phase 2c: domains remove (subdomain)"
wraps email domains remove \
  --domain "$SUBDOMAIN" \
  --force \
  --json

# Verify subdomain is gone from SES
if aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" &>/dev/null; then
  fail "SES identity $SUBDOMAIN still exists after removal"
else
  pass "Subdomain removed from SES"
fi

# Verify primary domain still intact
if aws sesv2 get-email-identity \
  --email-identity "$DOMAIN" \
  --region "$REGION" &>/dev/null; then
  pass "Primary domain still intact after subdomain removal"
else
  fail "Primary domain was removed (should only remove subdomain)"
fi

summary || { printf "${RED}Phase 2c FAILED${NC}\n"; exit 1; }

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
verify_iam_events_policy
verify_smtp
verify_console_access_role

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

# doctor (full deployment — should find all resources healthy)
section "Phase 3b: email doctor (full deployment)"
DOCTOR_FULL=$(wraps email doctor --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$DOCTOR_FULL" | jq -e '.success == true' &>/dev/null; then
  pass "email doctor succeeds (full)"
else
  fail "email doctor failed (full)" "$DOCTOR_FULL"
fi

if echo "$DOCTOR_FULL" | jq -e '.data.totalResources >= 5' &>/dev/null; then
  typeset dr_full_count
  dr_full_count=$(echo "$DOCTOR_FULL" | jq -r '.data.totalResources')
  pass "email doctor found $dr_full_count resources (production)"
else
  fail "email doctor found too few resources for production"
fi

if echo "$DOCTOR_FULL" | jq -e '[.data.resources[] | select(.status != "pass")] | length == 0' &>/dev/null; then
  pass "email doctor all resources healthy (full)"
else
  fail "email doctor found unhealthy resources (full)"
fi

# check (DKIM should be SUCCESS by now — expect better score)
section "Phase 3b: email check (full deployment)"
CHECK_FULL=$(wraps email check --json --domain "$DOMAIN" --quick 2>/dev/null | extract_json) || true

if echo "$CHECK_FULL" | jq -e '.success == true' &>/dev/null; then
  pass "email check succeeds (full)"
else
  fail "email check failed (full)" "$CHECK_FULL"
fi

if echo "$CHECK_FULL" | jq -e '.data.score.finalScore | type == "number"' &>/dev/null; then
  typeset check_full_score check_full_grade
  check_full_score=$(echo "$CHECK_FULL" | jq -r '.data.score.finalScore')
  check_full_grade=$(echo "$CHECK_FULL" | jq -r '.data.score.grade')
  pass "email check score: $check_full_score/100 (grade $check_full_grade)"
else
  fail "email check missing score (full)"
fi

if echo "$CHECK_FULL" | jq -e '.data.dkim.found == true' &>/dev/null; then
  pass "email check DKIM found (full deployment)"
else
  fail "email check DKIM not found (expected after DNS propagation)"
fi

summary || { printf "${RED}Phase 3b FAILED${NC}\n"; exit 1; }

# ─── Phase 3c: Platform role permission smoke test ───────────────────

printf "\n${YELLOW}Phase 3c: Platform role permission smoke test${NC}\n"

reset_counters
verify_role_permissions "$ACCOUNT_ID" "$REGION" "$DOMAIN"

summary || { printf "${RED}Phase 3c FAILED${NC}\n"; exit 1; }

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
verify_iam_events_policy
verify_smtp
verify_console_access_role

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Teardown ─────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

pre_teardown_rename_archive

wraps email destroy \
  --region "$REGION" \
  --force \
  --json

reset_counters
verify_teardown "$DOMAIN" "$REGION"

# doctor (post-teardown — should find zero resources)
section "Teardown: email doctor (clean state)"
DOCTOR_CLEAN=$(wraps email doctor --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$DOCTOR_CLEAN" | jq -e '.success == true' &>/dev/null; then
  pass "email doctor succeeds (post-teardown)"
else
  fail "email doctor failed (post-teardown)" "$DOCTOR_CLEAN"
fi

if echo "$DOCTOR_CLEAN" | jq -e '.data.totalResources == 0' &>/dev/null; then
  pass "email doctor found 0 resources (clean account)"
else
  typeset dr_leftover
  dr_leftover=$(echo "$DOCTOR_CLEAN" | jq -r '.data.totalResources')
  fail "email doctor found $dr_leftover leftover resources after teardown"
fi

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}CLI deployment test PASSED${NC}\n"
