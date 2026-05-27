import { Card, CardContent } from "@wraps/ui/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const comparisons = [
  {
    competitor: "Resend",
    href: "/compare/resend-vs-wraps",
    tagline: "Same DX, different economics",
  },
  {
    competitor: "Amazon SES",
    href: "/compare/amazon-ses-vs-wraps",
    tagline: "Same infrastructure, better DX",
  },
  {
    competitor: "SendGrid",
    href: "/compare/sendgrid-vs-wraps",
    tagline: "Escape the legacy tax",
  },
  {
    competitor: "Customer.io",
    href: "/compare/customer-io-vs-wraps",
    tagline: "Unlimited contacts, no surprise bills",
  },
  {
    competitor: "Postmark",
    href: "/compare/postmark-vs-wraps",
    tagline: "Beyond transactional sending",
  },
  {
    competitor: "Klaviyo",
    href: "/compare/klaviyo-vs-wraps",
    tagline: "10x cheaper at scale",
  },
  {
    competitor: "Mailgun",
    href: "/compare/mailgun-vs-wraps",
    tagline: "Your infra, AWS pricing, no suspensions",
  },
];

/**
 * Cross-links to other comparison pages, excluding the current one.
 */
export function AlsoCompare({ current }: { current: string }) {
  const others = comparisons.filter((c) => c.href !== current);

  return (
    <section className="mb-16">
      <h2 className="mb-4 font-semibold text-2xl">Also Compare</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {others.map((c) => (
          <Link href={c.href} key={c.href}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{c.competitor} vs Wraps</p>
                  <p className="text-muted-foreground text-sm">{c.tagline}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
