#!/usr/bin/env zsh
# Wrapper for deployment tests with CLI-friendly flags
#
# Usage:
#   ./tests/deployment/run.sh [options] [methods...]
#
# Options:
#   --region <region>       AWS region (default: us-east-1)
#   --domain <domain>       Test domain (default: test-cli.wraps.dev)
#   --profile <profile>     AWS profile for all methods (overrides per-method profiles)
#   --sequential            Run tests sequentially instead of in parallel
#   --timeout <seconds>     Deploy timeout per phase (default: 600)
#
# Methods: cli, cdk, pulumi, cfn (default: all)
#
# Examples:
#   ./tests/deployment/run.sh --region us-west-2 cli
#   ./tests/deployment/run.sh --region eu-west-1 --sequential cli cfn
#   ./tests/deployment/run.sh --profile my-aws-profile --region us-west-2

set -euo pipefail

SCRIPT_DIR="${0:A:h}"
PASSTHROUGH_ARGS=()

while (( $# > 0 )); do
  case "$1" in
    --region)
      export WRAPS_TEST_REGION="$2"
      shift 2
      ;;
    --domain)
      export WRAPS_TEST_DOMAIN="$2"
      shift 2
      ;;
    --profile)
      export AWS_PROFILE_CLI="$2"
      export AWS_PROFILE_CDK="$2"
      export AWS_PROFILE_PULUMI="$2"
      export AWS_PROFILE_CFN="$2"
      shift 2
      ;;
    --timeout)
      export DEPLOY_TIMEOUT="$2"
      shift 2
      ;;
    --sequential)
      PASSTHROUGH_ARGS+=(--sequential)
      shift
      ;;
    cli|cdk|pulumi|cfn)
      PASSTHROUGH_ARGS+=("$1")
      shift
      ;;
    --help|-h)
      head -17 "$0" | tail -15
      exit 0
      ;;
    *)
      printf "Unknown option: %s\nRun with --help for usage.\n" "$1"
      exit 1
      ;;
  esac
done

exec "$SCRIPT_DIR/run-all.sh" "${PASSTHROUGH_ARGS[@]}"
