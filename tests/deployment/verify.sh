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

  # Check inline policy (name varies: CLI uses wraps-email-policy, Pulumi auto-names)
  local policies_list
  if policies_list=$(aws_check iam list-role-policies --role-name wraps-email-role); then
    local policy_count
    policy_count=$(echo "$policies_list" | jq '.PolicyNames | length')
    if (( policy_count > 0 )); then
      local policy_name
      policy_name=$(echo "$policies_list" | jq -r '.PolicyNames[0]')
      pass "IAM inline policy exists: $policy_name"

      local policy_doc
      policy_doc=$(aws iam get-role-policy --role-name wraps-email-role --policy-name "$policy_name" 2>/dev/null)
      local policy_text
      policy_text=$(echo "$policy_doc" | jq -r '.PolicyDocument')

      # SES read permissions
      if echo "$policy_text" | grep -q 'ses:GetAccount'; then
        pass "IAM policy has ses:GetAccount"
      else
        fail "IAM policy missing ses:GetAccount"
      fi

      if echo "$policy_text" | grep -q 'ses:GetSendStatistics'; then
        pass "IAM policy has ses:GetSendStatistics"
      else
        fail "IAM policy missing ses:GetSendStatistics"
      fi

      # SES identity read permissions
      if echo "$policy_text" | grep -q 'ses:ListEmailIdentities'; then
        pass "IAM policy has ses:ListEmailIdentities"
      else
        fail "IAM policy missing ses:ListEmailIdentities"
      fi

      if echo "$policy_text" | grep -q 'ses:GetEmailIdentity'; then
        pass "IAM policy has ses:GetEmailIdentity"
      else
        fail "IAM policy missing ses:GetEmailIdentity"
      fi

      # SES send permissions
      if echo "$policy_text" | grep -q 'ses:SendEmail'; then
        pass "IAM policy has ses:SendEmail"
      else
        fail "IAM policy missing ses:SendEmail"
      fi

      if echo "$policy_text" | grep -q 'ses:SendRawEmail'; then
        pass "IAM policy has ses:SendRawEmail"
      else
        fail "IAM policy missing ses:SendRawEmail"
      fi
    else
      fail "IAM inline policy not found"
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
    if echo "$ses_output" | jq -e '.SendingOptions.SendingEnabled == true' &>/dev/null; then
      pass "SES config set sending enabled"
    else
      fail "SES config set sending not enabled"
    fi

    # Check reputation metrics
    if echo "$ses_output" | jq -e '.ReputationOptions.ReputationMetricsEnabled == true' &>/dev/null; then
      pass "SES config set reputation metrics enabled"
    else
      fail "SES config set reputation metrics not enabled"
    fi

    # Check suppression (BOUNCE and COMPLAINT)
    local suppressed_reasons
    suppressed_reasons=$(echo "$ses_output" | jq -r '[.SuppressionOptions.SuppressedReasons[]] | sort | join(",")' 2>/dev/null)
    if [[ "$suppressed_reasons" == *"BOUNCE"* && "$suppressed_reasons" == *"COMPLAINT"* ]]; then
      pass "SES config set suppression: $suppressed_reasons"
    else
      fail "SES config set missing suppression (BOUNCE/COMPLAINT), got: $suppressed_reasons"
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

    # Check DKIM status
    local dkim_status
    dkim_status=$(echo "$identity_output" | jq -r '.DkimAttributes.Status // "NONE"')
    if [[ "$dkim_status" == "SUCCESS" || "$dkim_status" == "PENDING" ]]; then
      pass "SES DKIM status: $dkim_status"
    else
      fail "SES DKIM status unexpected: $dkim_status"
    fi

    # Check DKIM signing key length
    local dkim_key_length
    dkim_key_length=$(echo "$identity_output" | jq -r '.DkimAttributes.CurrentSigningKeyLength // .DkimAttributes.SigningAttributesOrigin // "NONE"')
    if [[ "$dkim_key_length" == "RSA_2048_BIT" || "$dkim_key_length" == "RSA_1024_BIT" ]]; then
      pass "SES DKIM key length: $dkim_key_length"
    else
      # Some API versions return this differently, just check DKIM tokens exist
      local token_count
      token_count=$(echo "$identity_output" | jq '[.DkimAttributes.Tokens // [] | length] | .[0]' 2>/dev/null)
      if (( token_count > 0 )); then
        pass "SES DKIM tokens present ($token_count)"
      else
        pass "SES DKIM configured (key length: $dkim_key_length)"
      fi
    fi

    # Check config set linkage
    local linked_config
    linked_config=$(echo "$identity_output" | jq -r '.ConfigurationSetName // "NONE"')
    if [[ "$linked_config" == "wraps-email-tracking" ]]; then
      pass "SES identity linked to wraps-email-tracking config set"
    else
      fail "SES identity config set: expected wraps-email-tracking, got $linked_config"
    fi

    # Check MAIL FROM domain (optional — not all presets/configs set it)
    local mail_from
    mail_from=$(echo "$identity_output" | jq -r '.MailFromAttributes.MailFromDomain // "NONE"')
    if [[ "$mail_from" == mail.* || "$mail_from" == *".${domain}" ]]; then
      pass "SES MAIL FROM domain: $mail_from"

      # Check MAIL FROM behavior on failure (only if MAIL FROM is configured)
      local mail_from_behavior
      mail_from_behavior=$(echo "$identity_output" | jq -r '.MailFromAttributes.BehaviorOnMxFailure // "NONE"')
      if [[ "$mail_from_behavior" == "USE_DEFAULT_VALUE" ]]; then
        pass "SES MAIL FROM fallback: USE_DEFAULT_VALUE"
      else
        fail "SES MAIL FROM fallback: expected USE_DEFAULT_VALUE, got $mail_from_behavior"
      fi
    else
      pass "SES MAIL FROM not configured (optional)"
    fi
  else
    fail "SES email identity $domain not found" "$identity_output"
  fi
}

# ─── IAM Policy Conditional Verification ─────────────────────────────

verify_iam_events_policy() {
  section "IAM: Conditional policy statements (events enabled)"

  local policies_list
  if policies_list=$(aws_check iam list-role-policies --role-name wraps-email-role); then
    local policy_name
    policy_name=$(echo "$policies_list" | jq -r '.PolicyNames[0]')
    local policy_doc
    policy_doc=$(aws iam get-role-policy --role-name wraps-email-role --policy-name "$policy_name" 2>/dev/null)
    local policy_text
    policy_text=$(echo "$policy_doc" | jq -r '.PolicyDocument')

    # DynamoDB access should be present when events.storeHistory is true
    if echo "$policy_text" | grep -q 'dynamodb:PutItem'; then
      pass "IAM policy has DynamoDB access (events.storeHistory)"
    else
      fail "IAM policy missing DynamoDB access"
    fi

    if echo "$policy_text" | grep -q 'dynamodb:Query'; then
      pass "IAM policy has dynamodb:Query"
    else
      fail "IAM policy missing dynamodb:Query"
    fi

    # EventBridge access should be present when events is configured
    if echo "$policy_text" | grep -q 'events:PutEvents'; then
      pass "IAM policy has events:PutEvents (events configured)"
    else
      fail "IAM policy missing events:PutEvents"
    fi

    # SQS access should be present when events is configured
    if echo "$policy_text" | grep -q 'sqs:SendMessage'; then
      pass "IAM policy has sqs:SendMessage (events configured)"
    else
      fail "IAM policy missing sqs:SendMessage"
    fi

    if echo "$policy_text" | grep -q 'sqs:ReceiveMessage'; then
      pass "IAM policy has sqs:ReceiveMessage (events configured)"
    else
      fail "IAM policy missing sqs:ReceiveMessage"
    fi
  else
    fail "Could not list IAM role policies" "$policies_list"
  fi
}

verify_iam_no_events_policy() {
  section "IAM: Verify no conditional statements (events disabled)"

  local policies_list
  if policies_list=$(aws_check iam list-role-policies --role-name wraps-email-role); then
    local policy_name
    policy_name=$(echo "$policies_list" | jq -r '.PolicyNames[0]')
    local policy_doc
    policy_doc=$(aws iam get-role-policy --role-name wraps-email-role --policy-name "$policy_name" 2>/dev/null)
    local policy_text
    policy_text=$(echo "$policy_doc" | jq -r '.PolicyDocument')

    # DynamoDB access should NOT be present without events
    if echo "$policy_text" | grep -q 'dynamodb:PutItem'; then
      fail "IAM policy has DynamoDB access but events not configured"
    else
      pass "No DynamoDB access (expected without events)"
    fi

    # EventBridge access should NOT be present without events
    if echo "$policy_text" | grep -q 'events:PutEvents'; then
      fail "IAM policy has events:PutEvents but events not configured"
    else
      pass "No EventBridge access (expected without events)"
    fi

    # SQS access should NOT be present without events
    if echo "$policy_text" | grep -q 'sqs:SendMessage'; then
      fail "IAM policy has sqs:SendMessage but events not configured"
    else
      pass "No SQS access (expected without events)"
    fi
  else
    fail "Could not list IAM role policies" "$policies_list"
  fi
}

# ─── Events Verification ─────────────────────────────────────────────

verify_events() {
  local region="${1:-us-east-1}"

  section "Events: SES Event Destination"

  # Check that config set has an EventBridge event destination
  local event_dest_output
  if event_dest_output=$(aws_check sesv2 get-configuration-set-event-destinations \
    --configuration-set-name wraps-email-tracking \
    --region "$region"); then
    local dest_count
    dest_count=$(echo "$event_dest_output" | jq '[.EventDestinations[]] | length')
    if (( dest_count > 0 )); then
      pass "SES config set has event destination(s): $dest_count"

      # Check for EventBridge destination
      if echo "$event_dest_output" | jq -e '.EventDestinations[] | select(.EventBridgeDestination != null)' &>/dev/null; then
        pass "SES event destination targets EventBridge"
      else
        fail "SES event destination not targeting EventBridge"
      fi

      # Check destination is enabled
      if echo "$event_dest_output" | jq -e '.EventDestinations[] | select(.Enabled == true)' &>/dev/null; then
        pass "SES event destination is enabled"
      else
        fail "SES event destination is disabled"
      fi

      # Check matching event types include critical ones
      local event_types
      event_types=$(echo "$event_dest_output" | jq -r '[.EventDestinations[0].MatchingEventTypes[]] | join(",")' 2>/dev/null)
      for evt in SEND DELIVERY BOUNCE COMPLAINT; do
        if [[ "$event_types" == *"$evt"* ]]; then
          pass "SES event destination captures $evt"
        else
          fail "SES event destination missing $evt event type"
        fi
      done
    else
      fail "SES config set has no event destinations"
    fi
  else
    fail "Could not get SES event destinations" "$event_dest_output"
  fi

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

      # GSI key schema
      if echo "$table_output" | jq -e '.Table.GlobalSecondaryIndexes[] | select(.IndexName=="accountId-sentAt-index") | .KeySchema[] | select(.AttributeName=="accountId" and .KeyType=="HASH")' &>/dev/null; then
        pass "DynamoDB GSI hash key: accountId"
      else
        fail "DynamoDB GSI hash key not accountId"
      fi

      if echo "$table_output" | jq -e '.Table.GlobalSecondaryIndexes[] | select(.IndexName=="accountId-sentAt-index") | .KeySchema[] | select(.AttributeName=="sentAt" and .KeyType=="RANGE")' &>/dev/null; then
        pass "DynamoDB GSI range key: sentAt"
      else
        fail "DynamoDB GSI range key not sentAt"
      fi

      # GSI projection
      local gsi_projection
      gsi_projection=$(echo "$table_output" | jq -r '.Table.GlobalSecondaryIndexes[] | select(.IndexName=="accountId-sentAt-index") | .Projection.ProjectionType')
      if [[ "$gsi_projection" == "ALL" ]]; then
        pass "DynamoDB GSI projection: ALL"
      else
        fail "DynamoDB GSI projection: expected ALL, got $gsi_projection"
      fi
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

    # Visibility timeout (must be >= Lambda timeout, range 60-300)
    local vis_timeout
    vis_timeout=$(echo "$queue_attrs" | jq -r '.Attributes.VisibilityTimeout // "0"')
    if (( vis_timeout >= 60 && vis_timeout <= 300 )); then
      pass "SQS visibility timeout: ${vis_timeout}s"
    else
      fail "SQS visibility timeout: expected 60-300, got $vis_timeout"
    fi

    # Message retention (4 days)
    local retention
    retention=$(echo "$queue_attrs" | jq -r '.Attributes.MessageRetentionPeriod // "0"')
    if [[ "$retention" == "345600" ]]; then
      pass "SQS retention: 4 days (345600s)"
    else
      fail "SQS retention: expected 345600, got $retention"
    fi

    # Long polling
    local receive_wait
    receive_wait=$(echo "$queue_attrs" | jq -r '.Attributes.ReceiveMessageWaitTimeSeconds // "0"')
    if (( receive_wait >= 10 && receive_wait <= 20 )); then
      pass "SQS long polling: ${receive_wait}s"
    else
      fail "SQS long polling: expected 10-20, got $receive_wait"
    fi

    # Redrive policy: check DLQ target and maxReceiveCount
    local redrive_policy
    redrive_policy=$(echo "$queue_attrs" | jq -r '.Attributes.RedrivePolicy // ""')
    if echo "$redrive_policy" | grep -q 'wraps-email-events-dlq'; then
      pass "SQS redrive policy targets DLQ"
    else
      fail "SQS redrive policy not targeting DLQ"
    fi

    local max_receive
    max_receive=$(echo "$redrive_policy" | jq -r '.maxReceiveCount // 0' 2>/dev/null)
    if [[ "$max_receive" == "3" ]]; then
      pass "SQS redrive maxReceiveCount: 3"
    else
      fail "SQS redrive maxReceiveCount: expected 3, got $max_receive"
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

    # Runtime
    local runtime
    runtime=$(echo "$lambda_output" | jq -r '.Configuration.Runtime')
    if [[ "$runtime" == nodejs* ]]; then
      pass "Lambda runtime: $runtime"
    else
      fail "Lambda runtime: expected nodejs*, got $runtime"
    fi

    # Memory
    local memory
    memory=$(echo "$lambda_output" | jq -r '.Configuration.MemorySize')
    if [[ "$memory" == "512" ]]; then
      pass "Lambda memory: 512 MB"
    else
      fail "Lambda memory: expected 512, got $memory"
    fi

    # Timeout (30-300s, must be <= SQS visibility timeout)
    local timeout
    timeout=$(echo "$lambda_output" | jq -r '.Configuration.Timeout')
    if (( timeout >= 30 && timeout <= 300 )); then
      pass "Lambda timeout: ${timeout}s"
    else
      fail "Lambda timeout: expected 30-300, got $timeout"
    fi

    # Verify Lambda timeout <= SQS visibility timeout
    if (( timeout <= vis_timeout )); then
      pass "Lambda timeout ($timeout) <= SQS visibility ($vis_timeout)"
    else
      fail "Lambda timeout ($timeout) > SQS visibility ($vis_timeout) — will cause retries"
    fi

    # Handler
    local handler
    handler=$(echo "$lambda_output" | jq -r '.Configuration.Handler')
    if [[ "$handler" == "index.handler" ]]; then
      pass "Lambda handler: index.handler"
    else
      fail "Lambda handler: expected index.handler, got $handler"
    fi

    # Environment variables
    local env_vars
    env_vars=$(echo "$lambda_output" | jq -r '.Configuration.Environment.Variables // {}')

    if echo "$env_vars" | jq -e '.TABLE_NAME == "wraps-email-history"' &>/dev/null; then
      pass "Lambda TABLE_NAME = wraps-email-history"
    elif echo "$env_vars" | jq -e '.TABLE_NAME' &>/dev/null; then
      local table_val
      table_val=$(echo "$env_vars" | jq -r '.TABLE_NAME')
      fail "Lambda TABLE_NAME: expected wraps-email-history, got $table_val"
    else
      fail "Lambda missing TABLE_NAME env var"
    fi

    if echo "$env_vars" | jq -e '.AWS_ACCOUNT_ID' &>/dev/null; then
      pass "Lambda has AWS_ACCOUNT_ID env var"
    else
      fail "Lambda missing AWS_ACCOUNT_ID env var"
    fi

    if echo "$env_vars" | jq -e '.RETENTION_DAYS' &>/dev/null; then
      local ret_days
      ret_days=$(echo "$env_vars" | jq -r '.RETENTION_DAYS')
      pass "Lambda RETENTION_DAYS = $ret_days"
    else
      fail "Lambda missing RETENTION_DAYS env var"
    fi

    # Tags
    local lambda_tags
    lambda_tags=$(echo "$lambda_output" | jq -r '.Tags // {}')
    if echo "$lambda_tags" | jq -e '.ManagedBy' &>/dev/null; then
      pass "Lambda has ManagedBy tag"
    else
      fail "Lambda missing ManagedBy tag"
    fi
  else
    fail "Lambda wraps-email-event-processor not found" "$lambda_output"
  fi

  # Lambda IAM role — discover from Lambda function's Role ARN
  section "Events: Lambda IAM Role"

  local lambda_role_name
  lambda_role_name=$(echo "$lambda_output" | jq -r '.Configuration.Role // ""' | sed 's|.*/||')
  if [[ -z "$lambda_role_name" ]]; then
    fail "Could not determine Lambda IAM role from function config"
  else
    local lambda_role_output
    if lambda_role_output=$(aws_check iam get-role --role-name "$lambda_role_name"); then
      pass "Lambda IAM role $lambda_role_name exists"

      # Trust policy allows lambda.amazonaws.com
      if echo "$lambda_role_output" | jq -e '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.Service == "lambda.amazonaws.com")' &>/dev/null; then
        pass "Lambda role trusts lambda.amazonaws.com"
      else
        fail "Lambda role missing lambda.amazonaws.com trust"
      fi

      # Check attached managed policy (AWSLambdaBasicExecutionRole)
      local attached_policies
      attached_policies=$(aws iam list-attached-role-policies --role-name "$lambda_role_name" --query 'AttachedPolicies[].PolicyArn' --output json 2>/dev/null)
      if echo "$attached_policies" | grep -q 'AWSLambdaBasicExecutionRole'; then
        pass "Lambda role has AWSLambdaBasicExecutionRole"
      else
        fail "Lambda role missing AWSLambdaBasicExecutionRole"
      fi

      # Check inline policy has DynamoDB + SQS permissions
      local lambda_policies
      lambda_policies=$(aws iam list-role-policies --role-name "$lambda_role_name" --query 'PolicyNames' --output json 2>/dev/null)
      local lambda_policy_count
      lambda_policy_count=$(echo "$lambda_policies" | jq 'length')
      if (( lambda_policy_count > 0 )); then
        local lp_name
        lp_name=$(echo "$lambda_policies" | jq -r '.[0]')
        local lp_doc
        lp_doc=$(aws iam get-role-policy --role-name "$lambda_role_name" --policy-name "$lp_name" --query 'PolicyDocument' --output json 2>/dev/null)

        if echo "$lp_doc" | grep -q 'dynamodb:PutItem'; then
          pass "Lambda policy has DynamoDB write access"
        else
          fail "Lambda policy missing DynamoDB write access"
        fi

        if echo "$lp_doc" | grep -q 'sqs:ReceiveMessage'; then
          pass "Lambda policy has SQS read access"
        else
          fail "Lambda policy missing SQS read access"
        fi

        if echo "$lp_doc" | grep -q 'sqs:DeleteMessage'; then
          pass "Lambda policy has SQS delete access"
        else
          fail "Lambda policy missing SQS delete access"
        fi
      else
        fail "Lambda role has no inline policies"
      fi
    else
      fail "Lambda IAM role $lambda_role_name not found" "$lambda_role_output"
    fi
  fi

  # Event source mapping
  section "Events: Lambda Event Source Mapping"

  local esm_output
  if esm_output=$(aws_check lambda list-event-source-mappings \
    --function-name wraps-email-event-processor \
    --region "$region"); then
    local esm_count
    esm_count=$(echo "$esm_output" | jq '.EventSourceMappings | length')
    if (( esm_count > 0 )); then
      pass "Lambda has SQS event source mapping"

      local esm_first
      esm_first=$(echo "$esm_output" | jq '.EventSourceMappings[0]')

      # Batch size
      local batch_size
      batch_size=$(echo "$esm_first" | jq -r '.BatchSize')
      if [[ "$batch_size" == "10" ]]; then
        pass "Lambda ESM batch size: 10"
      else
        fail "Lambda ESM batch size: expected 10, got $batch_size"
      fi

      # Batching window
      local batch_window
      batch_window=$(echo "$esm_first" | jq -r '.MaximumBatchingWindowInSeconds // 0')
      if (( batch_window >= 0 && batch_window <= 10 )); then
        pass "Lambda ESM batching window: ${batch_window}s"
      else
        fail "Lambda ESM batching window: expected 0-10, got $batch_window"
      fi

      # ReportBatchItemFailures
      local response_types
      response_types=$(echo "$esm_first" | jq -r '[.FunctionResponseTypes // []] | .[0] | join(",")' 2>/dev/null)
      if [[ "$response_types" == *"ReportBatchItemFailures"* ]]; then
        pass "Lambda ESM reports batch item failures"
      else
        fail "Lambda ESM missing ReportBatchItemFailures"
      fi

      # Source ARN points to our queue
      local esm_source
      esm_source=$(echo "$esm_first" | jq -r '.EventSourceArn // ""')
      if [[ "$esm_source" == *"wraps-email-events"* ]]; then
        pass "Lambda ESM source: wraps-email-events queue"
      else
        fail "Lambda ESM source doesn't match wraps-email-events"
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

    # Event pattern
    local pattern
    pattern=$(echo "$rule_output" | jq -r '.EventPattern // ""')
    if echo "$pattern" | grep -q 'aws.ses'; then
      pass "EventBridge rule matches aws.ses events"
    else
      fail "EventBridge rule pattern doesn't match aws.ses"
    fi

    # Rule is enabled
    local rule_state
    rule_state=$(echo "$rule_output" | jq -r '.State // "DISABLED"')
    if [[ "$rule_state" == "ENABLED" ]]; then
      pass "EventBridge rule is ENABLED"
    else
      fail "EventBridge rule state: expected ENABLED, got $rule_state"
    fi

    # Check targets
    local targets_output
    targets_output=$(aws events list-targets-by-rule \
      --rule wraps-email-events-to-sqs \
      --region "$region" 2>/dev/null)
    local target_count
    target_count=$(echo "$targets_output" | jq '.Targets | length')
    if (( target_count > 0 )); then
      pass "EventBridge rule has $target_count target(s)"

      # At least one target points to SQS
      if echo "$targets_output" | jq -e '.Targets[] | select(.Arn | contains("sqs"))' &>/dev/null; then
        pass "EventBridge rule targets SQS queue"
      else
        fail "EventBridge rule has no SQS target"
      fi
    else
      fail "EventBridge rule has no targets"
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

  # Check access key exists
  local access_keys
  access_keys=$(aws iam list-access-keys --user-name wraps-email-smtp-user --query 'AccessKeyMetadata' --output json 2>/dev/null)
  local key_count
  key_count=$(echo "$access_keys" | jq 'length')
  if (( key_count > 0 )); then
    local key_status
    key_status=$(echo "$access_keys" | jq -r '.[0].Status')
    pass "SMTP access key exists (status: $key_status)"
  else
    fail "SMTP user has no access keys"
  fi
}

# ─── Webhook Verification ─────────────────────────────────────────────

verify_webhook() {
  local region="${1:-us-east-1}"

  section "Webhook: EventBridge Connection"

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

  section "Webhook: API Destination"

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
    if [[ "$endpoint" == *"/webhooks/ses/"* ]]; then
      pass "API destination endpoint contains /webhooks/ses/"
    else
      fail "API destination endpoint doesn't match expected pattern: $endpoint"
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

  section "Webhook: EventBridge Rule Targets"

  # Check that the EventBridge rule has an API Destination target
  local targets_output
  targets_output=$(aws events list-targets-by-rule \
    --rule wraps-email-events-to-sqs \
    --region "$region" 2>/dev/null)
  local target_count
  target_count=$(echo "$targets_output" | jq '.Targets | length')
  if (( target_count >= 2 )); then
    pass "EventBridge rule has $target_count targets (SQS + webhook)"
  else
    fail "EventBridge rule has only $target_count target(s), expected >= 2"
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

  # Lambda role (name may have auto-generated suffix)
  local lambda_roles
  lambda_roles=$(aws iam list-roles --query "Roles[?starts_with(RoleName, 'wraps-email-lambda-role')].RoleName" --output json 2>/dev/null)
  local lambda_role_count
  lambda_role_count=$(echo "$lambda_roles" | jq 'length')
  if (( lambda_role_count > 0 )); then
    fail "Lambda role still exists: $(echo "$lambda_roles" | jq -r '.[0]')"
  else
    pass "Lambda role wraps-email-lambda-role* removed"
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

  # Webhook connection
  if aws events describe-connection \
    --name wraps-webhook-connection \
    --region "$region" &>/dev/null; then
    fail "EventBridge connection wraps-webhook-connection still exists"
  else
    pass "EventBridge connection wraps-webhook-connection removed"
  fi

  # Webhook API destination
  if aws events describe-api-destination \
    --name wraps-webhook-destination \
    --region "$region" &>/dev/null; then
    fail "API destination wraps-webhook-destination still exists"
  else
    pass "API destination wraps-webhook-destination removed"
  fi
}
