import { describe, expect, it } from "vitest";
import { buildDeployedEnvVars } from "../env.js";

/**
 * The from-address rule itself is tested next to it in
 * packages/cli/src/utils/selfhost/__tests__/email-stack.test.ts. What matters
 * here is that the SST variant's env file actually carries the result.
 */

describe("buildDeployedEnvVars", () => {
  const base = {
    apiUrl: "https://api.example.com",
    webUrl: "https://app.example.com",
    webDomain: "app.example.com",
  };

  it("emits AUTH_EMAIL_FROM at the verified domain, not the dashboard domain", () => {
    const vars = buildDeployedEnvVars({
      ...base,
      emailStack: {
        roleArn: "arn:aws:iam::123456789012:role/wraps-email-role",
        configSetName: "wraps-email-example-com",
        verifiedDomains: ["mail.example.net"],
      },
    });

    expect(vars.AUTH_EMAIL_FROM).toBe("noreply@mail.example.net");
  });

  it("emits AUTH_EMAIL_FROM even with no configuration set", () => {
    // A config set only adds event tracking. Gating the from-address on it
    // left auth email dead in accounts that could send fine.
    const vars = buildDeployedEnvVars({
      ...base,
      emailStack: {
        roleArn: null,
        configSetName: null,
        verifiedDomains: ["example.com"],
      },
    });

    expect(vars.AUTH_EMAIL_FROM).toBe("noreply@app.example.com");
    expect(vars.AUTH_EMAIL_CONFIGURATION_SET).toBeNull();
  });

  it("omits AUTH_EMAIL_FROM when SES has no verified domain", () => {
    const vars = buildDeployedEnvVars({
      ...base,
      emailStack: {
        roleArn: null,
        configSetName: null,
        verifiedDomains: [],
      },
    });

    expect(vars.AUTH_EMAIL_FROM).toBeNull();
  });
});
