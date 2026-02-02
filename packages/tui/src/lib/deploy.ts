import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { InitConfig } from "../types";

export function buildInitCommand(config: InitConfig): string[] {
  const args = [
    "email",
    "init",
    "--provider",
    config.provider,
    "--region",
    config.region,
    "--domain",
    config.domain,
    "--preset",
    config.preset,
    "--yes",
  ];

  if (
    config.provider === "vercel" &&
    config.vercelConfig?.teamSlug &&
    config.vercelConfig?.projectName
  ) {
    args.push(
      "--vercel-team",
      config.vercelConfig.teamSlug,
      "--vercel-project",
      config.vercelConfig.projectName
    );
  }

  return args;
}

export function spawnDeploy(args: string[]): {
  lines: AsyncIterable<string>;
  exitCode: Promise<number>;
} {
  const proc = spawn("wraps", args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  const rl = createInterface({ input: proc.stdout! });
  const errRl = createInterface({ input: proc.stderr! });

  const lineBuffer: string[] = [];
  let resolve: ((value: IteratorResult<string>) => void) | null = null;
  let done = false;

  const push = (line: string) => {
    if (resolve) {
      const r = resolve;
      resolve = null;
      r({ value: line, done: false });
    } else {
      lineBuffer.push(line);
    }
  };

  rl.on("line", push);
  errRl.on("line", push);

  const finish = () => {
    if (done) return;
    done = true;
    if (resolve) {
      const r = resolve;
      resolve = null;
      r({ value: undefined as unknown as string, done: true });
    }
  };

  rl.on("close", finish);
  errRl.on("close", finish);

  const lines: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          if (lineBuffer.length > 0) {
            return Promise.resolve({
              value: lineBuffer.shift()!,
              done: false,
            });
          }
          if (done) {
            return Promise.resolve({
              value: undefined as unknown as string,
              done: true,
            });
          }
          return new Promise<IteratorResult<string>>((r) => {
            resolve = r;
          });
        },
      };
    },
  };

  const exitCode = new Promise<number>((res) => {
    proc.on("close", (code) => res(code ?? 1));
    proc.on("error", () => res(1));
  });

  return { lines, exitCode };
}
