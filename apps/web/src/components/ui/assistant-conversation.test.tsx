/**
 * AssistantConversation Tests
 *
 * @vitest-environment jsdom
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, describe, expect, it } from "vitest";
import { AssistantConversation } from "./assistant-conversation";

afterEach(() => {
  cleanup();
});

const userMessage: UIMessage = {
  id: "msg-user-1",
  role: "user",
  parts: [{ type: "text", text: "Hello there" }],
};

const assistantMessage: UIMessage = {
  id: "msg-assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "Hi, how can I help?" }],
};

describe("AssistantConversation", () => {
  it("renders both user and assistant message text inside a log region", () => {
    render(
      <AssistantConversation
        isLoading={false}
        messages={[userMessage, assistantMessage]}
      />
    );

    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi, how can I help?")).toBeInTheDocument();
    expect(screen.getByRole("log")).toBeInTheDocument();
  });

  it("renders the empty state when there are no messages", () => {
    render(
      <AssistantConversation
        emptyState={<p>Nothing here yet</p>}
        isLoading={false}
        messages={[]}
      />
    );

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders a status marker while loading after a trailing user message", () => {
    render(
      <AssistantConversation
        isLoading
        loadingLabel="Generating..."
        messages={[userMessage]}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });
});
