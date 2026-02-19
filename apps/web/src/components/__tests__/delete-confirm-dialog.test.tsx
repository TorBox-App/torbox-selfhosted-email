/**
 * DeleteConfirmDialog Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteConfirmDialog } from "../delete-confirm-dialog";

describe("DeleteConfirmDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render title and description when open", () => {
    render(
      <DeleteConfirmDialog
        description="Are you sure you want to delete this template? This action cannot be undone."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        title="Delete Template"
      />
    );

    expect(screen.getByText("Delete Template")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ).toBeInTheDocument();
  });

  it("should call onConfirm when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteConfirmDialog
        description="This action cannot be undone."
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open={true}
        title="Delete Template"
      />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("should not call onConfirm when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <DeleteConfirmDialog
        description="This action cannot be undone."
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open={true}
        title="Delete Template"
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("should show loading state when loading is true", () => {
    render(
      <DeleteConfirmDialog
        description="This action cannot be undone."
        loading={true}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        title="Delete Template"
      />
    );

    expect(
      screen.getByRole("button", { name: /deleting/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
