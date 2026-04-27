import { passkeyClient } from "@better-auth/passkey/client";
import { scimClient } from "@better-auth/scim/client";
import { ssoClient } from "@better-auth/sso/client";
import { stripeClient } from "@better-auth/stripe/client";
import {
  deviceAuthorizationClient,
  lastLoginMethodClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    deviceAuthorizationClient(),
    lastLoginMethodClient(),
    passkeyClient(),
    twoFactorClient(),
    organizationClient(),
    stripeClient({
      subscription: true,
    }),
    ssoClient({ domainVerification: { enabled: true } }),
    scimClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization: useOrganization,
} = authClient;
