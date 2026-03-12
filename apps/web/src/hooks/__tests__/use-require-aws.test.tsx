/**
 * useRequireAws Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/products-store", () => ({
  useProductsStore: vi.fn(),
}));

import { useProductsStore } from "@/stores/products-store";
import { useRequireAws } from "../use-require-aws";

const mockUseProductsStore = vi.mocked(useProductsStore);

describe("useRequireAws", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when hasAwsAccounts is true", () => {
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: true } })
    );

    const { result } = renderHook(() => useRequireAws("test-org"));

    let allowed: boolean;
    act(() => {
      allowed = result.current.requireAws("send");
    });

    expect(allowed!).toBe(true);
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.pendingAction).toBeNull();
  });

  it("should return false and set dialog open when hasAwsAccounts is false", () => {
    mockUseProductsStore.mockImplementation((selector: any) =>
      selector({ status: { hasAwsAccounts: false } })
    );

    const { result } = renderHook(() => useRequireAws("test-org"));

    let allowed: boolean;
    act(() => {
      allowed = result.current.requireAws("publish");
    });

    expect(allowed!).toBe(false);
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.pendingAction).toBe("publish");
    expect(result.current.orgSlug).toBe("test-org");
  });
});
