#!/usr/bin/env zsh
# Self-hosted control plane deployment verification test
# Tests: wraps selfhost deploy → verify → status → API health → upgrade → teardown

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

export AWS_PROFILE="$AWS_PROFILE_CLI"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

REGION="$WRAPS_TEST_REGION"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Self-hosted specific config
NEON_API_KEY="${WRAPS_SELFHOST_NEON_API_KEY:?WRAPS_SELFHOST_NEON_API_KEY is required}"
NEON_ORG_ID="${WRAPS_SELFHOST_NEON_ORG_ID:-}"
LICENSE_KEY="${WRAPS_SELFHOST_LICENSE_KEY:-wraps_lic_test}"
APP_URL="${WRAPS_SELFHOST_APP_URL:-https://app.wraps.dev}"

REPO_ROOT="${ROOT_DIR:h:h}"
wraps() { node "${REPO_ROOT}/packages/cli/dist/cli.js" "$@"; }

# Neon project ID extracted after deploy (used in cleanup)
NEON_PROJECT_ID=""

# ─── Resource cleanup ────────────────────────────────────────────────

destroy_selfhost_resources() {
  printf "${CYAN}  Cleaning up self-hosted AWS resources...${NC}\n"

  # Delete Lambda ESMs before deleting the function
  local esm_uuid
  for esm_uuid in $(aws lambda list-event-source-mappings \
    --function-name wraps-selfhost-api \
    --region "$REGION" \
    --query 'EventSourceMappings[].UUID' \
    --output text 2>/dev/null || true); do
    aws lambda delete-event-source-mapping --uuid "$esm_uuid" --region "$REGION" &>/dev/null || true
  done

  # Delete Lambda function URL and function
  aws lambda delete-function-url-config \
    --function-name wraps-selfhost-api \
    --region "$REGION" &>/dev/null || true
  aws lambda delete-function \
    --function-name wraps-selfhost-api \
    --region "$REGION" &>/dev/null || true

  # Delete main SQS queues first (DLQs can't delete while main queue points to them)
  local q qurl
  for q in wraps-selfhost-batch wraps-selfhost-workflow; do
    qurl=$(aws sqs get-queue-url --queue-name "$q" --region "$REGION" \
      --query 'QueueUrl' --output text 2>/dev/null || true)
    [[ -n "$qurl" ]] && aws sqs delete-queue --queue-url "$qurl" --region "$REGION" &>/dev/null || true
  done

  # SQS deletion is eventually consistent — wait before deleting DLQs
  sleep 15

  for q in wraps-selfhost-batch-dlq wraps-selfhost-workflow-dlq; do
    qurl=$(aws sqs get-queue-url --queue-name "$q" --region "$REGION" \
      --query 'QueueUrl' --output text 2>/dev/null || true)
    [[ -n "$qurl" ]] && aws sqs delete-queue --queue-url "$qurl" --region "$REGION" &>/dev/null || true
  done

  # Delete DynamoDB table
  aws dynamodb delete-table \
    --table-name wraps-selfhost-rate-limit \
    --region "$REGION" &>/dev/null || true

  # Delete EventBridge Scheduler group (must be empty — schedules within the group
  # were created by the API at runtime, not by deploy, so this may fail if any remain)
  aws scheduler delete-schedule-group \
    --name wraps-selfhost-schedulers \
    --region "$REGION" &>/dev/null || true

  # Delete Scheduler IAM role (inline policies must go first)
  local policy
  for policy in $(aws iam list-role-policies --role-name wraps-selfhost-scheduler-role \
    --query 'PolicyNames' --output text 2>/dev/null || true); do
    aws iam delete-role-policy --role-name wraps-selfhost-scheduler-role \
      --policy-name "$policy" &>/dev/null || true
  done
  aws iam delete-role --role-name wraps-selfhost-scheduler-role &>/dev/null || true

  # Delete Lambda IAM role (detach managed policy + delete inline policies)
  aws iam detach-role-policy \
    --role-name wraps-selfhost-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    &>/dev/null || true
  for policy in $(aws iam list-role-policies --role-name wraps-selfhost-lambda-role \
    --query 'PolicyNames' --output text 2>/dev/null || true); do
    aws iam delete-role-policy --role-name wraps-selfhost-lambda-role \
      --policy-name "$policy" &>/dev/null || true
  done
  aws iam delete-role --role-name wraps-selfhost-lambda-role &>/dev/null || true

  # Delete Neon project
  if [[ -n "$NEON_PROJECT_ID" ]]; then
    printf "${CYAN}  Deleting Neon project %s...${NC}\n" "$NEON_PROJECT_ID"
    curl -sf -X DELETE \
      "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}" \
      -H "Authorization: Bearer ${NEON_API_KEY}" &>/dev/null || true
  fi

  # Remove selfhost entry from local connection metadata (preserve other service data)
  local metadata_file="${HOME}/.wraps/connections/${ACCOUNT_ID}-${REGION}.json"
  if [[ -f "$metadata_file" ]]; then
    local updated
    updated=$(jq 'del(.services.selfhost)' "$metadata_file" 2>/dev/null) || true
    [[ -n "$updated" ]] && printf '%s' "$updated" > "$metadata_file" || true
  fi

  # Remove selfhost entry from S3 metadata (loadConnectionMetadata syncs from S3,
  # so the local deletion alone is not enough — the S3 version must also be cleared)
  local state_bucket="wraps-state-${ACCOUNT_ID}-${REGION}"
  local s3_metadata="s3://${state_bucket}/metadata/${ACCOUNT_ID}-${REGION}.json"
  if aws s3 ls "s3://${state_bucket}" &>/dev/null; then
    local remote_meta
    remote_meta=$(aws s3 cp "$s3_metadata" - 2>/dev/null || true)
    if [[ -n "$remote_meta" ]]; then
      local updated_remote
      updated_remote=$(printf '%s' "$remote_meta" | jq 'del(.services.selfhost)' 2>/dev/null) || true
      [[ -n "$updated_remote" ]] && printf '%s' "$updated_remote" | \
        aws s3 cp - "$s3_metadata" &>/dev/null || true
    fi
  fi

  # Remove Pulumi stack state
  local stack_name="wraps-selfhost-${ACCOUNT_ID}-${REGION}"
  if aws s3 ls "s3://${state_bucket}" &>/dev/null; then
    PULUMI_CONFIG_PASSPHRASE="" PULUMI_BACKEND_URL="s3://${state_bucket}" \
      pulumi stack rm "$stack_name" --yes --force --cwd ~/.wraps/pulumi 2>/dev/null || true
  fi
}

cleanup_on_exit() {
  local exit_code=$?
  if (( exit_code != 0 )); then
    printf "\n${RED}Test failed (exit %d) — destroying resources to avoid orphans${NC}\n" "$exit_code"
    destroy_selfhost_resources
  fi
  exit "$exit_code"
}
trap cleanup_on_exit EXIT

# ─── Helpers ─────────────────────────────────────────────────────────

# Extract JSON from mixed CLI output (clack text + JSON).
# Handles both clean lines starting with { and cases where the JSON is
# appended to a spinner line (e.g. migration output ends mid-line).
extract_json() {
  grep -oE '\{"success":.*' | tail -1
}

printf "\n%s\n" "============================================"
printf "  Self-Hosted Deployment Test\n"
printf "  Region: %s  Account: %s\n" "$REGION" "$ACCOUNT_ID"
printf "  App URL: %s\n" "$APP_URL"
printf "%s\n\n" "============================================"

# ─── Phase 1: Deploy ─────────────────────────────────────────────────

printf "${YELLOW}Phase 1: wraps selfhost deploy${NC}\n"

DEPLOY_EXTRA_FLAGS=()
[[ -n "$NEON_ORG_ID" ]] && DEPLOY_EXTRA_FLAGS+=(--neon-org-id "$NEON_ORG_ID")

DEPLOY_OUT=$(wraps selfhost deploy \
  --region "$REGION" \
  --neon-api-key "$NEON_API_KEY" \
  --license-key "$LICENSE_KEY" \
  --app-url "$APP_URL" \
  "${DEPLOY_EXTRA_FLAGS[@]}" \
  --yes \
  --json 2>/dev/null | extract_json) || true

reset_counters
section "Phase 1: selfhost deploy output"

if echo "$DEPLOY_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "selfhost deploy succeeded"
else
  fail "selfhost deploy failed" "$DEPLOY_OUT"
  summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }
fi

API_URL=$(echo "$DEPLOY_OUT" | jq -r '.data.apiUrl // ""')
LAMBDA_ARN=$(echo "$DEPLOY_OUT" | jq -r '.data.lambdaArn // ""')

if [[ -n "$API_URL" && "$API_URL" != "null" ]]; then
  pass "selfhost deploy returned API URL: $API_URL"
else
  fail "selfhost deploy missing apiUrl"
fi

if [[ -n "$LAMBDA_ARN" && "$LAMBDA_ARN" != "null" ]]; then
  pass "selfhost deploy returned Lambda ARN"
else
  fail "selfhost deploy missing lambdaArn"
fi

if echo "$DEPLOY_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "selfhost deploy reports correct region"
else
  fail "selfhost deploy region mismatch"
fi

# Extract Neon project ID from stored metadata for cleanup
NEON_PROJECT_ID=$(jq -r '.services.selfhost.config.neonProjectId // ""' \
  "${HOME}/.wraps/connections/${ACCOUNT_ID}-${REGION}.json" 2>/dev/null || true)

summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }

# ─── Phase 2: Verify AWS resources ───────────────────────────────────

printf "\n${YELLOW}Phase 2: Verify deployed AWS resources${NC}\n"
reset_counters

section "Phase 2: IAM Lambda role"

LAMBDA_ROLE_OUT=$(aws iam get-role --role-name wraps-selfhost-lambda-role --output json 2>&1) || true
if echo "$LAMBDA_ROLE_OUT" | jq -e '.Role.RoleName' &>/dev/null; then
  pass "IAM role wraps-selfhost-lambda-role exists"

  if echo "$LAMBDA_ROLE_OUT" | jq -e '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.Service == "lambda.amazonaws.com")' &>/dev/null; then
    pass "Lambda role trusts lambda.amazonaws.com"
  else
    fail "Lambda role missing lambda.amazonaws.com trust"
  fi

  LAMBDA_ROLE_TAG=$(echo "$LAMBDA_ROLE_OUT" | jq -r '.Role.Tags[]? | select(.Key=="ManagedBy") | .Value // ""')
  if [[ "$LAMBDA_ROLE_TAG" == "wraps-cli" ]]; then
    pass "Lambda role ManagedBy: wraps-cli"
  else
    fail "Lambda role ManagedBy tag: expected wraps-cli, got: $LAMBDA_ROLE_TAG"
  fi
else
  fail "IAM role wraps-selfhost-lambda-role not found"
fi

# Managed policy attachment
ATTACHED=$(aws iam list-attached-role-policies --role-name wraps-selfhost-lambda-role \
  --query 'AttachedPolicies[].PolicyArn' --output json 2>/dev/null || echo '[]')
if echo "$ATTACHED" | grep -q 'AWSLambdaBasicExecutionRole'; then
  pass "Lambda role has AWSLambdaBasicExecutionRole"
else
  fail "Lambda role missing AWSLambdaBasicExecutionRole"
fi

# Inline policy: DynamoDB + SQS + Scheduler + SES + iam:PassRole
INLINE_POLICIES=$(aws iam list-role-policies --role-name wraps-selfhost-lambda-role \
  --query 'PolicyNames' --output json 2>/dev/null || echo '[]')
INLINE_COUNT=$(echo "$INLINE_POLICIES" | jq 'length')
if (( INLINE_COUNT > 0 )); then
  INLINE_NAME=$(echo "$INLINE_POLICIES" | jq -r '.[0]')
  INLINE_DOC=$(aws iam get-role-policy \
    --role-name wraps-selfhost-lambda-role \
    --policy-name "$INLINE_NAME" \
    --query 'PolicyDocument' --output json 2>/dev/null || echo '{}')

  for action in 'dynamodb:PutItem' 'dynamodb:Query' 'sqs:SendMessage' 'sqs:ReceiveMessage' \
                'scheduler:CreateSchedule' 'iam:PassRole' 'ses:SendEmail'; do
    if echo "$INLINE_DOC" | grep -q "$action"; then
      pass "Lambda inline policy has $action"
    else
      fail "Lambda inline policy missing $action"
    fi
  done

  # Resource scope: must be wraps-selfhost-* for DynamoDB and SQS (not *)
  if echo "$INLINE_DOC" | grep -q 'wraps-selfhost-\*'; then
    pass "Lambda inline policy scoped to wraps-selfhost-* resources"
  else
    fail "Lambda inline policy not scoped to wraps-selfhost-* (check DynamoDB/SQS ARNs)"
  fi
else
  fail "Lambda role has no inline policies"
fi

section "Phase 2: IAM Scheduler role"

SCHED_ROLE_OUT=$(aws iam get-role --role-name wraps-selfhost-scheduler-role --output json 2>&1) || true
if echo "$SCHED_ROLE_OUT" | jq -e '.Role.RoleName' &>/dev/null; then
  pass "IAM role wraps-selfhost-scheduler-role exists"

  if echo "$SCHED_ROLE_OUT" | jq -e '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.Service == "scheduler.amazonaws.com")' &>/dev/null; then
    pass "Scheduler role trusts scheduler.amazonaws.com"
  else
    fail "Scheduler role missing scheduler.amazonaws.com trust"
  fi
else
  fail "IAM role wraps-selfhost-scheduler-role not found"
fi

SCHED_INLINE=$(aws iam list-role-policies --role-name wraps-selfhost-scheduler-role \
  --query 'PolicyNames' --output json 2>/dev/null || echo '[]')
if (( $(echo "$SCHED_INLINE" | jq 'length') > 0 )); then
  SCHED_POLICY_NAME=$(echo "$SCHED_INLINE" | jq -r '.[0]')
  SCHED_DOC=$(aws iam get-role-policy \
    --role-name wraps-selfhost-scheduler-role \
    --policy-name "$SCHED_POLICY_NAME" \
    --query 'PolicyDocument' --output json 2>/dev/null || echo '{}')
  if echo "$SCHED_DOC" | grep -q 'sqs:SendMessage'; then
    pass "Scheduler inline policy has sqs:SendMessage"
  else
    fail "Scheduler inline policy missing sqs:SendMessage"
  fi
else
  fail "Scheduler role has no inline policies"
fi

section "Phase 2: DynamoDB rate-limit table"

TABLE_OUT=$(aws dynamodb describe-table \
  --table-name wraps-selfhost-rate-limit \
  --region "$REGION" --output json 2>&1) || true
if echo "$TABLE_OUT" | jq -e '.Table.TableName' &>/dev/null; then
  pass "DynamoDB table wraps-selfhost-rate-limit exists"

  TABLE_BILLING=$(echo "$TABLE_OUT" | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')
  if [[ "$TABLE_BILLING" == "PAY_PER_REQUEST" ]]; then
    pass "DynamoDB billing: PAY_PER_REQUEST"
  else
    fail "DynamoDB billing: expected PAY_PER_REQUEST, got $TABLE_BILLING"
  fi

  if echo "$TABLE_OUT" | jq -e '.Table.KeySchema[] | select(.AttributeName=="pk" and .KeyType=="HASH")' &>/dev/null; then
    pass "DynamoDB hash key: pk"
  else
    fail "DynamoDB hash key not pk"
  fi

  if echo "$TABLE_OUT" | jq -e '.Table.KeySchema[] | select(.AttributeName=="sk" and .KeyType=="RANGE")' &>/dev/null; then
    pass "DynamoDB range key: sk"
  else
    fail "DynamoDB range key not sk"
  fi

  TTL_OUT=$(aws dynamodb describe-time-to-live \
    --table-name wraps-selfhost-rate-limit \
    --region "$REGION" --output json 2>/dev/null || echo '{}')
  TTL_ATTR=$(echo "$TTL_OUT" | jq -r '.TimeToLiveDescription.AttributeName // "NONE"')
  if [[ "$TTL_ATTR" == "expiresAt" ]]; then
    pass "DynamoDB TTL on expiresAt"
  else
    fail "DynamoDB TTL attribute: expected expiresAt, got $TTL_ATTR"
  fi
else
  fail "DynamoDB table wraps-selfhost-rate-limit not found"
fi

section "Phase 2: SQS queues"

for queue_spec in \
  "wraps-selfhost-batch:300:wraps-selfhost-batch-dlq" \
  "wraps-selfhost-workflow:300:wraps-selfhost-workflow-dlq"; do
  local q_name="${queue_spec%%:*}"
  local q_vis="${${queue_spec#*:}%%:*}"
  local q_dlq="${queue_spec##*:}"

  Q_URL=$(aws sqs get-queue-url --queue-name "$q_name" --region "$REGION" \
    --query 'QueueUrl' --output text 2>/dev/null || true)
  if [[ -n "$Q_URL" ]]; then
    pass "SQS queue $q_name exists"

    Q_ATTRS=$(aws sqs get-queue-attributes --queue-url "$Q_URL" \
      --attribute-names All --region "$REGION" --output json 2>/dev/null || echo '{}')

    Q_VIS=$(echo "$Q_ATTRS" | jq -r '.Attributes.VisibilityTimeout // "0"')
    if [[ "$Q_VIS" == "$q_vis" ]]; then
      pass "SQS $q_name visibility timeout: ${Q_VIS}s"
    else
      fail "SQS $q_name visibility timeout: expected ${q_vis}, got $Q_VIS"
    fi

    Q_REDRIVE=$(echo "$Q_ATTRS" | jq -r '.Attributes.RedrivePolicy // ""')
    if echo "$Q_REDRIVE" | grep -q "$q_dlq"; then
      pass "SQS $q_name redrive policy targets $q_dlq"
    else
      fail "SQS $q_name redrive policy missing $q_dlq"
    fi

    Q_MAX=$(echo "$Q_REDRIVE" | jq -r '.maxReceiveCount // 0' 2>/dev/null)
    if [[ "$Q_MAX" == "3" ]]; then
      pass "SQS $q_name maxReceiveCount: 3"
    else
      fail "SQS $q_name maxReceiveCount: expected 3, got $Q_MAX"
    fi
  else
    fail "SQS queue $q_name not found"
  fi
done

for dlq_name in wraps-selfhost-batch-dlq wraps-selfhost-workflow-dlq; do
  DLQ_URL=$(aws sqs get-queue-url --queue-name "$dlq_name" --region "$REGION" \
    --query 'QueueUrl' --output text 2>/dev/null || true)
  if [[ -n "$DLQ_URL" ]]; then
    pass "SQS DLQ $dlq_name exists"

    DLQ_ATTRS=$(aws sqs get-queue-attributes --queue-url "$DLQ_URL" \
      --attribute-names MessageRetentionPeriod --region "$REGION" --output json 2>/dev/null || echo '{}')
    DLQ_RETENTION=$(echo "$DLQ_ATTRS" | jq -r '.Attributes.MessageRetentionPeriod // "0"')
    if [[ "$DLQ_RETENTION" == "1209600" ]]; then
      pass "SQS DLQ $dlq_name retention: 14 days"
    else
      fail "SQS DLQ $dlq_name retention: expected 1209600, got $DLQ_RETENTION"
    fi
  else
    fail "SQS DLQ $dlq_name not found"
  fi
done

section "Phase 2: EventBridge Scheduler group"

SCHED_GROUP=$(aws scheduler get-schedule-group \
  --name wraps-selfhost-schedulers \
  --region "$REGION" --output json 2>&1) || true
if echo "$SCHED_GROUP" | jq -e '.Name == "wraps-selfhost-schedulers"' &>/dev/null; then
  pass "EventBridge Scheduler group wraps-selfhost-schedulers exists"

  SCHED_STATE=$(echo "$SCHED_GROUP" | jq -r '.State // "UNKNOWN"')
  if [[ "$SCHED_STATE" == "ACTIVE" ]]; then
    pass "Scheduler group state: ACTIVE"
  else
    fail "Scheduler group state: expected ACTIVE, got $SCHED_STATE"
  fi
else
  fail "EventBridge Scheduler group wraps-selfhost-schedulers not found"
fi

section "Phase 2: Lambda function"

LAMBDA_OUT=$(aws lambda get-function \
  --function-name wraps-selfhost-api \
  --region "$REGION" --output json 2>&1) || true
if echo "$LAMBDA_OUT" | jq -e '.Configuration.FunctionName' &>/dev/null; then
  pass "Lambda wraps-selfhost-api exists"

  LAMBDA_RUNTIME=$(echo "$LAMBDA_OUT" | jq -r '.Configuration.Runtime // ""')
  if [[ "$LAMBDA_RUNTIME" == "nodejs22.x" ]]; then
    pass "Lambda runtime: nodejs22.x"
  else
    fail "Lambda runtime: expected nodejs22.x, got $LAMBDA_RUNTIME"
  fi

  LAMBDA_HANDLER=$(echo "$LAMBDA_OUT" | jq -r '.Configuration.Handler // ""')
  if [[ "$LAMBDA_HANDLER" == "lambda.handler" ]]; then
    pass "Lambda handler: lambda.handler"
  else
    fail "Lambda handler: expected lambda.handler, got $LAMBDA_HANDLER"
  fi

  LAMBDA_MEM=$(echo "$LAMBDA_OUT" | jq -r '.Configuration.MemorySize // 0')
  if [[ "$LAMBDA_MEM" == "512" ]]; then
    pass "Lambda memory: 512 MB"
  else
    fail "Lambda memory: expected 512, got $LAMBDA_MEM"
  fi

  LAMBDA_TIMEOUT=$(echo "$LAMBDA_OUT" | jq -r '.Configuration.Timeout // 0')
  if [[ "$LAMBDA_TIMEOUT" == "30" ]]; then
    pass "Lambda timeout: 30s"
  else
    fail "Lambda timeout: expected 30, got $LAMBDA_TIMEOUT"
  fi

  LAMBDA_ENV=$(echo "$LAMBDA_OUT" | jq -r '.Configuration.Environment.Variables // {}')
  for env_key in DATABASE_URL WRAPS_LICENSE_KEY BATCH_QUEUE_URL BATCH_QUEUE_ARN \
                  RATE_LIMIT_TABLE_NAME WORKFLOW_QUEUE_URL WORKFLOW_QUEUE_ARN \
                  SCHEDULER_ROLE_ARN SCHEDULER_GROUP_NAME; do
    if echo "$LAMBDA_ENV" | jq -e --arg k "$env_key" '.[$k]' &>/dev/null; then
      pass "Lambda env var: $env_key"
    else
      fail "Lambda missing env var: $env_key"
    fi
  done

  LAMBDA_TAG=$(echo "$LAMBDA_OUT" | jq -r '.Tags.ManagedBy // ""')
  if [[ "$LAMBDA_TAG" == "wraps-cli" ]]; then
    pass "Lambda ManagedBy: wraps-cli"
  else
    fail "Lambda ManagedBy tag: expected wraps-cli, got: $LAMBDA_TAG"
  fi
else
  fail "Lambda wraps-selfhost-api not found"
fi

section "Phase 2: Lambda Function URL"

FUNC_URL_OUT=$(aws lambda get-function-url-config \
  --function-name wraps-selfhost-api \
  --region "$REGION" --output json 2>&1) || true
if echo "$FUNC_URL_OUT" | jq -e '.FunctionUrl' &>/dev/null; then
  pass "Lambda Function URL exists"

  URL_AUTH=$(echo "$FUNC_URL_OUT" | jq -r '.AuthType // ""')
  if [[ "$URL_AUTH" == "NONE" ]]; then
    pass "Lambda Function URL auth: NONE"
  else
    fail "Lambda Function URL auth: expected NONE, got $URL_AUTH"
  fi

  URL_CORS=$(echo "$FUNC_URL_OUT" | jq -r '.Cors // {}')
  if echo "$URL_CORS" | jq -e '.AllowCredentials == true' &>/dev/null; then
    pass "Lambda Function URL CORS allowCredentials: true"
  else
    fail "Lambda Function URL CORS allowCredentials not true"
  fi
else
  fail "Lambda Function URL not found"
fi

section "Phase 2: Lambda event source mappings"

ESM_OUT=$(aws lambda list-event-source-mappings \
  --function-name wraps-selfhost-api \
  --region "$REGION" --output json 2>/dev/null || echo '{"EventSourceMappings":[]}')
ESM_COUNT=$(echo "$ESM_OUT" | jq '.EventSourceMappings | length')
if (( ESM_COUNT >= 2 )); then
  pass "Lambda has $ESM_COUNT event source mapping(s) (batch + workflow)"
else
  fail "Lambda has only $ESM_COUNT ESM(s), expected 2 (batch + workflow)"
fi

for queue_arn_pattern in 'wraps-selfhost-batch' 'wraps-selfhost-workflow'; do
  if echo "$ESM_OUT" | jq -e --arg p "$queue_arn_pattern" \
    '[.EventSourceMappings[] | select(.EventSourceArn | contains($p))] | length > 0' &>/dev/null; then
    pass "Lambda ESM for $queue_arn_pattern queue"
  else
    fail "Lambda ESM missing for $queue_arn_pattern queue"
  fi
done

ESM_BATCH_SIZE=$(echo "$ESM_OUT" | jq -r '.EventSourceMappings[0].BatchSize // 0')
if [[ "$ESM_BATCH_SIZE" == "1" ]]; then
  pass "Lambda ESM batch size: 1"
else
  fail "Lambda ESM batch size: expected 1, got $ESM_BATCH_SIZE"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Status command ─────────────────────────────────────────

printf "\n${YELLOW}Phase 3: wraps selfhost status${NC}\n"
reset_counters

STATUS_OUT=$(wraps selfhost status \
  --region "$REGION" \
  --json 2>/dev/null | extract_json) || true

section "Phase 3: selfhost status output"

if echo "$STATUS_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "selfhost status succeeds"
else
  fail "selfhost status failed" "$STATUS_OUT"
fi

if echo "$STATUS_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "selfhost status reports correct region"
else
  fail "selfhost status region mismatch"
fi

if echo "$STATUS_OUT" | jq -e --arg url "$API_URL" '.data.apiUrl == $url' &>/dev/null; then
  pass "selfhost status reports correct API URL"
else
  typeset status_url
  status_url=$(echo "$STATUS_OUT" | jq -r '.data.apiUrl // "MISSING"')
  fail "selfhost status apiUrl mismatch (expected $API_URL, got $status_url)"
fi

if [[ -n "$NEON_PROJECT_ID" ]]; then
  if echo "$STATUS_OUT" | jq -e --arg id "$NEON_PROJECT_ID" '.data.neonProjectId == $id' &>/dev/null; then
    pass "selfhost status reports correct Neon project ID"
  else
    fail "selfhost status Neon project ID mismatch"
  fi
fi

if echo "$STATUS_OUT" | jq -e --arg url "$APP_URL" '.data.appUrl == $url' &>/dev/null; then
  pass "selfhost status reports correct app URL"
else
  fail "selfhost status appUrl mismatch"
fi

summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }

# ─── Phase 4: API health check ───────────────────────────────────────

printf "\n${YELLOW}Phase 4: API health check${NC}\n"
reset_counters

section "Phase 4: GET ${API_URL}health"

# Use -s (silent) without -f so curl doesn't exit non-zero on 4xx/5xx —
# we just want to know if the Lambda Function URL is reachable at all.
HEALTH_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
  --max-time 15 \
  "${API_URL}health" 2>/dev/null)
[[ -z "$HEALTH_STATUS" ]] && HEALTH_STATUS="000"

if [[ "$HEALTH_STATUS" =~ ^[1-9][0-9][0-9]$ ]]; then
  pass "API Lambda Function URL is reachable (HTTP $HEALTH_STATUS)"
else
  fail "API Lambda Function URL unreachable (no HTTP response — is the Function URL accessible?)"
fi

summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }

# ─── Phase 5: Upgrade (idempotent re-deploy) ─────────────────────────

printf "\n${YELLOW}Phase 5: wraps selfhost upgrade (idempotent)${NC}\n"

UPGRADE_OUT=$(wraps selfhost upgrade \
  --region "$REGION" \
  --yes \
  --json 2>/dev/null | extract_json) || true

reset_counters
section "Phase 5: selfhost upgrade output"

if echo "$UPGRADE_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "selfhost upgrade succeeded"
else
  fail "selfhost upgrade failed" "$UPGRADE_OUT"
fi

if echo "$UPGRADE_OUT" | jq -e --arg r "$REGION" '.data.region == $r' &>/dev/null; then
  pass "selfhost upgrade reports correct region"
else
  fail "selfhost upgrade region mismatch"
fi

UPGRADED_API_URL=$(echo "$UPGRADE_OUT" | jq -r '.data.apiUrl // ""')
if [[ "$UPGRADED_API_URL" == "$API_URL" ]]; then
  pass "selfhost upgrade preserved API URL"
else
  fail "selfhost upgrade API URL changed: $UPGRADED_API_URL (was $API_URL)"
fi

# Verify resources still intact after upgrade
section "Phase 5: Resources intact after upgrade"

if aws lambda get-function --function-name wraps-selfhost-api --region "$REGION" &>/dev/null; then
  pass "Lambda wraps-selfhost-api still exists after upgrade"
else
  fail "Lambda wraps-selfhost-api missing after upgrade"
fi

if aws dynamodb describe-table --table-name wraps-selfhost-rate-limit --region "$REGION" &>/dev/null; then
  pass "DynamoDB wraps-selfhost-rate-limit still exists after upgrade"
else
  fail "DynamoDB wraps-selfhost-rate-limit missing after upgrade"
fi

if aws sqs get-queue-url --queue-name wraps-selfhost-batch --region "$REGION" &>/dev/null; then
  pass "SQS wraps-selfhost-batch still exists after upgrade"
else
  fail "SQS wraps-selfhost-batch missing after upgrade"
fi

summary || { printf "${RED}Phase 5 FAILED${NC}\n"; exit 1; }

# ─── Teardown ─────────────────────────────────────────────────────────

printf "\n${YELLOW}Teardown: Destroying all resources${NC}\n"

# Disable the trap — we're handling destroy explicitly now
trap - EXIT

destroy_selfhost_resources

# Verify teardown
reset_counters
section "Teardown: Verify resources removed"

# Allow eventual consistency — poll with timeout
typeset -i teardown_deadline=$(($(date -u +%s) + 60))

if aws iam get-role --role-name wraps-selfhost-lambda-role &>/dev/null; then
  fail "IAM role wraps-selfhost-lambda-role still exists"
else
  pass "IAM role wraps-selfhost-lambda-role removed"
fi

if aws iam get-role --role-name wraps-selfhost-scheduler-role &>/dev/null; then
  fail "IAM role wraps-selfhost-scheduler-role still exists"
else
  pass "IAM role wraps-selfhost-scheduler-role removed"
fi

if aws lambda get-function --function-name wraps-selfhost-api --region "$REGION" &>/dev/null; then
  fail "Lambda wraps-selfhost-api still exists"
else
  pass "Lambda wraps-selfhost-api removed"
fi

if aws dynamodb describe-table --table-name wraps-selfhost-rate-limit --region "$REGION" &>/dev/null; then
  fail "DynamoDB wraps-selfhost-rate-limit still exists"
else
  pass "DynamoDB wraps-selfhost-rate-limit removed"
fi

# SQS deletion is eventually consistent — poll
typeset sqs_main_gone=false sqs_dlq_gone=false
while (( $(date -u +%s) < teardown_deadline )); do
  local all_gone=true
  for q in wraps-selfhost-batch wraps-selfhost-workflow \
            wraps-selfhost-batch-dlq wraps-selfhost-workflow-dlq; do
    if aws sqs get-queue-url --queue-name "$q" --region "$REGION" &>/dev/null; then
      all_gone=false
      break
    fi
  done
  [[ "$all_gone" == "true" ]] && { sqs_main_gone=true; sqs_dlq_gone=true; break; }
  sleep 5
done

if [[ "$sqs_main_gone" == "true" ]]; then
  pass "SQS queues (batch + workflow) removed"
else
  fail "SQS queues still exist after teardown"
fi

if [[ "$sqs_dlq_gone" == "true" ]]; then
  pass "SQS DLQs (batch + workflow) removed"
else
  fail "SQS DLQs still exist after teardown"
fi

if aws scheduler get-schedule-group --name wraps-selfhost-schedulers --region "$REGION" &>/dev/null; then
  fail "EventBridge Scheduler group wraps-selfhost-schedulers still exists"
else
  pass "EventBridge Scheduler group wraps-selfhost-schedulers removed"
fi

summary || { printf "${RED}Teardown FAILED${NC}\n"; exit 1; }

printf "\n${GREEN}Self-hosted deployment test PASSED${NC}\n"
