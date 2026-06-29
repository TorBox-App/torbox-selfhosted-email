/**
 * SignUpForm per-field validation tests
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

// Hoisted mocks — must use vi.hoisted so they're initialized before vi.mock factories run
const { mockUseSession, mockPush, mockReplace } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mockUseSession,
    signUp: {
      email: vi.fn(),
    },
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: (_key: string) => null,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), identify: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@wraps/ui/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock("@wraps/ui/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/loader", () => ({
  default: () => <div>Loading...</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
    loading,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: string;
    loading?: boolean;
    [key: string]: unknown;
  }) => (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      type={(type as any) || "button"}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  toSafeRedirectPath: (_path: unknown, fallback: string) => fallback,
}));

import SignUpForm from "../sign-up-form";

describe("SignUpForm - per-field validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ isPending: false, data: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows password error on blur when too short", async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "abc" } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 6 characters")
      ).toBeInTheDocument();
    });
  });

  it("clears password error when valid password entered and blurred", async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/password/i);

    // First trigger the error
    fireEvent.change(passwordInput, { target: { value: "abc" } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 6 characters")
      ).toBeInTheDocument();
    });

    // Now fix it
    fireEvent.change(passwordInput, { target: { value: "abcdef" } });
    fireEvent.blur(passwordInput);

    await waitFor(() => {
      expect(
        screen.queryByText("Password must be at least 6 characters")
      ).not.toBeInTheDocument();
    });
  });

  it("shows email error on blur when invalid email entered", async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);

    const emailInput = screen.getByPlaceholderText(/m@example\.com/i);
    fireEvent.change(emailInput, { target: { value: "notanemail" } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  it("renders the password error only once when both onBlur and onSubmit produce it", async () => {
    render(<SignUpForm onSwitchToSignIn={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "abc" } });
    fireEvent.blur(passwordInput);

    const submitButton = screen.getByRole("button", {
      name: /create account/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getAllByText("Password must be at least 6 characters")
      ).toHaveLength(1);
    });
  });
});
