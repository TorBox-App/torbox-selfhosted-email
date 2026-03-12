/**
 * ConnectAwsDialog Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectAwsDialog } from "../connect-aws-dialog";

describe("ConnectAwsDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should render title and send action description when open", () => {
    render(
      <ConnectAwsDialog
        action="send"
        onOpenChange={vi.fn()}
        open={true}
        orgSlug="test-org"
      />
    );

    expect(screen.getByText("Connect AWS to continue")).toBeInTheDocument();
    expect(
      screen.getByText(
        "To send this broadcast, connect your AWS account first. Your emails are sent through your own AWS SES."
      )
    ).toBeInTheDocument();
  });

  it("should render publish action description when open", () => {
    render(
      <ConnectAwsDialog
        action="publish"
        onOpenChange={vi.fn()}
        open={true}
        orgSlug="test-org"
      />
    );

    expect(screen.getByText("Connect AWS to continue")).toBeInTheDocument();
    expect(
      screen.getByText(
        "To publish this template to SES, connect your AWS account first. Templates are published to your own AWS."
      )
    ).toBeInTheDocument();
  });

  it("should render enable action description when open", () => {
    render(
      <ConnectAwsDialog
        action="enable"
        onOpenChange={vi.fn()}
        open={true}
        orgSlug="test-org"
      />
    );

    expect(screen.getByText("Connect AWS to continue")).toBeInTheDocument();
    expect(
      screen.getByText(
        "To enable this workflow, connect your AWS account first. Workflows run on your own AWS infrastructure."
      )
    ).toBeInTheDocument();
  });

  it("should link Connect AWS button to /{orgSlug}/onboarding", () => {
    render(
      <ConnectAwsDialog
        action="send"
        onOpenChange={vi.fn()}
        open={true}
        orgSlug="my-company"
      />
    );

    const link = screen.getByRole("link", { name: /connect aws/i });
    expect(link).toHaveAttribute("href", "/my-company/onboarding");
  });

  it("should call onOpenChange with false when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    function TestHarness() {
      const [open, setOpen] = useState(true);
      return (
        <ConnectAwsDialog
          action="send"
          onOpenChange={(v) => {
            setOpen(v);
            onOpenChange(v);
          }}
          open={open}
          orgSlug="test-org"
        />
      );
    }

    render(<TestHarness />);

    expect(screen.getByText("Connect AWS to continue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByText("Connect AWS to continue")
      ).not.toBeInTheDocument();
    });
  });
});
