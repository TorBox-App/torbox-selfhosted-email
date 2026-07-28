#!/usr/bin/env zsh
# Dual-plane SES event delivery verification (plans 134-138).
#
# Asserts that SES events reach BOTH a self-hosted control plane AND
# app.wraps.dev from the same EventBridge rule. Every unit test for this
# behaviour mocks buildEmailStackConfig, so what Pulumi actually built in the
# customer's AWS account is only checked here.
#
# This script does NOT deploy or tear down the self-hosted control plane. It
# verifies an EXISTING deployment. Deploy one first with
# `wraps selfhost deploy` (see tests/deployment/selfhost/run.sh) and point
# WRAPS_SELFHOST_API_URL at it.
#
# Not wired into run-all.sh or CI on purpose: it needs real AWS credentials
# and a live self-hosted control plane that neither of those provisions.
#
# ─── What this script CANNOT observe: the reroute migration gap ──────
#
# When a customer previously ran `pnpm selfhost:deploy --reroute-events`, plan
# 138's migration clears `services.email.webhookSecret`. That makes
# `buildEmailStackConfig` skip the platform-webhook reconstruction, so
# `wraps email upgrade` DESTROYS the old Connection / API Destination / Target
# and CREATES the new selfhost-named ones. It is a replace, not a rename: SES
# events are undelivered for the duration of that Pulumi step.
#
# This script asserts the END STATE, not the gap. To observe the gap, watch the
# `wraps email upgrade` Pulumi output for `deleting`/`creating` on
# `wraps-webhook-*` and `wraps-selfhost-webhook-*`, and check the `AWS/Events`
# `FailedInvocations` and `Invocations` metrics for the rule across the upgrade
# window.

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
ROOT_DIR="${SCRIPT_DIR:h}"

source "$ROOT_DIR/config.sh"
[[ -f "$ROOT_DIR/config.local.sh" ]] && source "$ROOT_DIR/config.local.sh"
source "$ROOT_DIR/verify.sh"

: "${WRAPS_TEST_REGION:?WRAPS_TEST_REGION is required (set it in config.local.sh)}"
: "${AWS_PROFILE_CLI:?AWS_PROFILE_CLI is required (set it in config.local.sh)}"
: "${WRAPS_SELFHOST_API_URL:?WRAPS_SELFHOST_API_URL is required — the BASE url of an already-deployed self-hosted control plane, no trailing slash (e.g. https://abc123.lambda-url.us-east-1.on.aws)}"

export AWS_PROFILE="$AWS_PROFILE_CLI"
export AWS_DEFAULT_REGION="$WRAPS_TEST_REGION"

REGION="$WRAPS_TEST_REGION"
SELFHOST_API_URL="${WRAPS_SELFHOST_API_URL%/}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

REPO_ROOT="${ROOT_DIR:h:h}"
wraps() { node "${REPO_ROOT}/packages/cli/dist/cli.js" "$@"; }

printf "\n%s\n" "============================================"
printf "  Dual-Plane Coexistence Test\n"
printf "  Region: %s  Account: %s\n" "$REGION" "$ACCOUNT_ID"
printf "  Self-hosted API: %s\n" "$SELFHOST_API_URL"
printf "%s\n\n" "============================================"

reset_counters

# `wraps selfhost connect`, not `wraps platform connect --selfhosted`: the CLI
# router only passes `selfhosted: true` to platformConnect from the `selfhost`
# subcommand (packages/cli/src/cli.ts:1253). `platform connect` ignores a
# --selfhosted flag entirely and would connect the Wraps platform instead,
# leaving nothing for verify_coexistence to assert against.
section "Coexistence: wraps selfhost connect"

if wraps selfhost connect --region "$REGION" --yes; then
  pass "wraps selfhost connect succeeded"
else
  fail "wraps selfhost connect failed" "see output above"
fi

# Rebuilds the email stack so the second EventBridge target is materialised
# from the metadata `selfhost connect` just wrote.
section "Coexistence: wraps email upgrade"

if wraps email upgrade --region "$REGION" --yes; then
  pass "wraps email upgrade succeeded"
else
  fail "wraps email upgrade failed" "see output above"
fi

verify_coexistence "$REGION" "$ACCOUNT_ID" "$SELFHOST_API_URL"

summary
