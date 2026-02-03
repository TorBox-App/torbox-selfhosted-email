"use client";

import {
  FileText,
  Headphones,
  Mail,
  MessageSquare,
  Package,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const useCases = [
  {
    id: "support",
    icon: Headphones,
    title: "Support Inbox",
    description:
      "Auto-create tickets from customer emails. Route by subject, extract order IDs, and assign to teams.",
    code: `// EventBridge handler
const ticket = await linear.createIssue({
  title: email.subject,
  description: email.text,
  teamId: routeToTeam(email.from),
});`,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: "orders",
    icon: Package,
    title: "Order Processing",
    description:
      "Parse order confirmations, extract tracking numbers, and update your database automatically.",
    code: `// Parse order email
const tracking = extractTracking(email.html);
await db.orders.update({
  where: { email: email.from },
  data: { trackingNumber: tracking },
});`,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: "tickets",
    icon: FileText,
    title: "Email-to-Ticket",
    description:
      "Integrate with Jira, Linear, GitHub Issues, or any ticketing system via webhooks.",
    code: `// Create GitHub issue
await octokit.issues.create({
  owner: 'your-org',
  repo: 'support',
  title: email.subject,
  body: email.html,
});`,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: "autorespond",
    icon: Mail,
    title: "Auto-Responders",
    description:
      "Send acknowledgments, out-of-office replies, or follow-up sequences automatically.",
    code: `// Auto-acknowledge
await email.inbox.reply(emailId, {
  from: 'support@yourapp.com',
  html: \`Thanks for reaching out!
We'll respond within 24h.\`,
});`,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    id: "leads",
    icon: Users,
    title: "Lead Capture",
    description:
      "Extract contact information from inquiries and sync to your CRM or marketing automation.",
    code: `// Sync to CRM
await hubspot.contacts.create({
  email: email.from.address,
  firstname: email.from.name,
  source: 'inbound_email',
});`,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
  {
    id: "documents",
    icon: MessageSquare,
    title: "Document Processing",
    description:
      "Extract attachments, process PDFs, and trigger document workflows with S3 events.",
    code: `// Process attachments
for (const att of email.attachments) {
  const file = await email.inbox
    .getAttachment(emailId, att.id);
  await processDocument(file);
}`,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
];

export function UseCasesSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Update active index based on scroll position
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const handleScroll = () => {
      const scrollLeft = scrollContainer.scrollLeft;
      const cardWidth = scrollContainer.offsetWidth * 0.7; // Approximate card width
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(index, useCases.length - 1));
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToIndex = (index: number) => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const cards = scrollContainer.querySelectorAll("[data-card]");
    const card = cards[index] as HTMLElement;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  };

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-8 text-center">
          <p className="text-lg text-muted-foreground">
            Endless possibilities.{" "}
            <span className="text-foreground">
              Build any email-driven workflow.
            </span>
          </p>
        </div>
      </div>

      {/* Horizontal scroll container */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
        ref={scrollRef}
      >
        {useCases.map((useCase, index) => {
          const Icon = useCase.icon;
          return (
            <div
              className={cn(
                "w-[85vw] max-w-md shrink-0 snap-center rounded-2xl border-2 bg-background transition-all duration-300 sm:w-[70vw] lg:w-[400px]",
                useCase.borderColor,
                activeIndex === index && "shadow-lg"
              )}
              data-card
              key={useCase.id}
            >
              {/* Card header */}
              <div className={cn("border-b p-6", useCase.bgColor)}>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg",
                      useCase.bgColor
                    )}
                  >
                    <Icon className={cn("size-5", useCase.color)} />
                  </div>
                  <h3 className={cn("font-bold text-lg", useCase.color)}>
                    {useCase.title}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {useCase.description}
                </p>
              </div>

              {/* Code snippet */}
              <div className="overflow-hidden bg-[#0a0a0a] p-4">
                <pre className="overflow-x-auto text-xs">
                  <code className="text-green-400">{useCase.code}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="mt-6 flex justify-center gap-2">
        {useCases.map((useCase, index) => (
          <button
            aria-label={`Go to ${useCase.title}`}
            className={cn(
              "size-2 rounded-full transition-all",
              activeIndex === index
                ? "w-6 bg-cyan-500"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            key={useCase.id}
            onClick={() => scrollToIndex(index)}
            type="button"
          />
        ))}
      </div>
    </section>
  );
}
