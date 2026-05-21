import { Elysia, t } from "elysia";

export const wellKnownRoutes = new Elysia({ prefix: "/.well-known" }).get(
  "/oauth-authorization-server",
  () => ({
    issuer: "https://api.wraps.dev",
    device_authorization_endpoint: "https://app.wraps.dev/api/auth/device/code",
    token_endpoint: "https://app.wraps.dev/api/auth/device/token",
    grant_types_supported: [
      "urn:ietf:params:oauth:grant-type:device_code",
    ] as string[],
    token_endpoint_auth_methods_supported: ["none"] as string[],
    service_documentation: "https://wraps.dev/docs",
  }),
  {
    response: t.Object({
      issuer: t.String(),
      device_authorization_endpoint: t.String(),
      token_endpoint: t.String(),
      grant_types_supported: t.Array(t.String()),
      token_endpoint_auth_methods_supported: t.Array(t.String()),
      service_documentation: t.String(),
    }),
    detail: {
      tags: ["health"],
      summary: "OAuth 2.0 Authorization Server Metadata",
      description:
        "RFC 8414 OAuth 2.0 Authorization Server Metadata. Describes the Device Authorization Grant flow used by the Wraps CLI and AI agents.",
      security: [],
    },
  }
);
