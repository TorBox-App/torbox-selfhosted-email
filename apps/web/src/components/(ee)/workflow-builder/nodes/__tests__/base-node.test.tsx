// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BaseNode } from "../base-node";

const mockUpdateNodeName = vi.fn();

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  useNodeId: () => "node-1",
}));

vi.mock("../../use-workflow-store", () => ({
  useWorkflowStore: (
    sel: (s: { updateNodeName: typeof mockUpdateNodeName }) => unknown
  ) => sel({ updateNodeName: mockUpdateNodeName }),
}));

beforeEach(() => {
  mockUpdateNodeName.mockReset();
});

describe("BaseNode", () => {
  it("renders label as text by default", () => {
    render(<BaseNode accentColor="bg-blue-500" icon={null} label="My Node" />);
    expect(screen.getByText("My Node")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("double-click enters edit mode with current label value", () => {
    render(<BaseNode accentColor="bg-blue-500" icon={null} label="My Node" />);
    fireEvent.doubleClick(screen.getByTitle("Double-click to rename"));
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("My Node");
  });

  it("Enter commits the rename", () => {
    render(<BaseNode accentColor="bg-blue-500" icon={null} label="My Node" />);
    fireEvent.doubleClick(screen.getByTitle("Double-click to rename"));
    act(() => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "New Name" },
      });
    });
    act(() => {
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    });
    expect(mockUpdateNodeName).toHaveBeenCalledOnce();
    expect(mockUpdateNodeName).toHaveBeenCalledWith("node-1", "New Name");
  });

  it("Escape cancels without calling updateNodeName", () => {
    render(<BaseNode accentColor="bg-blue-500" icon={null} label="My Node" />);
    fireEvent.doubleClick(screen.getByTitle("Double-click to rename"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mockUpdateNodeName).not.toHaveBeenCalled();
    expect(screen.getByText("My Node")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("empty/whitespace-only value does not rename on blur", () => {
    render(<BaseNode accentColor="bg-blue-500" icon={null} label="My Node" />);
    fireEvent.doubleClick(screen.getByTitle("Double-click to rename"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(mockUpdateNodeName).not.toHaveBeenCalled();
  });
});
