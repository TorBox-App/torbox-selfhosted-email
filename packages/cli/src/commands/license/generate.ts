import * as clack from "@clack/prompts";
import pc from "picocolors";
import type { LicenseGenerateOptions } from "../../types/index.js";
import { generateLicenseKey } from "../../utils/license.js";
import { isJsonMode, jsonSuccess } from "../../utils/shared/json-output.js";

const VALID_TIERS = ["starter", "growth", "scale"];

export async function licenseGenerate(
  options: LicenseGenerateOptions
): Promise<void> {
  if (!isJsonMode()) {
    clack.intro(pc.bold("Wraps License Key Generator"));
  }

  let tier = options.tier;
  if (!tier) {
    const answer = await clack.select({
      message: "License tier:",
      options: VALID_TIERS.map((t) => ({ value: t, label: t })),
    });
    if (clack.isCancel(answer)) {
      clack.cancel("Cancelled.");
      process.exit(0);
    }
    tier = answer as string;
  }

  let expires = options.expires;
  if (!expires) {
    const answer = await clack.text({
      message: "Expiry date (YYYY-MM-DD):",
      placeholder: "2027-05-13",
      validate: (v) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Use YYYY-MM-DD format";
        const today = new Date().toISOString().slice(0, 10);
        if (v <= today) return "Expiry date must be in the future";
      },
    });
    if (clack.isCancel(answer)) {
      clack.cancel("Cancelled.");
      process.exit(0);
    }
    expires = answer as string;
  }

  const key = generateLicenseKey(tier, expires);

  if (isJsonMode()) {
    jsonSuccess("license.generate", { key, tier, expires });
    return;
  }

  clack.note(
    [
      `${pc.bold("Key:")}     ${pc.cyan(key)}`,
      `${pc.bold("Tier:")}    ${pc.dim(tier)}`,
      `${pc.bold("Expires:")} ${pc.dim(expires)}`,
    ].join("\n"),
    "Generated License Key"
  );

  clack.outro(
    pc.dim("Set WRAPS_LICENSE_KEY=<key> in the self-hosted deployment")
  );
}
