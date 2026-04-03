#!/usr/bin/env zsh
# CloudFormation deployment verification test
# Deploys via CFN template through 5 phases, verifying resources at each step

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

export AWS_PROFILE="$AWS_PROFILE_CFN"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

DOMAIN="$WRAPS_TEST_DOMAIN"
REGION="$WRAPS_TEST_REGION"
STACK_NAME="WrapsDeploymentTest"
TEMPLATE="$ROOT_DIR/../../cloudformation/wraps-email-infrastructure.yaml"

# Get AWS account ID for webhook endpoint
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Always destroy infrastructure on exit to avoid orphaned resources
cleanup_on_exit() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    printf "\n${RED}Test failed (exit %d) — destroying resources to avoid orphans${NC}\n" "$exit_code"
    aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true
    aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup_on_exit EXIT

printf "\n%s\n" "============================================"
printf "  CloudFormation Deployment Test\n"
printf "  Domain: %s  Region: %s\n" "$DOMAIN" "$REGION"
printf "  Profile: %s  Account: %s\n" "$AWS_PROFILE" "$AWS_ACCOUNT_ID"
printf "%s\n\n" "============================================"

cfn_deploy() {
  aws cloudformation deploy \
    --template-file "$TEMPLATE" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides "$@" \
    --region "$REGION"
}

# ─── CFN-Specific Verification Functions ─────────────────────────────

# CFN puts DynamoDB on the main role but EventBridge/SQS on separate roles,
# so the shared verify_iam_events_policy (which checks all three) doesn't apply.
verify_iam_events_policy_cfn() {
  section "IAM (CFN): Main role conditional statements (events enabled)"

  local policies_list
  if policies_list=$(aws_check iam list-role-policies --role-name wraps-email-role); then
    local policy_name
    policy_name=$(echo "$policies_list" | jq -r '.PolicyNames[0]')
    local policy_doc
    policy_doc=$(aws iam get-role-policy --role-name wraps-email-role --policy-name "$policy_name" 2>/dev/null)
    local policy_text
    policy_text=$(echo "$policy_doc" | jq -r '.PolicyDocument')

    # DynamoDB access should be present when history storage is enabled
    if echo "$policy_text" | grep -q 'dynamodb:PutItem'; then
      pass "IAM policy has DynamoDB access (history storage)"
    else
      fail "IAM policy missing DynamoDB access"
    fi

    if echo "$policy_text" | grep -q 'dynamodb:Query'; then
      pass "IAM policy has dynamodb:Query"
    else
      fail "IAM policy missing dynamodb:Query"
    fi
  else
    fail "Could not list IAM role policies" "$policies_list"
  fi
}

verify_webhook_cfn() {
  local region="${1:-us-east-1}"

  section "Webhook (CFN): EventBridge Connection"

  local conn_output
  if conn_output=$(aws_check events describe-connection \
    --name wraps-webhook-connection \
    --region "$region"); then
    pass "EventBridge connection wraps-webhook-connection exists"

    local auth_type
    auth_type=$(echo "$conn_output" | jq -r '.AuthorizationType // "NONE"')
    if [[ "$auth_type" == "API_KEY" ]]; then
      pass "Connection auth type: API_KEY"
    else
      fail "Connection auth type: expected API_KEY, got $auth_type"
    fi

    local conn_state
    conn_state=$(echo "$conn_output" | jq -r '.ConnectionState // "UNKNOWN"')
    if [[ "$conn_state" == "AUTHORIZED" || "$conn_state" == "AUTHORIZING" || "$conn_state" == "CREATING" ]]; then
      pass "Connection state: $conn_state"
    else
      fail "Connection state: unexpected $conn_state"
    fi
  else
    fail "EventBridge connection wraps-webhook-connection not found" "$conn_output"
  fi

  section "Webhook (CFN): API Destination"

  local dest_output
  if dest_output=$(aws_check events describe-api-destination \
    --name wraps-webhook-destination \
    --region "$region"); then
    pass "API destination wraps-webhook-destination exists"

    local http_method
    http_method=$(echo "$dest_output" | jq -r '.HttpMethod // "NONE"')
    if [[ "$http_method" == "POST" ]]; then
      pass "API destination method: POST"
    else
      fail "API destination method: expected POST, got $http_method"
    fi

    local endpoint
    endpoint=$(echo "$dest_output" | jq -r '.InvocationEndpoint // ""')
    if [[ "$endpoint" == *"$AWS_ACCOUNT_ID"* ]]; then
      pass "API destination endpoint contains account ID"
    else
      fail "API destination endpoint doesn't contain account ID: $endpoint"
    fi

    local rate_limit
    rate_limit=$(echo "$dest_output" | jq -r '.InvocationRateLimitPerSecond // 0')
    if (( rate_limit > 0 )); then
      pass "API destination rate limit: $rate_limit/s"
    else
      fail "API destination rate limit not set"
    fi
  else
    fail "API destination wraps-webhook-destination not found" "$dest_output"
  fi

  section "Webhook (CFN): EventBridge Rule (separate webhook rule)"

  local rule_output
  if rule_output=$(aws_check events describe-rule \
    --name wraps-email-events-to-webhook \
    --region "$region"); then
    pass "EventBridge rule wraps-email-events-to-webhook exists"

    local pattern
    pattern=$(echo "$rule_output" | jq -r '.EventPattern // ""')
    if echo "$pattern" | grep -q 'aws.ses'; then
      pass "Webhook rule matches aws.ses events"
    else
      fail "Webhook rule pattern doesn't match aws.ses"
    fi

    local rule_state
    rule_state=$(echo "$rule_output" | jq -r '.State // "DISABLED"')
    if [[ "$rule_state" == "ENABLED" ]]; then
      pass "Webhook rule is ENABLED"
    else
      fail "Webhook rule state: expected ENABLED, got $rule_state"
    fi

    # Check target points to API destination with a role ARN
    local targets_output
    targets_output=$(aws events list-targets-by-rule \
      --rule wraps-email-events-to-webhook \
      --region "$region" 2>/dev/null)
    local target_count
    target_count=$(echo "$targets_output" | jq '.Targets | length')
    if (( target_count > 0 )); then
      pass "Webhook rule has $target_count target(s)"

      if echo "$targets_output" | jq -e '.Targets[] | select(.RoleArn)' &>/dev/null; then
        pass "Webhook target has RoleArn"
      else
        fail "Webhook target missing RoleArn"
      fi
    else
      fail "Webhook rule has no targets"
    fi
  else
    fail "EventBridge rule wraps-email-events-to-webhook not found" "$rule_output"
  fi

  section "Webhook (CFN): IAM Role"

  local webhook_role
  if webhook_role=$(aws_check iam get-role --role-name wraps-email-webhook-role); then
    pass "IAM role wraps-email-webhook-role exists"

    if echo "$webhook_role" | jq -e '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.Service == "events.amazonaws.com")' &>/dev/null; then
      pass "Webhook role trusts events.amazonaws.com"
    else
      fail "Webhook role missing events.amazonaws.com trust"
    fi
  else
    fail "IAM role wraps-email-webhook-role not found" "$webhook_role"
  fi
}

verify_alerting() {
  local region="${1:-us-east-1}"
  local events_enabled="${2:-true}"

  section "CFN: Alerting Resources"

  # SNS topic
  local topic_arn
  topic_arn=$(aws sns list-topics --region "$region" --query "Topics[?ends_with(TopicArn, ':wraps-email-alerts')].TopicArn | [0]" --output text 2>/dev/null)
  if [[ "$topic_arn" != "None" && -n "$topic_arn" ]]; then
    pass "SNS topic wraps-email-alerts exists"
  else
    fail "SNS topic wraps-email-alerts not found"
  fi

  # CloudWatch alarms
  for alarm_name in wraps-email-bounce-rate-warning wraps-email-complaint-rate-warning wraps-email-complaint-rate-critical; do
    if aws cloudwatch describe-alarms \
      --alarm-names "$alarm_name" \
      --region "$region" \
      --query 'MetricAlarms[0].AlarmName' --output text 2>/dev/null | grep -q "$alarm_name"; then
      pass "CloudWatch alarm $alarm_name exists"
    else
      fail "CloudWatch alarm $alarm_name not found"
    fi
  done

  # DLQ alarm (only when both alerting AND event tracking enabled)
  if [[ "$events_enabled" == "true" ]]; then
    if aws cloudwatch describe-alarms \
      --alarm-names wraps-email-dlq-messages \
      --region "$region" \
      --query 'MetricAlarms[0].AlarmName' --output text 2>/dev/null | grep -q 'wraps-email-dlq-messages'; then
      pass "CloudWatch alarm wraps-email-dlq-messages exists (events+alerting)"
    else
      fail "CloudWatch alarm wraps-email-dlq-messages not found"
    fi
  fi
}

# ─── Phase 1: Base deploy (domain + events disabled) ────────────────

printf "${YELLOW}Phase 1: Base deploy (domain only, no events)${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=false" \
  "EnableHistoryStorage=false"

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
if aws lambda get-function --function-name wraps-email-event-processor --region "$REGION" &>/dev/null; then
  fail "Lambda function should not exist"
else
  pass "No Lambda function (expected)"
fi
if aws events describe-rule --name wraps-email-events-to-sqs --region "$REGION" &>/dev/null; then
  fail "EventBridge rule should not exist"
else
  pass "No EventBridge rule wraps-email-events-to-sqs (expected)"
fi

summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }

# ─── Phase 2: Enable events + history ───────────────────────────────

printf "\n${YELLOW}Phase 2: Enable events + history${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=true" \
  "EnableHistoryStorage=true" \
  "HistoryRetentionDays=90"

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy_cfn
verify_console_access_role

section "Phase 2: Verify no SMTP"
if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
  fail "SMTP user should not exist"
else
  pass "No SMTP user (expected)"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Add SMTP ──────────────────────────────────────────────

printf "\n${YELLOW}Phase 3: Add SMTP${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=true" \
  "EnableHistoryStorage=true" \
  "HistoryRetentionDays=90" \
  "EnableSMTP=true"

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy_cfn
verify_smtp
verify_console_access_role

summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }

# ─── Phase 4: Add webhook ───────────────────────────────────────────

printf "\n${YELLOW}Phase 4: Add webhook${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=true" \
  "EnableHistoryStorage=true" \
  "HistoryRetentionDays=90" \
  "EnableSMTP=true" \
  "WrapsWebhookSecret=test-webhook-secret-key"

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy_cfn
verify_smtp
verify_webhook_cfn "$REGION"
verify_console_access_role

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Phase 5: Add alerting + archiving ──────────────────────────────

printf "\n${YELLOW}Phase 5: Add alerting + archiving${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=true" \
  "EnableHistoryStorage=true" \
  "HistoryRetentionDays=90" \
  "EnableSMTP=true" \
  "WrapsWebhookSecret=test-webhook-secret-key" \
  "EnableAlerting=true" \
  "EnableEmailArchiving=true"

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy_cfn
verify_smtp
verify_webhook_cfn "$REGION"
verify_console_access_role
verify_alerting "$REGION" "true"
verify_archiving

summary || { printf "${RED}Phase 5 FAILED${NC}\n"; exit 1; }

# ─── Phase 6: Idempotent re-deploy ──────────────────────────────────

printf "\n${YELLOW}Phase 6: Idempotent re-deploy (same config)${NC}\n"

cfn_deploy \
  "Domain=$DOMAIN" \
  "EnableEventTracking=true" \
  "EnableHistoryStorage=true" \
  "HistoryRetentionDays=90" \
  "EnableSMTP=true" \
  "WrapsWebhookSecret=test-webhook-secret-key" \
  "EnableAlerting=true" \
  "EnableEmailArchiving=true"

reset_counters
verify_base "$DOMAIN" "$REGION"
verify_events "$REGION"
verify_iam_events_policy_cfn
verify_smtp
verify_webhook_cfn "$REGION"
verify_console_access_role
verify_alerting "$REGION" "true"
verify_archiving

summary || { printf "${RED}Phase 6 FAILED${NC}\n"; exit 1; }

# ─── Teardown ────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

pre_teardown_rename_archive

trap - EXIT
aws cloudformation delete-stack \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

aws cloudformation wait stack-delete-complete \
  --stack-name "$STACK_NAME" \
  --region "$REGION"

reset_counters
verify_teardown "$DOMAIN" "$REGION"

section "Teardown: CFN-specific resources"

# Webhook IAM role
if aws iam get-role --role-name wraps-email-webhook-role &>/dev/null; then
  fail "IAM role wraps-email-webhook-role still exists"
else
  pass "IAM role wraps-email-webhook-role removed"
fi

# SNS topic
typeset topic_arn
topic_arn=$(aws sns list-topics --region "$REGION" --query "Topics[?ends_with(TopicArn, ':wraps-email-alerts')].TopicArn | [0]" --output text 2>/dev/null)
if [[ "$topic_arn" != "None" && -n "$topic_arn" ]]; then
  fail "SNS topic wraps-email-alerts still exists"
else
  pass "SNS topic wraps-email-alerts removed"
fi

# CloudWatch alarms
for alarm_name in wraps-email-bounce-rate-warning wraps-email-complaint-rate-warning wraps-email-complaint-rate-critical wraps-email-dlq-messages; do
  if aws cloudwatch describe-alarms \
    --alarm-names "$alarm_name" \
    --region "$REGION" \
    --query 'MetricAlarms[0].AlarmName' --output text 2>/dev/null | grep -q "$alarm_name"; then
    fail "CloudWatch alarm $alarm_name still exists"
  else
    pass "CloudWatch alarm $alarm_name removed"
  fi
done

# Webhook EventBridge rule (CFN-specific separate rule)
if aws events describe-rule \
  --name wraps-email-events-to-webhook \
  --region "$REGION" &>/dev/null; then
  fail "EventBridge rule wraps-email-events-to-webhook still exists"
else
  pass "EventBridge rule wraps-email-events-to-webhook removed"
fi

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}CloudFormation deployment test PASSED${NC}\n"
