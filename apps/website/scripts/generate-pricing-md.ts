/**
 * Regenerates public/pricing.md from the pricing config and cost engine.
 * Run with `pnpm --filter wraps-website pricing:md`.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderPricingMarkdown } from "../src/lib/pricing-markdown";

const outputPath = resolve(import.meta.dirname, "..", "public", "pricing.md");

writeFileSync(outputPath, renderPricingMarkdown(), "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);
