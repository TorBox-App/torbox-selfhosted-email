import { passkeyClient } from "@better-auth/passkey/client";
import { stripeClient } from "@better-auth/stripe/client";
import {
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    lastLoginMethodClient(),
    passkeyClient(),
    twoFactorClient(),
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization: useOrganization,
} = authClient;
