import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSpawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn: mockSpawn }));

vi.mock("node:path", async () => {
  const actual = await vi.importActual("node:path");
  return actual;
});

vi.mock("node:url", async () => {
  const actual = await vi.importActual("node:url");
  return actual;
});

import { runSubprocess } from "../subprocess.js";

function makeChild(exitCode: number | null = 0) {
  const emitter = new EventEmitter() as EventEmitter & { stdio: "inherit" };
  queueMicrotask(() => {
    emitter.emit("close", exitCode);
  });
  return emitter;
}

function makeErrorChild(err: Error) {
  const emitter = new EventEmitter() as EventEmitter & { stdio: "inherit" };
  queueMicrotask(() => {
    emitter.emit("error", err);
  });
  return emitter;
}

describe("runSubprocess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves when process exits with code 0", async () => {
    mockSpawn.mockReturnValue(makeChild(0));
    await expect(runSubprocess("echo", ["hello"])).resolves.toBeUndefined();
  });

  it("rejects with descriptive error when process exits non-zero", async () => {
    mockSpawn.mockReturnValue(makeChild(1));
    await expect(runSubprocess("sst", ["deploy"])).rejects.toThrow(
      "sst deploy failed with exit code 1"
    );
  });

  it("rejects when process emits error event (e.g. command not found)", async () => {
    const spawnError = Object.assign(new Error("spawn sst ENOENT"), {
      code: "ENOENT",
    });
    mockSpawn.mockReturnValue(makeErrorChild(spawnError));
    await expect(runSubprocess("sst", ["bootstrap"])).rejects.toThrow(
      "spawn sst ENOENT"
    );
  });

  it("passes cwd and merged env to spawn", async () => {
    mockSpawn.mockReturnValue(makeChild(0));
    await runSubprocess("sst", ["deploy"], { MY_VAR: "123" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "sst",
      ["deploy"],
      expect.objectContaining({
        stdio: "inherit",
        env: expect.objectContaining({ MY_VAR: "123" }),
      })
    );
  });
});
