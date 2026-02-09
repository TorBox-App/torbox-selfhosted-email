/**
 * AWS Doctor - Diagnose AWS setup issues
 *
 * @module commands/aws/doctor
 */

import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import { isSESSandbox } from "../../utils/shared/aws.js";
import {
  type AWSSetupState,
  detectAWSState,
  formatSSOProfile,
  getConfiguredProfiles,
  getSSOLoginCommand,
  hasConfigFile,
  hasCredentialsFile,
} from "../../utils/shared/aws-detection.js";

type DoctorResult = {
  status: "pass" | "warn" | "fail" | "info";
  message: string;
  details?: string;
};

/**
 * Run all diagnostic checks
 */
async function runDiagnostics(state: AWSSetupState): Promise<DoctorResult[]> {
  const results: DoctorResult[] = [];

  // Check AWS CLI
  if (state.cliInstalled) {
    results.push({
      status: "pass",
      message: `AWS CLI v${state.cliVersion} installed`,
    });
  } else {
    results.push({
      status: "fail",
      message: "AWS CLI not installed",
      details:
        "Install: brew install awscli (macOS) or https://aws.amazon.com/cli/",
    });
  }

  // Check credentials file
  if (hasCredentialsFile()) {
    results.push({
      status: "pass",
      message: "Credentials file exists (~/.aws/credentials)",
    });
  } else if (
    state.credentialSource === "environment" ||
    state.credentialSource === "sso"
  ) {
    results.push({
      status: "info",
      message: `Using ${state.credentialSource} credentials (no file needed)`,
    });
  } else {
    results.push({
      status: "warn",
      message: "No credentials file (~/.aws/credentials)",
      details: "Run: aws configure",
    });
  }

  // Check config file
  if (hasConfigFile()) {
    results.push({
      status: "pass",
      message: "Config file exists (~/.aws/config)",
    });
  } else {
    results.push({
      status: "info",
      message: "No config file (~/.aws/config)",
      details: "Optional: stores default region and output format",
    });
  }

  // === SSO-specific diagnostics ===
  if (state.sso.configured) {
    results.push({
      status: "pass",
      message: `SSO configured (${state.sso.profiles.length} profile${state.sso.profiles.length > 1 ? "s" : ""})`,
      details: state.sso.profiles.map((p) => p.name).join(", "),
    });

    // Show SSO sessions if any
    if (state.sso.sessions.length > 0) {
      results.push({
        status: "info",
        message: `SSO sessions: ${state.sso.sessions.map((s) => s.name).join(", ")}`,
      });
    }

    // Check if we're using an SSO profile
    if (state.sso.activeProfile) {
      results.push({
        status: "pass",
        message: `Active SSO profile: ${formatSSOProfile(state.sso.activeProfile)}`,
      });
    } else if (state.credentialSource === "sso") {
      // Using SSO but not a named profile
      results.push({
        status: "info",
        message: "Using SSO credentials",
      });
    }

    // Check SSO token status
    if (state.sso.tokenStatus) {
      if (state.sso.tokenStatus.valid) {
        const minutes = state.sso.tokenStatus.minutesRemaining || 0;
        if (minutes > 60) {
          const hours = Math.floor(minutes / 60);
          results.push({
            status: "pass",
            message: `SSO session valid (${hours}h ${minutes % 60}m remaining)`,
          });
        } else if (minutes > 15) {
          results.push({
            status: "pass",
            message: `SSO session valid (${minutes}m remaining)`,
          });
        } else if (minutes > 0) {
          results.push({
            status: "warn",
            message: `SSO session expiring soon (${minutes}m remaining)`,
            details: getSSOLoginCommand(state.sso.activeProfile?.name),
          });
        }
      } else if (state.sso.tokenStatus.expired) {
        results.push({
          status: "fail",
          message: "SSO session expired",
          details: `Run: ${getSSOLoginCommand(state.sso.activeProfile?.name)}`,
        });
      }
    }
  }

  // Check credentials are working
  if (state.credentialsConfigured) {
    results.push({
      status: "pass",
      message: `Can connect to AWS (account: ${state.accountId})`,
    });

    // Check credential source (if not already shown for SSO)
    if (!state.sso.configured) {
      if (state.credentialSource === "environment") {
        results.push({
          status: "pass",
          message: "Using environment variable credentials",
        });
      } else if (state.credentialSource === "profile") {
        const profileName = state.profileName || "default";
        results.push({
          status: "pass",
          message: `Using profile: ${profileName}`,
        });
      }
    }
  } else {
    // Not authenticated
    if (state.sso.configured && state.sso.tokenStatus?.expired) {
      results.push({
        status: "fail",
        message: "Cannot connect to AWS (SSO session expired)",
        details: `Run: ${getSSOLoginCommand(state.sso.activeProfile?.name)}`,
      });
    } else if (state.sso.configured) {
      results.push({
        status: "fail",
        message: "Cannot connect to AWS (SSO login required)",
        details: `Run: ${getSSOLoginCommand(state.sso.activeProfile?.name || state.sso.profiles[0]?.name)}`,
      });
    } else {
      results.push({
        status: "fail",
        message: "Cannot connect to AWS",
        details: "Run: wraps aws setup",
      });
    }
    return results; // Can't do more checks without credentials
  }

  // Check region
  if (state.region) {
    results.push({
      status: "pass",
      message: `Region set: ${state.region}`,
    });
  } else {
    results.push({
      status: "warn",
      message: "Region not set",
      details: "Will default to us-east-1. Set AWS_REGION for faster commands.",
    });
  }

  // Check profiles (non-SSO)
  if (!state.sso.configured) {
    const profiles = getConfiguredProfiles();
    if (profiles.length > 1) {
      results.push({
        status: "info",
        message: `${profiles.length} profiles configured`,
        details: profiles.join(", "),
      });
    }
  }

  // Check SES sandbox status (only if we have credentials and region)
  if (state.credentialsConfigured) {
    try {
      const region = state.region || "us-east-1";
      const sandbox = await isSESSandbox(region);
      if (sandbox) {
        results.push({
          status: "warn",
          message: "SES is in sandbox mode",
          details:
            "You can only send to verified emails. Request production access in AWS console.",
        });
      } else {
        results.push({
          status: "pass",
          message: "SES has production access",
        });
      }
    } catch {
      results.push({
        status: "info",
        message: "Could not check SES status",
        details: "SES may not be enabled in this region",
      });
    }
  }

  // Check for common misconfigurations
  if (process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
    results.push({
      status: "fail",
      message: "AWS_ACCESS_KEY_ID set but AWS_SECRET_ACCESS_KEY missing",
      details: "Both environment variables are required",
    });
  }

  if (process.env.AWS_SECRET_ACCESS_KEY && !process.env.AWS_ACCESS_KEY_ID) {
    results.push({
      status: "fail",
      message: "AWS_SECRET_ACCESS_KEY set but AWS_ACCESS_KEY_ID missing",
      details: "Both environment variables are required",
    });
  }

  return results;
}

/**
 * Display diagnostic results
 */
function displayResults(results: DoctorResult[]): void {
  console.log();

  for (const result of results) {
    let icon: string;
    let color: (s: string) => string;

    switch (result.status) {
      case "pass":
        icon = "✓";
        color = pc.green;
        break;
      case "warn":
        icon = "!";
        color = pc.yellow;
        break;
      case "fail":
        icon = "✗";
        color = pc.red;
        break;
      case "info":
        icon = "i";
        color = pc.blue;
        break;
    }

    console.log(`  ${color(`[${icon}]`)} ${result.message}`);
    if (result.details) {
      console.log(`      ${pc.dim(result.details)}`);
    }
  }

  console.log();
}

/**
 * Generate suggestions based on results
 */
function generateSuggestions(
  results: DoctorResult[],
  state: AWSSetupState
): string[] {
  const suggestions: string[] = [];

  const hasCredentialsFail = results.some(
    (r) => r.status === "fail" && r.message.includes("Cannot connect")
  );
  const hasCLIFail = results.some(
    (r) => r.status === "fail" && r.message.includes("CLI not installed")
  );
  const hasRegionWarn = results.some(
    (r) => r.status === "warn" && r.message.includes("Region not set")
  );
  const hasSandboxWarn = results.some(
    (r) => r.status === "warn" && r.message.includes("sandbox mode")
  );
  const hasSSOExpired = results.some(
    (r) => r.status === "fail" && r.message.includes("SSO session expired")
  );
  const hasSSOExpiring = results.some(
    (r) => r.status === "warn" && r.message.includes("SSO session expiring")
  );

  if (hasCLIFail) {
    suggestions.push("Install AWS CLI: brew install awscli (macOS)");
  }

  if (hasSSOExpired) {
    const loginCmd = getSSOLoginCommand(
      state.sso.activeProfile?.name || state.sso.profiles[0]?.name
    );
    suggestions.push(`Refresh SSO session: ${loginCmd}`);
  } else if (hasSSOExpiring) {
    const loginCmd = getSSOLoginCommand(state.sso.activeProfile?.name);
    suggestions.push(`Session expiring soon, refresh with: ${loginCmd}`);
  } else if (hasCredentialsFail) {
    if (state.sso.configured) {
      const loginCmd = getSSOLoginCommand(
        state.sso.activeProfile?.name || state.sso.profiles[0]?.name
      );
      suggestions.push(`SSO login required: ${loginCmd}`);
    } else {
      suggestions.push("Run `wraps aws setup` to configure credentials");
    }
  }

  if (hasRegionWarn) {
    suggestions.push("Set AWS_REGION environment variable for faster commands");
  }

  if (hasSandboxWarn) {
    suggestions.push(
      "Request SES production access: wraps email check --domain yourdomain.com"
    );
  }

  // Additional SSO suggestions
  if (
    state.sso.configured &&
    state.sso.profiles.length > 1 &&
    !state.sso.activeProfile
  ) {
    suggestions.push(
      `Set AWS_PROFILE to use one of: ${state.sso.profiles.map((p) => p.name).join(", ")}`
    );
  }

  return suggestions;
}

/**
 * AWS Doctor command entry point
 */
export async function doctor(): Promise<void> {
  const startTime = Date.now();
  clack.intro(pc.bold("AWS Setup Diagnostics"));

  const spinner = clack.spinner();
  spinner.start("Running diagnostics...");

  const state = await detectAWSState();
  const results = await runDiagnostics(state);

  spinner.stop("Diagnostics complete");

  displayResults(results);

  // Summary
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const passCount = results.filter((r) => r.status === "pass").length;

  if (failCount > 0) {
    clack.log.error(`${failCount} issue${failCount > 1 ? "s" : ""} found`);
  } else if (warnCount > 0) {
    clack.log.warn(
      `${passCount} checks passed, ${warnCount} warning${warnCount > 1 ? "s" : ""}`
    );
  } else {
    clack.log.success("All checks passed!");
  }

  // Suggestions
  const suggestions = generateSuggestions(results, state);
  if (suggestions.length > 0) {
    console.log();
    clack.log.info(pc.bold("Suggestions:"));
    for (const suggestion of suggestions) {
      console.log(`  ${pc.dim("-")} ${suggestion}`);
    }
  }

  trackCommand("aws:doctor", {
    success: true,
    duration_ms: Date.now() - startTime,
    pass_count: passCount,
    fail_count: failCount,
    warn_count: warnCount,
  });

  console.log();
  clack.outro(
    failCount > 0
      ? pc.dim("Run `wraps aws setup` to fix issues")
      : pc.dim("Ready to deploy: wraps email init")
  );
}
