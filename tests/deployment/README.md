# Deployment verification tests

Operator-run scripts that assert what the CLI actually built in a real AWS
account. They are not unit tests: they need credentials, they cost money, and
they are deliberately kept out of CI.

`verify.sh` is the shared assertion library (`pass`, `fail`, `section`,
`summary`, `aws_check`, and the `verify_*` functions). Each scenario directory
sources it and drives the built CLI.

## Setup

```bash
cp config.sh config.local.sh   # config.local.sh is gitignored
$EDITOR config.local.sh        # fill in profiles, region, domain
pnpm --filter @wraps.dev/cli build
```

Scenarios invoke `packages/cli/dist/cli.js` directly, so build the CLI first.

## Scenarios

| Scenario | Command | Notes |
|---|---|---|
| Default suite | `./run-all.sh` | CLI / CDK / CFN / Pulumi deployment paths |
| Self-hosted control plane | `./selfhost/run.sh` | Deploys, verifies, and tears down. Pulumi variant only — SST is not covered. |
| Dual-plane coexistence | `./coexistence/run.sh` | Verifies an EXISTING deployment. Not in `run-all.sh`. |

## Dual-plane coexistence (`coexistence/run.sh`)

Verifies that SES events reach **both** a self-hosted control plane and
app.wraps.dev from the same EventBridge rule (plans 134-138). Every unit test
for that behaviour mocks `buildEmailStackConfig`, so the resources Pulumi
actually created are only checked here.

### Prerequisites

- An AWS account with `wraps email deploy` already run.
- A **deployed** self-hosted control plane. This script does not deploy or tear
  one down. Use `wraps selfhost deploy` (or `selfhost/run.sh`) first.
- `WRAPS_SELFHOST_API_URL` — the self-hosted API's base URL, no trailing slash.
- `WRAPS_TEST_REGION` and `AWS_PROFILE_CLI`, as with every other scenario.

```bash
WRAPS_SELFHOST_API_URL=https://abc123.lambda-url.us-east-1.on.aws \
  ./coexistence/run.sh
```

Run it against a scratch account before touching a paying customer's
deployment.

### What a failure means

| Failure | What it means |
|---|---|
| `Expected exactly 1 wraps-webhook-destination target, found 0` | **The coexistence regression.** The self-hosted connect deleted app.wraps.dev's event delivery. The self-hosted branch must pass *no* `webhook` key to `buildEmailStackConfig` — an explicit `webhook: undefined` means "delete the platform target". |
| `2 targets POST to <selfhost>/webhooks/ses/<account>` | The legacy `--reroute-events` primary is still wired alongside `wraps-selfhost-webhook-destination`. Every SES event is delivered twice. |
| `EventBridge rule has 5 targets` | At the AWS hard quota of 5 targets per rule (not adjustable). The next target will be rejected with `LimitExceeded` on a customer's next deploy. |
| `Self-hosted connection auth header: expected X-Wraps-Api-Key` | The self-hosted control plane will 401 every event. |
| `Self-hosted invocation endpoint mismatch` | Events POST to the wrong path — most likely the `/webhooks/ses/{accountId}` suffix was dropped or doubled. |
| `Self-hosted target has an InputTransformer` | The self-hosted control plane runs the same `apps/api` code as the platform and expects the raw SES envelope. |

The 4-target assertion is deliberately exact rather than `>= 3`. When a fifth
target is legitimately added, update the assertion **and** record in the
failure message that the rule is at quota.

### What this scenario cannot observe

When a customer previously ran `pnpm selfhost:deploy --reroute-events`, plan
138's migration clears `services.email.webhookSecret`. That makes
`buildEmailStackConfig` skip the platform-webhook reconstruction, so
`wraps email upgrade` **destroys** the old Connection / API Destination /
Target and **creates** the new selfhost-named ones. It is a replace, not a
rename: SES events are undelivered for the duration of that Pulumi step.

This script asserts the *end state*, not the gap. To observe the gap, watch the
`wraps email upgrade` Pulumi output for `deleting`/`creating` on
`wraps-webhook-*` and `wraps-selfhost-webhook-*`, and check the `AWS/Events`
`FailedInvocations` and `Invocations` metrics for the rule across the upgrade
window.

## Conventions

- zsh, not bash. `#!/usr/bin/env zsh`, `set -euo pipefail`.
- Every assertion goes through `pass` / `fail` so `summary` can count it.
  Never `echo` a result directly.
- Wrap AWS calls that may legitimately 404 in `aws_check` — it captures output
  and returns non-zero instead of aborting under `set -e`.
- Parse JSON with `jq`, not `grep`.
- Resource names are literal strings, not derived. The harness asserts what the
  infrastructure code hardcodes; a test that reads its expectations from the
  code it verifies passes for any value, including a wrong one.
- Never print secret values. Assert on header/key *names* only — this output is
  routinely pasted into issues.
