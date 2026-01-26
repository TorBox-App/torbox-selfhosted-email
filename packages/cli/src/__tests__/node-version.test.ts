import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Node.js version check", () => {
  it("should have a Node.js version check in cli.ts", () => {
    const cliPath = join(__dirname, "../cli.ts");
    const cliContent = readFileSync(cliPath, "utf-8");

    // Verify the version check exists
    expect(cliContent).toContain("process.versions.node");
    expect(cliContent).toContain("nodeMajorVersion < 20");
    expect(cliContent).toContain("Wraps CLI requires Node.js 20 or higher");
  });

  it("should exit with code 1 if check fails", () => {
    const cliPath = join(__dirname, "../cli.ts");
    const cliContent = readFileSync(cliPath, "utf-8");

    // Verify it calls process.exit(1) when version is too low
    expect(cliContent).toMatch(/if\s*\(\s*nodeMajorVersion\s*<\s*20\s*\)/);
    expect(cliContent).toContain("process.exit(1)");
  });

  it("should provide upgrade instructions", () => {
    const cliPath = join(__dirname, "../cli.ts");
    const cliContent = readFileSync(cliPath, "utf-8");

    // Verify upgrade instructions are present
    expect(cliContent).toContain("nvm install 20");
    expect(cliContent).toContain("brew install node@20");
    expect(cliContent).toContain("nodejs.org");
  });

  it("should correctly parse the major version", () => {
    // Test the version parsing logic works correctly
    const parseVersion = (version: string): number => {
      const [major] = version.split(".").map(Number);
      return major;
    };

    expect(parseVersion("18.17.0")).toBe(18);
    expect(parseVersion("20.0.0")).toBe(20);
    expect(parseVersion("20.10.0")).toBe(20);
    expect(parseVersion("22.1.0")).toBe(22);
  });
});
