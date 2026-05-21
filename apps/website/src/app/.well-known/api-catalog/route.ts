export const dynamic = "force-static";

export function GET() {
  const catalog = {
    linkset: [
      {
        anchor: "https://api.wraps.dev",
        "service-desc": [
          {
            href: "https://api.wraps.dev/swagger/json",
            type: "application/openapi+json",
          },
        ],
        "service-doc": [
          {
            href: "https://wraps.dev/docs",
          },
        ],
        status: [
          {
            href: "https://api.wraps.dev/health",
          },
        ],
      },
    ],
  };

  return Response.json(catalog, {
    headers: { "Content-Type": "application/linkset+json" },
  });
}
