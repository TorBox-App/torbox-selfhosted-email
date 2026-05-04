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

# Always destroy infrastructure on exit (success or failure) to avoid orphaned resources
cleanup_on_exit() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    printf "\n${RED}Test failed (exit %d) — destroying resources to avoid orphans${NC}\n" "$exit_code"
    wraps email destroy --region "$REGION" --force --json 2>/dev/null || true
    # Also clean Pulumi stack state so next run starts fresh
    local state_bucket="wraps-state-${ACCOUNT_ID}-${REGION}"
    if aws s3 ls "s3://${state_bucket}" &>/dev/null; then
      PULUMI_CONFIG_PASSPHRASE="" PULUMI_BACKEND_URL="s3://${state_bucket}" \
        pulumi stack rm "wraps-${ACCOUNT_ID}-${REGION}" --yes --force --cwd ~/.wraps/pulumi 2>/dev/null || true
    fi
  fi
  exit "$exit_code"
}
trap cleanup_on_exit EXIT

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

# Helper: create MX + SPF records in Route53 for an inbound-capable domain.
# JSON mode skips DNS management, so we do it manually. SES inbound SMTP uses
# `inbound-smtp.{region}.amazonaws.com`.
create_inbound_dns_records() {
  local host="$1" region="$2" parent="$3"
  local zone_id

  zone_id=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${parent}.'].Id" \
    --output text 2>/dev/null | sed 's|/hostedzone/||')

  [[ -z "$zone_id" ]] && { printf "${YELLOW}  No hosted zone for ${parent}, skipping inbound DNS${NC}\n"; return 0; }

  local mx_target="inbound-smtp.${region}.amazonaws.com"
  local changes
  changes=$(jq -n \
    --arg name "$host" \
    --arg mx "10 ${mx_target}" \
    --arg spf "\"v=spf1 include:amazonses.com ~all\"" \
    '[
      {"Action":"UPSERT","ResourceRecordSet":{"Name":$name,"Type":"MX","TTL":300,"ResourceRecords":[{"Value":$mx}]}},
      {"Action":"UPSERT","ResourceRecordSet":{"Name":$name,"Type":"TXT","TTL":300,"ResourceRecords":[{"Value":$spf}]}}
    ]')

  aws route53 change-resource-record-sets \
    --hosted-zone-id "$zone_id" \
    --change-batch "{\"Changes\": $changes}" \
    --query 'ChangeInfo.Id' --output text &>/dev/null

  printf "${CYAN}  Created MX + SPF DNS records for ${host}${NC}\n"
}

# Delete MX + SPF records created by create_inbound_dns_records.
delete_inbound_dns_records() {
  local host="$1" parent="$2"
  local zone_id

  zone_id=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='${parent}.'].Id" \
    --output text 2>/dev/null | sed 's|/hostedzone/||')

  [[ -z "$zone_id" ]] && return 0

  # Read existing records so DELETE matches exactly — Route53 requires the
  # ResourceRecords to match the stored values or it rejects the change.
  typeset -a record_types
  record_types=(MX TXT)
  local t existing changes_list="[]"

  for t in "${record_types[@]}"; do
    existing=$(aws route53 list-resource-record-sets \
      --hosted-zone-id "$zone_id" \
      --query "ResourceRecordSets[?Name=='${host}.' && Type=='${t}']" \
      --output json 2>/dev/null)
    [[ "$(echo "$existing" | jq 'length')" == "0" ]] && continue
    local rrs
    rrs=$(echo "$existing" | jq '.[0]')
    changes_list=$(echo "$changes_list" | jq \
      --argjson rrs "$rrs" \
      '. + [{"Action":"DELETE","ResourceRecordSet": $rrs}]')
  done

  if [[ "$(echo "$changes_list" | jq 'length')" != "0" ]]; then
    aws route53 change-resource-record-sets \
      --hosted-zone-id "$zone_id" \
      --change-batch "{\"Changes\": $changes_list}" \
      --query 'ChangeInfo.Id' --output text &>/dev/null || true
    printf "${CYAN}  Removed MX + SPF DNS records for ${host}${NC}\n"
  fi
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

# Derive the primary domain's per-domain config set name from SES (used throughout)
PRIMARY_CONFIG_SET_NAME=$(aws sesv2 get-email-identity \
  --email-identity "$DOMAIN" \
  --region "$REGION" \
  --query 'ConfigurationSetName' \
  --output text 2>/dev/null)
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

if echo "$STATUS_OUT" | jq -e --arg cs "$PRIMARY_CONFIG_SET_NAME" '.data.resources.configSetName == $cs' &>/dev/null; then
  pass "email status reports per-domain config set ($PRIMARY_CONFIG_SET_NAME)"
else
  fail "email status config set mismatch (expected $PRIMARY_CONFIG_SET_NAME)"
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
verify_events "$REGION" "$DOMAIN"
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
verify_events "$REGION" "$DOMAIN"
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

# Verify subdomain has its own per-domain config set (not the shared wraps-email-tracking)
typeset sub_cs
sub_cs=$(aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" \
  --query 'ConfigurationSetName' \
  --output text 2>/dev/null)

if [[ "$sub_cs" == "wraps-email-tracking" ]]; then
  fail "Subdomain still using shared wraps-email-tracking (should have per-domain config set)"
elif [[ "$sub_cs" == wraps-email-* ]]; then
  pass "Subdomain has per-domain config set: $sub_cs"
else
  fail "Subdomain config set unexpected value: $sub_cs"
fi

# Verify per-domain config set exists in SES
if aws sesv2 get-configuration-set \
  --configuration-set-name "$sub_cs" \
  --region "$REGION" &>/dev/null; then
  pass "Per-domain config set $sub_cs exists in SES"
else
  fail "Per-domain config set $sub_cs not found in SES"
fi

# Verify EventBridge destination is attached and enabled
typeset sub_dest_out
sub_dest_out=$(aws sesv2 get-configuration-set-event-destinations \
  --configuration-set-name "$sub_cs" \
  --region "$REGION" \
  --output json 2>/dev/null)

if echo "$sub_dest_out" | jq -e '[.EventDestinations[] | select(.Name == "wraps-email-eventbridge" and .Enabled == true)] | length > 0' &>/dev/null; then
  pass "Per-domain config set has EventBridge destination enabled"
else
  fail "Per-domain config set missing enabled EventBridge destination"
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

# Idempotency: re-add the same subdomain after removal. The per-domain config set
# remains in AWS after identity deletion (domains remove does not delete config sets),
# so CreateConfigurationSetCommand + CreateConfigurationSetEventDestinationCommand
# both throw AlreadyExistsException — verify they are handled gracefully.
section "Phase 2c: domains add idempotency (re-add after removal)"
wraps email domains add \
  --domain "$SUBDOMAIN" \
  --region "$REGION" \
  --yes \
  --json

if aws sesv2 get-email-identity \
  --email-identity "$SUBDOMAIN" \
  --region "$REGION" &>/dev/null; then
  pass "Subdomain re-added successfully (config set AlreadyExists handled)"
else
  fail "Subdomain re-add failed"
fi

# Clean up: remove re-added subdomain + its orphaned config set
wraps email domains remove \
  --domain "$SUBDOMAIN" \
  --force \
  --json

aws sesv2 delete-configuration-set \
  --configuration-set-name "$sub_cs" \
  --region "$REGION" &>/dev/null || true

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
verify_events "$REGION" "$DOMAIN"
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
verify_events "$REGION" "$DOMAIN"
verify_iam_events_policy
verify_smtp
verify_console_access_role

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Phase 5: Reply threading end-to-end ─────────────────────────────
#
# Deploys inbound + reply-threading, then round-trips a real signed email
# through SES: sign a token locally → send to the r.mail.{DOMAIN} reply
# address → Lambda verifies → parsed JSON lands in S3 → assert status=valid
# and that conversationId/sendId round-trip exactly.

printf "\n${YELLOW}Phase 5: Reply threading (inbound + signed Reply-To round-trip)${NC}\n"

# 5a. Deploy inbound on the root domain (reply-threading is a prerequisite).
printf "${CYAN}  5a: Deploy inbound on ${DOMAIN}${NC}\n"
wraps email inbound init \
  --region "$REGION" \
  --root \
  --yes \
  --json
create_inbound_dns_records "$DOMAIN" "$REGION" "$DOMAIN"

# 5b. Enable reply-threading for the same domain.
printf "${CYAN}  5b: Enable reply-threading for ${DOMAIN}${NC}\n"
wraps email reply init \
  --domain "$DOMAIN" \
  --region "$REGION" \
  --yes \
  --json
create_inbound_dns_records "r.mail.${DOMAIN}" "$REGION" "$DOMAIN"

# 5c. Verify AWS resources
reset_counters
verify_reply_threading "$REGION" "$DOMAIN"
summary || { printf "${RED}Phase 5c FAILED${NC}\n"; exit 1; }

# 5d. CLI command smoke tests (status + decode)
printf "\n${YELLOW}Phase 5d: email reply status + decode${NC}\n"
reset_counters

section "Phase 5d: email reply status"
REPLY_STATUS=$(wraps email reply status --json --region "$REGION" 2>/dev/null | extract_json) || true

if echo "$REPLY_STATUS" | jq -e '.success == true' &>/dev/null; then
  pass "email reply status succeeds"
else
  fail "email reply status failed" "$REPLY_STATUS"
fi

if echo "$REPLY_STATUS" | jq -e --arg d "$DOMAIN" '[.data.domains[] | select(.domain == $d)] | length > 0' &>/dev/null; then
  pass "reply status lists $DOMAIN"
else
  fail "reply status missing $DOMAIN"
fi

if echo "$REPLY_STATUS" | jq -e --arg d "$DOMAIN" '.data.domains[] | select(.domain == $d) | .currentKid >= 1' &>/dev/null; then
  typeset status_kid
  status_kid=$(echo "$REPLY_STATUS" | jq -r --arg d "$DOMAIN" '.data.domains[] | select(.domain == $d) | .currentKid')
  pass "reply status reports currentKid=$status_kid"
else
  fail "reply status missing currentKid"
fi

summary || { printf "${RED}Phase 5d FAILED${NC}\n"; exit 1; }

# 5e. End-to-end signed round-trip
#
# Mint a token with the current SSM secret, send an email addressed to
# <token>@r.mail.{DOMAIN} via SES. The SES receipt rule stores the raw MIME
# in S3, the inbound-processor Lambda parses it and writes
# parsed/{emailId}.json with the verification result.
printf "\n${YELLOW}Phase 5e: End-to-end signed round-trip${NC}\n"
reset_counters

section "Phase 5e: mint + send + verify"

# Fetch the secret + kid from SSM (customer AWS — same account we just deployed to).
SSM_VALUE=$(aws ssm get-parameter \
  --name "/wraps/email/reply-secret/${DOMAIN}" \
  --with-decryption \
  --region "$REGION" \
  --query 'Parameter.Value' --output text 2>/dev/null)

if [[ -z "$SSM_VALUE" ]]; then
  fail "Could not read SSM reply-secret"
  summary || { printf "${RED}Phase 5e FAILED${NC}\n"; exit 1; }
else
  pass "Read SSM reply-secret"

  SECRET_B64=$(echo "$SSM_VALUE" | jq -r '.current')
  KID=$(echo "$SSM_VALUE" | jq -r '.kid')

  # Mint a signed token locally (pure node:crypto).
  TOKEN_OUT=$(REPLY_SECRET_B64="$SECRET_B64" REPLY_KID="$KID" \
    node "${SCRIPT_DIR}/sign-reply-token.mjs")
  TOKEN=$(echo "$TOKEN_OUT" | jq -r '.token')
  EXPECTED_CONV=$(echo "$TOKEN_OUT" | jq -r '.conversationId')
  EXPECTED_SEND=$(echo "$TOKEN_OUT" | jq -r '.sendId')

  if [[ ${#TOKEN} -eq 51 ]]; then
    pass "Minted 51-char signed token"
  else
    fail "Token has unexpected length ${#TOKEN} (expected 51)"
  fi

  REPLY_ADDRESS="${TOKEN}@r.mail.${DOMAIN}"
  INBOUND_BUCKET="wraps-inbound-${ACCOUNT_ID}-${REGION}"
  SUBJECT="reply-threading-test-$(date +%s)-$$"
  SEND_START=$(date -u +%s)

  # Send to the signed reply address. Sender is our verified domain so this
  # works in SES sandbox. The MX for r.mail.{DOMAIN} we just created delivers
  # the message straight back into our inbound receipt rule.
  if MESSAGE_ID=$(aws sesv2 send-email \
    --from-email-address "test@${DOMAIN}" \
    --destination "{\"ToAddresses\":[\"${REPLY_ADDRESS}\"]}" \
    --content "{\"Simple\":{\"Subject\":{\"Data\":\"${SUBJECT}\"},\"Body\":{\"Text\":{\"Data\":\"e2e reply threading test\"}}}}" \
    --configuration-set-name "$PRIMARY_CONFIG_SET_NAME" \
    --region "$REGION" \
    --query 'MessageId' --output text 2>&1); then
    pass "Sent email to ${REPLY_ADDRESS} (MessageId: ${MESSAGE_ID})"
  else
    fail "SES send failed" "$MESSAGE_ID"
    summary || { printf "${RED}Phase 5e FAILED${NC}\n"; exit 1; }
    exit 1
  fi

  # Poll S3 for the parsed object. SES inbound delivery + Lambda processing
  # is typically 15–45 s; we allow up to 3 min to tolerate cold starts.
  # We use grep to match the unique subject (sidesteps jq strict-mode choking
  # on control chars in email header values) and python3 to extract fields.
  printf "${CYAN}  Polling s3://${INBOUND_BUCKET}/parsed/ for subject '${SUBJECT}'...${NC}\n"
  typeset -i POLL_DEADLINE=$((SEND_START + 180))
  FOUND_JSON=""
  FOUND_KEY=""
  while (( $(date -u +%s) < POLL_DEADLINE )); do
    OBJECTS_JSON=$(aws s3api list-objects-v2 \
      --bucket "$INBOUND_BUCKET" \
      --prefix "parsed/" \
      --region "$REGION" \
      --output json 2>/dev/null || echo '{"Contents":[]}')

    for key in $(echo "$OBJECTS_JSON" | jq -r '.Contents[]?.Key'); do
      tmpfile=$(mktemp)
      aws s3api get-object \
        --bucket "$INBOUND_BUCKET" \
        --key "$key" \
        --region "$REGION" \
        "$tmpfile" &>/dev/null || { rm -f "$tmpfile"; continue; }
      if grep -qF "$SUBJECT" "$tmpfile"; then
        FOUND_JSON=$(cat "$tmpfile")
        FOUND_KEY="$key"
        rm -f "$tmpfile"
        break
      fi
      rm -f "$tmpfile"
    done

    [[ -n "$FOUND_JSON" ]] && break
    sleep 3
  done

  if [[ -z "$FOUND_JSON" ]]; then
    typeset -i elapsed=$(( $(date -u +%s) - SEND_START ))
    fail "Timeout after ${elapsed}s — no parsed email with subject '${SUBJECT}' found in S3"
  else
    typeset -i elapsed=$(( $(date -u +%s) - SEND_START ))
    pass "Found parsed email in S3 after ${elapsed}s (key: ${FOUND_KEY})"

    # Extract fields with python3 — more tolerant than jq for real-world MIME.
    EXTRACT=$(printf '%s' "$FOUND_JSON" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
rt = d.get('replyToken') or {}
print(rt.get('status', 'MISSING'))
print(rt.get('conversationId', 'MISSING'))
print(rt.get('sendId', 'MISSING'))
print('true' if d.get('autoReply') else 'false')
print(d.get('receivingDomain', 'MISSING'))
")
    GOT_STATUS=$(echo "$EXTRACT" | sed -n '1p')
    GOT_CONV=$(echo "$EXTRACT" | sed -n '2p')
    GOT_SEND=$(echo "$EXTRACT" | sed -n '3p')
    GOT_AUTO=$(echo "$EXTRACT" | sed -n '4p')
    GOT_DOMAIN=$(echo "$EXTRACT" | sed -n '5p')

    if [[ "$GOT_STATUS" == "valid" ]]; then
      pass "Lambda emitted replyToken.status = valid"
    else
      fail "replyToken.status expected 'valid', got '$GOT_STATUS'"
    fi

    if [[ "$GOT_CONV" == "$EXPECTED_CONV" ]]; then
      pass "conversationId round-trips ($EXPECTED_CONV)"
    else
      fail "conversationId mismatch — sent $EXPECTED_CONV, got $GOT_CONV"
    fi

    if [[ "$GOT_SEND" == "$EXPECTED_SEND" ]]; then
      pass "sendId round-trips"
    else
      fail "sendId mismatch — sent $EXPECTED_SEND, got $GOT_SEND"
    fi

    if [[ "$GOT_AUTO" == "false" ]]; then
      pass "autoReply correctly false (no Auto-Submitted header)"
    else
      fail "autoReply expected false, got $GOT_AUTO"
    fi

    if [[ "$GOT_DOMAIN" == "r.mail.${DOMAIN}" ]]; then
      pass "receivingDomain = r.mail.${DOMAIN}"
    else
      fail "receivingDomain expected r.mail.${DOMAIN}, got $GOT_DOMAIN"
    fi
  fi
fi

summary || { printf "${RED}Phase 5e FAILED${NC}\n"; exit 1; }

# 5f. Rotate secret → new kid, verify new tokens still round-trip.
printf "\n${YELLOW}Phase 5f: Rotate + round-trip with new kid${NC}\n"
reset_counters

section "Phase 5f: reply rotate"

OLD_KID="$KID"
ROTATE_OUT=$(wraps email reply rotate \
  --domain "$DOMAIN" \
  --region "$REGION" \
  --yes \
  --json 2>/dev/null | extract_json) || true

if echo "$ROTATE_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "email reply rotate succeeded"
else
  fail "email reply rotate failed" "$ROTATE_OUT"
fi

# Re-read SSM, assert new kid + previousKid.
SSM_VALUE_AFTER=$(aws ssm get-parameter \
  --name "/wraps/email/reply-secret/${DOMAIN}" \
  --with-decryption \
  --region "$REGION" \
  --query 'Parameter.Value' --output text 2>/dev/null)

NEW_KID=$(echo "$SSM_VALUE_AFTER" | jq -r '.kid')
STORED_PREV_KID=$(echo "$SSM_VALUE_AFTER" | jq -r '.previousKid // "null"')
NEW_SECRET_B64=$(echo "$SSM_VALUE_AFTER" | jq -r '.current')

if [[ "$NEW_KID" == "$((OLD_KID + 1))" ]]; then
  pass "SSM kid incremented $OLD_KID → $NEW_KID"
else
  fail "SSM kid did not increment (expected $((OLD_KID + 1)), got $NEW_KID)"
fi

if [[ "$STORED_PREV_KID" == "$OLD_KID" ]]; then
  pass "SSM blob carries previousKid=$OLD_KID"
else
  fail "SSM previousKid expected $OLD_KID, got $STORED_PREV_KID"
fi

# Send a fresh token signed with the NEW kid. The Lambda's 5-min cache holds
# the OLD value, so this forces a container with a cold cache to verify. In
# practice the existing container will re-fetch because cache TTL on the first
# send was set before rotation; a new S3 event picks up whichever Lambda
# container Amazon picks. Either way, the NEW secret must verify.
section "Phase 5f: round-trip with rotated kid"

# Wait BEFORE sending so any warm Lambda containers expire their pre-rotation
# secret cache (TTL is 5 min; +15s margin). Sending before the wait would let
# a warm container process the email with the old cache and return
# `invalid-signature`, since the new-kid token isn't in the old secrets map.
printf "${CYAN}  Waiting 5m15s for Lambda secret cache TTL to expire...${NC}\n"
sleep 315

TOKEN_OUT_2=$(REPLY_SECRET_B64="$NEW_SECRET_B64" REPLY_KID="$NEW_KID" \
  node "${SCRIPT_DIR}/sign-reply-token.mjs")
TOKEN_2=$(echo "$TOKEN_OUT_2" | jq -r '.token')
EXPECTED_CONV_2=$(echo "$TOKEN_OUT_2" | jq -r '.conversationId')
EXPECTED_SEND_2=$(echo "$TOKEN_OUT_2" | jq -r '.sendId')
REPLY_ADDRESS_2="${TOKEN_2}@r.mail.${DOMAIN}"
SUBJECT_2="reply-threading-rotate-test-$(date +%s)-$$"
SEND_START_2=$(date -u +%s)

aws sesv2 send-email \
  --from-email-address "test@${DOMAIN}" \
  --destination "{\"ToAddresses\":[\"${REPLY_ADDRESS_2}\"]}" \
  --content "{\"Simple\":{\"Subject\":{\"Data\":\"${SUBJECT_2}\"},\"Body\":{\"Text\":{\"Data\":\"rotate round-trip\"}}}}" \
  --configuration-set-name "$PRIMARY_CONFIG_SET_NAME" \
  --region "$REGION" \
  --query 'MessageId' --output text &>/dev/null

# Poll S3 for the second parsed object (grep + python3 for same reasons as 5e).
typeset -i POLL_DEADLINE_2=$(( $(date -u +%s) + 180 ))
FOUND_JSON_2=""
while (( $(date -u +%s) < POLL_DEADLINE_2 )); do
  OBJECTS_JSON_2=$(aws s3api list-objects-v2 \
    --bucket "$INBOUND_BUCKET" \
    --prefix "parsed/" \
    --region "$REGION" \
    --output json 2>/dev/null || echo '{"Contents":[]}')

  for key in $(echo "$OBJECTS_JSON_2" | jq -r '.Contents[]?.Key'); do
    tmpfile=$(mktemp)
    aws s3api get-object \
      --bucket "$INBOUND_BUCKET" \
      --key "$key" \
      --region "$REGION" \
      "$tmpfile" &>/dev/null || { rm -f "$tmpfile"; continue; }
    if grep -qF "$SUBJECT_2" "$tmpfile"; then
      FOUND_JSON_2=$(cat "$tmpfile")
      rm -f "$tmpfile"
      break
    fi
    rm -f "$tmpfile"
  done

  [[ -n "$FOUND_JSON_2" ]] && break
  sleep 3
done

if [[ -z "$FOUND_JSON_2" ]]; then
  fail "Timeout waiting for rotated-kid parsed email"
else
  pass "Found parsed email signed with new kid $NEW_KID"

  EXTRACT_2=$(printf '%s' "$FOUND_JSON_2" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
rt = d.get('replyToken') or {}
print(rt.get('status', 'MISSING'))
print(rt.get('conversationId', 'MISSING'))
print(rt.get('sendId', 'MISSING'))
")
  GOT_STATUS_2=$(echo "$EXTRACT_2" | sed -n '1p')
  GOT_CONV_2=$(echo "$EXTRACT_2" | sed -n '2p')
  GOT_SEND_2=$(echo "$EXTRACT_2" | sed -n '3p')

  if [[ "$GOT_STATUS_2" == "valid" ]]; then
    pass "Rotated kid: replyToken.status = valid"
  else
    fail "Rotated kid: expected status=valid, got $GOT_STATUS_2"
  fi

  if [[ "$GOT_CONV_2" == "$EXPECTED_CONV_2" ]]; then
    pass "Rotated kid: conversationId round-trips"
  else
    fail "Rotated kid: conversationId mismatch"
  fi

  if [[ "$GOT_SEND_2" == "$EXPECTED_SEND_2" ]]; then
    pass "Rotated kid: sendId round-trips"
  else
    fail "Rotated kid: sendId mismatch"
  fi
fi

summary || { printf "${RED}Phase 5f FAILED${NC}\n"; exit 1; }

# 5g. Cleanup reply-threading + inbound so main teardown starts from a
# known baseline. The final `wraps email destroy` below is belt-and-braces.
printf "\n${YELLOW}Phase 5g: Cleanup reply-threading + inbound${NC}\n"

wraps email reply destroy \
  --domain "$DOMAIN" \
  --region "$REGION" \
  --force \
  --json || true
delete_inbound_dns_records "r.mail.${DOMAIN}" "$DOMAIN"

wraps email inbound destroy \
  --region "$REGION" \
  --force \
  --json || true
delete_inbound_dns_records "$DOMAIN" "$DOMAIN"

# ─── Teardown ─────────────────────────────────────────────────────────
# The trap handles destroy on failure. This section runs the explicit teardown
# with post-destroy verification (doctor check) on the happy path.

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

pre_teardown_rename_archive

# Disable the trap — we're handling destroy explicitly now
trap - EXIT

wraps email destroy \
  --region "$REGION" \
  --force \
  --json

reset_counters
verify_teardown "$DOMAIN" "$REGION" "$PRIMARY_CONFIG_SET_NAME"

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
