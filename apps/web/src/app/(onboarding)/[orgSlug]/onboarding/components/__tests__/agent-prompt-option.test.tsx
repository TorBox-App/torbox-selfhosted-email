/**
 * AgentPromptOption tests — the copy button must put the exact prompt on the
 * clipboard (a truncated or stale prompt silently breaks the agent path) and
 * the prompt itself must stay hidden until the user expands it.
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWriteText = vi.fn();

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  BotIcon: () => <svg data-testid="bot-icon" />,
  CheckIcon: () => <svg data-testid="check-icon" />,
  ChevronDownIcon: () => <svg data-testid="chevron-icon" />,
  CopyIcon: () => <svg data-testid="copy-icon" />,
}));

import { AgentPromptOption } from "../agent-prompt-option";

const PROMPT = "Deploy Wraps email infrastructure.\n1. Step one\n2. Step two";

describe("AgentPromptOption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("copies the full prompt verbatim", async () => {
    render(<AgentPromptOption prompt={PROMPT} />);

    fireEvent.click(screen.getByText("Copy prompt"));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(PROMPT);
    });
  });

  it("fires onCopyPrompt only for the prompt, not the skills install", async () => {
    const onCopyPrompt = vi.fn();
    render(<AgentPromptOption onCopyPrompt={onCopyPrompt} prompt={PROMPT} />);

    fireEvent.click(screen.getByText("npx add-skill wraps-team/skills"));
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        "npx add-skill wraps-team/skills"
      );
    });
    expect(onCopyPrompt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Copy prompt"));
    await waitFor(() => {
      expect(onCopyPrompt).toHaveBeenCalledTimes(1);
    });
  });

  it("hides the prompt body until expanded, then shows it", () => {
    render(<AgentPromptOption prompt={PROMPT} />);

    expect(screen.queryByText(/Step one/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("View"));

    expect(screen.getByText(/Step one/)).toBeInTheDocument();
    expect(screen.getByText("Hide")).toBeInTheDocument();
  });

  it("does not crash when the clipboard is unavailable", async () => {
    mockWriteText.mockRejectedValue(new Error("not allowed"));
    const onCopyPrompt = vi.fn();
    render(<AgentPromptOption onCopyPrompt={onCopyPrompt} prompt={PROMPT} />);

    fireEvent.click(screen.getByText("Copy prompt"));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });
    expect(onCopyPrompt).not.toHaveBeenCalled();
    expect(screen.getByText("Copy prompt")).toBeInTheDocument();
  });
});
