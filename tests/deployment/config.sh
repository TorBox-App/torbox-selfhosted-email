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

# Timeouts
export DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-600}"  # 10 minutes per deploy phase
export VERIFY_TIMEOUT="${VERIFY_TIMEOUT:-30}"   # 30 seconds per verification
