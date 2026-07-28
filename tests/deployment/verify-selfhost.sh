#!/usr/bin/env zsh
# Self-hosted control-plane verification functions.
#
# Source this AFTER verify.sh — it uses `pass`, `fail`, `section` and
# `aws_check` from there and defines nothing they need.
#
# Split out of verify.sh because the self-hosted surface has its own shape: two
# deploy variants (Pulumi `wraps selfhost deploy`, SST `pnpm selfhost:deploy`),
# a second console access role, a second control-plane identity, and a second
# SES event target. verify.sh stays the shared library for the four platform
# deployment paths.
#
# Everything here is READ-ONLY against AWS except verify_selfhost_event_delivery,
# which sends one email to the SES mailbox simulator.
#
# Convention (inherited from verify.sh): resource names are literal strings,
# never derived from the code under test, and no assertion ever prints a secret
# value — header names, key names and lengths only. This output gets pasted
# into issues.

# ─── Shared helpers ──────────────────────────────────────────────────

# IAM account of the Wraps SaaS platform. A self-hosted console role must NOT
# trust it (that is the whole point of the role split), and the platform role
# must never stop trusting it.
typeset -r WRAPS_PLATFORM_ACCOUNT_ID="905130073023"

typeset -r SELFHOST_CONSOLE_ROLE="wraps-selfhost-console-access-role"
typeset -r PLATFORM_CONSOLE_ROLE="wraps-console-access-role"
typeset -r AGENT_ENFORCER_FUNCTION="wraps-agent-enforcer"

# SST v3 derives physical names as `{app}-{stage}-{logicalName}-{suffix}`, so
# nothing can be fetched by exact name. These are the two halves the CLI's own
# recovery path matches on (packages/cli/src/utils/selfhost/api-url.ts).
typeset -r SST_FUNCTION_PREFIX="wraps-selfhost-production-"
typeset -r SST_API_LOGICAL_NAME="SelfhostApi"

# Set by verify_selfhost_sst_api so later phases (and the scenario script) can
# assert against what discovery actually found.
typeset -g SELFHOST_SST_API_FUNCTION=""
typeset -g SELFHOST_SST_API_URL=""

# Format an epoch as an ISO-8601 UTC timestamp. BSD date first (this harness
# runs on macOS), GNU date as the fallback.
_iso_utc() {
  date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ
}

# Echo every Lambda in the account whose name contains a substring.
#
# SST decorates the prefix differently per resource (the observed names include
# `wraps-selfh-production-…` and `prod-Selfhost…`, both truncated), so matching
# on the SST prefix alone misses functions. The logical name is the stable
# part — match on that.
#
# The AWS CLI paginates ListFunctions automatically; a busy account does not
# carry the target on page one.
selfhost_find_functions() {
  local region="${1:?region required}"
  local needle="${2:?needle required}"
  aws lambda list-functions \
    --region "$region" \
    --query "Functions[?contains(FunctionName, \`${needle}\`)].FunctionName" \
    --output json 2>/dev/null \
    | jq -r '.[]?' 2>/dev/null || true
}

# Echo a Lambda's environment variables as JSON, or `{}` if unreadable.
selfhost_lambda_env() {
  local region="${1:?region required}"
  local fn="${2:?function name required}"
  aws lambda get-function-configuration \
    --function-name "$fn" \
    --region "$region" \
    --query 'Environment.Variables' \
    --output json 2>/dev/null || echo '{}'
}

# Assert an env var equals an expected value. Values are printed — only use
# this for URLs and role names, never for secrets.
_assert_env_equals() {
  local env_json="$1" key="$2" expected="$3" label="$4"
  local actual
  actual=$(echo "$env_json" | jq -r --arg k "$key" '.[$k] // ""')
  if [[ "$actual" == "$expected" ]]; then
    pass "$label $key: $actual"
  else
    fail "$label $key: expected $expected, got ${actual:-<unset>}"
  fi
}

# Assert an env var is set and non-empty. Prints the key name and the value's
# length, never the value — this is the one used for licenses and DSNs.
_assert_env_present() {
  local env_json="$1" key="$2" label="$3" why="${4:-}"
  local actual
  actual=$(echo "$env_json" | jq -r --arg k "$key" '.[$k] // ""')
  if [[ -n "$actual" ]]; then
    pass "$label $key is set (${#actual} chars)"
  else
    fail "$label $key is unset or empty" "$why"
  fi
}

# ─── Self-hosted console access role (plans 134, 137, 144, 145, 147) ──

# Verify the console access role split: each control plane gets its OWN role,
# because an IAM trust policy names one principal and sharing a role forces the
# two planes to overwrite each other's trust policy.
#
# Asserts in BOTH directions. The regression this catches is not "the
# self-hosted role is wrong" — it is "connecting one plane silently broke the
# other", which only shows up if you look at the plane you were not touching.
#
# Args:
#   $1 account_id — the AWS account the roles live in (the self-hosted plane's
#                   own account, and the principal its role must trust)
verify_selfhost_console_role() {
  local account_id="${1:?account_id is required}"

  section "Self-hosted: console access role"

  local role_output
  if role_output=$(aws_check iam get-role --role-name "$SELFHOST_CONSOLE_ROLE"); then
    pass "IAM role $SELFHOST_CONSOLE_ROLE exists"

    # Trusts the customer's OWN account: a self-hosted dashboard runs in that
    # account and assumes this role from there.
    if echo "$role_output" \
      | jq -e --arg a "$account_id" \
        '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.AWS | tostring | contains($a))' \
        &>/dev/null; then
      pass "Self-hosted console role trusts its own account $account_id"
    else
      fail "Self-hosted console role does not trust account $account_id" \
        "the self-hosted dashboard assumes this role from the customer's own account — AssumeRole will fail"
    fi

    # And must NOT trust the Wraps platform. If it does, the role was written
    # by a connect that did not know it was self-hosted.
    if echo "$role_output" \
      | jq -e --arg p "$WRAPS_PLATFORM_ACCOUNT_ID" \
        '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.AWS | tostring | contains($p))' \
        &>/dev/null; then
      fail "Self-hosted console role trusts the Wraps platform account $WRAPS_PLATFORM_ACCOUNT_ID" \
        "a self-hosted role must trust only the customer's own account — this grants Wraps access to a self-hosted install"
    else
      pass "Self-hosted console role does not trust the Wraps platform account"
    fi

    if echo "$role_output" \
      | jq -e '.Role.AssumeRolePolicyDocument.Statement[] | select(.Condition.StringEquals["sts:ExternalId"])' \
        &>/dev/null; then
      pass "Self-hosted console role requires an ExternalId condition"
    else
      fail "Self-hosted console role missing ExternalId condition"
    fi

    local console_policy
    if console_policy=$(aws_check iam get-role-policy \
      --role-name "$SELFHOST_CONSOLE_ROLE" \
      --policy-name "wraps-console-access-policy"); then
      pass "Self-hosted console role has inline policy wraps-console-access-policy"

      local action
      for action in "ses:GetAccount" "ses:ListEmailIdentities" "cloudwatch:GetMetricData"; do
        if echo "$console_policy" | jq -e --arg a "$action" \
          '[.PolicyDocument.Statement[].Action] | flatten | index($a)' &>/dev/null; then
          pass "Self-hosted console policy grants $action"
        else
          fail "Self-hosted console policy missing $action" \
            "the self-hosted dashboard reads SES state through this role"
        fi
      done
    else
      fail "Self-hosted console role has no wraps-console-access-policy inline policy" \
        "run 'wraps selfhost update-role' to repair it"
    fi
  else
    fail "IAM role $SELFHOST_CONSOLE_ROLE not found" \
      "run 'wraps selfhost connect' — the self-hosted dashboard has no way to read AWS state without it"
  fi

  # The other direction: an ordinary `wraps platform connect` (or update-role)
  # run from a machine that has deployed self-hosted must not have rewritten
  # the platform role's principal. Only asserted when the platform role exists;
  # a self-hosted-only account legitimately has no platform role.
  local platform_role_output
  if platform_role_output=$(aws_check iam get-role --role-name "$PLATFORM_CONSOLE_ROLE"); then
    if echo "$platform_role_output" \
      | jq -e --arg p "$WRAPS_PLATFORM_ACCOUNT_ID" \
        '.Role.AssumeRolePolicyDocument.Statement[] | select(.Principal.AWS | tostring | contains($p))' \
        &>/dev/null; then
      pass "Platform console role still trusts the Wraps platform account $WRAPS_PLATFORM_ACCOUNT_ID"
    else
      fail "Platform console role no longer trusts $WRAPS_PLATFORM_ACCOUNT_ID" \
        "a self-hosted connect rewrote the platform role's trust policy — app.wraps.dev's AssumeRole is broken for this account"
    fi
  else
    pass "No platform console role in this account (self-hosted only — nothing to clobber)"
  fi
}

# Verify the agent enforcer invoke grant reaches the self-hosted console role.
#
# The grant is deliberately best-effort in the stack (a missing role is skipped
# with a warning, never a stack failure), so a missing grant does not fail a
# deploy — it fails the approval flow's execute step later, with an IAM denial
# and no deploy-time signal. That is exactly the kind of thing only a real-AWS
# assertion catches.
#
# Skipped when the account has no enforcer: agents are opt-in.
verify_selfhost_enforcer_grant() {
  local region="${1:?region required}"

  section "Self-hosted: agent enforcer invoke grant"

  if ! aws lambda get-function \
    --function-name "$AGENT_ENFORCER_FUNCTION" \
    --region "$region" &>/dev/null; then
    pass "No $AGENT_ENFORCER_FUNCTION in this account — agent approval flow not deployed, nothing to grant"
    return 0
  fi

  # Declared once, outside the loop: in zsh, re-running `local name` for a
  # variable that is already local PRINTS it — which on the second iteration
  # dumps the value to stdout. Harmless for a role name, not harmless for the
  # env dumps these helpers handle elsewhere.
  local role policy_names found_grant policy_name policy_doc
  for role in "$SELFHOST_CONSOLE_ROLE" "$PLATFORM_CONSOLE_ROLE"; do
    if ! aws iam get-role --role-name "$role" &>/dev/null; then
      continue
    fi

    found_grant="false"
    if policy_names=$(aws_check iam list-role-policies --role-name "$role"); then
      for policy_name in $(echo "$policy_names" | jq -r '.PolicyNames[]?'); do
        policy_doc=$(aws_check iam get-role-policy \
          --role-name "$role" --policy-name "$policy_name") || continue
        # Both the action and the enforcer ARN must match: a role that can
        # invoke some other Lambda is not the grant we are looking for.
        if echo "$policy_doc" | jq -e --arg f "$AGENT_ENFORCER_FUNCTION" \
          '.PolicyDocument.Statement[]
             | select((.Action | tostring | contains("lambda:InvokeFunction"))
                      and (.Resource | tostring | contains($f)))' &>/dev/null; then
          found_grant="true"
          break
        fi
      done
    fi

    if [[ "$found_grant" == "true" ]]; then
      pass "$role can invoke $AGENT_ENFORCER_FUNCTION"
    else
      fail "$role has no policy granting lambda:InvokeFunction on $AGENT_ENFORCER_FUNCTION" \
        "the agent approval flow's execute step will fail with an IAM denial — re-run 'wraps email upgrade' after connecting this plane"
    fi
  done
}

# ─── Control-plane identity + webhook metadata (plans 135, 138, 144) ──

# Verify the local connection metadata that the two control planes share.
#
# This is a file, not AWS, but it is the single place where one plane can
# destroy the other's identity — `metadata.platform` and
# `metadata.selfhostPlatform` are separate slots precisely because they were
# once one, and whichever plane connected last silently broke the other's
# sts:ExternalId condition.
#
# Args:
#   $1 account_id       — AWS account
#   $2 region           — AWS region
#   $3 expected_api_url — the self-hosted API base URL (no trailing slash)
#   $4 expected_variant — "sst" or "pulumi"
verify_selfhost_metadata() {
  local account_id="${1:?account_id is required}"
  local region="${2:?region is required}"
  local expected_api_url="${3:?expected_api_url is required}"
  local expected_variant="${4:?expected_variant is required}"

  section "Self-hosted: connection metadata"

  local metadata_file="${HOME}/.wraps/connections/${account_id}-${region}.json"
  if [[ ! -f "$metadata_file" ]]; then
    fail "No connection metadata at $metadata_file" \
      "every assertion below reads this file"
    return 0
  fi
  pass "Connection metadata present for ${account_id}/${region}"

  local metadata
  metadata=$(cat "$metadata_file")

  local variant
  variant=$(echo "$metadata" | jq -r '.services.selfhost.variant // ""')
  if [[ "$variant" == "$expected_variant" ]]; then
    pass "Self-hosted variant: $variant"
  else
    fail "Self-hosted variant: expected $expected_variant, got ${variant:-<unset>}" \
      "the two variants share account-global IAM resources and cannot coexist"
  fi

  # `apiUrl` is persisted empty before the stack runs, so an interrupted deploy
  # leaves the service present but unusable. It is also what `wraps selfhost
  # connect` POSTs the control-plane API key to, so a stale value is not a
  # cosmetic problem.
  local api_url
  api_url=$(echo "$metadata" | jq -r '.services.selfhost.apiUrl // ""')
  if [[ "${api_url%/}" == "$expected_api_url" ]]; then
    pass "Metadata apiUrl matches the live control plane"
  else
    fail "Metadata apiUrl mismatch" \
      "expected $expected_api_url, got ${api_url:-<empty>} — run 'wraps selfhost status' to reconcile it from AWS"
  fi

  # Identity split. Each plane issues its own externalId; it is the
  # sts:ExternalId condition on that plane's console role.
  local selfhost_external_id platform_external_id
  selfhost_external_id=$(echo "$metadata" | jq -r '.selfhostPlatform.externalId // ""')
  platform_external_id=$(echo "$metadata" | jq -r '.platform.externalId // ""')

  if [[ -n "$selfhost_external_id" ]]; then
    pass "selfhostPlatform.externalId is set (${#selfhost_external_id} chars)"
    if [[ "$selfhost_external_id" == wraps_* ]]; then
      pass "selfhostPlatform.externalId carries the wraps_ prefix"
    else
      fail "selfhostPlatform.externalId does not start with wraps_" \
        "customer trust policies are keyed on this prefix"
    fi
  else
    fail "selfhostPlatform.externalId is unset" \
      "run 'wraps selfhost connect' — without it 'wraps selfhost update-role' cannot repair the trust policy"
  fi

  if [[ -n "$platform_external_id" ]]; then
    if [[ "$platform_external_id" == "$selfhost_external_id" ]]; then
      fail "platform.externalId and selfhostPlatform.externalId are identical" \
        "the two planes issue different IDs — identical values mean one connect overwrote the other's slot"
    else
      pass "platform and selfhostPlatform identities are distinct"
    fi
  else
    pass "No platform identity in metadata (self-hosted only — nothing to clobber)"
  fi

  section "Self-hosted: SES webhook target metadata"

  local selfhost_webhook_url selfhost_webhook_secret
  selfhost_webhook_url=$(echo "$metadata" | jq -r '.services.email.selfhostWebhook.url // ""')
  selfhost_webhook_secret=$(echo "$metadata" | jq -r '.services.email.selfhostWebhook.secret // ""')

  if [[ "${selfhost_webhook_url%/}" == "$expected_api_url" ]]; then
    pass "services.email.selfhostWebhook.url points at the self-hosted API"
  else
    fail "services.email.selfhostWebhook.url mismatch" \
      "expected $expected_api_url, got ${selfhost_webhook_url:-<unset>} — SES events will not reach this control plane"
  fi

  if [[ -n "$selfhost_webhook_secret" ]]; then
    pass "services.email.selfhostWebhook.secret is set (${#selfhost_webhook_secret} chars)"
  else
    fail "services.email.selfhostWebhook.secret is unset" \
      "the EventBridge connection has no API key to send — every event 401s"
  fi

  # The legacy `--reroute-events` path wrote the self-hosted URL into the
  # PRIMARY webhook fields, which are now reserved for the platform. Leaving it
  # in place builds two targets pointed at the same self-hosted API and
  # delivers every event twice; `wraps selfhost connect` migrates it.
  local legacy_webhook_url
  legacy_webhook_url=$(echo "$metadata" | jq -r '.services.email.webhookUrl // ""')
  if [[ -z "$legacy_webhook_url" ]]; then
    pass "No legacy services.email.webhookUrl (reroute migration is complete)"
  else
    fail "services.email.webhookUrl is still set to $legacy_webhook_url" \
      "the legacy --reroute-events target coexists with the selfhost target — every SES event is delivered twice"
  fi

  # Only meaningful once the platform has also connected. When it has, the
  # platform's own secret must have survived the self-hosted connect.
  if [[ -n "$platform_external_id" ]]; then
    local platform_webhook_secret
    platform_webhook_secret=$(echo "$metadata" | jq -r '.services.email.webhookSecret // ""')
    if [[ -n "$platform_webhook_secret" ]]; then
      pass "services.email.webhookSecret survives (${#platform_webhook_secret} chars) — app.wraps.dev still authenticates"
    else
      fail "services.email.webhookSecret was cleared while a platform identity exists" \
        "buildEmailStackConfig will skip the platform webhook and 'wraps email upgrade' will DESTROY app.wraps.dev's event target"
    fi
  fi
}

# ─── SST deployment variant (plans 142, 146, 148, 149) ────────────────

# Verify the self-hosted API Lambda deployed by `pnpm selfhost:deploy` (SST).
#
# Sets SELFHOST_SST_API_FUNCTION and SELFHOST_SST_API_URL for later phases.
#
# Args:
#   $1 region  — AWS region
#   $2 app_url — the dashboard URL this deployment serves (e.g. https://demo.wraps.dev)
verify_selfhost_sst_api() {
  local region="${1:?region required}"
  local app_url="${2:?app_url required}"

  section "Self-hosted (SST): API Lambda discovery"

  local -a matches
  matches=($(selfhost_find_functions "$region" "$SST_API_LOGICAL_NAME"))

  # Exactly one, deliberately. The CLI's own recovery path returns null rather
  # than picking between candidates, because the URL it recovers is where it
  # POSTs the customer's control-plane API key — no answer is safer than a
  # wrong host. The harness holds the same line.
  if (( ${#matches[@]} == 1 )); then
    SELFHOST_SST_API_FUNCTION="${matches[1]}"
    pass "Found exactly one $SST_API_LOGICAL_NAME function: $SELFHOST_SST_API_FUNCTION"
  elif (( ${#matches[@]} == 0 )); then
    fail "No Lambda matching $SST_API_LOGICAL_NAME in $region" \
      "'wraps selfhost status' resolves the API URL by this same scan and will report the deployment as missing"
    return 0
  else
    fail "${#matches[@]} Lambdas match $SST_API_LOGICAL_NAME: ${matches[*]}" \
      "resolveSelfhostApiUrl refuses to choose between candidates and returns null — API URL recovery is broken until one is removed"
    return 0
  fi

  if [[ "$SELFHOST_SST_API_FUNCTION" == "${SST_FUNCTION_PREFIX}"* ]]; then
    pass "API function carries the SST prefix $SST_FUNCTION_PREFIX"
  else
    fail "API function does not start with $SST_FUNCTION_PREFIX: $SELFHOST_SST_API_FUNCTION" \
      "resolveSelfhostApiUrl matches on this prefix — recovery will not find this function"
  fi

  section "Self-hosted (SST): API Lambda configuration"

  local config_out
  config_out=$(aws lambda get-function-configuration \
    --function-name "$SELFHOST_SST_API_FUNCTION" \
    --region "$region" --output json 2>/dev/null || echo '{}')

  local runtime
  runtime=$(echo "$config_out" | jq -r '.Runtime // ""')
  if [[ "$runtime" == "nodejs24.x" ]]; then
    pass "API Lambda runtime: $runtime"
  else
    fail "API Lambda runtime: expected nodejs24.x, got ${runtime:-<unknown>} (see infra/selfhost.config.ts)"
  fi

  local env_json
  env_json=$(selfhost_lambda_env "$region" "$SELFHOST_SST_API_FUNCTION")

  # Plan 142. The API reads WRAPS_LICENSE_KEY (apps/api ee/lib/license.ts); the
  # config used to inject the same value as LICENSE_KEY, so isSelfHosted() was
  # false on every request and rate limits, plan gates and the monthly event
  # cap all stayed enforced on a licensed deployment — with the 429 pointing
  # the customer at app.wraps.dev to upgrade.
  _assert_env_present "$env_json" "WRAPS_LICENSE_KEY" "API" \
    "isSelfHosted() is false without it — rate limits, plan gates and the monthly event cap stay enforced on a licensed install"

  if echo "$env_json" | jq -e 'has("LICENSE_KEY") and (has("WRAPS_LICENSE_KEY") | not)' &>/dev/null; then
    fail "API Lambda has LICENSE_KEY but not WRAPS_LICENSE_KEY" \
      "this is the pre-142 shape — the license is injected under a name the API never reads"
  else
    pass "API Lambda license is not injected under the bare LICENSE_KEY name alone"
  fi

  # Plan 137. The API stores and assumes a role by this name; sharing the
  # platform's would overwrite its single-principal trust policy.
  _assert_env_equals "$env_json" "WRAPS_CONSOLE_ROLE_NAME" "$SELFHOST_CONSOLE_ROLE" "API"

  # Plan 149 / the two-pass URL bake. The API builds links into emails, so a
  # missing or platform-defaulted URL emails self-hosted recipients links to
  # app.wraps.dev — a server that has never heard of their unsubscribe token.
  _assert_env_equals "$env_json" "NEXT_PUBLIC_APP_URL" "$app_url" "API"
  _assert_env_equals "$env_json" "BETTER_AUTH_URL" "$app_url" "API"

  _assert_env_present "$env_json" "DATABASE_URL" "API"
  _assert_env_present "$env_json" "UNSUBSCRIBE_SECRET" "API"
  _assert_env_present "$env_json" "BETTER_AUTH_SECRET" "API"

  local key
  for key in BATCH_QUEUE_URL BATCH_QUEUE_ARN WORKFLOW_QUEUE_URL WORKFLOW_QUEUE_ARN \
             RATE_LIMIT_TABLE_NAME SCHEDULER_ROLE_ARN SCHEDULER_GROUP_NAME; do
    if echo "$env_json" | jq -e --arg k "$key" '.[$k] // "" | length > 0' &>/dev/null; then
      pass "API env var: $key"
    else
      fail "API missing env var: $key"
    fi
  done

  section "Self-hosted (SST): API Function URL"

  local url_out
  if url_out=$(aws_check lambda get-function-url-config \
    --function-name "$SELFHOST_SST_API_FUNCTION" \
    --region "$region"); then
    SELFHOST_SST_API_URL=$(echo "$url_out" | jq -r '.FunctionUrl // ""')
    SELFHOST_SST_API_URL="${SELFHOST_SST_API_URL%/}"
    pass "API Function URL exists: $SELFHOST_SST_API_URL"

    local auth_type
    auth_type=$(echo "$url_out" | jq -r '.AuthType // ""')
    if [[ "$auth_type" == "NONE" ]]; then
      pass "API Function URL auth: NONE"
    else
      fail "API Function URL auth: expected NONE, got $auth_type" \
        "EventBridge API destinations cannot sign SigV4 — SES events would stop being delivered"
    fi
  else
    fail "API Function URL not found for $SELFHOST_SST_API_FUNCTION" \
      "the control plane has no reachable endpoint"
  fi

  if [[ -n "$SELFHOST_SST_API_URL" ]]; then
    section "Self-hosted (SST): API health"

    # -s without -f: a 4xx/5xx is still a reachable Lambda, and `|| true`
    # covers transport failures (DNS, timeout) so the readable diagnosis below
    # survives `set -e`.
    local health_status
    health_status=$(curl -s -o /dev/null -w '%{http_code}' \
      --max-time 15 "${SELFHOST_SST_API_URL}/health" 2>/dev/null || true)
    [[ -z "$health_status" ]] && health_status="000"

    if [[ "$health_status" == "200" ]]; then
      pass "GET /health returned 200"
    elif [[ "$health_status" =~ ^[1-9][0-9][0-9]$ ]]; then
      fail "GET /health returned HTTP $health_status" \
        "the Function URL is reachable but the API is not healthy"
    else
      fail "GET ${SELFHOST_SST_API_URL}/health got no HTTP response" \
        "transport failure — DNS, timeout, or the Function URL is not public"
    fi
  fi
}

# Verify the Next.js dashboard Lambda (OpenNext server function).
#
# The load-bearing assertion is WRAPS_LICENSE_KEY: `isSelfHosted()` reads it
# server-side, and it is what tells the settings page it is a self-hosted
# dashboard. Without it the AWS-connect UI falls back to the platform
# CloudFormation template — a role trusting the Wraps platform account,
# offered to a customer who is not on the platform (plan 146).
verify_selfhost_sst_web() {
  local region="${1:?region required}"
  local app_url="${2:?app_url required}"

  section "Self-hosted (SST): dashboard Lambda"

  local -a matches
  matches=($(selfhost_find_functions "$region" "SelfhostWebServer"))

  if (( ${#matches[@]} != 1 )); then
    fail "Expected exactly one SelfhostWebServer function, found ${#matches[@]}" \
      "${matches[*]:-none}"
    return 0
  fi

  local web_fn="${matches[1]}"
  pass "Found dashboard function: $web_fn"

  local env_json
  env_json=$(selfhost_lambda_env "$region" "$web_fn")

  _assert_env_present "$env_json" "WRAPS_LICENSE_KEY" "Dashboard" \
    "isSelfHosted() is false without it — the AWS-connect settings page serves the PLATFORM CloudFormation template, creating a role that trusts $WRAPS_PLATFORM_ACCOUNT_ID"

  _assert_env_equals "$env_json" "NEXT_PUBLIC_APP_URL" "$app_url" "Dashboard"
  _assert_env_equals "$env_json" "CORS_ORIGIN" "$app_url" "Dashboard"
  _assert_env_present "$env_json" "NEXT_PUBLIC_API_URL" "Dashboard"
  _assert_env_present "$env_json" "DATABASE_URL" "Dashboard"

  # The dashboard assumes wraps-* roles in this account for SES reads.
  _assert_env_present "$env_json" "AWS_BACKEND_ACCOUNT_ID" "Dashboard"
}

# Verify the queue subscriber Lambdas that build recipient-facing links.
#
# batch-sender and workflow-processor render unsubscribe and preference-centre
# URLs. They resolve the dashboard from APP_BASE_URL; a self-hosted deployment
# whose workers fall back to the platform emails recipients links to a server
# that has never seen their token (plan 149).
verify_selfhost_sst_workers() {
  local region="${1:?region required}"
  local app_url="${2:?app_url required}"

  section "Self-hosted (SST): send-path workers"

  # All declared before the loop — `local` on an already-local name prints it
  # in zsh, and `env_json` holds the function's full environment.
  local worker label needle env_json
  local -a matches
  for worker in "SelfhostBatchQueueSubscriber:batch sender" \
                "SelfhostWorkflowQueueSubscriber:workflow processor"; do
    needle="${worker%%:*}"
    label="${worker##*:}"

    matches=($(selfhost_find_functions "$region" "$needle"))

    if (( ${#matches[@]} != 1 )); then
      fail "Expected exactly one $needle function ($label), found ${#matches[@]}" \
        "${matches[*]:-none}"
      continue
    fi

    env_json=$(selfhost_lambda_env "$region" "${matches[1]}")

    _assert_env_equals "$env_json" "APP_BASE_URL" "$app_url" "Worker ($label)"
    _assert_env_present "$env_json" "API_BASE_URL" "Worker ($label)"
    _assert_env_present "$env_json" "DATABASE_URL" "Worker ($label)"
  done
}

# Verify error reporting points at the SELF-HOSTER's Sentry, not ours.
#
# Two failure modes, opposite directions:
#   1. No DSN at all — the error page's "our team has been notified" is false
#      and the Error ID resolves nowhere but the customer's own CloudWatch.
#   2. Wraps' own DSN baked in — a maintainer running a customer deploy with
#      SENTRY_DSN exported streams that customer's errors to us. The config
#      reads .env.selfhost precisely to avoid this, which is only observable
#      against a real deployment.
#
# Gated: a deployment with no Sentry configured is a legitimate state, so set
# WRAPS_SELFHOST_EXPECT_SENTRY=1 to require a DSN. Set
# WRAPS_PLATFORM_SENTRY_DSN to Wraps' own DSN to enable the leak check.
verify_selfhost_sentry() {
  local region="${1:?region required}"
  local expect="${WRAPS_SELFHOST_EXPECT_SENTRY:-0}"

  section "Self-hosted (SST): Sentry ownership"

  local -a api_matches web_matches
  api_matches=($(selfhost_find_functions "$region" "$SST_API_LOGICAL_NAME"))
  web_matches=($(selfhost_find_functions "$region" "SelfhostWebServer"))

  if (( ${#api_matches[@]} != 1 || ${#web_matches[@]} != 1 )); then
    fail "Could not resolve both the API and dashboard functions for the Sentry check"
    return 0
  fi

  local api_env web_env api_dsn web_dsn web_public_dsn
  api_env=$(selfhost_lambda_env "$region" "${api_matches[1]}")
  web_env=$(selfhost_lambda_env "$region" "${web_matches[1]}")
  api_dsn=$(echo "$api_env" | jq -r '.SENTRY_DSN // ""')
  web_dsn=$(echo "$web_env" | jq -r '.SENTRY_DSN // ""')
  web_public_dsn=$(echo "$web_env" | jq -r '.NEXT_PUBLIC_SENTRY_DSN // ""')

  if [[ "$expect" != "1" ]]; then
    if [[ -z "$api_dsn" && -z "$web_dsn" ]]; then
      pass "No Sentry DSN configured on either function (set WRAPS_SELFHOST_EXPECT_SENTRY=1 to require one)"
    else
      pass "Sentry DSN present (not required — WRAPS_SELFHOST_EXPECT_SENTRY is not 1)"
    fi
  else
    if [[ -n "$api_dsn" ]]; then
      pass "API SENTRY_DSN is set (${#api_dsn} chars)"
    else
      fail "API SENTRY_DSN is unset" \
        "redeploy with --sentry-dsn; API errors reach nobody"
    fi

    if [[ -n "$web_dsn" ]]; then
      pass "Dashboard SENTRY_DSN is set (${#web_dsn} chars)"
    else
      fail "Dashboard SENTRY_DSN is unset" "server-side dashboard errors reach nobody"
    fi

    # The browser SDK reads the NEXT_PUBLIC_ copy, inlined at build time. One
    # input feeds both, so a mismatch means a stale build.
    if [[ -n "$web_public_dsn" && "$web_public_dsn" == "$web_dsn" ]]; then
      pass "Dashboard NEXT_PUBLIC_SENTRY_DSN matches SENTRY_DSN"
    else
      fail "Dashboard NEXT_PUBLIC_SENTRY_DSN is unset or differs from SENTRY_DSN" \
        "browser errors go to a different project than server errors — both come from one input, so this is a stale build"
    fi
  fi

  # The leak check runs whichever way EXPECT is set: a DSN that should not be
  # there is worse than none.
  local wraps_dsn="${WRAPS_PLATFORM_SENTRY_DSN:-}"
  if [[ -z "$wraps_dsn" ]]; then
    pass "Skipping Sentry leak check (set WRAPS_PLATFORM_SENTRY_DSN to Wraps' own DSN to enable it)"
  elif [[ "$api_dsn" == "$wraps_dsn" || "$web_dsn" == "$wraps_dsn" ]]; then
    fail "This deployment reports errors to WRAPS' OWN Sentry project" \
      "a maintainer deploy with SENTRY_DSN exported baked our DSN in — the customer's errors are streaming to us"
  else
    pass "Deployment does not report to Wraps' own Sentry project"
  fi
}

# ─── Shared self-hosted infrastructure ────────────────────────────────

# Verify the queues, table and scheduler group the control plane runs on.
#
# Physical names differ per variant (Pulumi pins them, SST decorates them), so
# they are discovered from the API Lambda's own environment rather than
# guessed — the env var IS how the API finds them, so a mismatch there is the
# failure, not a naming difference.
verify_selfhost_runtime_resources() {
  local region="${1:?region required}"
  local api_fn="${2:?api function name required}"

  section "Self-hosted: runtime resources"

  local env_json
  env_json=$(selfhost_lambda_env "$region" "$api_fn")

  local table_name
  table_name=$(echo "$env_json" | jq -r '.RATE_LIMIT_TABLE_NAME // ""')
  if [[ -n "$table_name" ]]; then
    local table_out
    if table_out=$(aws_check dynamodb describe-table \
      --table-name "$table_name" --region "$region"); then
      pass "Rate-limit table $table_name exists"

      local billing
      billing=$(echo "$table_out" | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')
      if [[ "$billing" == "PAY_PER_REQUEST" ]]; then
        pass "Rate-limit table billing: PAY_PER_REQUEST"
      else
        fail "Rate-limit table billing: expected PAY_PER_REQUEST, got $billing"
      fi

      local ttl_attr
      ttl_attr=$(aws dynamodb describe-time-to-live \
        --table-name "$table_name" --region "$region" \
        --query 'TimeToLiveDescription.AttributeName' --output text 2>/dev/null || echo "NONE")
      if [[ "$ttl_attr" == "expiresAt" ]]; then
        pass "Rate-limit table TTL on expiresAt"
      else
        fail "Rate-limit table TTL attribute: expected expiresAt, got $ttl_attr" \
          "rate-limit rows accumulate forever without it"
      fi
    else
      fail "Rate-limit table $table_name not found" "the API reads this name from its own environment"
    fi
  else
    fail "API has no RATE_LIMIT_TABLE_NAME — cannot verify the rate-limit table"
  fi

  local queue_key label queue_url attrs visibility redrive max_receive
  for queue_key in "BATCH_QUEUE_URL:batch" "WORKFLOW_QUEUE_URL:workflow"; do
    label="${queue_key##*:}"
    queue_url=$(echo "$env_json" | jq -r --arg k "${queue_key%%:*}" '.[$k] // ""')
    if [[ -z "$queue_url" ]]; then
      fail "API has no ${queue_key%%:*} — cannot verify the $label queue"
      continue
    fi

    if attrs=$(aws_check sqs get-queue-attributes \
      --queue-url "$queue_url" --attribute-names All --region "$region"); then
      pass "SQS $label queue exists"

      # Must be >= the API Lambda's timeout or SQS refuses the event source
      # mapping — this is a floor, not a preference.
      visibility=$(echo "$attrs" | jq -r '.Attributes.VisibilityTimeout // "0"')
      if (( visibility >= 300 )); then
        pass "SQS $label visibility timeout: ${visibility}s"
      else
        fail "SQS $label visibility timeout is ${visibility}s, expected >= 300" \
          "must be at least the consumer Lambda's timeout or messages redeliver mid-send"
      fi

      redrive=$(echo "$attrs" | jq -r '.Attributes.RedrivePolicy // ""')
      if [[ -n "$redrive" ]]; then
        pass "SQS $label queue has a redrive policy"
        max_receive=$(echo "$redrive" | jq -r '.maxReceiveCount // 0' 2>/dev/null || echo 0)
        if [[ "$max_receive" == "3" ]]; then
          pass "SQS $label maxReceiveCount: 3"
        else
          fail "SQS $label maxReceiveCount: expected 3, got $max_receive"
        fi
      else
        fail "SQS $label queue has no redrive policy" \
          "a poison message retries forever instead of landing in a DLQ"
      fi
    else
      fail "SQS $label queue not reachable at $queue_url"
    fi
  done

  local group_name
  group_name=$(echo "$env_json" | jq -r '.SCHEDULER_GROUP_NAME // ""')
  if [[ -n "$group_name" ]]; then
    local group_state
    group_state=$(aws scheduler get-schedule-group --name "$group_name" \
      --region "$region" --query 'State' --output text 2>/dev/null || echo "MISSING")
    if [[ "$group_state" == "ACTIVE" ]]; then
      pass "Scheduler group $group_name is ACTIVE"
    else
      fail "Scheduler group $group_name state: $group_state" \
        "scheduled sends have nowhere to land"
    fi
  else
    fail "API has no SCHEDULER_GROUP_NAME — cannot verify the scheduler group"
  fi

  # Account-global name, shared by both variants — which is why the two cannot
  # coexist in one account.
  if aws iam get-role --role-name wraps-selfhost-scheduler-role &>/dev/null; then
    pass "IAM role wraps-selfhost-scheduler-role exists"
  else
    fail "IAM role wraps-selfhost-scheduler-role not found"
  fi
}

# ─── Live SES event delivery ──────────────────────────────────────────

# Send one real email and prove the events actually land.
#
# The coexistence checks assert WIRING — that the target, destination and
# connection exist with the right endpoint and header name. None of that
# catches a wrong secret: EventBridge happily POSTs an API key the control
# plane rejects, and a 401 shows up only as a FailedInvocations datapoint. This
# is the assertion that closes that gap.
#
# Mutating (one send to the SES mailbox simulator, which never leaves AWS and
# never reaches a real recipient). Everything else in this file is read-only.
#
# Args:
#   $1 region       — AWS region
#   $2 from_address — a verified sender on the test domain
#   $3 config_set   — SES configuration set carrying the EventBridge destination
verify_selfhost_event_delivery() {
  local region="${1:?region required}"
  local from_address="${2:?from_address required}"
  local config_set="${3:?config_set required}"
  local rule_name="wraps-email-events-to-sqs"
  local dlq_name="wraps-email-events-dlq"

  section "Self-hosted: live SES event delivery"

  # Baseline the DLQ before sending. A 401 or 5xx from either control plane
  # lands here after EventBridge exhausts its retries.
  local dlq_url dlq_before="0"
  dlq_url=$(aws sqs get-queue-url --queue-name "$dlq_name" --region "$region" \
    --query 'QueueUrl' --output text 2>/dev/null || true)
  if [[ -n "$dlq_url" ]]; then
    dlq_before=$(aws sqs get-queue-attributes --queue-url "$dlq_url" \
      --attribute-names ApproximateNumberOfMessages --region "$region" \
      --query 'Attributes.ApproximateNumberOfMessages' --output text 2>/dev/null || echo "0")
    pass "Event DLQ $dlq_name baseline: $dlq_before message(s)"
  else
    fail "Event DLQ $dlq_name not found" \
      "undeliverable events are dropped silently without it"
  fi

  # CloudWatch buckets by minute, so start the window a minute back.
  local -i window_start
  window_start=$(( $(date -u +%s) - 60 ))

  local stamp send_out message_id
  stamp=$(date -u +%s)
  send_out=$(aws sesv2 send-email \
    --region "$region" \
    --from-email-address "$from_address" \
    --destination "ToAddresses=success@simulator.amazonses.com" \
    --configuration-set-name "$config_set" \
    --content "Simple={Subject={Data=wraps deployment test ${stamp},Charset=utf-8},Body={Text={Data=wraps deployment test ${stamp},Charset=utf-8}}}" \
    --output json 2>&1) || true

  message_id=$(echo "$send_out" | jq -r '.MessageId // ""' 2>/dev/null || true)
  if [[ -n "$message_id" ]]; then
    pass "Sent test email via config set $config_set (MessageId ${message_id})"
  else
    fail "SES send failed" "$send_out"
    return 0
  fi

  # EventBridge metrics lag 1-3 minutes. Poll rather than sleep-and-hope.
  printf "${CYAN}  Waiting for EventBridge to report the invocation (up to 5 min)...${NC}\n"
  local -i deadline=$(( $(date -u +%s) + 300 ))
  local -i invocations=0
  while (( $(date -u +%s) < deadline )); do
    invocations=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/Events --metric-name Invocations \
      --dimensions "Name=RuleName,Value=${rule_name}" \
      --start-time "$(_iso_utc $window_start)" \
      --end-time "$(_iso_utc $(date -u +%s))" \
      --period 60 --statistics Sum \
      --region "$region" \
      --query 'sum(Datapoints[].Sum)' --output text 2>/dev/null || echo 0)
    invocations=${invocations%%.*}
    [[ -z "$invocations" || "$invocations" == "None" ]] && invocations=0
    (( invocations > 0 )) && break
    sleep 20
  done

  if (( invocations > 0 )); then
    pass "EventBridge rule $rule_name reported $invocations invocation(s) after the send"
  else
    fail "EventBridge rule $rule_name reported no invocations within 5 minutes" \
      "the SES configuration set is not delivering to EventBridge — check its event destination"
  fi

  local -i failed
  failed=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Events --metric-name FailedInvocations \
    --dimensions "Name=RuleName,Value=${rule_name}" \
    --start-time "$(_iso_utc $window_start)" \
    --end-time "$(_iso_utc $(date -u +%s))" \
    --period 60 --statistics Sum \
    --region "$region" \
    --query 'sum(Datapoints[].Sum)' --output text 2>/dev/null || echo 0)
  failed=${failed%%.*}
  [[ -z "$failed" || "$failed" == "None" ]] && failed=0

  if (( failed == 0 )); then
    pass "No FailedInvocations on $rule_name during the send window"
  else
    fail "$failed FailedInvocation(s) on $rule_name during the send window" \
      "at least one target rejected the event — a control plane answering 401 means its webhook secret does not match the EventBridge connection's API key"
  fi

  if [[ -n "$dlq_url" ]]; then
    # Give EventBridge time to exhaust retries into the DLQ before reading it.
    sleep 30
    local dlq_after
    dlq_after=$(aws sqs get-queue-attributes --queue-url "$dlq_url" \
      --attribute-names ApproximateNumberOfMessages --region "$region" \
      --query 'Attributes.ApproximateNumberOfMessages' --output text 2>/dev/null || echo "0")
    if (( dlq_after <= dlq_before )); then
      pass "Event DLQ did not grow (still $dlq_after message(s))"
    else
      fail "Event DLQ grew from $dlq_before to $dlq_after" \
        "an undeliverable event was dead-lettered — inspect it with 'aws sqs receive-message --queue-url $dlq_url'"
    fi
  fi
}
