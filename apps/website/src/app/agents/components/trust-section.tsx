import { Card, CardContent } from "@wraps/ui/components/ui/card";
import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";

const differentiators = [
  {
    name: "Resend",
    tradeoff:
      "Hosted, not owned — your domain reputation lives in their shared pool.",
  },
  {
    name: "Cloudflare Email for Agents",
    tradeoff:
      "Runs in their network — you don't see the AWS bill or keep the infra after you churn.",
  },
  {
    name: "AgentMail",
    tradeoff:
      "Agent-specific, third-party sender — still their infra, still their reputation.",
  },
];

export function AgentsTrustSection() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl">
          <h2 className="mb-3 font-bold text-3xl tracking-tight sm:text-4xl">
            Transactional, not outreach.
          </h2>
          <p className="text-lg text-muted-foreground">
            Wraps is built for agents that send reports, replies, and
            notifications from your domain — the mail you'd send yourself if you
            were at the keyboard. It is not a tool for prospecting.
          </p>
        </div>

        <div className="mb-10 grid gap-3">
          <div className="flex items-start gap-3">
            <Mail className="mt-1 size-4 shrink-0 text-orange-500" />
            <p className="text-muted-foreground">
              Agents send to people who already expect mail from you —
              customers, teammates, subscribers.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-4 shrink-0 text-orange-500" />
            <p className="text-muted-foreground">
              DKIM, SPF, and DMARC sign every message from your domain. If an
              agent misbehaves, your DMARC report surfaces it before an ISP
              does.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 size-4 shrink-0 text-orange-500" />
            <p className="text-muted-foreground">
              Prospecting and unsolicited mail violate the AWS SES Acceptable
              Use Policy and will burn your sending domain. Don't ship that;
              neither will we.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold text-xl">
            Where Wraps fits in the agent-email landscape.
          </h3>
          <p className="mt-1 text-muted-foreground">
            The differentiator isn't volume or features. It's ownership.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {differentiators.map((item) => (
            <Card key={item.name}>
              <CardContent className="p-5">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  {item.tradeoff}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
