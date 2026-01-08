import { passkey } from "@better-auth/passkey";
import { stripe } from "@better-auth/stripe";
import { db, eq } from "@wraps/db";
import * as schema from "@wraps/db/schema/auth";
import { getWrapsClient } from "@wraps/email";
import { createPlatformClient } from "@wraps.dev/client";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import {
  haveIBeenPwned,
  lastLoginMethod,
  organization,
  twoFactor,
} from "better-auth/plugins";
import Stripe from "stripe";

/**
 * Track user signup event for welcome automation.
 * Creates the contact if needed, then emits the user.signup event.
 * Non-blocking - failures are logged but don't affect auth flow.
 */
async function trackUserSignup(user: { email: string; name: string | null }) {
  try {
    const apiKey = process.env.WRAPS_API_KEY;
    if (!apiKey) {
      console.warn("WRAPS_API_KEY not configured, skipping signup event");
      return;
    }

    const client = createPlatformClient({ apiKey });
    const normalizedEmail = user.email.toLowerCase().trim();

    // Create/upsert the contact first (required for events)
    const { error: contactError } = await client.POST("/v1/contacts/", {
      body: {
        email: normalizedEmail,
        emailStatus: "active",
        properties: {
          name: user.name || undefined,
          signupAt: new Date().toISOString(),
          source: "web",
        },
      },
    });

    if (contactError) {
      // Contact might already exist (e.g., from waitlist), that's OK
      console.log("Contact create result:", contactError);
    }

    // Now emit the signup event
    const { error: eventError } = await client.POST("/v1/events/", {
      body: {
        name: "user.signup",
        contactEmail: normalizedEmail,
        properties: {
          name: user.name || undefined,
          signupAt: new Date().toISOString(),
          source: "web",
        },
      },
    });

    if (eventError) {
      console.error("Failed to track user.signup event:", eventError);
    }
  } catch (err) {
    console.error("Error tracking user.signup event:", err);
  }
}

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
    requireEmailVerification: false,
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
            name: user.name,
            email: user.email,
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
            email: user.email,
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
            onEvent: async (event) => {
              // Handle payment failed events
              if (event.type === "invoice.payment_failed") {
                try {
                  const invoice = event.data.object as Stripe.Invoice;
                  const customerId =
                    typeof invoice.customer === "string"
                      ? invoice.customer
                      : invoice.customer?.id;

                  if (!customerId) {
                    console.error(
                      "Payment failed webhook: No customer ID found"
                    );
                    return;
                  }

                  // Find subscription by Stripe customer ID
                  const sub = await db.query.subscription.findFirst({
                    where: eq(schema.subscription.stripeCustomerId, customerId),
                  });

                  if (!sub) {
                    console.error(
                      `Payment failed webhook: No subscription found for customer ${customerId}`
                    );
                    return;
                  }

                  // Get organization details
                  const org = await db.query.organization.findFirst({
                    where: eq(schema.organization.id, sub.referenceId),
                  });

                  if (!org) {
                    console.error(
                      `Payment failed webhook: No organization found for ${sub.referenceId}`
                    );
                    return;
                  }

                  // Get owner/admin members to notify
                  const members = await db.query.member.findMany({
                    where: eq(schema.member.organizationId, org.id),
                    with: {
                      user: true,
                    },
                  });

                  const adminsToNotify = members.filter(
                    (m) => m.role === "owner" || m.role === "admin"
                  );

                  if (adminsToNotify.length === 0) {
                    console.error(
                      `Payment failed webhook: No admins found for org ${org.id}`
                    );
                    return;
                  }

                  // Format amount
                  const amount = (invoice.amount_due / 100).toFixed(2);
                  const currency = invoice.currency.toUpperCase();

                  // Build billing URL
                  const appUrl =
                    process.env.NEXT_PUBLIC_APP_URL || "https://app.wraps.dev";
                  const billingUrl = `${appUrl}/${org.slug}/settings?tab=billing`;

                  // Send payment failed email to all admins
                  const wraps = await getWrapsClient();
                  for (const admin of adminsToNotify) {
                    if (!admin.user?.email) {
                      continue;
                    }

                    try {
                      await wraps.sendTemplate({
                        from: "Wraps <billing@wraps.dev>",
                        to: admin.user.email,
                        template: "Payment-Failure",
                        templateData: {
                          name: admin.user.name || "there",
                          amount: `${currency} ${amount}`,
                          organizationName: org.name,
                          billingUrl,
                          invoiceUrl: invoice.hosted_invoice_url || undefined,
                        },
                      });
                    } catch (emailError) {
                      console.error(
                        `Failed to send payment failed email to ${admin.user.email}:`,
                        emailError
                      );
                    }
                  }

                  console.log(
                    `Payment failed notification sent for org ${org.id} (${org.name})`
                  );
                } catch (error) {
                  console.error(
                    "Error handling payment failed webhook:",
                    error
                  );
                }
              }
            },
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
                  name: "starter",
                  priceId: process.env.STRIPE_STARTER_PRICE_ID,
                  annualDiscountPriceId:
                    process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
                  limits: {
                    emails: -1, // Unlimited (they pay AWS)
                    awsAccounts: 1,
                    aiMessages: 50,
                    bulkBatchSize: 100,
                    members: -1, // Unlimited (we don't gate on team size)
                  },
                },
                {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PRICE_ID,
                  annualDiscountPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
                  limits: {
                    emails: -1, // Unlimited (they pay AWS)
                    awsAccounts: 3,
                    aiMessages: 250,
                    bulkBatchSize: 1000,
                    members: -1, // Unlimited (we don't gate on team size)
                  },
                },
                {
                  name: "growth",
                  priceId: process.env.STRIPE_GROWTH_PRICE_ID,
                  annualDiscountPriceId:
                    process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
                  limits: {
                    emails: -1, // Unlimited
                    awsAccounts: -1, // Unlimited
                    aiMessages: 1000,
                    bulkBatchSize: 10_000,
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
      // Track user signup for welcome automation
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Fire and forget - don't block auth flow
          trackUserSignup({
            email: newSession.user.email,
            name: newSession.user.name,
          });
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
