const packages = [
  {
    name: "@wraps.dev/email",
    description: "Send email through SES",
  },
  {
    name: "@wraps.dev/sms",
    description: "Send SMS through AWS",
  },
  {
    name: "@wraps.dev/client",
    description: "Platform API, workflows, events",
  },
];

export function SdkInstallSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {packages.map((pkg) => (
            <div
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-orange-500/40"
              key={pkg.name}
            >
              <code className="font-mono text-foreground text-sm">
                {pkg.name}
              </code>
              <p className="mt-1 text-muted-foreground text-xs">
                {pkg.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
