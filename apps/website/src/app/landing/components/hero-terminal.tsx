"use client";

import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/shadcn-io/terminal";

export function HeroTerminal() {
  return (
    <Terminal className="max-h-[340px]">
      <TypingAnimation delay={200} duration={40}>
        $ npx @wraps.dev/cli email init
      </TypingAnimation>

      <AnimatedSpan className="text-muted-foreground" delay={2000}>
        Deploying to us-east-1...
      </AnimatedSpan>

      <AnimatedSpan className="text-green-500" delay={3000}>
        ✓ SES identity verified (acme.com)
      </AnimatedSpan>

      <AnimatedSpan className="text-green-500" delay={3600}>
        ✓ DKIM, SPF, DMARC configured
      </AnimatedSpan>

      <AnimatedSpan className="text-green-500" delay={4200}>
        ✓ Event tracking pipeline deployed
      </AnimatedSpan>

      <AnimatedSpan className="text-green-500" delay={4800}>
        ✓ Analytics tables created
      </AnimatedSpan>

      <AnimatedSpan className="text-green-500" delay={5400}>
        ✓ Bounce &amp; complaint handlers active
      </AnimatedSpan>

      <AnimatedSpan delay={6200}>
        <span className="text-foreground">
          Infrastructure deployed in{" "}
          <strong className="text-orange-500">38s</strong>
        </span>
      </AnimatedSpan>

      <AnimatedSpan className="text-muted-foreground" delay={7000}>
        Ready to send. Run: wraps email status
      </AnimatedSpan>
    </Terminal>
  );
}
