/**
 * AgentApprovalQueue Tests
 *
 * The approval queue is the human control between an autonomous agent and a
 * stranger's inbox. It used to let an operator approve a send having read
 * only a truncated subject and a recipient address — never the body. These
 * tests pin two properties: a decision is unreachable from the table row
 * (only from the detail sheet that shows the full message), and the HTML
 * preview iframe is sandboxed with no escape hatch.
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApprovalWithMeta } from "@/lib/agents";

vi.mock("@/actions/agents", () => ({
  listApprovals: vi.fn(),
  approveSend: vi.fn(),
  rejectSend: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { approveSend, listApprovals, rejectSend } from "@/actions/agents";
import { AgentApprovalQueue } from "../agent-approval-queue";

function makeApproval(
  overrides: Partial<ApprovalWithMeta> = {}
): ApprovalWithMeta {
  return {
    id: "approval-1",
    agentId: "agent-1",
    agentName: "Support Bot",
    payload: {
      from: "agent@example.com",
      to: "customer@example.com",
      subject: "Your refund request",
      html: "<p>Hello there</p>",
      text: "Hello there",
    },
    reason: "New recipient domain",
    status: "PENDING",
    decidedBy: null,
    decidedAt: null,
    messageId: null,
    errorMessage: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

// Payload with text only (no html): forces the sheet's default tab to Plain
// text so the body is visible immediately, without an extra tab click. The
// html-present default-tab behaviour is its own test below.
function textOnlyApproval(
  overrides: Partial<ApprovalWithMeta> = {}
): ApprovalWithMeta {
  return makeApproval({
    payload: {
      from: "agent@example.com",
      to: "customer@example.com",
      subject: "Your refund request",
      text: "Hello there",
    },
    ...overrides,
  });
}

function mockApprovals(approvals: ApprovalWithMeta[]) {
  vi.mocked(listApprovals).mockResolvedValue({ success: true, approvals });
}

async function renderQueue(
  approvals: ApprovalWithMeta[],
  userRole: "owner" | "admin" | "member" = "owner"
) {
  mockApprovals(approvals);
  render(
    <AgentApprovalQueue
      organizationId="org-1"
      orgSlug="acme"
      userRole={userRole}
    />
  );
  // Wait for the initial load to resolve.
  await screen.findByRole("table");
}

describe("AgentApprovalQueue", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders no Approve or Reject button in the table for a PENDING row (regression guard)", async () => {
    await renderQueue([makeApproval()]);

    const table = screen.getByRole("table");
    expect(
      within(table).queryByRole("button", { name: /approve/i })
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("button", { name: /reject/i })
    ).not.toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: /review/i })
    ).toBeInTheDocument();
  });

  it("opens the sheet with the message body when Review is clicked", async () => {
    const user = userEvent.setup();
    await renderQueue([textOnlyApproval()]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    expect(await screen.findByText("Hello there")).toBeInTheDocument();
  });

  it("shows the full recipient address in the sheet even though the row truncates it", async () => {
    const user = userEvent.setup();
    const longRecipient =
      "a-very-long-recipient-address-that-would-be-truncated-in-the-table-row@example.com";
    await renderQueue([
      makeApproval({
        payload: { ...makeApproval().payload, to: longRecipient },
      }),
    ]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    expect(await screen.findByText(longRecipient)).toBeInTheDocument();
  });

  it("calls approveSend once with the approval id when Approve is clicked in the sheet", async () => {
    const user = userEvent.setup();
    vi.mocked(approveSend).mockResolvedValue({
      success: true,
      approval: makeApproval({ status: "SENT" }),
    });
    await renderQueue([makeApproval()]);

    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(await screen.findByRole("button", { name: /^approve$/i }));

    await waitFor(() => {
      expect(approveSend).toHaveBeenCalledTimes(1);
    });
    expect(approveSend).toHaveBeenCalledWith("approval-1", "org-1");
  });

  it("calls rejectSend once with the approval id when Reject is clicked in the sheet", async () => {
    const user = userEvent.setup();
    vi.mocked(rejectSend).mockResolvedValue({
      success: true,
      approval: makeApproval({ status: "REJECTED" }),
    });
    await renderQueue([makeApproval()]);

    await user.click(screen.getByRole("button", { name: /review/i }));
    await user.click(await screen.findByRole("button", { name: /^reject$/i }));

    await waitFor(() => {
      expect(rejectSend).toHaveBeenCalledTimes(1);
    });
    expect(rejectSend).toHaveBeenCalledWith("approval-1", "org-1");
  });

  it("opens a non-PENDING approval's sheet with no decision buttons", async () => {
    const user = userEvent.setup();
    await renderQueue([textOnlyApproval({ status: "SENT" })]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    await screen.findByText("Hello there");
    expect(
      screen.queryByRole("button", { name: /^approve$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^reject$/i })
    ).not.toBeInTheDocument();
  });

  it("lets a read-only member open the sheet and read content, but shows no decision buttons", async () => {
    const user = userEvent.setup();
    await renderQueue([textOnlyApproval()], "member");

    await user.click(screen.getByRole("button", { name: /review/i }));

    await screen.findByText("Hello there");
    expect(
      screen.queryByRole("button", { name: /^approve$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^reject$/i })
    ).not.toBeInTheDocument();
  });

  it("renders the preview iframe fully sandboxed with no referrer leak", async () => {
    const user = userEvent.setup();
    await renderQueue([makeApproval()]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    const iframe = await screen.findByTitle("Message preview");
    expect(iframe).toHaveAttribute("sandbox", "");
    expect(iframe).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("shows 'No message body' and still allows a decision when payload has neither html nor text", async () => {
    const user = userEvent.setup();
    await renderQueue([
      makeApproval({
        payload: {
          from: "agent@example.com",
          to: "customer@example.com",
          subject: "Empty",
        },
      }),
    ]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    expect(await screen.findByText("No message body")).toBeInTheDocument();
    const approveButton = screen.getByRole("button", { name: /^approve$/i });
    expect(approveButton).toBeEnabled();
  });

  it("defaults to the Preview tab when html is present and text is absent", async () => {
    const user = userEvent.setup();
    await renderQueue([
      makeApproval({
        payload: {
          from: "agent@example.com",
          to: "customer@example.com",
          subject: "HTML only",
          html: "<p>Only html</p>",
        },
      }),
    ]);

    await user.click(screen.getByRole("button", { name: /review/i }));

    const previewTab = await screen.findByRole("tab", { name: "Preview" });
    expect(previewTab).toHaveAttribute("data-state", "active");
    expect(screen.getByTitle("Message preview")).toBeInTheDocument();
  });
});
