"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@wraps/ui/components/ui/accordion";

/*
 * Written for the person who did not choose Wraps and now has to approve it.
 * Every answer leads with the unflattering half, because a champion who gets
 * blindsided in the meeting stops being a champion. If an answer here starts
 * sounding like marketing, it has stopped doing its job.
 */

const faqItems = [
  {
    id: "soc2",
    question: "Are you SOC 2 certified?",
    answer:
      "No. Not SOC 2, not HIPAA, and there is no BAA. If your review process requires a report, we will not pass it and you should stop here. What is true is narrower: the sending infrastructure runs inside your own AWS account, so your existing AWS posture covers that half. The gap is the Wraps platform itself — the dashboard, and the contacts and templates in our database.",
  },
  {
    id: "sandbox",
    question: "Will we get stuck in the SES sandbox?",
    answer:
      "Possibly, and nobody selling you software can promise otherwise. New AWS accounts can only send to verified addresses until AWS grants production access, that request is made from your account, and it is sometimes refused. Wraps detects sandbox at the end of a deploy, explains it, and points you at the request — it cannot approve it. If your team expects a refusal, a hosted API is the safer plan.",
  },
  {
    id: "data",
    question: "Where does our data actually live?",
    answer:
      "Split, and the split is wider than the marketing shorthand suggests, so here it is exactly. In your AWS account: SES does the sending, and the per-event delivery history lands in a DynamoDB table whose retention you set in your own deploy config, up to permanent. In the Wraps database (Neon, Postgres): contacts, templates, broadcasts, workflow state — and a row per message carrying the recipient address, subject, sender, any template variables, and the delivery and open timestamps, because that is what the dashboard list and the analytics read. If recipient addresses and subject lines in a vendor database are a problem for your review, that is the fact to take into the room. Anyone who tells you every byte stays in your account is describing a different product.",
  },
  {
    id: "access",
    question: "What access does Wraps have to our AWS account?",
    answer:
      "An IAM role your side creates and your side can delete, assumed with an external ID. No access keys are stored anywhere, so there is nothing to rotate and nothing to leak from us. Revoking it is a one-line change in your account that does not require telling us.",
  },
  {
    id: "support",
    question: "What is the support commitment?",
    answer:
      "Free is community support through GitHub and Discord, with no response-time commitment. Pro at $29/mo adds email support. Business at $199/mo adds a priority SLA. There is no phone number and no dedicated CSM at any tier — if your team needs one, say so now rather than after signing.",
  },
  {
    id: "stop-paying",
    question: "What happens if we stop paying, or you go away?",
    answer:
      "Sending keeps working. SES, the Lambdas, the EventBridge rules and the DynamoDB tables are in your account, namespaced wraps-email-*, and nothing about them depends on us being alive. What you lose is the platform: the dashboard, and the contacts, templates and workflows stored in our database. Export those before you leave. The repository is AGPL-3.0 with an enterprise kernel under a separate licence, and the SDKs are MIT, so the code outlives the company either way.",
  },
  {
    id: "wrapper",
    question: "Isn't this just a wrapper around SES? There are free ones.",
    answer:
      "The API part is, and yes there are free ones — OpenSend, useSend, MillionSend and others will give you a Resend-shaped API over your own SES for nothing. If your team already has production access and already handles bounces, that is a real option and we would rather you heard it here. What none of them build is the operational layer: reputation against the rates AWS enforces, an hourly sweep, blacklist and authentication audits, suppression wired in from the first send.",
  },
  {
    id: "migration",
    question: "How disruptive is the migration?",
    answer:
      "Deploy alongside whatever you run now — the install is namespaced and does not modify existing SES resources, so it can coexist with an account that is already sending. Move traffic gradually, keep the old provider up until you are satisfied, then decommission. Your sending domain does not change. The deploy itself takes minutes; the cutover takes as long as your sending code takes to repoint, and we would rather not put a number on that for you.",
  },
];

export function FaqSection() {
  return (
    <section className="mb-16">
      <h2 className="mb-2 font-heading font-semibold text-2xl tracking-tight">
        Questions your team will ask
      </h2>
      <p className="mb-6 max-w-2xl text-muted-foreground">
        Answered the way we would answer them in the meeting, which means some
        of these argue against us.
      </p>
      <Accordion collapsible type="single">
        {faqItems.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
