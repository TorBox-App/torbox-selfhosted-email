import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

// Schema for updating account information
export const updateAccountSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  // Optional: accounts created with a single-word name have no last name, and
  // requiring one here would lock them out of saving anything at all.
  lastName: z.string().trim(),
  email: z.string().trim().email("Invalid email address"),
});

/**
 * Split a stored `name` into first/last on the FIRST space only.
 *
 * `String.split(" ", 2)` drops everything after the second token, so
 * "Mary Jane Watson" round-tripped through the form as "Mary Jane" — saving
 * the page without editing anything destroyed part of the name.
 */
export function splitFullName(name: string): {
  firstName: string;
  lastName: string;
} {
  const normalized = name.trim().replace(/\s+/g, " ");
  const boundary = normalized.indexOf(" ");

  if (boundary === -1) {
    return { firstName: normalized, lastName: "" };
  }

  return {
    firstName: normalized.slice(0, boundary),
    lastName: normalized.slice(boundary + 1),
  };
}

/** Inverse of `splitFullName` — safe when either half is empty. */
export function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

// Form options for account update
export const updateAccountFormOpts = formOptions({
  defaultValues: {
    firstName: "",
    lastName: "",
    email: "",
  } satisfies UpdateAccountInput,
});

// Schema for changing password
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Form options for password change
export const changePasswordFormOpts = formOptions({
  defaultValues: {
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  } satisfies ChangePasswordInput,
});

// Schema for security settings (phone number and login alerts)
export const securitySettingsSchema = z.object({
  phoneNumber: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val === "" || z.e164().safeParse(val).success, {
      message: "Phone number must be in E.164 format (e.g., +14155551234)",
    }),
  // FormData sends booleans as strings, so we need to preprocess
  loginAlertsEnabled: z.preprocess(
    (val) => val === true || val === "true",
    z.boolean()
  ),
});

export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;

// Form options for security settings
export const securitySettingsFormOpts = formOptions({
  defaultValues: {
    phoneNumber: "",
    loginAlertsEnabled: false as boolean,
  } satisfies SecuritySettingsInput,
});
