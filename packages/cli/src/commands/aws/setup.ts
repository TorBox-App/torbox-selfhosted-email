/**
 * AWS Setup Wizard
 * Interactive command to help users configure AWS credentials
 *
 * @module commands/aws/setup
 */

import * as clack from "@clack/prompts";
import pc from "picocolors";
import { trackCommand } from "../../telemetry/events.js";
import {
  type AWSSetupState,
  detectAWSState,
  formatSSOProfile,
  getSSOLoginCommand,
  parseSSOProfiles,
  type SSOProfile,
} from "../../utils/shared/aws-detection.js";
import { promptProvider, promptRegion } from "../../utils/shared/prompts.js";

type SetupOptions = {
  /** Skip interactive prompts where possible */
  yes?: boolean;
};

/**
 * Display current AWS state with icons
 */
function displayCurrentState(state: AWSSetupState): void {
  console.log();
  clack.log.info(pc.bold("Current AWS Setup"));
  console.log();

  // AWS CLI
  if (state.cliInstalled) {
    console.log(
      `  ${pc.green("✓")} AWS CLI ${pc.dim(`v${state.cliVersion || "installed"}`)}`
    );
  } else {
    console.log(`  ${pc.red("✗")} AWS CLI ${pc.dim("not installed")}`);
  }

  // Credentials
  if (state.credentialsConfigured) {
    const source = state.credentialSource || "unknown";
    const profile =
      state.profileName && state.profileName !== "default"
        ? pc.dim(` (${state.profileName})`)
        : "";
    console.log(
      `  ${pc.green("✓")} Credentials ${pc.dim(`via ${source}`)}${profile}`
    );
    console.log(`      ${pc.dim("Account:")} ${state.accountId}`);
  } else {
    console.log(`  ${pc.red("✗")} Credentials ${pc.dim("not configured")}`);
  }

  // Region
  if (state.region) {
    console.log(`  ${pc.green("✓")} Region ${pc.dim(state.region)}`);
  } else {
    console.log(
      `  ${pc.yellow("○")} Region ${pc.dim("not set (defaults to us-east-1)")}`
    );
  }

  // SSO status
  if (state.sso.configured) {
    const profileCount = state.sso.profiles.length;
    console.log(
      `  ${pc.blue("i")} SSO ${pc.dim(`${profileCount} profile${profileCount > 1 ? "s" : ""} configured`)}`
    );

    if (state.sso.activeProfile) {
      console.log(
        `      ${pc.dim("Active:")} ${formatSSOProfile(state.sso.activeProfile)}`
      );
    }

    // Show token status if relevant
    if (state.sso.tokenStatus) {
      if (state.sso.tokenStatus.expired) {
        console.log(`      ${pc.yellow("Session expired")} - login required`);
      } else if (state.sso.tokenStatus.minutesRemaining !== null) {
        const mins = state.sso.tokenStatus.minutesRemaining;
        if (mins < 60) {
          console.log(`      ${pc.dim("Session expires in")} ${mins}m`);
        } else {
          const hours = Math.floor(mins / 60);
          console.log(
            `      ${pc.dim("Session expires in")} ${hours}h ${mins % 60}m`
          );
        }
      }
    }
  }

  // Provider detection
  if (state.detectedProvider) {
    console.log(
      `  ${pc.blue("i")} Provider ${pc.dim(`detected: ${state.detectedProvider}`)}`
    );
  }

  console.log();
}

/**
 * Path A: Full setup for users without AWS CLI
 */
async function runFullSetup(): Promise<boolean> {
  clack.log.step("Let's get you set up with AWS from scratch");
  console.log();

  // Step 1: AWS Account
  clack.log.info(pc.bold("Step 1: AWS Account"));
  console.log();
  console.log("  If you don't have an AWS account yet, create one at:");
  console.log(`  ${pc.cyan("https://aws.amazon.com/free")}`);
  console.log();
  console.log(
    pc.dim("  The AWS Free Tier includes 3,000 SES emails/month for 12 months")
  );
  console.log();

  const hasAccount = await clack.confirm({
    message: "Do you have an AWS account?",
    initialValue: true,
  });

  if (clack.isCancel(hasAccount)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (!hasAccount) {
    console.log();
    console.log(
      "  Please create an AWS account first, then run this command again."
    );
    console.log(`  ${pc.cyan("https://aws.amazon.com/free")}`);
    console.log();
    return false;
  }

  // Step 2: Install AWS CLI
  console.log();
  clack.log.info(pc.bold("Step 2: Install AWS CLI"));
  console.log();

  const platform = process.platform;
  let installCmd: string;
  let installInstructions: string;

  if (platform === "darwin") {
    installCmd = "brew install awscli";
    installInstructions = `  Run: ${pc.yellow(installCmd)}`;
  } else if (platform === "linux") {
    installCmd =
      'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && sudo ./aws/install';
    installInstructions = `  Run:\n    ${pc.yellow('curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"')}\n    ${pc.yellow("unzip awscliv2.zip && sudo ./aws/install")}`;
  } else {
    installCmd = "Download from AWS website";
    installInstructions = `  Download the installer from:\n  ${pc.cyan("https://awscli.amazonaws.com/AWSCLIV2.msi")}`;
  }

  console.log(installInstructions);
  console.log();

  const cliInstalled = await clack.confirm({
    message: "Is AWS CLI now installed?",
    initialValue: false,
  });

  if (clack.isCancel(cliInstalled)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (!cliInstalled) {
    console.log();
    console.log("  Install AWS CLI and run this command again.");
    console.log(
      `  ${pc.cyan("https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html")}`
    );
    console.log();
    return false;
  }

  // Continue to credential setup
  return runCredentialSetup();
}

/**
 * Path B: Credential setup for users with AWS CLI but no credentials
 */
async function runCredentialSetup(): Promise<boolean> {
  console.log();
  clack.log.info(pc.bold("Configure AWS Credentials"));
  console.log();

  const method = await clack.select({
    message: "How would you like to authenticate?",
    options: [
      {
        value: "access-key",
        label: "Access Key (simple)",
        hint: "Create an IAM user with access keys",
      },
      {
        value: "sso",
        label: "AWS SSO (recommended for organizations)",
        hint: "Use your organization's SSO login",
      },
      {
        value: "skip",
        label: "I'll configure it myself",
        hint: "Skip to documentation",
      },
    ],
  });

  if (clack.isCancel(method)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (method === "skip") {
    showManualSetupInstructions();
    return true;
  }

  if (method === "sso") {
    return showSSOInstructions();
  }

  // Access key setup
  return showAccessKeyInstructions();
}

/**
 * Show instructions for setting up access keys
 */
async function showAccessKeyInstructions(): Promise<boolean> {
  console.log();
  clack.log.info(pc.bold("Create IAM User with Access Keys"));
  console.log();
  console.log("  1. Open the AWS IAM Console:");
  console.log(
    `     ${pc.cyan("https://console.aws.amazon.com/iam/home#/users")}`
  );
  console.log();
  console.log('  2. Click "Create user"');
  console.log(`     - User name: ${pc.cyan("wraps-cli")}`);
  console.log('     - Click "Next"');
  console.log();
  console.log("  3. Set permissions:");
  console.log(`     - Select "Attach policies directly"`);
  console.log(`     - Search and select: ${pc.cyan("AdministratorAccess")}`);
  console.log(
    pc.dim("        (You can use more restrictive permissions later)")
  );
  console.log('     - Click "Next" → "Create user"');
  console.log();
  console.log("  4. Create access key:");
  console.log('     - Click on your new user → "Security credentials" tab');
  console.log('     - Click "Create access key"');
  console.log(`     - Select "Command Line Interface (CLI)"`);
  console.log("     - Copy your Access Key ID and Secret Access Key");
  console.log();

  const hasKeys = await clack.confirm({
    message: "Do you have your access keys ready?",
    initialValue: false,
  });

  if (clack.isCancel(hasKeys)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (!hasKeys) {
    console.log();
    console.log("  Create your access keys and run this command again.");
    console.log();
    return false;
  }

  // Configure AWS CLI
  console.log();
  clack.log.info(pc.bold("Configure AWS CLI"));
  console.log();
  console.log("  Run this command and enter your access keys:");
  console.log(`  ${pc.yellow("aws configure")}`);
  console.log();
  console.log("  When prompted:");
  console.log("    - AWS Access Key ID: [paste your access key]");
  console.log("    - AWS Secret Access Key: [paste your secret key]");
  console.log(
    `    - Default region: ${pc.cyan("us-east-1")} (or your preferred region)`
  );
  console.log("    - Default output format: [press Enter for default]");
  console.log();

  const configured = await clack.confirm({
    message: "Have you run `aws configure`?",
    initialValue: false,
  });

  if (clack.isCancel(configured)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (configured) {
    // Verify the configuration worked
    const state = await detectAWSState();
    if (state.credentialsConfigured) {
      console.log();
      clack.log.success(
        `Connected to AWS account ${pc.cyan(state.accountId || "unknown")}`
      );
      return true;
    }
    console.log();
    clack.log.warn(
      "Credentials not detected. Please check your configuration."
    );
    console.log();
    return false;
  }

  return false;
}

/**
 * Handle SSO profile selection for users with existing SSO configuration
 */
async function runSSOProfileSelection(
  profiles: SSOProfile[]
): Promise<boolean> {
  console.log();
  clack.log.info(pc.bold("AWS SSO Profile Selection"));
  console.log();

  // Build options for profile selection
  const profileOptions = profiles.map((profile) => ({
    value: profile.name,
    label: profile.name,
    hint: `${profile.ssoAccountId} / ${profile.ssoRoleName}`,
  }));

  // Add option to configure new profile
  profileOptions.push({
    value: "_new",
    label: "Configure a new SSO profile",
    hint: "Run aws configure sso",
  });

  const selectedProfile = await clack.select({
    message: "Which SSO profile would you like to use?",
    options: profileOptions,
  });

  if (clack.isCancel(selectedProfile)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (selectedProfile === "_new") {
    return showSSOInstructions();
  }

  const profile = profiles.find((p) => p.name === selectedProfile);
  if (!profile) {
    clack.log.error("Profile not found.");
    return false;
  }

  // Show login instructions
  console.log();
  clack.log.info(pc.bold(`Login to SSO Profile: ${profile.name}`));
  console.log();
  console.log("  Run this command to authenticate:");
  console.log(`  ${pc.yellow(getSSOLoginCommand(profile.name))}`);
  console.log();
  console.log("  This will open your browser for SSO authentication.");
  console.log();

  const loggedIn = await clack.confirm({
    message: "Have you completed the SSO login?",
    initialValue: false,
  });

  if (clack.isCancel(loggedIn)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (!loggedIn) {
    console.log();
    console.log("  Run the login command and try again:");
    console.log(`  ${pc.yellow(getSSOLoginCommand(profile.name))}`);
    console.log();
    return false;
  }

  // Set profile and verify
  console.log();
  clack.log.info(pc.bold("Set Active Profile"));
  console.log();
  console.log("  To use this profile, run:");
  console.log(`  ${pc.yellow(`export AWS_PROFILE=${profile.name}`)}`);
  console.log();
  console.log(pc.dim("  Or add it to your shell profile for persistence."));
  console.log();

  // Check if this profile is now the active one
  const currentProfile = process.env.AWS_PROFILE;
  if (currentProfile === profile.name) {
    // Verify credentials work
    const state = await detectAWSState();
    if (state.credentialsConfigured) {
      console.log();
      clack.log.success(
        `Connected to AWS account ${pc.cyan(state.accountId || "unknown")} via SSO`
      );
      return true;
    }
  }

  console.log();
  clack.log.info(
    `After setting AWS_PROFILE=${profile.name}, run this command again to verify.`
  );
  return true;
}

/**
 * Handle SSO session refresh for users with expired tokens
 */
async function runSSORefresh(state: AWSSetupState): Promise<boolean> {
  console.log();
  clack.log.warn("Your SSO session has expired");
  console.log();

  const activeProfile = state.sso.activeProfile;
  const loginCmd = getSSOLoginCommand(activeProfile?.name);

  console.log("  Run this command to re-authenticate:");
  console.log(`  ${pc.yellow(loginCmd)}`);
  console.log();

  const refreshed = await clack.confirm({
    message: "Have you completed the SSO login?",
    initialValue: false,
  });

  if (clack.isCancel(refreshed)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (!refreshed) {
    console.log();
    console.log("  Run the login command and try again:");
    console.log(`  ${pc.yellow(loginCmd)}`);
    console.log();
    return false;
  }

  // Verify credentials work now
  const newState = await detectAWSState();
  if (newState.credentialsConfigured) {
    console.log();
    clack.log.success(
      `Connected to AWS account ${pc.cyan(newState.accountId || "unknown")} via SSO`
    );
    return true;
  }

  console.log();
  clack.log.warn(
    "Session still appears expired. Please check the login completed successfully."
  );
  return false;
}

/**
 * Show instructions for SSO setup
 */
async function showSSOInstructions(): Promise<boolean> {
  // First check if SSO is already configured
  const existingProfiles = parseSSOProfiles();
  if (existingProfiles.length > 0) {
    console.log();
    clack.log.info(
      `Found ${existingProfiles.length} existing SSO profile${existingProfiles.length > 1 ? "s" : ""}`
    );

    const useExisting = await clack.confirm({
      message: "Would you like to use an existing SSO profile?",
      initialValue: true,
    });

    if (clack.isCancel(useExisting)) {
      clack.cancel("Setup cancelled.");
      return false;
    }

    if (useExisting) {
      return runSSOProfileSelection(existingProfiles);
    }
  }

  console.log();
  clack.log.info(pc.bold("AWS SSO Setup"));
  console.log();
  console.log("  If your organization uses AWS SSO (IAM Identity Center):");
  console.log();
  console.log("  1. Configure SSO:");
  console.log(`     ${pc.yellow("aws configure sso")}`);
  console.log();
  console.log("  2. Follow the prompts to:");
  console.log("     - Enter your SSO start URL");
  console.log("     - Sign in via your browser");
  console.log("     - Select an account and role");
  console.log("     - Name your profile");
  console.log();
  console.log("  3. After setup, login with:");
  console.log(`     ${pc.yellow("aws sso login --profile your-profile-name")}`);
  console.log();
  console.log("  4. Set your profile in the terminal:");
  console.log(`     ${pc.yellow("export AWS_PROFILE=your-profile-name")}`);
  console.log();

  const configured = await clack.confirm({
    message: "Have you configured AWS SSO?",
    initialValue: false,
  });

  if (clack.isCancel(configured)) {
    clack.cancel("Setup cancelled.");
    return false;
  }

  if (configured) {
    const state = await detectAWSState();
    if (state.credentialsConfigured) {
      console.log();
      clack.log.success(
        `Connected to AWS account ${pc.cyan(state.accountId || "unknown")}`
      );
      return true;
    }
    console.log();
    clack.log.warn(
      "Credentials not detected. Make sure you've logged in with `aws sso login`."
    );
    console.log();
    return false;
  }

  return false;
}

/**
 * Show manual setup instructions
 */
function showManualSetupInstructions(): void {
  console.log();
  clack.log.info(pc.bold("Manual Setup"));
  console.log();
  console.log("  For detailed instructions, see our documentation:");
  console.log(`  ${pc.cyan("https://wraps.dev/docs/guides/aws-setup")}`);
  console.log();
  console.log("  Or the official AWS CLI guide:");
  console.log(
    `  ${pc.cyan("https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html")}`
  );
  console.log();
}

/**
 * Path C: Provider setup for users who already have credentials
 */
async function runProviderSetup(state: AWSSetupState): Promise<boolean> {
  console.log();
  clack.log.success(
    `AWS credentials configured (Account: ${pc.cyan(state.accountId || "unknown")})`
  );
  console.log();

  // Check if provider was auto-detected
  if (state.detectedProvider) {
    console.log(
      `  Detected hosting provider: ${pc.cyan(state.detectedProvider)}`
    );
    console.log();
  }

  const setupProvider = await clack.confirm({
    message: "Would you like to configure your hosting provider now?",
    initialValue: true,
  });

  if (clack.isCancel(setupProvider) || !setupProvider) {
    showNextSteps(state);
    return true;
  }

  // Ask about provider
  const provider = await promptProvider();

  // Show provider-specific guidance
  console.log();

  if (provider === "vercel") {
    clack.log.info(pc.bold("Vercel OIDC Setup"));
    console.log();
    console.log(
      "  With Vercel, your production app can access AWS without storing"
    );
    console.log(
      "  any credentials. This is more secure and follows AWS best practices."
    );
    console.log();
    console.log("  When you run `wraps email init`, we'll:");
    console.log("  1. Create an OIDC provider in your AWS account");
    console.log("  2. Create an IAM role that trusts Vercel");
    console.log("  3. Tell you what environment variables to set in Vercel");
    console.log();
    console.log(
      pc.dim(
        "  Your local AWS credentials are only used for the initial setup."
      )
    );
    console.log();
  } else if (provider === "aws") {
    clack.log.info(pc.bold("AWS Native Setup"));
    console.log();
    console.log("  Since your app runs on AWS (Lambda/ECS/EC2), it can use");
    console.log("  IAM roles for authentication - no credentials needed!");
    console.log();
    console.log("  When you run `wraps email init`, we'll create an IAM role");
    console.log("  that your compute can assume to send emails.");
    console.log();
  } else {
    clack.log.info(
      pc.bold(`${provider === "railway" ? "Railway" : "Other"} Setup`)
    );
    console.log();
    console.log(
      "  Your app will need AWS credentials set as environment variables:"
    );
    console.log();
    console.log(`  ${pc.cyan("AWS_ACCESS_KEY_ID")}=your-access-key`);
    console.log(`  ${pc.cyan("AWS_SECRET_ACCESS_KEY")}=your-secret-key`);
    console.log(`  ${pc.cyan("AWS_REGION")}=${state.region || "us-east-1"}`);
    console.log();
    console.log(
      pc.dim("  We recommend creating a dedicated IAM user for production.")
    );
    console.log();
  }

  // Ask about region if not set
  if (!state.region) {
    const setRegion = await clack.confirm({
      message: "Would you like to set a default AWS region?",
      initialValue: true,
    });

    if (!clack.isCancel(setRegion) && setRegion) {
      const region = await promptRegion("us-east-1");
      console.log();
      console.log("  To set this region permanently, run:");
      console.log(`  ${pc.yellow(`export AWS_REGION=${region}`)}`);
      console.log();
      console.log(
        "  Or add it to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
      );
      console.log();
    }
  }

  showNextSteps(state);
  return true;
}

/**
 * Show next steps after setup
 */
function showNextSteps(_state: AWSSetupState): void {
  console.log();
  clack.log.info(pc.bold("Next Steps"));
  console.log();
  console.log("  Deploy email infrastructure:");
  console.log(`  ${pc.yellow("npx @wraps.dev/cli email init")}`);
  console.log();
  console.log("  Check AWS setup diagnostics:");
  console.log(`  ${pc.yellow("npx @wraps.dev/cli aws doctor")}`);
  console.log();
  console.log("  Documentation:");
  console.log(`  ${pc.cyan("https://wraps.dev/docs")}`);
  console.log();
}

/**
 * AWS Setup Wizard entry point
 */
export async function setup(_options: SetupOptions = {}): Promise<void> {
  const startTime = Date.now();
  clack.intro(pc.bold("AWS Setup Wizard"));

  // Detect current state
  const spinner = clack.spinner();
  spinner.start("Checking your AWS setup...");

  const state = await detectAWSState();

  spinner.stop("AWS setup check complete");

  // Display current state
  displayCurrentState(state);

  // Route to appropriate setup path
  if (!state.cliInstalled) {
    // Path A: Full setup
    await runFullSetup();
  } else if (state.credentialsConfigured) {
    // Path C: Provider setup (already have credentials)
    await runProviderSetup(state);
  } else {
    // Check if SSO is configured but session expired
    if (state.sso.configured && state.sso.tokenStatus?.expired) {
      // SSO configured but session expired - offer to refresh
      await runSSORefresh(state);
    } else if (state.sso.configured && state.sso.profiles.length > 0) {
      // SSO configured but no active credentials - offer profile selection
      await runSSOProfileSelection(state.sso.profiles);
    } else {
      // Path B: Credential setup (standard flow)
      await runCredentialSetup();
    }
  }

  trackCommand("aws:setup", {
    success: true,
    duration_ms: Date.now() - startTime,
  });

  clack.outro(pc.dim("Run `wraps aws doctor` to verify your setup"));
}
