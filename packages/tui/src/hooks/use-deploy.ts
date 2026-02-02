import { useCallback, useRef, useState } from "react";
import { buildInitCommand, spawnDeploy } from "../lib/deploy";
import type { InitConfig } from "../types";

export type UseDeployReturn = {
  status: "idle" | "running" | "done" | "error";
  output: string[];
  error: string | null;
  start: (config: InitConfig) => void;
};

export function useDeploy(): UseDeployReturn {
  const [status, setStatus] = useState<UseDeployReturn["status"]>("idle");
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const processRef = useRef<ReturnType<typeof spawnDeploy> | null>(null);

  const start = useCallback((config: InitConfig) => {
    setStatus("running");
    setOutput([]);
    setError(null);

    const args = buildInitCommand(config);
    const spawned = spawnDeploy(args);
    processRef.current = spawned;

    (async () => {
      try {
        for await (const line of spawned.lines) {
          setOutput((prev) => [...prev, line]);
        }

        const exitCode = await spawned.exitCode;
        if (exitCode === 0) {
          setStatus("done");
        } else {
          setStatus("error");
          setError(`Process exited with code ${exitCode}`);
        }
      } catch (err: unknown) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Deployment failed");
      }
    })();
  }, []);

  return { status, output, error, start };
}
