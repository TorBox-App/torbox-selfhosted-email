#!/usr/bin/env zsh
# Deployment verification test configuration
# Copy to config.local.sh and fill in values before running tests

# Required: domain with verified DNS access
export WRAPS_TEST_DOMAIN="${WRAPS_TEST_DOMAIN:-test-cli.wraps.dev}"

# AWS region for all deployments
export WRAPS_TEST_REGION="${WRAPS_TEST_REGION:-us-east-1}"

# AWS profiles — one per deployment method (can be same account if running sequentially)
export AWS_PROFILE_CLI="${AWS_PROFILE_CLI:-test-wraps-cli}"
export AWS_PROFILE_CDK="${AWS_PROFILE_CDK:-test-wraps-cli}"
export AWS_PROFILE_PULUMI="${AWS_PROFILE_PULUMI:-wraps-test-pulumi}"
export AWS_PROFILE_CFN="${AWS_PROFILE_CFN:-test-wraps-cli}"

# Self-hosted control plane (enterprise feature)
# WRAPS_SELFHOST_NEON_API_KEY is required for selfhost tests (create at console.neon.tech)
# WRAPS_SELFHOST_NEON_ORG_ID is required when using an organization-scoped API key
export WRAPS_SELFHOST_NEON_API_KEY="${WRAPS_SELFHOST_NEON_API_KEY:-}"
export WRAPS_SELFHOST_NEON_ORG_ID="${WRAPS_SELFHOST_NEON_ORG_ID:-}"
export WRAPS_SELFHOST_LICENSE_KEY="${WRAPS_SELFHOST_LICENSE_KEY:-wraps_lic_test}"
export WRAPS_SELFHOST_APP_URL="${WRAPS_SELFHOST_APP_URL:-https://app.wraps.dev}"

# Self-hosted SST variant (`pnpm selfhost:deploy` from a fork) — verified in
# place by selfhost-sst/run.sh, never deployed or destroyed by it. Kept separate
# from the values above: those drive a throwaway Pulumi deploy into the CLI test
# account, these point at the live demo control plane.
export AWS_PROFILE_SELFHOST_SST="${AWS_PROFILE_SELFHOST_SST:-demo}"
export WRAPS_SELFHOST_SST_APP_URL="${WRAPS_SELFHOST_SST_APP_URL:-https://demo.wraps.dev}"
export WRAPS_SELFHOST_SST_DOMAIN="${WRAPS_SELFHOST_SST_DOMAIN:-demo.wraps.dev}"
# Verified sender used by the live-send probe (WRAPS_SELFHOST_LIVE_SEND=1).
export WRAPS_SELFHOST_SST_FROM="${WRAPS_SELFHOST_SST_FROM:-test@demo.wraps.dev}"

# Opt-in checks for the self-hosted scenarios
# 1 = require a Sentry DSN on the API and dashboard functions
export WRAPS_SELFHOST_EXPECT_SENTRY="${WRAPS_SELFHOST_EXPECT_SENTRY:-0}"
# Wraps' own Sentry DSN. Set it to catch a maintainer deploy that baked our DSN
# into a customer's stack; leave empty to skip that check.
export WRAPS_PLATFORM_SENTRY_DSN="${WRAPS_PLATFORM_SENTRY_DSN:-}"
# 1 = send one real email to the SES mailbox simulator and assert it is
# delivered to every EventBridge target without failures
export WRAPS_SELFHOST_LIVE_SEND="${WRAPS_SELFHOST_LIVE_SEND:-0}"
# 1 (default) = run `wraps platform update-role` in both forms and re-verify
# both console roles afterwards. This writes IAM trust policies.
export WRAPS_SELFHOST_RUN_UPDATE_ROLE="${WRAPS_SELFHOST_RUN_UPDATE_ROLE:-1}"

# Timeouts
export DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-600}"  # 10 minutes per deploy phase
export VERIFY_TIMEOUT="${VERIFY_TIMEOUT:-30}"   # 30 seconds per verification
