import { stripe } from "@better-auth/stripe";
import { db } from "@wraps/db";
import * as schema from "@wraps/db/schema/auth";
import { getWrapsClient } from "@wraps/email";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import {
  haveIBeenPwned,
  lastLoginMethod,
  organization,
} from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { twoFactor } from "better-auth/plugins/two-factor";
import Stripe from "stripe";

// Only initialize Stripe client if the secret key is available
// This prevents build-time errors when env vars aren't set (e.g., during Next.js static generation)
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-10-29.clover",
      typescript: true,
    })
  : null;

export const auth = betterAuth<BetterAuthOptions>({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || ""],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disabled for smoother onboarding - enable in production
    sendResetPassword: async ({ user, url }) => {
      try {
        const wraps = await getWrapsClient();
        await wraps.sendTemplate({
          from: "Wraps <info@wraps.dev>",
          to: user.email,
          template: "Password-Reset",
          templateData: {
            privacyUrl: "https://wraps.dev/privacy",
            resetPasswordUrl: url,
          },
        });
      } catch (error) {
        console.error("Error sending password reset email:", error);
      }
    },
    onPasswordReset: async ({ user }) => {
      try {
        const wraps = await getWrapsClient();
        await wraps.sendTemplate({
          from: "Wraps <info@wraps.dev>",
          to: user.email,
          template: "Password-Changed",
          templateData: {
            name: user.name,
          },
        });
      } catch (error) {
        console.error("Error sending password changed email:", error);
      }
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Dynamic import to avoid bundling email package in edge/middleware
      const { sendVerificationEmail } = await import(
        "@wraps/email/emails/verification"
      );
      await sendVerificationEmail({
        to: user.email,
        url,
      });
    },
  },
  plugins: [
    nextCookies(),
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "This password has been exposed in a data breach. Please choose a more secure password.",
    }),
    lastLoginMethod({
      storeInDatabase: true,
    }),
    passkey({
      rpID: process.env.PASSKEY_RP_ID || "localhost",
      rpName: process.env.PASSKEY_RP_NAME || "Wraps",
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    }),
    twoFactor({
      issuer: "Wraps",
    }),
    organization(),
    // Only include Stripe plugin if the client is available (requires STRIPE_SECRET_KEY)
    ...(stripeClient
      ? [
          stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
            subscription: {
              enabled: true,
              authorizeReference: async ({ user, referenceId }) => {
                // Verify user is a member of the organization
                const membership = await db.query.member.findFirst({
                  where: (members, { and, eq }) =>
                    and(
                      eq(members.userId, user.id),
                      eq(members.organizationId, referenceId)
                    ),
                });

                if (!membership) {
                  throw new Error(
                    "Unauthorized: You are not a member of this organization"
                  );
                }

                // Optionally: restrict to owners/admins only
                if (
                  membership.role !== "owner" &&
                  membership.role !== "admin"
                ) {
                  throw new Error(
                    "Unauthorized: Only organization owners and admins can manage subscriptions"
                  );
                }

                return true;
              },
              plans: [
                {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PRICE_ID || "",
                  annualDiscountPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
                  limits: {
                    emails: 100_000, // 100k emails/month
                    awsAccounts: 3,
                    members: 10,
                  },
                  freeTrial: {
                    days: 14,
                  },
                },
                {
                  name: "enterprise",
                  priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
                  annualDiscountPriceId:
                    process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID,
                  limits: {
                    emails: -1, // Unlimited
                    awsAccounts: -1, // Unlimited
                    members: -1, // Unlimited
                  },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Send "password changed" email after successful password change from settings
      if (ctx.path === "/change-password") {
        const session = ctx.context.session;
        if (session?.user) {
          void (async () => {
            try {
              const wraps = await getWrapsClient();
              await wraps.sendTemplate({
                from: "info@wraps.dev",
                to: session.user.email,
                template: "Password-Changed",
                templateData: {
                  name: session.user.name,
                },
              });
            } catch (error) {
              console.error("Error sending password changed email:", error);
            }
          })();
        }
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Auto-set active organization to first org user is a member of
          const memberRecord = await db.query.member.findFirst({
            where: (members, { eq }) => eq(members.userId, session.userId),
            orderBy: (members, { asc }) => [asc(members.createdAt)],
          });

          if (memberRecord) {
            return {
              data: {
                ...session,
                activeOrganizationId: memberRecord.organizationId,
              },
            };
          }

          return { data: session };
        },
      },
    },
  },
});
