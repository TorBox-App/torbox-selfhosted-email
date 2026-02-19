/**
 * SendConfirmDialog Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendConfirmDialog } from "../send-confirm-dialog";

describe("SendConfirmDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render title and recipient count when open", () => {
    render(
      <SendConfirmDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        recipientCount={1500}
        variant="send"
      />
    );

    expect(screen.getByText("Confirm send")).toBeInTheDocument();
    expect(screen.getByText(/1,500 contacts/)).toBeInTheDocument();
  });

  it("should call onConfirm when Send now is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <SendConfirmDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open={true}
        recipientCount={100}
        variant="send"
      />
    );

    await user.click(screen.getByRole("button", { name: /send now/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("should not call onConfirm when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <SendConfirmDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open={true}
        recipientCount={100}
        variant="send"
      />
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("should show schedule variant with different title and button", () => {
    render(
      <SendConfirmDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        recipientCount={2000}
        variant="schedule"
      />
    );

    expect(screen.getByText("Confirm schedule")).toBeInTheDocument();
    expect(screen.getByText(/2,000 contacts/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^schedule$/i })
    ).toBeInTheDocument();
  });

  it("should show loading state when loading is true", () => {
    render(
      <SendConfirmDialog
        loading={true}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        recipientCount={100}
        variant="send"
      />
    );

    expect(
      screen.getByRole("button", { name: /sending/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
  });

  it("should open dialog on trigger click, then call onConfirm on confirmation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    function TestHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Send to 500 contacts
          </button>
          <SendConfirmDialog
            onConfirm={onConfirm}
            onOpenChange={setOpen}
            open={open}
            recipientCount={500}
            variant="send"
          />
        </>
      );
    }

    render(<TestHarness />);

    // Dialog should not be visible initially
    expect(screen.queryByText("Confirm send")).not.toBeInTheDocument();

    // Click the send button — opens dialog
    await user.click(screen.getByText("Send to 500 contacts"));
    expect(screen.getByText("Confirm send")).toBeInTheDocument();

    // Confirm — calls onConfirm
    await user.click(screen.getByRole("button", { name: /send now/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("should open dialog on trigger click but NOT call onConfirm on cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    function TestHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Send to 200 contacts
          </button>
          <SendConfirmDialog
            onConfirm={onConfirm}
            onOpenChange={setOpen}
            open={open}
            recipientCount={200}
            variant="send"
          />
        </>
      );
    }

    render(<TestHarness />);

    // Click the send button — opens dialog
    await user.click(screen.getByText("Send to 200 contacts"));
    expect(screen.getByText("Confirm send")).toBeInTheDocument();

    // Cancel — does NOT call onConfirm
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText("Confirm send")).not.toBeInTheDocument();
    });
  });
});
