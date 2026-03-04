#!/usr/bin/env zsh
# Deployment verification test configuration
# Copy to config.local.sh and fill in values before running tests

# Required: domain with verified DNS access
export WRAPS_TEST_DOMAIN="${WRAPS_TEST_DOMAIN:-test-cli.wraps.dev}"

# AWS region for all deployments
export WRAPS_TEST_REGION="${WRAPS_TEST_REGION:-us-east-1}"

# AWS profiles — one per deployment method (can be same account if running sequentially)
export AWS_PROFILE_CLI="${AWS_PROFILE_CLI:-test-wraps-cli}"
export AWS_PROFILE_CDK="${AWS_PROFILE_CDK:-wraps-test-cdk}"
export AWS_PROFILE_PULUMI="${AWS_PROFILE_PULUMI:-wraps-test-pulumi}"

# Timeouts
export DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-600}"  # 10 minutes per deploy phase
export VERIFY_TIMEOUT="${VERIFY_TIMEOUT:-30}"   # 30 seconds per verification
