# Deployment verification tests

Operator-run scripts that assert what the CLI actually built in a real AWS
account. They are not unit tests: they need credentials, they cost money, and
they are deliberately kept out of CI.

`verify.sh` is the shared assertion library (`pass`, `fail`, `section`,
`summary`, `aws_check`, and the `verify_*` functions). Each scenario directory
sources it and drives the built CLI.

`verify-selfhost.sh` holds the self-hosted control-plane verifiers and is
sourced *after* `verify.sh`. It is a separate file because the self-hosted
surface has its own shape — two deploy variants, a second console access role,
a second control-plane identity, a second SES event target — none of which the
four platform deployment paths share.

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
| Self-hosted | `./selfhost-sst/run.sh` | Verifies an EXISTING deployment (demo.wraps.dev). Never deploys, never tears down. |
| Dual-plane coexistence | `./coexistence/run.sh` | Verifies an EXISTING deployment. Not in `run-all.sh`. |

None of the self-hosted scenarios are in `run-all.sh`: they need a live control
plane and credentials that `run-all.sh` does not provision.

## Self-hosted (`selfhost-sst/run.sh`)

Self-hosting deploys via `pnpm selfhost:deploy` from a fork (SST), which derives
every physical name as `{app}-{stage}-{logical}-{suffix}` — so nothing can be
fetched by exact name, the same constraint that makes the CLI's own API URL
recovery a paginated scan. It is what the demo control plane at
**demo.wraps.dev** runs.

This scenario verifies that deployment in place. It never deploys and never
tears down — the account is a live demo, not a scratch account.

```bash
./selfhost-sst/run.sh                              # read-only + update-role
WRAPS_SELFHOST_LIVE_SEND=1 ./selfhost-sst/run.sh   # + one real SES send
WRAPS_SELFHOST_RUN_UPDATE_ROLE=0 ./selfhost-sst/run.sh   # fully read-only
```

Defaults live in `config.sh`: profile `demo`, dashboard `https://demo.wraps.dev`,
sending domain `demo.wraps.dev`. The platform suite's `WRAPS_TEST_DOMAIN` is
untouched — that domain drives throwaway SES deploys into the CLI test account.

### Phases

| Phase | What it proves | Mutates |
|---|---|---|
| 1. Deployed SST resources | The license reaches the API as `WRAPS_LICENSE_KEY` (not the bare `LICENSE_KEY` the API never reads), the dashboard Lambda is licensed too, the API/dashboard/workers all point at this deployment's own URLs, the console role name is the self-hosted one, Sentry is the self-hoster's | no |
| 2. CLI resolution | `selfhost status` and `selfhost env` find the deployment via the paginated Lambda scan, so `selfhost connect` can reach the plane | no |
| 3. Console roles + identity | Both console roles exist with the right principals, neither connect flow overwrote the other's trust policy, the enforcer invoke grant reached the self-hosted role, and the two control-plane identities are distinct | no |
| 4. SES event delivery | Both planes' targets coexist on one rule; with `WRAPS_SELFHOST_LIVE_SEND=1`, one real send proves events are actually accepted | one send |
| 5. `update-role`, both forms | Both forms of the command write the role they claim and leave the other plane's role alone | IAM trust policies |

Phases 3–5 need `wraps selfhost connect` to have run against the account. On a
freshly deployed plane it has not, which is a legitimate state — those phases
print a `SKIP` line naming the command to run rather than reporting failures for
work that was never done. `SKIP` lines are phase-level and are not counted by
`summary`; individual assertions still go through `pass`/`fail` only.

### Why the live send exists

Every other assertion here checks *wiring*: that the target, destination and
connection exist with the right endpoint and header name. None of it catches a
wrong secret — EventBridge will happily POST an API key the control plane
rejects, and the 401 surfaces only as a `FailedInvocations` datapoint. The live
send is the assertion that closes that gap. It goes to the SES mailbox
simulator, so it never reaches a real recipient.

### Opt-in checks

| Variable | Effect |
|---|---|
| `WRAPS_SELFHOST_LIVE_SEND=1` | Send one email and assert every target accepted the event |
| `WRAPS_SELFHOST_RUN_UPDATE_ROLE=0` | Skip phase 5, making the run fully read-only apart from the live send |
| `WRAPS_SELFHOST_EXPECT_SENTRY=1` | Require a Sentry DSN on the API and dashboard functions |
| `WRAPS_PLATFORM_SENTRY_DSN=…` | Fail if the deployment reports errors to *Wraps'* Sentry project — catches a maintainer deploy that baked our DSN into a customer's stack |

## Dual-plane coexistence (`coexistence/run.sh`)

Verifies that SES events reach **both** a self-hosted control plane and
app.wraps.dev from the same EventBridge rule (plans 134-138). Every unit test
for that behaviour mocks `buildEmailStackConfig`, so the resources Pulumi
actually created are only checked here.

### Prerequisites

- An AWS account with `wraps email deploy` already run.
- A **deployed** self-hosted control plane. This script does not deploy or tear
  one down. Use `pnpm selfhost:deploy` from a fork first.
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

The target-count assertion is exact, not `>= 3`. The expected total is
SQS + selfhost webhook, plus the platform webhook when the account has a
platform identity, plus the user webhook when one is configured — the last two
are the only optional members, and both are counted rather than assumed. A flat
"exactly 4" reported a false failure on any deployment without a user webhook.
The ceiling stays a hard failure: at 5 targets the rule is at the AWS quota and
the next one is rejected. When a fifth target is legitimately added, update the
assertion **and** say in the failure message that the rule is at quota.

`verify_coexistence` takes an optional fourth argument, `expect_platform`
(default `true`). Pass `false` for an account that has only ever run
`wraps selfhost connect`: there, the *absence* of a platform target is the
correct end state, and the check inverts to "nothing is POSTing this account's
SES events to app.wraps.dev".

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
  Never `echo` a result directly. `fail` always returns 0 — it used to end in a
  `[[ -n "$2" ]] && printf` short-circuit, which returned 1 whenever it was
  called without a detail string, and under `set -e` that aborted the run at the
  first failed assertion instead of reporting the rest.
- Declare loop-scoped variables *before* the loop. In zsh, running `local name`
  for a name that is already local **prints its value** — on the second
  iteration that dumps whatever it holds to stdout, which for a Lambda
  environment means printing a `DATABASE_URL`.
- Wrap AWS calls that may legitimately 404 in `aws_check` — it captures output
  and returns non-zero instead of aborting under `set -e`.
- Parse JSON with `jq`, not `grep`.
- Resource names are literal strings, not derived. The harness asserts what the
  infrastructure code hardcodes; a test that reads its expectations from the
  code it verifies passes for any value, including a wrong one.
- Never print secret values. Assert on header/key *names* only — this output is
  routinely pasted into issues.
