import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

// Schema for updating account information
export const updateAccountSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

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
