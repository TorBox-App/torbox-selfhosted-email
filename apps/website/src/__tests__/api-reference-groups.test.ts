import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = resolve(__dirname, "..", "..");
const read = (relativePath: string) =>
  readFileSync(resolve(webRoot, relativePath), "utf8");

const PAGE_CONTENT_PATH = "src/app/docs/reference/api/page-content.tsx";

describe("API reference endpoint groups stay in sync", () => {
  const source = read(PAGE_CONTENT_PATH);

  it("lists Agents and Email Logs in endpointGroups", () => {
    expect(source).toContain('name: "Agents"');
    expect(source).toContain('name: "Email Logs"');
  });

  it("lists Agents and Email Logs in the markdown endpoints table", () => {
    expect(source).toMatch(/^\| Agents \|/m);
    expect(source).toMatch(/^\| Email Logs \|/m);
  });

  it("has a matching markdown row for every endpointGroups entry", () => {
    const groupsMatch = source.match(
      /const endpointGroups = \[([\s\S]*?)\n\];/
    );
    if (!groupsMatch) {
      throw new Error(
        "could not find endpointGroups array in page-content.tsx"
      );
    }
    const groupNames = new Set(
      [...groupsMatch[1].matchAll(/name: "([^"]+)"/g)].map((m) => m[1])
    );

    const tableMatch = source.match(
      /\| Group \| Description \| Auth Required \|\n\|[-|]+\|\n([\s\S]*?)`,/
    );
    if (!tableMatch) {
      throw new Error("could not find the markdown endpoints table");
    }
    const tableNames = new Set(
      [...tableMatch[1].matchAll(/^\| ([^|]+) \|/gm)].map((m) => m[1].trim())
    );

    const missingFromTable = [...groupNames].filter(
      (name) => !tableNames.has(name)
    );
    const missingFromArray = [...tableNames].filter(
      (name) => !groupNames.has(name)
    );

    expect(
      missingFromTable,
      `groups in endpointGroups but missing from the markdown table: ${missingFromTable.join(", ")}`
    ).toEqual([]);
    expect(
      missingFromArray,
      `rows in the markdown table but missing from endpointGroups: ${missingFromArray.join(", ")}`
    ).toEqual([]);
  });
});
