import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export function runSubprocess(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
  cwd?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
      cwd: cwd ?? REPO_ROOT,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args[0]} failed with exit code ${code}`));
      }
    });
  });
}
