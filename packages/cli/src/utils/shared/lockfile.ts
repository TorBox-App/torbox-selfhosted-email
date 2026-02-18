import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type LockfileTemplateEntry = {
  id?: string;
  localHash: string;
  remoteHash?: string;
  sesTemplateName: string;
  lastPushed: string;
};

export type LockfileWorkflowEntry = {
  id?: string;
  localHash: string;
  remoteHash?: string;
  lastPushed: string;
};

export type Lockfile = {
  version: string;
  org?: string;
  lastSync: string;
  templates: Record<string, LockfileTemplateEntry>;
  workflows: Record<string, LockfileWorkflowEntry>;
};

export function getLockfilePath(wrapsDir: string): string {
  return join(wrapsDir, ".wraps", "lockfile.json");
}

export async function loadLockfile(wrapsDir: string): Promise<Lockfile> {
  const path = getLockfilePath(wrapsDir);
  if (!existsSync(path)) {
    return { version: "1.0.0", lastSync: "", templates: {}, workflows: {} };
  }
  try {
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content) as Lockfile;
    if (!parsed.templates) {
      parsed.templates = {};
    }
    if (!parsed.workflows) {
      parsed.workflows = {};
    }
    return parsed;
    // baseline:allow-next-line no-swallowed-errors — corrupted lockfile returns fresh default
  } catch {
    return { version: "1.0.0", lastSync: "", templates: {}, workflows: {} };
  }
}

export async function saveLockfile(
  wrapsDir: string,
  lockfile: Lockfile
): Promise<void> {
  const path = getLockfilePath(wrapsDir);
  const dir = join(path, "..");
  await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(lockfile, null, 2), "utf-8");
}
