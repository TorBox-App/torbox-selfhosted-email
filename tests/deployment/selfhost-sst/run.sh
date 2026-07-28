#!/usr/bin/env zsh
# Self-hosted control plane — SST variant (`pnpm selfhost:deploy` from a fork).
#
# Verifies an EXISTING deployment. It never deploys and never tears down: the
# SST variant is deployed from a fork of this repo, and the account it runs in
# is a live demo, not a scratch account.
#
# The sibling `selfhost/run.sh` covers the Pulumi variant end to end (deploy →
# verify → teardown) and hardcodes that variant's fixed physical names. SST
# derives every name as `{app}-{stage}-{logical}-{suffix}`, so nothing here can
# be fetched by exact name — the same constraint that made the CLI's own API
# URL recovery a paginated scan.
#
# What this covers that unit tests cannot:
#   - the license reaches the API as WRAPS_LICENSE_KEY, so isSelfHosted() is
#     true and the rate limits / plan gates / event cap actually lift
#   - the dashboard Lambda is licensed too, so the AWS-connect page does not
#     fall back to the platform CloudFormation template
#   - the API and the send-path workers point at the deployment's own URLs, so
#     recipients are not emailed links to app.wraps.dev
#   - both console access roles exist with the right principals, and neither
#     connect flow overwrote the other's trust policy
#   - the agent enforcer invoke grant reached the self-hosted role (it is
#     skipped with a warning at deploy time, never a stack failure)
#   - the two control-plane identities are distinct in metadata
#
# Usage:
#   ./selfhost-sst/run.sh
#   WRAPS_SELFHOST_LIVE_SEND=1 ./selfhost-sst/run.sh   # + one real SES send
#
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"
source "$ROOT_DIR/verify-selfhost.sh"

: "${WRAPS_TEST_REGION:?WRAPS_TEST_REGION is required (set it in config.local.sh)}"
: "${AWS_PROFILE_SELFHOST_SST:?AWS_PROFILE_SELFHOST_SST is required — the profile for the account running the SST control plane}"
: "${WRAPS_SELFHOST_SST_APP_URL:?WRAPS_SELFHOST_SST_APP_URL is required — the dashboard URL this deployment serves}"

export AWS_PROFILE="$AWS_PROFILE_SELFHOST_SST"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

REGION="$WRAPS_TEST_REGION"
APP_URL="${WRAPS_SELFHOST_SST_APP_URL%/}"
DOMAIN="$WRAPS_SELFHOST_SST_DOMAIN"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

REPO_ROOT="${ROOT_DIR:h:h}"
wraps() { node "${REPO_ROOT}/packages/cli/dist/cli.js" "$@"; }

# Extract JSON from mixed CLI output (clack text + JSON), same as selfhost/run.sh.
extract_json() {
  grep -oE '\{"success":.*' | tail -1
}

# A SKIP is not a failure. The trailing `[[ -n $2 ]] && printf` used to be the
# last command, so a one-argument call returned 1 and `set -e` killed the run at
# the first skipped phase — every assertion passing, no PASSED line, exit 1.
notice() {
  printf "${YELLOW}  SKIP${NC} %s\n" "$1"
  if [[ -n "${2:-}" ]]; then
    printf "       %s\n" "$2"
  fi
  return 0
}

METADATA_FILE="${HOME}/.wraps/connections/${ACCOUNT_ID}-${REGION}.json"

printf "\n%s\n" "============================================"
printf "  Self-Hosted Deployment Test — SST variant\n"
printf "  Region: %s  Account: %s\n" "$REGION" "$ACCOUNT_ID"
printf "  Dashboard: %s\n" "$APP_URL"
printf "  Sending domain: %s\n" "$DOMAIN"
printf "%s\n\n" "============================================"

# ─── Phase 1: Deployed stack ─────────────────────────────────────────

printf "${YELLOW}Phase 1: Deployed SST resources${NC}\n"
reset_counters

verify_selfhost_sst_api "$REGION" "$APP_URL"
verify_selfhost_sst_web "$REGION" "$APP_URL"
verify_selfhost_sst_workers "$REGION" "$APP_URL"
verify_selfhost_sentry "$REGION"

if [[ -n "$SELFHOST_SST_API_FUNCTION" ]]; then
  verify_selfhost_runtime_resources "$REGION" "$SELFHOST_SST_API_FUNCTION"
fi

summary || { printf "${RED}Phase 1 FAILED${NC}\n"; exit 1; }

if [[ -z "$SELFHOST_SST_API_URL" ]]; then
  printf "\n${RED}No API URL resolved — later phases have nothing to assert against${NC}\n"
  exit 1
fi

# ─── Phase 2: CLI resolution ─────────────────────────────────────────
#
# The CLI finds an SST deployment by scanning ListFunctions for the app prefix
# plus the SelfhostApi logical name — a Pulumi-only lookup silently no-opped
# here, leaving `wraps selfhost connect` unable to find the plane it was
# supposed to register with. These two commands are the observable surface of
# that recovery.

printf "\n${YELLOW}Phase 2: CLI resolves the SST deployment${NC}\n"
reset_counters

section "Phase 2: wraps selfhost status"

STATUS_OUT=$(wraps selfhost status --region "$REGION" --json 2>/dev/null | extract_json) || true

if echo "$STATUS_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "selfhost status succeeded"
else
  fail "selfhost status failed" "$STATUS_OUT"
fi

STATUS_API_URL=$(echo "$STATUS_OUT" | jq -r '.data.apiUrl // ""')
if [[ "${STATUS_API_URL%/}" == "$SELFHOST_SST_API_URL" ]]; then
  pass "selfhost status resolved the live SST Function URL"
else
  fail "selfhost status apiUrl mismatch" \
    "expected $SELFHOST_SST_API_URL, got ${STATUS_API_URL:-<empty>} — the SST branch of resolveSelfhostApiUrl is not finding this deployment"
fi

if echo "$STATUS_OUT" | jq -e --arg u "$APP_URL" '.data.appUrl == $u' &>/dev/null; then
  pass "selfhost status reports the dashboard URL $APP_URL"
else
  fail "selfhost status appUrl mismatch (got $(echo "$STATUS_OUT" | jq -r '.data.appUrl // "MISSING"'))"
fi

if echo "$STATUS_OUT" | jq -e '.data.variant == "sst"' &>/dev/null; then
  pass "selfhost status reports variant: sst"
else
  fail "selfhost status variant: expected sst, got $(echo "$STATUS_OUT" | jq -r '.data.variant // "MISSING"')" \
    "the two variants share account-global IAM resources — a mislabelled deployment breaks upgrade's coexistence guard"
fi

section "Phase 2: wraps selfhost env"

ENV_OUT=$(wraps selfhost env --region "$REGION" --json 2>/dev/null | extract_json) || true

if echo "$ENV_OUT" | jq -e '.success == true' &>/dev/null; then
  pass "selfhost env succeeded"
else
  fail "selfhost env failed" "$ENV_OUT"
fi

# Key names only — the payload is a full set of deployment secrets.
for env_key in DATABASE_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_API_URL CORS_ORIGIN \
               BETTER_AUTH_SECRET UNSUBSCRIBE_SECRET WRAPS_LICENSE_KEY AWS_BACKEND_ACCOUNT_ID; do
  if echo "$ENV_OUT" | jq -e --arg k "$env_key" '.data.env[$k] // "" | length > 0' &>/dev/null; then
    pass "selfhost env emits $env_key"
  else
    fail "selfhost env missing or empty: $env_key"
  fi
done

if echo "$ENV_OUT" | jq -e --arg u "$SELFHOST_SST_API_URL" \
  '(.data.env.NEXT_PUBLIC_API_URL | rtrimstr("/")) == $u' &>/dev/null; then
  pass "selfhost env NEXT_PUBLIC_API_URL matches the live Function URL"
else
  fail "selfhost env NEXT_PUBLIC_API_URL does not match the live Function URL" \
    "a dashboard deployed from this output would call the wrong API"
fi

if echo "$ENV_OUT" | jq -e --arg u "$APP_URL" '.data.env.NEXT_PUBLIC_APP_URL == $u' &>/dev/null; then
  pass "selfhost env NEXT_PUBLIC_APP_URL matches $APP_URL"
else
  fail "selfhost env NEXT_PUBLIC_APP_URL mismatch"
fi

summary || { printf "${RED}Phase 2 FAILED${NC}\n"; exit 1; }

# ─── Phase 3: Control-plane connect state ────────────────────────────
#
# Everything below needs `wraps selfhost connect` to have run against this
# account. On a freshly deployed plane it has not, and that is a legitimate
# state — so the phases skip loudly rather than reporting failures for work
# that was never done.

CONNECTED_SELFHOST="false"
CONNECTED_PLATFORM="false"
if [[ -f "$METADATA_FILE" ]]; then
  jq -e '.selfhostPlatform.externalId // "" | length > 0' "$METADATA_FILE" &>/dev/null \
    && CONNECTED_SELFHOST="true"
  jq -e '.platform.externalId // "" | length > 0' "$METADATA_FILE" &>/dev/null \
    && CONNECTED_PLATFORM="true"
fi

printf "\n${YELLOW}Phase 3: Console access roles and control-plane identity${NC}\n"
reset_counters

if [[ "$CONNECTED_SELFHOST" == "true" ]]; then
  verify_selfhost_console_role "$ACCOUNT_ID"
  verify_selfhost_enforcer_grant "$REGION"
  verify_selfhost_metadata "$ACCOUNT_ID" "$REGION" "$SELFHOST_SST_API_URL" "sst"
  summary || { printf "${RED}Phase 3 FAILED${NC}\n"; exit 1; }
else
  notice "Phase 3 skipped — this account has no self-hosted identity in $METADATA_FILE" \
    "run 'wraps selfhost login' then 'wraps selfhost connect --region $REGION' to exercise the console role, enforcer grant and identity split"
fi

# ─── Phase 4: SES event delivery wiring ──────────────────────────────

printf "\n${YELLOW}Phase 4: SES event delivery${NC}\n"
reset_counters

if [[ "$CONNECTED_SELFHOST" == "true" ]]; then
  verify_coexistence "$REGION" "$ACCOUNT_ID" "$SELFHOST_SST_API_URL" "$CONNECTED_PLATFORM"

  if [[ "${WRAPS_SELFHOST_LIVE_SEND:-0}" == "1" ]]; then
    # Discover the configuration set from SES rather than deriving it from the
    # domain — the slug rules live in the code under test, and an input read
    # from that code would agree with any value, including a wrong one.
    CONFIG_SET=$(aws sesv2 get-email-identity --email-identity "$DOMAIN" \
      --region "$REGION" --query 'ConfigurationSetName' --output text 2>/dev/null || true)
    if [[ -n "$CONFIG_SET" && "$CONFIG_SET" != "None" ]]; then
      verify_selfhost_event_delivery "$REGION" "${WRAPS_SELFHOST_SST_FROM}" "$CONFIG_SET"
    else
      fail "SES identity $DOMAIN has no configuration set" \
        "sends from this domain emit no events at all — run 'wraps email init' for it"
    fi
  else
    notice "Live send skipped — set WRAPS_SELFHOST_LIVE_SEND=1 to send one email to the SES mailbox simulator" \
      "wiring assertions above cannot catch a wrong webhook secret; only a real send can"
  fi

  summary || { printf "${RED}Phase 4 FAILED${NC}\n"; exit 1; }
else
  notice "Phase 4 skipped — no self-hosted identity, so no SES event target exists yet"
fi

# ─── Phase 5: update-role, both directions ───────────────────────────
#
# `update-role` writes a trust policy. Which role it writes, and which principal
# it names, is keyed off the invoked subcommand — `wraps selfhost update-role`
# for the self-hosted plane, `wraps platform update-role` for the SaaS one. The
# regression this guards is not that one form is broken, but that running EITHER
# silently rewrote the OTHER plane's role. Both forms run here, and both roles
# are re-verified after each.

printf "\n${YELLOW}Phase 5: platform update-role (mutating)${NC}\n"

if [[ "${WRAPS_SELFHOST_RUN_UPDATE_ROLE:-1}" != "1" ]]; then
  notice "Phase 5 skipped — WRAPS_SELFHOST_RUN_UPDATE_ROLE is not 1"
elif [[ "$CONNECTED_SELFHOST" != "true" ]]; then
  notice "Phase 5 skipped — no self-hosted identity to repair a trust policy from"
else
  reset_counters

  section "Phase 5: wraps selfhost update-role"

  # --force, not just --json: the confirm prompt is gated on --force alone
  # (platform/update-role.ts:143), so in JSON mode it prompts, reads EOF from
  # the pipe, and exits 0 having done nothing — a silent no-op the assertions
  # below then report as a failed command.
  UPDATE_OUT=$(wraps selfhost update-role --region "$REGION" --force --json 2>/dev/null | extract_json) || true
  if echo "$UPDATE_OUT" | jq -e '.success == true' &>/dev/null; then
    pass "selfhost update-role succeeded"
  else
    fail "selfhost update-role failed" "$UPDATE_OUT"
  fi

  if echo "$UPDATE_OUT" | jq -e '.data.roleName == "wraps-selfhost-console-access-role"' &>/dev/null; then
    pass "selfhost update-role targeted wraps-selfhost-console-access-role"
  else
    fail "selfhost update-role reported role $(echo "$UPDATE_OUT" | jq -r '.data.roleName // "MISSING"')" \
      "self-hosted intent travels with the subcommand — a router that does not pass selfhosted:true silently updates the platform role instead"
  fi

  verify_selfhost_console_role "$ACCOUNT_ID"

  if [[ "$CONNECTED_PLATFORM" == "true" ]]; then
    section "Phase 5: wraps platform update-role (platform form)"

    PLATFORM_UPDATE_OUT=$(wraps platform update-role --region "$REGION" --force --json 2>/dev/null | extract_json) || true
    if echo "$PLATFORM_UPDATE_OUT" | jq -e '.success == true' &>/dev/null; then
      pass "update-role (platform) succeeded"
    else
      fail "update-role (platform) failed" "$PLATFORM_UPDATE_OUT"
    fi

    # The assertion that matters: the self-hosted role must be untouched by a
    # platform update-role run from this machine.
    verify_selfhost_console_role "$ACCOUNT_ID"
  else
    notice "Platform-form update-role skipped — this account has no platform identity"
  fi

  summary || { printf "${RED}Phase 5 FAILED${NC}\n"; exit 1; }
fi

printf "\n${GREEN}Self-hosted SST deployment test PASSED${NC}\n"
