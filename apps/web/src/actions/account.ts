"use server";

import {
  createServerValidate,
  type ServerValidateError,
} from "@tanstack/react-form-nextjs";
import { auth } from "@wraps/auth";
import { db } from "@wraps/db";
import { user } from "@wraps/db/schema/auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  type ChangePasswordInput,
  changePasswordFormOpts,
  changePasswordSchema,
  joinFullName,
  type SecuritySettingsInput,
  securitySettingsFormOpts,
  securitySettingsSchema,
  type UpdateAccountInput,
  updateAccountFormOpts,
  updateAccountSchema,
} from "@/lib/forms/update-account";
import { createActionLogger } from "@/lib/logger";

// Server validator for account update
const serverValidateAccount = createServerValidate({
  ...updateAccountFormOpts,
  onServerValidate: ({ value }) => {
    // Parse with Zod
    const result = updateAccountSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message || "Validation failed";
    }
  },
});

// Server validator for password change
const serverValidatePassword = createServerValidate({
  ...changePasswordFormOpts,
  onServerValidate: ({ value }) => {
    // Parse with Zod
    const result = changePasswordSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message || "Validation failed";
    }
  },
});

export type UpdateAccountResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

export async function updateAccountAction(
  _prev: unknown,
  formData: FormData
): Promise<
  UpdateAccountResult | ServerValidateError<UpdateAccountInput, undefined>
> {
  try {
    // Validate form data
    const validatedData = await serverValidateAccount(formData);

    const headers = await import("next/headers").then((mod) => mod.headers());

    // Get current user session
    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to update your account",
      };
    }

    // Update the name through better-auth rather than writing to the user table
    // directly: it refreshes the cached session cookie (5min TTL, see
    // packages/auth session.cookieCache) so the change is visible immediately,
    // and it maintains updatedAt.
    const name = joinFullName(validatedData.firstName, validatedData.lastName);
    if (name !== session.user.name) {
      await auth.api.updateUser({ body: { name }, headers });
    }

    // Email changes go through better-auth's verification flow — a direct DB
    // write would move the address without proving the user owns it and would
    // leave emailVerified stale.
    const newEmail = validatedData.email.toLowerCase();
    const emailChanged = newEmail !== session.user.email.toLowerCase();
    if (emailChanged) {
      await auth.api.changeEmail({
        body: { newEmail, callbackURL: "/settings/account" },
        headers,
      });
    }

    // Revalidate paths
    revalidatePath("/settings/account");

    return {
      success: true,
      message: emailChanged
        ? `Profile updated. Check ${newEmail} for a link to confirm your new email address.`
        : "Account updated successfully",
    };
  } catch (error) {
    // If it's a ServerValidateError, re-throw it
    if (error && typeof error === "object" && "formState" in error) {
      throw error;
    }

    const log = createActionLogger("updateAccountAction", {});

    // better-auth rejections carry a client-safe message (e.g. "Email is the
    // same") — surface it instead of a generic failure.
    if (error instanceof APIError) {
      log.warn({ err: error }, "Account update rejected by better-auth");
      return {
        success: false,
        error: error.body?.message ?? "Could not update your account.",
      };
    }

    log.error({ err: error }, "Failed to update account");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export type ChangePasswordResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

// Server validator for security settings
const serverValidateSecuritySettings = createServerValidate({
  ...securitySettingsFormOpts,
  onServerValidate: ({ value }) => {
    const result = securitySettingsSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message || "Validation failed";
    }
  },
});

export type SecuritySettingsResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Get current security settings for the logged-in user
 */
export async function getSecuritySettingsAction(): Promise<{
  phoneNumber: string;
  loginAlertsEnabled: boolean;
} | null> {
  try {
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return null;
    }

    const userData = await db.query.user.findFirst({
      where: (users, { eq: eqOp }) => eqOp(users.id, session.user.id),
      columns: {
        phoneNumber: true,
        loginAlertsEnabled: true,
      },
    });

    return {
      phoneNumber: userData?.phoneNumber || "",
      loginAlertsEnabled: userData?.loginAlertsEnabled ?? false,
    };
  } catch (error) {
    const log = createActionLogger("getSecuritySettingsAction", {});
    log.error({ err: error }, "Failed to get security settings");
    return null;
  }
}

/**
 * Update security settings (phone number and login alerts)
 */
export async function updateSecuritySettingsAction(
  _prev: unknown,
  formData: FormData
): Promise<
  SecuritySettingsResult | ServerValidateError<SecuritySettingsInput, undefined>
> {
  try {
    // Validate form data
    const validatedData = await serverValidateSecuritySettings(formData);

    // Get current user session
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to update security settings",
      };
    }

    // Update user in database
    await db
      .update(user)
      .set({
        phoneNumber: validatedData.phoneNumber || null,
        loginAlertsEnabled: validatedData.loginAlertsEnabled,
      })
      .where(eq(user.id, session.user.id));

    // Revalidate paths
    revalidatePath("/settings/account");

    return {
      success: true,
      message: validatedData.loginAlertsEnabled
        ? "Security settings updated. You'll receive SMS alerts for new logins."
        : "Security settings updated.",
    };
  } catch (error) {
    // If it's a ServerValidateError, re-throw it
    if (error && typeof error === "object" && "formState" in error) {
      throw error;
    }

    const log = createActionLogger("updateSecuritySettingsAction", {});
    log.error({ err: error }, "Failed to update security settings");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData
): Promise<
  ChangePasswordResult | ServerValidateError<ChangePasswordInput, undefined>
> {
  try {
    // Validate form data
    const validatedData = await serverValidatePassword(formData);

    // Get current user session
    const session = await auth.api.getSession({
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to change your password",
      };
    }

    // Use better-auth to change password
    // Note: better-auth handles password verification and hashing
    const result = await auth.api.changePassword({
      body: {
        currentPassword: validatedData.currentPassword,
        newPassword: validatedData.newPassword,
      },
      headers: await import("next/headers").then((mod) => mod.headers()),
    });

    if (!result) {
      return {
        success: false,
        error: "Failed to change password. Please check your current password.",
      };
    }

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    // If it's a ServerValidateError, re-throw it
    if (error && typeof error === "object" && "formState" in error) {
      throw error;
    }

    const log = createActionLogger("changePasswordAction", {});
    log.error({ err: error }, "Failed to change password");
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
