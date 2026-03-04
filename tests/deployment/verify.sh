#!/usr/bin/env zsh
# Shared AWS CLI verification functions for deployment tests
# Source this file to use verify_base, verify_events, verify_smtp, verify_teardown

set -euo pipefail

# Colors
typeset -r GREEN='\033[0;32m'
typeset -r RED='\033[0;31m'
typeset -r YELLOW='\033[0;33m'
typeset -r CYAN='\033[0;36m'
typeset -r NC='\033[0m'

# Counters
typeset -i PASS_COUNT=0
typeset -i FAIL_COUNT=0

pass() {
  PASS_COUNT+=1
  printf "${GREEN}  PASS${NC} %s\n" "$1"
}

fail() {
  FAIL_COUNT+=1
  printf "${RED}  FAIL${NC} %s\n" "$1"
  [[ -n "${2:-}" ]] && printf "       %s\n" "$2"
}

section() {
  printf "\n${CYAN}--- %s ---${NC}\n" "$1"
}

summary() {
  printf "\n${CYAN}=== Results ===${NC}\n"
  printf "${GREEN}  Passed: %d${NC}\n" "$PASS_COUNT"
  if (( FAIL_COUNT > 0 )); then
    printf "${RED}  Failed: %d${NC}\n" "$FAIL_COUNT"
    return 1
  else
    printf "  All checks passed.\n"
    return 0
  fi
}

reset_counters() {
  PASS_COUNT=0
  FAIL_COUNT=0
}

# Helper: run AWS CLI command, capture stdout+stderr, return exit code
aws_check() {
  local output
  output=$(aws "$@" 2>&1) && echo "$output" && return 0 || return 1
}

# ─── Base Verification ───────────────────────────────────────────────

verify_base() {
  local domain="${1:?domain required}"
  local region="${2:-us-east-1}"

  section "Base: IAM Role"

  local role_output
  if role_output=$(aws_check iam get-role --role-name wraps-email-role); then
    pass "IAM role wraps-email-role exists"

    # Check ManagedBy tag
    if echo "$role_output" | jq -e '.Role.Tags[] | select(.Key=="ManagedBy")' &>/dev/null; then
      pass "IAM role has ManagedBy tag"
    else
      fail "IAM role missing ManagedBy tag"
    fi

    # Check trust policy has sts:AssumeRoleWithWebIdentity (OIDC) or sts:AssumeRole
    if echo "$role_output" | jq -e '.Role.AssumeRolePolicyDocument.Statement[].Action' | grep -q 'AssumeRole'; then
      pass "IAM role trust policy allows AssumeRole"
    else
      fail "IAM role trust policy missing AssumeRole action"
    fi
  else
    fail "IAM role wraps-email-role not found" "$role_output"
  fi

  # Check inline policy (name may have Pulumi suffix)
  local policies_list
  if policies_list=$(aws_check iam list-role-policies --role-name wraps-email-role); then
    local policy_name
    policy_name=$(echo "$policies_list" | jq -r '.PolicyNames[0] // ""')
    if [[ -n "$policy_name" && "$policy_name" == wraps-email-policy* ]]; then
      pass "IAM inline policy exists: $policy_name"

      local policy_output
      policy_output=$(aws iam get-role-policy --role-name wraps-email-role --policy-name "$policy_name" 2>/dev/null)
      if echo "$policy_output" | jq -r '.PolicyDocument' | grep -q 'ses:'; then
        pass "IAM policy has SES permissions"
      else
        fail "IAM policy missing SES permissions"
      fi
    else
      fail "IAM inline policy not found or unexpected name: $policy_name"
    fi
  else
    fail "Could not list IAM role policies" "$policies_list"
  fi

  section "Base: SES Configuration Set"

  local ses_output
  if ses_output=$(aws_check sesv2 get-configuration-set \
    --configuration-set-name wraps-email-tracking \
    --region "$region"); then
    pass "SES config set wraps-email-tracking exists"

    # Check sending is enabled
    if echo "$ses_output" | jq -e '.SendingOptions.SendingEnabled' &>/dev/null; then
      pass "SES config set sending enabled"
    else
      fail "SES config set sending not enabled"
    fi

    # Check suppression
    if echo "$ses_output" | jq -e '.SuppressionOptions.SuppressedReasons[]' 2>/dev/null | grep -q 'BOUNCE\|COMPLAINT'; then
      pass "SES config set has suppression list (BOUNCE/COMPLAINT)"
    else
      fail "SES config set missing suppression list"
    fi
  else
    fail "SES config set wraps-email-tracking not found" "$ses_output"
  fi

  section "Base: SES Domain Identity"

  local identity_output
  if identity_output=$(aws_check sesv2 get-email-identity \
    --email-identity "$domain" \
    --region "$region"); then
    pass "SES email identity $domain exists"

    # Check DKIM
    local dkim_status
    dkim_status=$(echo "$identity_output" | jq -r '.DkimAttributes.Status // "NONE"')
    if [[ "$dkim_status" == "SUCCESS" || "$dkim_status" == "PENDING" ]]; then
      pass "SES DKIM status: $dkim_status"
    else
      fail "SES DKIM status unexpected: $dkim_status"
    fi

    # Check config set linkage
    local linked_config
    linked_config=$(echo "$identity_output" | jq -r '.ConfigurationSetName // "NONE"')
    if [[ "$linked_config" == "wraps-email-tracking" ]]; then
      pass "SES identity linked to wraps-email-tracking config set"
    else
      fail "SES identity config set: expected wraps-email-tracking, got $linked_config"
    fi
  else
    fail "SES email identity $domain not found" "$identity_output"
  fi
}

# ─── Events Verification ─────────────────────────────────────────────

verify_events() {
  local region="${1:-us-east-1}"

  section "Events: DynamoDB Table"

  local table_output
  if table_output=$(aws_check dynamodb describe-table \
    --table-name wraps-email-history \
    --region "$region"); then
    pass "DynamoDB table wraps-email-history exists"

    # Billing mode
    local billing
    billing=$(echo "$table_output" | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')
    if [[ "$billing" == "PAY_PER_REQUEST" ]]; then
      pass "DynamoDB billing: PAY_PER_REQUEST"
    else
      fail "DynamoDB billing: expected PAY_PER_REQUEST, got $billing"
    fi

    # Key schema
    if echo "$table_output" | jq -e '.Table.KeySchema[] | select(.AttributeName=="messageId" and .KeyType=="HASH")' &>/dev/null; then
      pass "DynamoDB hash key: messageId"
    else
      fail "DynamoDB hash key not messageId"
    fi

    if echo "$table_output" | jq -e '.Table.KeySchema[] | select(.AttributeName=="sentAt" and .KeyType=="RANGE")' &>/dev/null; then
      pass "DynamoDB range key: sentAt"
    else
      fail "DynamoDB range key not sentAt"
    fi

    # TTL
    local ttl_output
    if ttl_output=$(aws_check dynamodb describe-time-to-live \
      --table-name wraps-email-history \
      --region "$region"); then
      local ttl_attr
      ttl_attr=$(echo "$ttl_output" | jq -r '.TimeToLiveDescription.AttributeName // "NONE"')
      if [[ "$ttl_attr" == "expiresAt" ]]; then
        pass "DynamoDB TTL on expiresAt"
      else
        fail "DynamoDB TTL attribute: expected expiresAt, got $ttl_attr"
      fi
    fi

    # GSI
    if echo "$table_output" | jq -e '.Table.GlobalSecondaryIndexes[] | select(.IndexName=="accountId-sentAt-index")' &>/dev/null; then
      pass "DynamoDB GSI accountId-sentAt-index exists"
    else
      fail "DynamoDB GSI accountId-sentAt-index not found"
    fi
  else
    fail "DynamoDB table wraps-email-history not found" "$table_output"
  fi

  section "Events: SQS Queues"

  # Main queue
  local queue_url
  if queue_url=$(aws sqs get-queue-url \
    --queue-name wraps-email-events \
    --region "$region" \
    --query 'QueueUrl' --output text 2>/dev/null); then
    pass "SQS queue wraps-email-events exists"

    local queue_attrs
    queue_attrs=$(aws sqs get-queue-attributes \
      --queue-url "$queue_url" \
      --attribute-names All \
      --region "$region" 2>/dev/null)

    local vis_timeout
    vis_timeout=$(echo "$queue_attrs" | jq -r '.Attributes.VisibilityTimeout // "0"')
    if [[ "$vis_timeout" == "60" ]]; then
      pass "SQS visibility timeout: 60s"
    else
      fail "SQS visibility timeout: expected 60, got $vis_timeout"
    fi

    local retention
    retention=$(echo "$queue_attrs" | jq -r '.Attributes.MessageRetentionPeriod // "0"')
    if [[ "$retention" == "345600" ]]; then
      pass "SQS retention: 4 days (345600s)"
    else
      fail "SQS retention: expected 345600, got $retention"
    fi

    # Check redrive policy points to DLQ
    if echo "$queue_attrs" | jq -r '.Attributes.RedrivePolicy // ""' | grep -q 'wraps-email-events-dlq'; then
      pass "SQS redrive policy targets DLQ"
    else
      fail "SQS redrive policy not targeting DLQ"
    fi
  else
    fail "SQS queue wraps-email-events not found"
  fi

  # DLQ
  local dlq_url
  if dlq_url=$(aws sqs get-queue-url \
    --queue-name wraps-email-events-dlq \
    --region "$region" \
    --query 'QueueUrl' --output text 2>/dev/null); then
    pass "SQS DLQ wraps-email-events-dlq exists"

    local dlq_attrs
    dlq_attrs=$(aws sqs get-queue-attributes \
      --queue-url "$dlq_url" \
      --attribute-names MessageRetentionPeriod \
      --region "$region" 2>/dev/null)

    local dlq_retention
    dlq_retention=$(echo "$dlq_attrs" | jq -r '.Attributes.MessageRetentionPeriod // "0"')
    if [[ "$dlq_retention" == "1209600" ]]; then
      pass "SQS DLQ retention: 14 days (1209600s)"
    else
      fail "SQS DLQ retention: expected 1209600, got $dlq_retention"
    fi
  else
    fail "SQS DLQ wraps-email-events-dlq not found"
  fi

  section "Events: Lambda Function"

  local lambda_output
  if lambda_output=$(aws_check lambda get-function \
    --function-name wraps-email-event-processor \
    --region "$region"); then
    pass "Lambda wraps-email-event-processor exists"

    local runtime
    runtime=$(echo "$lambda_output" | jq -r '.Configuration.Runtime')
    if [[ "$runtime" == nodejs* ]]; then
      pass "Lambda runtime: $runtime"
    else
      fail "Lambda runtime: expected nodejs*, got $runtime"
    fi

    local memory
    memory=$(echo "$lambda_output" | jq -r '.Configuration.MemorySize')
    if [[ "$memory" == "512" ]]; then
      pass "Lambda memory: 512 MB"
    else
      fail "Lambda memory: expected 512, got $memory"
    fi

    # Check env vars
    local env_vars
    env_vars=$(echo "$lambda_output" | jq -r '.Configuration.Environment.Variables // {}')
    if echo "$env_vars" | jq -e '.TABLE_NAME' &>/dev/null; then
      pass "Lambda has TABLE_NAME env var"
    else
      fail "Lambda missing TABLE_NAME env var"
    fi

    if echo "$env_vars" | jq -e '.RETENTION_DAYS' &>/dev/null; then
      pass "Lambda has RETENTION_DAYS env var"
    else
      fail "Lambda missing RETENTION_DAYS env var"
    fi
  else
    fail "Lambda wraps-email-event-processor not found" "$lambda_output"
  fi

  # Event source mapping
  local esm_output
  if esm_output=$(aws_check lambda list-event-source-mappings \
    --function-name wraps-email-event-processor \
    --region "$region"); then
    local esm_count
    esm_count=$(echo "$esm_output" | jq '.EventSourceMappings | length')
    if (( esm_count > 0 )); then
      pass "Lambda has SQS event source mapping"

      local batch_size
      batch_size=$(echo "$esm_output" | jq -r '.EventSourceMappings[0].BatchSize')
      if [[ "$batch_size" == "10" ]]; then
        pass "Lambda batch size: 10"
      else
        fail "Lambda batch size: expected 10, got $batch_size"
      fi
    else
      fail "Lambda has no event source mappings"
    fi
  fi

  section "Events: EventBridge Rule"

  local rule_output
  if rule_output=$(aws_check events describe-rule \
    --name wraps-email-events-to-sqs \
    --region "$region"); then
    pass "EventBridge rule wraps-email-events-to-sqs exists"

    local pattern
    pattern=$(echo "$rule_output" | jq -r '.EventPattern // ""')
    if echo "$pattern" | grep -q 'aws.ses'; then
      pass "EventBridge rule matches aws.ses events"
    else
      fail "EventBridge rule pattern doesn't match aws.ses"
    fi
  else
    fail "EventBridge rule wraps-email-events-to-sqs not found" "$rule_output"
  fi
}

# ─── SMTP Verification ───────────────────────────────────────────────

verify_smtp() {
  section "SMTP: IAM User"

  local user_output
  if user_output=$(aws_check iam get-user --user-name wraps-email-smtp-user); then
    pass "IAM user wraps-email-smtp-user exists"

    # Check tags
    if echo "$user_output" | jq -e '.User.Tags[] | select(.Key=="ManagedBy")' &>/dev/null; then
      pass "IAM SMTP user has ManagedBy tag"
    else
      fail "IAM SMTP user missing ManagedBy tag"
    fi
  else
    fail "IAM user wraps-email-smtp-user not found" "$user_output"
  fi

  # Check inline policy
  local policies_output
  if policies_output=$(aws_check iam list-user-policies --user-name wraps-email-smtp-user); then
    local policy_count
    policy_count=$(echo "$policies_output" | jq '.PolicyNames | length')
    if (( policy_count > 0 )); then
      pass "IAM SMTP user has inline policy"

      local policy_name
      policy_name=$(echo "$policies_output" | jq -r '.PolicyNames[0]')
      local smtp_policy
      smtp_policy=$(aws iam get-user-policy \
        --user-name wraps-email-smtp-user \
        --policy-name "$policy_name" 2>/dev/null)
      if echo "$smtp_policy" | jq -r '.PolicyDocument' | grep -q 'ses:SendRawEmail'; then
        pass "SMTP policy has ses:SendRawEmail permission"
      else
        fail "SMTP policy missing ses:SendRawEmail permission"
      fi
    else
      fail "IAM SMTP user has no inline policies"
    fi
  else
    fail "Could not list SMTP user policies" "$policies_output"
  fi
}

# ─── Teardown Verification ───────────────────────────────────────────

verify_teardown() {
  local domain="${1:?domain required}"
  local region="${2:-us-east-1}"

  section "Teardown: Verify Resources Removed"

  # IAM Role
  if aws iam get-role --role-name wraps-email-role &>/dev/null; then
    fail "IAM role wraps-email-role still exists"
  else
    pass "IAM role wraps-email-role removed"
  fi

  # Lambda role
  if aws iam get-role --role-name wraps-email-lambda-role &>/dev/null; then
    fail "IAM role wraps-email-lambda-role still exists"
  else
    pass "IAM role wraps-email-lambda-role removed"
  fi

  # SES config set
  if aws sesv2 get-configuration-set \
    --configuration-set-name wraps-email-tracking \
    --region "$region" &>/dev/null; then
    fail "SES config set wraps-email-tracking still exists"
  else
    pass "SES config set wraps-email-tracking removed"
  fi

  # SES domain identity
  if aws sesv2 get-email-identity \
    --email-identity "$domain" \
    --region "$region" &>/dev/null; then
    fail "SES email identity $domain still exists"
  else
    pass "SES email identity $domain removed"
  fi

  # DynamoDB
  if aws dynamodb describe-table \
    --table-name wraps-email-history \
    --region "$region" &>/dev/null; then
    fail "DynamoDB table wraps-email-history still exists"
  else
    pass "DynamoDB table wraps-email-history removed"
  fi

  # SQS queues
  if aws sqs get-queue-url \
    --queue-name wraps-email-events \
    --region "$region" &>/dev/null; then
    fail "SQS queue wraps-email-events still exists"
  else
    pass "SQS queue wraps-email-events removed"
  fi

  if aws sqs get-queue-url \
    --queue-name wraps-email-events-dlq \
    --region "$region" &>/dev/null; then
    fail "SQS DLQ wraps-email-events-dlq still exists"
  else
    pass "SQS DLQ wraps-email-events-dlq removed"
  fi

  # Lambda
  if aws lambda get-function \
    --function-name wraps-email-event-processor \
    --region "$region" &>/dev/null; then
    fail "Lambda wraps-email-event-processor still exists"
  else
    pass "Lambda wraps-email-event-processor removed"
  fi

  # EventBridge rule
  if aws events describe-rule \
    --name wraps-email-events-to-sqs \
    --region "$region" &>/dev/null; then
    fail "EventBridge rule wraps-email-events-to-sqs still exists"
  else
    pass "EventBridge rule wraps-email-events-to-sqs removed"
  fi

  # SMTP user
  if aws iam get-user --user-name wraps-email-smtp-user &>/dev/null; then
    fail "IAM user wraps-email-smtp-user still exists"
  else
    pass "IAM user wraps-email-smtp-user removed"
  fi
}
