export const dynamic = "force-static";

export function GET() {
  const metadata = {
    issuer: "https://api.wraps.dev",
    device_authorization_endpoint: "https://app.wraps.dev/api/auth/device/code",
    token_endpoint: "https://app.wraps.dev/api/auth/device/token",
    grant_types_supported: ["urn:ietf:params:oauth:grant-type:device_code"],
    token_endpoint_auth_methods_supported: ["none"],
    service_documentation: "https://wraps.dev/docs",
  };

  return Response.json(metadata);
}
