import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@wraps/email", () => ({
  getWrapsClient: vi.fn(),
}));

import { db } from "@wraps/db";
import * as schema from "@wraps/db/schema/auth";
import { auth } from "../index";

const hook = (auth.options.databaseHooks as any)?.user?.update?.after;

if (!hook) {
  throw new Error("Expected databaseHooks.user.update.after to be configured");
}

describe("SCIM session revocation — databaseHooks.user.update.after", () => {
  const mockWhere = vi.fn().mockResolvedValue([]);
  let deleteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([]);
    deleteSpy = vi
      .spyOn(db, "delete")
      .mockReturnValue({ where: mockWhere } as any);
  });

  afterEach(() => {
    deleteSpy.mockRestore();
  });

  it("deletes sessions from the session table for the user when banned becomes true", async () => {
    await hook({ id: "user-123", banned: true });
    expect(deleteSpy).toHaveBeenCalledWith(schema.session);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });

  it("does not delete sessions when banned is false (reactivation)", async () => {
    await hook({ id: "user-123", banned: false });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("does not delete sessions when banned field is absent", async () => {
    await hook({ id: "user-123" });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("does not delete sessions when banned is null", async () => {
    await hook({ id: "user-123", banned: null });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  // The IdP-facing name for deactivation. It must NOT drive this hook: the SCIM
  // plugin translates it to `banned` before the write, so an `active` key here
  // would mean the hook is keyed off a field the DB layer never sees.
  it("ignores a raw SCIM `active: false` payload", async () => {
    await hook({ id: "user-123", active: false });
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
