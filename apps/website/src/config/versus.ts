/**
 * Versus Pages Configuration
 * Single source of truth for the /versus/<a>-vs-<b> head-to-head pages.
 *
 * These pages are deliberately NOT about Wraps. Wraps is never a party to a
 * pair (the test enforces it), and the optional `thirdOption` note appears on
 * a minority of pages. A neutral referee page is the entire value of the
 * format: it is read by someone who has never heard of us and is choosing
 * between two other vendors. The moment every page ends in the same pitch, the
 * pages stop being worth reading and start being worth de-indexing.
 *
 * ## The duplicate-content rule this file inherits
 *
 * `config/alternatives.ts:9-26` documents a measured incident: rendering the
 * same shared vendor blocks across sibling pages pushed pairwise similarity to
 * 39%. The fix was terse shared blocks plus genuinely tailored per-page prose,
 * and `__tests__/alternatives.test.ts` fails if it climbs back.
 *
 * This corpus is larger and therefore at more risk, so its guard is tighter:
 * `__tests__/versus.test.ts` caps shared-per-page at 0.45 and mean pairwise at
 * 0.22. The rule that keeps it there is simple and non-negotiable:
 *
 *   **`dimensions`, `pickA`, `pickB` and `faqs` are written for THIS pair.**
 *   Not adapted from a sibling, not filled from a house template. If a pair
 *   cannot sustain ~1,800 words of substantive, specific prose, drop the pair.
 *   Padding is exactly what the shingle guard catches.
 *
 * Do not widen a threshold to make a batch pass. A failing batch means the
 * content is too templated, and the content is the thing to fix.
 *
 * ## Prices are never written here
 *
 * Every factual price comes from the vendor record in `config/alternatives.ts`
 * and is rendered from there, so a repricing is one edit in one place. The test
 * fails on any dollar-and-digit literal in this file or in a generated shim.
 *
 * ## Adding pages
 *
 * Append an entry here, then run `pnpm --filter wraps-website versus:generate`.
 * That writes the route shim, the llms.txt bullet and the search-intent entry.
 * Nothing else needs editing.
 */

import type { VendorId } from "./alternatives";

export type VersusDimension = {
  /** Section heading. Written for this pair — not a house template. */
  heading: string;
  /** How vendor `a` behaves on this dimension. 40-80 words. */
  a: string;
  /** Same for vendor `b`. */
  b: string;
};

export type VersusFaq = {
  question: string;
  answer: string;
};

/**
 * What the generated `search-intent.ts` entry says. Declared here rather than
 * derived so that adding a page is one edit in this file, and so that
 * `primaryQuery` is a decision someone made rather than a slug restated —
 * `search-intent-map.test.ts` fails on both a restatement and a collision.
 */
export type VersusSearchIntent = {
  /** Unique across the whole site map. Never just the slug with dashes removed. */
  primaryQuery: string;
  secondaryQueries: readonly string[];
  /** Why this page is winnable, in one line. Evidence, not hope. */
  rationale: string;
};

export type VersusPage = {
  /** `<a>-vs-<b>`, vendor ids in alphabetical order. Stable forever. */
  slug: string;
  a: VendorId;
  b: VendorId;
  title: string;
  description: string;
  /** Feeds the generated `search-intent.ts` entry for this route. */
  search: VersusSearchIntent;
  /** Unique, 60-100 words. Names the real tension, not a summary of both. */
  intro: string;
  /** The substance. Unique per pair, four or more. */
  dimensions: readonly VersusDimension[];
  /** "Choose A if..." — three to five, unique. */
  pickA: readonly string[];
  pickB: readonly string[];
  /**
   * OPTIONAL note that owning the AWS account is a third shape of answer.
   * Include ONLY where it genuinely answers the tension this page is about,
   * written for this pair. Fewer than 40% of pages carry one, enforced.
   */
  thirdOption?: string;
  /** Four to six, unique to this pair. */
  faqs: readonly VersusFaq[];
};

const POSTMARK_VS_RESEND: VersusPage = {
  slug: "postmark-vs-resend",
  a: "postmark",
  b: "resend",
  title: "Postmark vs Resend",
  description:
    "Postmark sells inbox placement and a decade of operating its own mail infrastructure. Resend sells the twenty minutes between an empty project and a sent email. Which of those you are short of decides this.",
  search: {
    primaryQuery: "postmark vs resend for transactional email",
    secondaryQueries: [
      "is resend or postmark better for deliverability",
      "resend 30 day log retention limit",
      "resend two requests per second rate limit",
      "react email with postmark",
    ],
    rationale:
      "The two facts that decide this in practice — Resend purging logs at thirty days on every non-Enterprise plan, and a two-per-second API ceiling that does not lift on any tier — appear in neither vendor's own comparison, because neither vendor is going to write them down.",
  },
  intro:
    "Both of these are transactional email APIs aimed at developers, both are genuinely good at it, and that is exactly why the choice is hard. The difference is not quality, it is what each company treats as its product. Postmark has spent a decade building a mail operation and sells inbox placement. Resend sells the twenty minutes between an empty project and a first sent email. If you already know which of those two you are short of, you already know the answer.",
  dimensions: [
    {
      heading: "What each company actually operates",
      a: "Postmark runs its own sending infrastructure and treats deliverability as the product rather than a feature of it. Transactional and broadcast traffic are split into separate message streams by the product itself, not left to you to remember, so a newsletter cannot quietly poison the reputation your password resets depend on. That separation is the most consequential design decision in the product.",
      b: "Resend is a developer experience layered over Amazon SES. That is not a criticism: the deliverability floor underneath you is AWS's, which is a high floor, and it frees Resend to spend its engineering on the parts you touch. It does mean the thing you are buying is the API, the dashboard and React Email, rather than a mail operation the company runs itself.",
    },
    {
      heading: "How the bill behaves as you grow",
      a: "Postmark bills a monthly plan with a fixed allowance of emails included and a per-thousand rate beyond it. Its tiers differ by capability rather than by volume, so moving up does not buy headroom, it buys dedicated IPs and retention. The curve is smooth and easy to forecast, and it is the steeper of the two once you pass a few hundred thousand messages a month.",
      b: "Resend splits into two ladders, Pro and Scale, and identical volume costs materially different amounts depending which one you sit on. Marketing contacts are a separate line from sending, so a list that grows raises the invoice in a month you sent nothing to it. Overage now bills automatically, the hard caps that used to stop it having been removed in December 2025.",
    },
    {
      heading: "The ceiling you hit first",
      a: "With Postmark it is almost never throughput. It is the dedicated IP threshold: isolation is gated behind the higher plans and carries a monthly volume minimum, so a small team with a reputation problem has nothing to buy its way out with. The second ceiling is scope. If what you actually needed was a campaign builder, Postmark does not have one and is not building one.",
      b: "With Resend it is two requests per second, on every plan including the most expensive. That is ample for signup and password-reset traffic and useless for a batch job that wants to push ten thousand messages in a minute. You queue and drip instead, which is ordinary engineering, but it is work nobody budgets for and upgrading does not remove it.",
    },
    {
      heading: "What happens to your event history",
      a: "Postmark's activity view is the feature its customers cite second after deliverability: full message content, the delivery path and the bounce reason, searchable without exporting anything first. The window is finite, as everyone's is, but the tooling inside it is unusually good. Answering did you get my email takes one search rather than a log pipeline someone has to build.",
      b: "Resend purges logs at thirty days on every plan short of Enterprise. The scenario that breaks is concrete rather than academic: a customer disputes a notice you sent in March and you are looking in June. Nothing went wrong, the window simply closed. Streaming events into your own store from day one fixes it, and almost nobody does that until after the first time it bites.",
    },
    {
      heading: "Templates, and who is allowed to edit them",
      a: "Postmark ships a template system with layouts, versioning inside the product and a small set of well-made starters. It is aimed at engineers and testable before you send. A non-engineer can change copy in it, but nobody would mistake it for a design tool, and the boundary is deliberate rather than an omission.",
      b: "Resend's answer is React Email, an open-source library it maintains. Templates are components, they live in your repository, and a change goes through code review like anything else. For an engineering team that is a better model than any hosted editor. For a team whose marketer wants to reword a headline without opening a pull request, it is a worse one.",
    },
    {
      heading: "Getting your traffic out again",
      a: "Postmark's API is its own, so leaving is a code change at every send site plus re-verifying your domains. The expensive parts are the ones nobody counts up front: the suppression list, the message streams you configured, and every webhook consumer written against their event shapes.",
      b: "Resend sits on SES, which tempts people into thinking the account travels with them. It does not, because the account is Resend's. Leaving still means re-verifying domains elsewhere and rebuilding reputation that accrued to their IPs. The SDK surface is small enough that the code change really is cheaper than most, but the infrastructure underneath is no more portable than anyone else's.",
    },
    {
      heading: "What it looks like when sending stops",
      a: "Postmark's support reputation is the quiet reason long-tenured customers stay put. When it does go wrong, what people report is a policy conversation about content, initiated by a human who explains the problem, rather than an unexplained stop discovered from a drop in signups.",
      b: "Resend's recurring complaint in public reviews is suspension during a traffic spike, and it lands on precisely the mail you least want to lose: signups, password resets, receipts. It is not universal and it is not malice, it is a young platform on shared reputation being conservative. It is still the risk you are accepting.",
    },
  ],
  pickA: [
    "Deliverability is the reason you are shopping rather than a tiebreaker at the end. Nothing else in this pair has a comparable record at inbox placement.",
    "You send both transactional and broadcast mail and want the reputation separation enforced by the product rather than remembered by your team.",
    "Support needs to answer whether a specific email arrived from a search box, today, without anyone building a log pipeline first.",
    "Your volume sits in the tens of thousands a month, where the included allowance is competitive and the curve has not steepened yet.",
  ],
  pickB: [
    "You write the templates yourself and want them to be React components in your repository, reviewed like the rest of your code.",
    "Time to first sent email is the metric that matters — a new project, a prototype, a launch next week.",
    "Traffic is steady request-response mail well under two per second and nothing in your system sends in batches.",
    "You already intend to stream delivery events into your own warehouse, so the thirty-day window is a non-issue rather than a trap.",
  ],
  thirdOption:
    "Both vendors keep your delivery history on their terms and inside their window, and neither can fix that for you, because the record lives in their system rather than yours. If losing the history is the part of this decision that actually worries you, the third shape is to send through SES inside your own AWS account, so events land in your storage under your retention policy. Wraps is one way to do that with a platform layer on top. It is a worse answer than either vendor here if what you want is to send an email this afternoon: it needs an AWS account and SES production access, an approval on AWS's schedule rather than ours.",
  faqs: [
    {
      question: "Is Resend just a wrapper around Amazon SES?",
      answer:
        "Substantially yes, and Resend has never hidden it. What you are buying is the layer on top: the SDKs, the dashboard, React Email, domain verification that finishes in minutes. The consequence worth understanding is not quality, because SES has a high deliverability floor. It is that the AWS account belongs to Resend, so reputation and event history accrue to them rather than to you.",
    },
    {
      question: "Which one actually has better deliverability?",
      answer:
        "Postmark, by reputation and by the length of its record, and the message-stream separation is a real mechanism rather than a slogan. That said, most teams' deliverability problems are self-inflicted: unverified domains, no DMARC policy, purchased lists, marketing sent from a transactional domain. Neither vendor repairs any of those, and both will suspend you for them.",
    },
    {
      question: "Can I use React Email with Postmark?",
      answer:
        "Yes. React Email renders components to HTML and is not coupled to Resend's API, so you can render to a string and hand that to Postmark, or to anything else that accepts HTML. The first-party path is more polished on Resend, but the templates themselves are portable — which is a decent argument for authoring them that way whichever vendor you pick.",
    },
    {
      question: "What happens to my logs if I switch?",
      answer:
        "You export whatever is still inside the retention window and you lose the rest. Neither vendor hands you a historical archive on the way out, and neither is unusual in that. If long-lived history matters to you, the time to start streaming events somewhere you control is while you are still a happy customer, not during a migration.",
    },
    {
      question: "Does Postmark do marketing email?",
      answer:
        "It has broadcast message streams, which is enough to send a newsletter to a list, and it stops well short of a campaign builder, segmentation or automation. If you need lifecycle marketing, Postmark expects you to bring a separate tool and keep the transactional stream clean. On its own terms that is the right answer, but it does mean two vendors.",
    },
    {
      question: "How do I test either of them without sending real email?",
      answer:
        "Both give you a sandbox or test mode that accepts the call and does not deliver, which is enough to prove your integration compiles and your template renders. Neither tells you anything about inbox placement, because placement is a property of reputation and content rather than of the API call. If you want to know how a message will actually land, send it to seed addresses at the major mailbox providers and look, or use a dedicated placement testing service. Treat a green response from either sandbox as a syntax check, not an outcome.",
    },
  ],
};

const MAILGUN_VS_POSTMARK: VersusPage = {
  slug: "mailgun-vs-postmark",
  a: "mailgun",
  b: "postmark",
  title: "Mailgun vs Postmark",
  description:
    "One is a broad sending platform with routing, validation and log search. The other is a narrow deliverability specialist that refuses to grow features. Breadth against focus, and what each choice costs you.",
  search: {
    primaryQuery: "mailgun vs postmark deliverability and pricing",
    secondaryQueries: [
      "did mailgun raise its prices",
      "mailgun flex plan discontinued",
      "postmark message streams explained",
      "which email api has better inbound routing",
    ],
    rationale:
      "Almost every comparison of these two still quotes Mailgun's pre-December-2025 pay-as-you-go rate, which closed to new signups and then doubled. A page that prices what you can actually buy today is correcting a specific, checkable error the rest of the results are repeating.",
  },
  intro:
    "This is breadth against focus. Mailgun wants to be the whole email surface of your application: outbound, inbound routing, address validation, searchable logs, all on one contract. Postmark wants to put transactional mail in the inbox and has spent years declining to become anything else. Teams cross-shop them because both answer a question phrased as we need a reliable email API, and then discover halfway through the trial that they were asking two different questions.",
  dimensions: [
    {
      heading: "How wide the product is",
      a: "Mailgun is an email platform in the fullest sense. Outbound sending is one surface among several: inbound routing with rule expressions, address validation, log retention and search, templates, and a reporting layer over the lot. The breadth is the pitch — one vendor, one invoice, one support relationship for everything email-shaped your application does.",
      b: "Postmark has a narrow perimeter and defends it. Transactional sending, message streams, activity search, templates, inbound parsing, webhooks. There is no validation service, no routing rule engine, no campaign tooling. When Postmark declines a feature request it is usually because the feature would compromise the deliverability posture the rest of the product is built around.",
    },
    {
      heading: "Inbound mail and routing",
      a: "Mailgun's routing engine is a first-class product with match expressions, priorities and multiple actions per rule, which is why it shows up in support-desk and ticketing architectures. If your application needs to receive mail, parse it, fan it out to more than one destination and do that conditionally, this is the more capable of the two by a wide margin.",
      b: "Postmark's inbound is a parsing endpoint rather than a routing engine. Mail arrives at an address, gets parsed into structured JSON and is posted to your webhook. That is enough for reply-by-email on a support thread and it is not enough for conditional fan-out. Postmark expects the routing logic to live in your code, which is a defensible position and also more code.",
    },
    {
      heading: "The December 2025 repricing, and who it hurt",
      a: "Mailgun's Flex plan closed to new signups in December 2025 and the legacy pay-as-you-go rate doubled. That is the single most important recent fact about Mailgun's pricing, because the low per-thousand rate people remember from years of blog posts is no longer available to a new account. The free tier that remains is a hard hundred a day, which is a demo, not a staging environment.",
      b: "Postmark repriced in early 2026 as well, and the practical consequence is the opposite one: long-standing accounts are not on the published numbers, so a recommendation from a colleague who has been a customer since 2021 is describing a contract you cannot buy. Check the current plan page rather than trusting a price you were told secondhand.",
    },
    {
      heading: "Dedicated IPs and when you can have one",
      a: "Mailgun includes a dedicated IP from its mid plans upward, with additional IPs charged monthly. That threshold is low enough that a mid-sized sender can get isolation without negotiating, which matters if you send for multiple brands or want to warm an IP on your own schedule rather than sharing a pool's history.",
      b: "Postmark gates dedicated IPs behind its upper plans and attaches a monthly volume minimum, on the reasonable grounds that a badly warmed dedicated IP below that volume performs worse than their shared pool. It is honest advice and it is also a wall: a sender below the minimum with a reputation problem has no isolation available at any price.",
    },
    {
      heading: "Address validation",
      a: "Mailgun sells list validation as part of the platform, which is an unusually direct answer to the most common cause of a bounce rate problem. Being able to screen an imported list before the first send, inside the same vendor that will suspend you for bouncing it, removes a whole category of self-inflicted incident.",
      b: "Postmark does not offer validation and its position is that you should not need it, because you should not be importing lists you did not collect. That posture is consistent with everything else about the product and it is unhelpful the day you inherit a list from an acquisition. You buy validation elsewhere or you clean it by hand.",
    },
    {
      heading: "Debugging a specific message",
      a: "Mailgun's logs are searchable and retained according to plan, and the search is built for volume — filter by event type, recipient, tag, time window. At high throughput that is the right shape of tool. It is also a log viewer rather than a support tool: you are reading events, not reading the email your customer read.",
      b: "Postmark's activity view shows the rendered message itself alongside the delivery path and the raw bounce text. For a support agent chasing one customer's missing receipt, that is a materially better experience than filtering an event log, and it is the difference people mean when they say Postmark feels more finished at small scale.",
    },
    {
      heading: "Reputation of the support relationship",
      a: "Mailgun is part of a larger communications group, and the pattern in its public reviews is the one that usually follows: capable platform, slower support, and account suspensions that arrive with less explanation than the sender thinks the situation warranted. Budget for that if your sending is spiky or your content is unusual.",
      b: "Postmark's support is the thing customers volunteer without being asked, and it is a real part of what the higher per-message price buys. The trade is that the same team will also tell you no, firmly, about content and list practices that another vendor would have let through until it became a deliverability problem.",
    },
    {
      heading: "Tagging, and finding a cohort of messages later",
      a: "Mailgun lets you tag outbound messages and then slice reporting by tag, which is how teams separate receipts from digests from notifications inside one account without spinning up separate domains. It is a small feature that quietly determines whether your analytics are usable at volume, and it is better developed here than on most of the field.",
      b: "Postmark's equivalent is the message stream plus a tag on the message, and streams are the stronger of the two concepts because they carry reputation separation rather than only reporting. The consequence is a nudge toward modelling your traffic types properly up front, which is more work on day one and much less work the first time one category of mail starts bouncing.",
    },
  ],
  pickA: [
    "Your application receives mail as well as sending it, and the receiving side needs conditional routing rather than one webhook.",
    "You are importing or inheriting lists and want validation from the same vendor that will judge your bounce rate.",
    "Volume is high enough that per-message price dominates the decision and log search at scale matters more than log presentation.",
    "You want a dedicated IP without negotiating a plan upgrade you do not otherwise need.",
  ],
  pickB: [
    "Transactional mail arriving in the inbox is the requirement, and you are willing to pay a higher unit price to stop thinking about it.",
    "Your support team debugs individual messages often enough that seeing the rendered email beats filtering an event stream.",
    "You send marketing as well, and you want the product to keep those streams apart rather than trusting a convention.",
    "Your volume is modest and the included allowance covers it, which is where Postmark's pricing is at its most competitive.",
  ],
  faqs: [
    {
      question: "Is Mailgun still the cheap option?",
      answer:
        "Not for a new account. The reputation for cheapness comes from the Flex pay-as-you-go plan, which closed to new signups in December 2025, and from a legacy rate that has since doubled. Compare the current plan pages rather than a blog post from 2023 — on the plans you can actually buy today the gap between these two is much narrower than the folklore suggests.",
    },
    {
      question: "Can I run both, transactional on one and bulk on the other?",
      answer:
        "Yes, and splitting by traffic type across two vendors is a reasonable architecture. Be deliberate about domains: use a subdomain per sender so reputation, DMARC alignment and DKIM keys stay separable. The cost is that you now have two suppression lists, two sets of webhooks and two dashboards, and nobody reconciles them until something has already gone wrong.",
    },
    {
      question: "Which one is better for inbound email parsing?",
      answer:
        "Mailgun, clearly, if you need routing decisions made before the mail reaches your code. Postmark parses inbound mail into structured JSON and posts it to a single webhook, which covers reply-by-email on a thread. Anything involving several destinations, conditional matching or priorities is a rules engine, and only one of these two has one.",
    },
    {
      question: "Does either of them suspend accounts without warning?",
      answer:
        "Both can, and both do, because shared sending reputation means one customer's bad list is everyone's problem. The difference reported in public reviews is tone and speed: Postmark tends to open a conversation, Mailgun tends to act first. Neither is safe from it, and the only real mitigation on either platform is not to give them a reason.",
    },
    {
      question: "What does migrating between them actually involve?",
      answer:
        "Re-verifying domains and rotating DKIM keys, rewriting the send calls, re-pointing webhooks at a different event shape, and importing your suppression list so you do not immediately re-mail addresses that already bounced. The last one is the step teams forget, and it is the one that starts the new account off with a bounce rate that looks like a bad sender.",
    },
    {
      question: "Do I need a dedicated IP at all?",
      answer:
        "Below a few hundred thousand messages a month, usually not, and taking one early makes things worse rather than better. A dedicated IP has no reputation of its own on day one, so you inherit nothing and have to warm it by ramping volume over weeks. A well-run shared pool will outperform a cold dedicated IP for months. The cases where you genuinely want one are consistent high volume, sending on behalf of several distinct brands, or a compliance requirement that names it. Otherwise the money is better spent on list hygiene.",
    },
  ],
};

const MAILGUN_VS_SENDGRID: VersusPage = {
  slug: "mailgun-vs-sendgrid",
  a: "mailgun",
  b: "sendgrid",
  title: "Mailgun vs SendGrid",
  description:
    "Two large, mature sending platforms, each owned by a bigger communications company. At volume the differences are procurement, marketing tooling and how each one handles an account it does not like.",
  search: {
    primaryQuery: "mailgun vs sendgrid for high volume sending",
    secondaryQueries: [
      "sendgrid free tier ended what replaced it",
      "sendgrid account suspended no warning",
      "is sendgrid marketing campaigns a separate plan",
      "dedicated ip mailgun or sendgrid",
    ],
    rationale:
      "Both vendors' free tiers are gone — SendGrid's ended in May 2025, Mailgun's is a hard hundred a day — and nearly every comparison still treats one of them as the free option. The suspension pattern that dominates both vendors' public reviews is likewise absent from every vendor-written page.",
  },
  intro:
    "Nobody picks between these two for the developer experience. They are the incumbents: both a decade old, both absorbed into larger communications companies, both capable of five hundred thousand messages a month without anyone thinking about it. The decision is procurement-shaped. What does the contract cover, what is sold separately, what does the free tier look like now, and what happens on the morning your account is paused. That last one is the question that should decide it and usually gets asked last.",
  dimensions: [
    {
      heading: "Who owns them, and where you can see it",
      a: "Mailgun sits inside a larger communications group, and the visible effect is roadmap gravity: the sending product is stable and well-maintained rather than fast-moving, and it is increasingly presented alongside sibling messaging products. That is fine if you want a durable supplier. It is less good if you were hoping for the pace of a company whose only product this is.",
      b: "SendGrid is Twilio's email arm, and it is a genuinely different experience depending on which door you come through. A self-serve account gets a mature but crowded console; an account attached to a Twilio enterprise agreement gets account management, consolidated billing across SMS and voice, and procurement leverage. If your company already buys Twilio, that is most of the argument.",
    },
    {
      heading: "How the volume ladders are shaped",
      a: "Mailgun's ladder has a low entry plan and then two parallel families above it, where the higher one buys throughput, retention and support rather than a lower unit rate. The jump that catches people is the one in the middle, where a dedicated IP becomes included — that is the step where the effective per-message cost changes direction rather than continuing to fall.",
      b: "SendGrid's ladder is the more granular of the two, with distinct price points running well past half a million a month on the higher tier. The trap is different: Marketing Campaigns is priced as its own plan, not as an add-on to your sending plan, so the number you compared against Mailgun covers less surface than you assumed if you also send campaigns.",
    },
    {
      heading: "Marketing tooling: included, or a second purchase",
      a: "Mailgun keeps campaign tooling thin and sells the marketing product separately in the group's portfolio. In practice most Mailgun customers are sending application mail and running marketing somewhere else entirely, which is a cleaner architecture than it sounds, because the suppression and reputation concerns of the two traffic types genuinely differ.",
      b: "SendGrid's whole positioning is one console for both, and the console does exist — a designer, a contact database, automations. But it is a separate plan on a separate meter, so the consolidation is in the vendor relationship and the login, not in the invoice. Teams that chose SendGrid specifically to avoid a second marketing tool often end up with two SendGrid plans instead.",
    },
    {
      heading: "SMTP as a first-class path",
      a: "Mailgun's SMTP relay is solid and widely used for appliances, legacy applications and anything that already speaks SMTP and is never going to be rewritten. Credentials per domain, sensible defaults, and the same logs as the API path. If half your sending comes from software you did not write, this matters more than any SDK.",
      b: "SendGrid's SMTP relay is the most widely deployed of any vendor here, which is a real advantage for an unglamorous reason: whatever obscure appliance or CMS plugin you need to configure, someone has already written the instructions for pointing it at SendGrid. Compatibility that broad is not a feature anyone designs, it accumulates.",
    },
    {
      heading: "Dedicated IPs and warm-up",
      a: "Mailgun includes a dedicated IP from its mid plans and charges monthly for additional ones, so a multi-brand sender can isolate per brand without an enterprise conversation. Warm-up is your responsibility, with the usual consequence that a new IP pushed hard on day one performs worse than the shared pool would have.",
      b: "SendGrid reserves dedicated IPs for its upper tier and charges monthly for extras. It does provide automated warm-up, which is a meaningful difference for a team that has never warmed an IP before and does not want to learn on production traffic. The catch is the plan floor: you are buying the tier to get the IP, whether or not you needed the rest of the tier.",
    },
    {
      heading: "The free tier, and what replaced it",
      a: "Mailgun's free allowance is a hard hundred a day. That is a demo. It is not a staging environment, and a CI pipeline that sends verification mail on every pull request will exhaust it before lunch. Plan on paying for a non-production account or on a separate test-capture tool.",
      b: "SendGrid's free tier ended on 27 May 2025 and was replaced by a sixty-day trial capped at a hundred a day. The practical effect on an architecture decision is that neither vendor now offers a durable free environment, so any comparison that treats one of them as the free option is working from stale information.",
    },
    {
      heading: "Support latency, and the suspension pattern",
      a: "The complaint that recurs about Mailgun is response time on the lower plans, and account actions that arrive with less context than the sender expected. It is a shared-reputation platform operating at scale, and the enforcement is automated before it is human.",
      b: "The complaint that recurs about SendGrid is the same one, with more volume behind it: support latency and abrupt suspensions dominate its public reviews. If your traffic is spiky, or your content is in a category compliance teams look at twice, this is not a tiebreaker consideration. It is the consideration, and it applies to both.",
    },
  ],
  pickA: [
    "You want routing, validation and log search from the same vendor as your outbound, and you are not buying marketing tooling from them.",
    "You need dedicated IPs per brand without stepping up to an enterprise tier to get them.",
    "Your traffic is application mail with a long tail of SMTP senders, and per-message cost at volume is the number being optimised.",
    "You would rather have a stable, slow-moving supplier than a fast-moving one.",
    "Tag-based reporting across several traffic types inside one account is how your analytics are already structured.",
  ],
  pickB: [
    "Your company already has a Twilio relationship, and consolidating email into it buys real procurement leverage.",
    "You need an unusually wide compatibility surface — odd appliances, legacy CMS plugins, vendors who only know how to configure one relay.",
    "You want automated IP warm-up rather than running the schedule yourself.",
    "Marketing and transactional genuinely need to be in one console and you have budgeted for both plans, not one.",
  ],
  thirdOption:
    "Both of these send from their own infrastructure, on shared reputation they manage, and both are well represented in public reviews by people whose accounts stopped without much warning. That specific risk is structural rather than a service-quality problem: when the sending identity belongs to the vendor, an enforcement decision about someone else's traffic can reach yours. The other shape is to send through SES in an AWS account you own, where the identity, the reputation and the enforcement relationship are yours. Wraps builds that out and runs the platform layer on top. It is not a free lunch: SES production access is an AWS approval that takes anywhere from an hour to three days, and it is not ours to grant.",
  faqs: [
    {
      question: "Which is cheaper at half a million emails a month?",
      answer:
        "Close enough that it should not decide the question, and both have repriced recently enough that any figure you remember is suspect. Price the exact volume on both current plan pages, then add the things sold separately — marketing campaigns on one side, additional dedicated IPs on either — because that second list is usually where the real difference between the two quotes appears.",
    },
    {
      question: "Do either of them still have a usable free tier?",
      answer:
        "No. SendGrid's free tier ended in May 2025 and became a sixty-day trial at a hundred a day; Mailgun's free allowance is a hard hundred a day. Neither is a staging environment. If you need one, budget for a paid non-production account or route test traffic to a capture tool instead of a real sender.",
    },
    {
      question: "How likely is a suspension, really?",
      answer:
        "Unlikely if you send consistent volume to addresses that opted in, and materially more likely if your volume is spiky, your list was imported, or your content sits in a category that gets extra scrutiny. Both vendors enforce automatically before a human reads anything. The mitigation is the same on either: warm gradually, watch your complaint rate, and never send marketing from your transactional domain.",
    },
    {
      question: "Can I keep my dedicated IP when I move between them?",
      answer:
        "No. The IP belongs to the vendor, not to you, and so does the reputation it accumulated. A migration means warming a new address from scratch, which is weeks of gradually increasing volume, not a switch you flip. This is the single most underestimated cost of changing sending platforms at volume.",
    },
    {
      question: "Is one better for high-volume marketing sends?",
      answer:
        "SendGrid has the more complete campaign product, but it is a separate plan, so compare it against a dedicated marketing platform rather than against Mailgun. Mailgun's answer is that marketing belongs in a different tool, which is an architecturally cleaner position and one more vendor. Neither product is where a marketing team would choose to work if the choice were theirs.",
    },
    {
      question: "How long does an enterprise migration between these take?",
      answer:
        "Plan a quarter, not a sprint, and expect the calendar to be driven by reputation rather than by code. The engineering is a few weeks: rewrite the send path, re-point webhooks, re-verify domains, import suppressions. Then comes the part nobody can compress, which is ramping volume on new infrastructure while watching complaint and bounce rates at each step. Running both vendors in parallel and shifting a percentage of traffic weekly is the standard approach, and it means paying two bills for a while. Budget for that overlap explicitly or it will arrive as a surprise.",
    },
  ],
};

const BREVO_VS_SENDGRID: VersusPage = {
  slug: "brevo-vs-sendgrid",
  a: "brevo",
  b: "sendgrid",
  title: "Brevo vs SendGrid",
  description:
    "A European all-in-one priced on sends against the American enterprise standard that sells marketing as a separate plan. Data residency, invoice shape, and the tier where the feature you assumed actually lives.",
  search: {
    primaryQuery: "brevo vs sendgrid marketing and transactional",
    secondaryQueries: [
      "eu based alternative to sendgrid",
      "does brevo put its logo on my emails",
      "brevo automation which plan",
      "gdpr compliant transactional email provider",
    ],
    rationale:
      "The decision is usually made by a European compliance review rather than by features, and the two facts that actually change the quote — Brevo branding your footer on lower plans, and SendGrid billing Marketing Campaigns as a second plan — are absent from the comparison tables that rank for this.",
  },
  intro:
    "These two get compared because they occupy the same slot on a shortlist — the platform that does marketing and transactional together — and almost nothing else about them matches. Brevo is European, priced on how much you send, and sells email, SMS and a light CRM on one bill. SendGrid is Twilio's, priced in tiers, and sells its marketing product as a second plan. The honest framing is not which is better but which continent your compliance review lives on and whether you want one invoice or two.",
  dimensions: [
    {
      heading: "Where the data sits, and who regulates it",
      a: "Brevo is a French company operating under GDPR as its home regime rather than as an export obligation, with EU data centres. For a European team, that removes a paperwork exercise: no transfer impact assessment, no argument with a DPO about standard contractual clauses, no explaining the arrangement to a customer's procurement questionnaire. That is frequently the whole reason Brevo is on the list.",
      b: "SendGrid is a US provider with the usual apparatus for transfers, which works and is well-trodden and is still a review your legal team has to complete. Enterprise agreements can specify more, but you are negotiating for it rather than getting it by default. If the deciding voice in this choice is a European DPO, this dimension has already decided it.",
    },
    {
      heading: "Priced on volume, priced on tier",
      a: "Brevo meters what you send rather than how many people you store, which is unusual among marketing platforms and is the single most consequential thing about it. A large, mostly dormant list costs nothing to keep. The cost arrives when you actually mail it, which is the month you can also attribute the revenue. Forecasting is easy: it tracks your campaign calendar.",
      b: "SendGrid prices in tiers with a volume allowance, and the marketing product has its own contact-based plan on top. That means your spend is a function of both what you send and how many contacts you keep, from two separate meters that do not talk to each other. It is predictable, but it is two forecasts rather than one.",
    },
    {
      heading: "One invoice or two",
      a: "Brevo's plan covers marketing and transactional together, and the transactional API is a genuine API rather than a token gesture — SMTP relay, a REST endpoint, templates, webhooks. For a small team, having a single supplier for lifecycle mail and password resets removes a whole class of integration work and a whole vendor relationship.",
      b: "SendGrid technically offers the same consolidation and charges for it twice. Marketing Campaigns is its own plan rather than an add-on, so the team that chose SendGrid to avoid buying a marketing tool frequently ends up buying two SendGrid plans. The consolidation you get is a single login and a single support contact, which is worth something, just not what people assume.",
    },
    {
      heading: "The tier where the features you assumed actually live",
      a: "On Brevo, the headline tier is not the one you want. Marketing automation, A/B testing and removing Brevo's own branding from the footer all sit a step up. Anyone pricing Brevo off its entry plan is pricing a product they will not be using by month two, and the step up is roughly a doubling at the same volume.",
      b: "On SendGrid, the same trap has a different shape: dedicated IPs and the more useful support tier sit on the upper plan, so a sender who needs isolation is buying a tier for one feature. The lesson is identical on both — find the tier that contains every feature on your actual requirement list, and compare those two numbers, not the headline ones.",
    },
    {
      heading: "Whose brand is on the email",
      a: "Brevo's lower plans put Brevo's own logo in the footer of your messages. It is a small thing that turns out to matter to exactly the customers who care most about brand, and removing it is a plan upgrade rather than a setting. Budget for the higher tier if you are sending anything customer-facing under your own name.",
      b: "SendGrid does not brand your outbound mail on any plan, which is a straightforward advantage and one of the few places where the American incumbent is the less commercially aggressive option. What it does instead is meter the marketing side by contacts, so the cost arrives later and from a different direction.",
    },
    {
      heading: "Deliverability posture",
      a: "Brevo sends from shared pools on its lower plans and its deliverability reports are mixed — good for most senders, poor for some, which is the signature of pool composition rather than of a technical defect. A dedicated IP is available further up the ladder, and it is worth getting sooner than you think if inbox placement is load-bearing for your business.",
      b: "SendGrid's shared pools are enormous and it has decades of relationships with the major mailbox providers, which cuts both ways: the infrastructure is excellent and the pool contains a great many other senders. Its own answer is that you should move to a dedicated IP, with automated warm-up, once volume justifies it, which is sound advice attached to a plan upgrade.",
    },
    {
      heading: "Channels beyond email",
      a: "Brevo bundles SMS, WhatsApp and a light CRM into the same account, which for a small team is genuinely useful: one contact record, one automation canvas, one bill. It is not a replacement for a real CRM at scale, and the light version starts to chafe roughly when your sales team grows past a handful of people.",
      b: "SendGrid's answer to other channels is Twilio, which is the most capable messaging infrastructure of anyone in this comparison and is also a separate product with its own integration work, its own console and its own bill. You get more power and none of the single-pane-of-glass convenience that makes Brevo attractive to a small team.",
    },
    {
      heading: "What the API feels like to build against",
      a: "Brevo's API is competent and unglamorous, with official libraries across the common languages and documentation that assumes you are integrating a marketing platform rather than writing a sending service. Error responses are workable, the templating is serviceable, and nothing about it is delightful. For most integrations that is fine, because you write it once.",
      b: "SendGrid's API is the more mature of the two and carries a decade of accumulated surface area, which cuts both ways: whatever you need is in there somewhere, and finding it means navigating versions and overlapping endpoints that exist for backward compatibility. The libraries are well maintained and the documentation is extensive rather than clear.",
    },
  ],
  pickA: [
    "You are a European team and keeping the data and the vendor inside the EU removes a compliance exercise rather than adding one.",
    "Your list is large and mostly dormant, so paying for sends rather than stored contacts is straightforwardly cheaper.",
    "You want marketing, transactional and SMS on one account and one invoice, and a light CRM is adequate.",
    "You are small enough that a single supplier relationship is worth more than best-of-breed in any one category.",
  ],
  pickB: [
    "You already buy Twilio, and adding email to that agreement gives you leverage and consolidated billing.",
    "You send high transactional volume where the tiered ladder prices better than a per-send meter.",
    "Your brand cannot carry a vendor logo in the footer and you do not want that to be a plan decision.",
    "You need the compatibility surface of the most widely deployed SMTP relay, because half your senders are software you did not write.",
    "Procurement prefers a supplier your security team has already reviewed, and Twilio is on that list.",
  ],
  faqs: [
    {
      question: "Is Brevo actually cheaper than SendGrid?",
      answer:
        "It depends entirely on the shape of your list. Brevo meters sends and SendGrid's marketing side meters contacts, so a large dormant list favours Brevo heavily and a small list mailed very frequently favours SendGrid. Price your real numbers on both current plan pages, and on Brevo make sure you are pricing the tier that contains automation rather than the entry tier.",
    },
    {
      question: "Does Brevo put its branding on my emails?",
      answer:
        "On the lower plans, yes — a Brevo logo in the footer. Removing it requires stepping up a tier. This catches people out because it is not usually listed as a feature difference in comparison tables, and it is the kind of thing a founder discovers when a customer asks about it rather than when reading the pricing page.",
    },
    {
      question: "Can I use Brevo just for transactional email?",
      answer:
        "Yes. The transactional API is real: SMTP relay, REST endpoint, templates, webhooks, and a separate sending stream from campaigns. It is a reasonable choice for a European team that wants one vendor for everything. It is not the choice you would make if transactional deliverability were the only thing you were optimising for — specialists exist for that.",
    },
    {
      question: "Which one is easier for a non-technical marketer to use?",
      answer:
        "Brevo, comfortably. The automation canvas and campaign editor are built for a marketer as the primary user, and the whole product assumes that person is the one logged in. SendGrid's marketing product is competent but the surrounding console is built for developers first, and it shows in the navigation the moment a marketer needs something outside the campaign flow.",
    },
    {
      question: "What about GDPR if I am a US company with EU customers?",
      answer:
        "You still have obligations, and using an EU-based processor simplifies some of them without removing any. Brevo's advantage here is practical rather than legal: fewer questions on procurement questionnaires, and a data processing agreement written from the European side of the problem. Talk to counsel rather than treating either vendor's marketing page as an answer.",
    },
    {
      question: "Should I split transactional and marketing across both?",
      answer:
        "It is a common arrangement and it works, provided you separate the sending domains. Use a subdomain for each traffic type so DKIM keys, DMARC alignment and reputation stay independent, and a marketing complaint rate cannot reach the domain your password resets go out on. The cost is two suppression lists that nobody reconciles, so decide up front which system is authoritative for an unsubscribe and make the other one follow it. Skipping that step is how a business ends up mailing someone who opted out months ago.",
    },
  ],
};

const BREVO_VS_KLAVIYO: VersusPage = {
  slug: "brevo-vs-klaviyo",
  a: "brevo",
  b: "klaviyo",
  title: "Brevo vs Klaviyo",
  description:
    "Klaviyo is built for ecommerce and bills every profile you store. Brevo is a generalist that bills what you send. The billing unit is not a detail here — it is the whole decision.",
  search: {
    primaryQuery: "brevo vs klaviyo for ecommerce email",
    secondaryQueries: [
      "does klaviyo charge for unsubscribed profiles",
      "klaviyo bill keeps going up",
      "cheaper klaviyo alternative for a big list",
      "klaviyo sending limit ten times profiles",
    ],
    rationale:
      "Klaviyo has billed all active profiles rather than only subscribers since February 2025 and auto-upgrades across bands without auto-downgrading. That ratchet is the single most common complaint from stores and it is the thing a send-metered competitor is genuinely an answer to.",
  },
  intro:
    "A store owner comparing these two is comparing a specialist against a generalist, but the thing that will actually determine the outcome is arithmetic. Klaviyo charges for the people in your database. Brevo charges for the messages you send them. Run the same store through both models and the answers can differ by an order of magnitude in either direction, depending on how big your list is and how often you mail it. Feature comparisons come second.",
  dimensions: [
    {
      heading: "The billing unit, and why it decides everything",
      a: "Brevo counts sends. Storing a hundred thousand lapsed customers is free; mailing them is what costs. For a store with a long tail of one-time buyers who will probably never return, this is enormously favourable, and it means list hygiene is an optional deliverability practice rather than a budget emergency.",
      b: "Klaviyo counts active profiles, and has billed all of them since February 2025 rather than only the subscribed ones. Every abandoned-cart visitor who gave you an email address is a line item forever. The upside is that unlimited sending to those profiles is included, so a store that mails its list several times a week gets very good value from the same arithmetic that punishes a dormant list.",
    },
    {
      heading: "Ecommerce integration depth",
      a: "Brevo integrates with the major storefronts and can trigger on orders and carts, and it is plainly an integration rather than a native understanding of a store. The objects are contacts and events with commerce fields attached. That is enough for abandoned cart and post-purchase flows and it is not enough to segment on lifetime value across product categories without building the segments yourself.",
      b: "Klaviyo's data model knows what a product, an order and a catalogue are, and the Shopify integration in particular is the deepest in the category. Predictive fields, product-block personalisation pulling live catalogue data, and segments expressed in commerce terms rather than as generic event filters. If you run a Shopify store, this is the gap that justifies the price.",
    },
    {
      heading: "Proving the channel made money",
      a: "Brevo reports opens, clicks and conversions where you have wired up tracking, which is standard email reporting and requires you to connect the revenue side yourself. It answers whether the campaign performed. It does not, without work, answer the question a store owner is actually asked, which is what email contributed to the quarter.",
      b: "Klaviyo's attribution is the product, not a report inside it. Revenue per recipient, per flow and per campaign, with an attribution window you control, presented as the default view. Whether you trust the number is a separate conversation — last-touch email attribution is generous to email — but having it in front of you changes how the channel gets managed and budgeted.",
    },
    {
      heading: "The ratchet nobody reads the terms on",
      a: "Brevo's meter resets with your sending. A quiet quarter is a cheap quarter, and there is no mechanism by which last month's activity raises next month's floor. Whatever else is true about the product, its bill goes down as easily as it goes up, which is rarer in this category than it should be.",
      b: "Klaviyo auto-upgrades your plan when profiles cross a threshold and never auto-downgrades when they fall back. Combined with billing all active profiles rather than only subscribers, the bill ratchets in one direction unless somebody actively prunes the database and then asks to be moved back down. Set a calendar reminder to review it, because nothing in the product will.",
    },
    {
      heading: "The sending cap inside an unlimited plan",
      a: "Brevo has no equivalent cap, because sends are the thing you are buying. Send a hundred thousand messages and you pay for a hundred thousand messages. The failure mode is a surprising invoice, not a stopped send, which is the better of the two failure modes on a launch day.",
      b: "Klaviyo's unlimited sending is capped at ten times your profile count, and sends halt past it. For normal campaign cadence that ceiling is invisible. For a store running a heavy promotional calendar on a small list — a flash sale sequence to twenty thousand people, several times in a month — it is reachable, and the way you find out is that the sending stops.",
    },
    {
      heading: "Building an automation",
      a: "Brevo's automation builder is capable and general-purpose: conditions, delays, branches, across email and SMS. It is aimed at a marketer rather than an engineer and it does not presume your business is a shop. Building a good abandoned-cart flow in it is an afternoon of work rather than clicking a template, because the template library is thinner.",
      b: "Klaviyo ships the flows a store actually needs already built — browse abandonment, cart recovery, post-purchase, winback — with benchmark timings baked in. For a small team with no email specialist, starting from a flow that already reflects what works across thousands of stores is worth a great deal more than the equivalent blank canvas.",
    },
    {
      heading: "Where each one stops being enough",
      a: "Brevo runs out when your segmentation ambitions outgrow generic event filters, or when the light CRM stops being adequate for a growing sales team. It is a good answer for a small business doing several things and a mediocre one for a business doing one thing extremely well.",
      b: "Klaviyo runs out when your business is not a store. Its whole vocabulary is commerce, so a SaaS product, a marketplace or a service business spends its time translating its own concepts into orders and catalogues. It also runs out on price, at exactly the moment a large list stops converting well enough to justify a per-profile bill.",
    },
    {
      heading: "Sign-up forms and how people get onto the list",
      a: "Brevo includes form and landing-page builders, which for a business without a marketing site team is a genuine saving: a signup form that writes straight into the contact database, with double opt-in handling that satisfies European consent expectations by default rather than as a configuration choice.",
      b: "Klaviyo's forms are unusually good and unusually aggressive — targeted popups, teasers, multi-step flows with a discount reveal, all tied to on-site behaviour and reporting on submitted-to-purchase rates. For a store this is a real conversion lever. For a business whose customers would find a popup insulting, it is a feature you turn off and stop paying attention to.",
    },
  ],
  pickA: [
    "Your list is large, lapsed and unlikely to be mailed often, so paying per send rather than per stored profile is obviously cheaper.",
    "You are not a store, or not only a store, and commerce-shaped data modelling would be a translation exercise.",
    "You need SMS and a light CRM on the same account, and the value is in having one supplier rather than the best one in each category.",
    "European data residency is a requirement rather than a preference.",
  ],
  pickB: [
    "You run a Shopify store and the integration depth translates directly into segments you could not otherwise build.",
    "Email attribution needs to be defensible in front of whoever approves your budget, as a default view rather than a project.",
    "You mail your list frequently and the unlimited-sending side of profile billing works in your favour.",
    "You would rather start from flows that already encode what works than build equivalents from a blank canvas.",
  ],
  faqs: [
    {
      question: "Which is cheaper for a store with fifty thousand contacts?",
      answer:
        "Entirely a function of how often you mail them. Take your real send volume for a typical month, price it on Brevo's published send bands, and price fifty thousand profiles on Klaviyo's profile bands. Also check how many of those fifty thousand are unsubscribed but still active profiles, because Klaviyo has billed those since February 2025 and most people's mental model of their list size is wrong.",
    },
    {
      question: "Does Klaviyo really charge for people who unsubscribed?",
      answer:
        "It bills active profiles, which is a broader category than subscribers. A profile that unsubscribed is still a profile you are storing and still counts. Suppressing is not the same as deleting. If your bill has drifted upward without your list growing in any way you recognise, this is very often why, and the fix is pruning the database rather than changing your sending.",
    },
    {
      question: "Can Brevo do abandoned cart flows?",
      answer:
        "Yes, through its storefront integrations and its automation builder, and the flow will work. What you do not get is Klaviyo's library of pre-built commerce flows with benchmark timings, or predictive fields like expected next order date. You are building the logic rather than adapting someone else's, which costs an afternoon and gives you something you understand completely.",
    },
    {
      question: "What is Klaviyo's sending cap and will I hit it?",
      answer:
        "Ten times your profile count per month, after which sends stop. Ordinary campaign cadence stays well under it. A promotional calendar with several multi-message sequences to a small list can reach it, and the discovery mechanism is unforgiving. Multiply your list size by ten and compare that to a heavy month before you assume unlimited means unlimited.",
    },
    {
      question: "Can I move from one to the other later?",
      answer:
        "Contacts and consent state export from both, which is the easy half. What does not transfer is the flows, the segment definitions, the templates and the historical engagement data your segments were built from — so a new platform starts without the behavioural history it needs to segment well. Plan several weeks, and keep the old account alive until the new flows have run a full cycle.",
    },
    {
      question: "Do I still need a separate transactional provider?",
      answer:
        "With Brevo, usually not: its transactional API is a real one and running order confirmations through the same account is reasonable. With Klaviyo it is more common to keep a separate provider, because Klaviyo's centre of gravity is campaigns and flows rather than low-latency single sends. Either way, think about domain separation before convenience. Marketing complaint rates and receipt deliverability should not share a reputation, and a subdomain per traffic type costs nothing to set up and is painful to retrofit.",
    },
  ],
};

const CUSTOMER_IO_VS_KLAVIYO: VersusPage = {
  slug: "customer-io-vs-klaviyo",
  a: "customer-io",
  b: "klaviyo",
  title: "Customer.io vs Klaviyo",
  description:
    "Both bill per profile and both automate lifecycle messaging. One was built for product teams reasoning about behaviour, the other for stores reasoning about revenue. The data model is the fork in the road.",
  search: {
    primaryQuery: "customer.io vs klaviyo for lifecycle messaging",
    secondaryQueries: [
      "klaviyo for saas instead of ecommerce",
      "customer.io profile based pricing explained",
      "lifecycle email tool that is not ecommerce first",
      "per profile billing marketing automation",
    ],
    rationale:
      "These two are usually compared on feature tables when the decision is actually made by data model — events you define against orders and catalogues you did not — and by a shared per-profile meter that neither vendor's page frames as the trade it is.",
  },
  intro:
    "Two platforms with almost identical pricing mechanics and completely different worldviews. Customer.io models a person as a stream of events your product emitted. Klaviyo models a person as a shopper with orders, a catalogue and a lifetime value. Both bill you per profile, so the cost curves look similar on a spreadsheet, and the experience of using them diverges within the first hour. Pick by data model, not by feature checklist, because the data model is what you will be fighting or leaning on for years.",
  dimensions: [
    {
      heading: "The customer each was designed around",
      a: "Customer.io was built for product and growth teams at software companies, and it assumes your interesting signals come from your own application: a feature used, a limit hit, an invitation left unaccepted. Nothing about it presumes a purchase. That generality is the reason it fits a SaaS product, a marketplace or a fintech, and the reason it gives you less for free than a vertical tool would.",
      b: "Klaviyo was built for ecommerce, and it shows in every default. The onboarding asks about your store. The reports lead with revenue. The segment builder speaks in orders and products. For a store that is a gift, because a large amount of domain knowledge is already encoded. For anything that is not a store, it is a vocabulary you spend your time translating into.",
    },
    {
      heading: "How a journey is authored",
      a: "Customer.io's workflow canvas is the most programmable in this comparison: branches, delays, attribute updates, webhooks out to your own services, and Liquid templating with the full profile and event payload available. An engineer can build things in it that no marketing tool is supposed to be able to do, which is both its appeal and the reason it needs someone technical to own it.",
      b: "Klaviyo's flow builder is aimed squarely at a marketer working without engineering help, and it is very good at that. Triggers, conditional splits, timing, and a large library of pre-built commerce flows. The ceiling is lower than Customer.io's and you hit it later than you expect, usually at the point you want a flow to call an external service and act on the reply.",
    },
    {
      heading: "What a profile is made of",
      a: "In Customer.io a profile is attributes plus an event history you defined. You decide what an event is, what it carries, and how long it matters. That freedom means the quality of your segmentation is exactly as good as the quality of your event instrumentation, so the real implementation cost of Customer.io is usually in your own codebase rather than in the tool.",
      b: "In Klaviyo a profile arrives pre-populated with commerce semantics from the storefront integration — orders, values, products, timestamps — without anyone writing tracking code. Predictive fields sit on top of that. You get sophisticated segmentation on day two instead of month two, at the cost of segmenting on their concepts rather than yours.",
    },
    {
      heading: "What the profile count actually costs",
      a: "Customer.io bills a plan floor that includes a block of profiles and then a per-profile rate beyond it, and it counts people whether or not you ever message them. A free tier with a large signup volume and low conversion is the pathological case: you pay for every account that was created, including the ones that never opened the product.",
      b: "Klaviyo bills active profiles in bands, has included unsubscribed profiles since February 2025, and auto-upgrades across band boundaries without ever auto-downgrading. Sending is unlimited within ten times your profile count. The structures rhyme, but Klaviyo's ratchets upward on its own and Customer.io's does not, which matters more over two years than either headline rate.",
    },
    {
      heading: "What counts as the channel working",
      a: "Customer.io reports on the messages and the journeys — delivery, engagement, conversion against goals you define. Tying that to revenue is your job, usually via your own analytics stack, and the reason it is your job is that Customer.io has no opinion about what your revenue event looks like. Teams with a warehouse find this natural. Teams without one find it thin.",
      b: "Klaviyo answers the revenue question by default, per flow and per campaign, with a configurable attribution window. It is the reason marketing leaders like it and the reason a sceptic should read it carefully, because last-touch email attribution flatters email. As a management tool it is excellent. As a measurement of incrementality it is not what it appears to be.",
    },
    {
      heading: "Channels other than email",
      a: "Customer.io handles push, in-app messages, SMS and webhooks as first-class parts of the same workflow, which for a product team is the important half: an in-app nudge and an email are the same campaign with different delivery. The webhook action in particular means a journey can drive your own systems, not just messaging.",
      b: "Klaviyo covers email, SMS and push with the same commerce framing throughout, and its SMS product is mature and well integrated with campaign attribution. What it does not do is treat your application as a destination. There is no equivalent of a journey step that calls your service and branches on the response.",
    },
    {
      heading: "The price floor, and who it excludes",
      a: "Customer.io's entry plan has a monthly floor that puts it out of reach of a pre-revenue side project, and its next tier is an order of magnitude above that. It is priced for a funded company with a growth function, and it does not pretend otherwise.",
      b: "Klaviyo starts far lower, at a band a small store can afford on day one, which is why it dominates the small-store market. The cost of that accessibility is the ratchet: the price you signed up at is not the price you will be paying in eighteen months, and the increases arrive automatically rather than as a renewal conversation.",
    },
  ],
  pickA: [
    "Your product emits the behaviour that matters, and a journey needs to branch on your own events rather than on orders.",
    "A journey needs to call your services mid-flow and act on the response, which is a capability only one of these two has.",
    "Engineering will own the messaging system, and you want a tool that rewards that rather than working around it.",
    "You are not a store, and translating your domain into carts and catalogues would be a permanent tax.",
  ],
  pickB: [
    "You run a store and want the commerce data model, predictive fields and pre-built flows without instrumenting anything.",
    "A marketer needs to ship campaigns without waiting on engineering, from day one rather than after an integration project.",
    "Revenue attribution per flow has to be the default report, because that is the number your budget is argued with.",
    "You are starting small and need a price band that a business with its first thousand customers can actually pay.",
  ],
  thirdOption:
    "The mechanic both of these share is that you pay for people you are storing rather than messages you are sending, and neither vendor will change that because it is the business model. If the thing driving this comparison is a bill that grows with a database you cannot prune — dormant signups, unsubscribed profiles, accounts that never activated — then swapping one profile meter for another is not a fix, it is a re-quote. The other shape is a platform whose fee does not move with contact count at all, sending through SES in your own AWS account. That is what Wraps does, and it is a poor substitute for either of these if what you need is Klaviyo's commerce modelling or Customer.io's workflow canvas, neither of which it has. It also needs an AWS account and SES production access, an approval AWS grants on its own schedule, so it is not a decision you can make on a Friday afternoon.",
  faqs: [
    {
      question: "Can Customer.io do ecommerce?",
      answer:
        "It can, if you send it the order events yourself. What you do not get is the storefront integration doing it for you, the catalogue-aware content blocks, or predictive fields like expected next order date. For a store, choosing Customer.io means rebuilding a meaningful amount of what Klaviyo gives you on day one, and the only good reason to do that is that your business is not only a store.",
    },
    {
      question: "Can Klaviyo do SaaS lifecycle email?",
      answer:
        "Yes, and plenty of SaaS companies run on it, particularly ones already using it for another business. The friction is constant rather than blocking: your events are second-class next to orders, the reporting leads with revenue you may not attribute that way, and segment building means expressing product concepts in commerce vocabulary. It works. It never stops feeling like a borrowed tool.",
    },
    {
      question: "Which one costs more at a hundred thousand profiles?",
      answer:
        "They land close enough that the deciding factors are structural rather than the headline rate. Ask two things instead: how many of those profiles will you actually message, and how many are unsubscribed or dormant. Then check the ratchet — Klaviyo auto-upgrades across bands and never auto-downgrades, so its two-year cost depends on whether anyone will be pruning the database.",
    },
    {
      question: "Do either of them replace a customer data platform?",
      answer:
        "Neither should be your system of record, though both are used that way by teams who did not decide to. Both hold a profile store good enough to be tempting and neither is built to be queried by other systems or to survive you changing messaging vendors. If the data matters beyond messaging, keep the authoritative copy in your own warehouse and treat either of these as a consumer of it.",
    },
    {
      question: "How hard is it to switch between them?",
      answer:
        "Harder than either vendor's import tool implies. Profiles and consent state move fine. Flows, segment definitions, templates and the behavioural history those segments depend on do not, so the new platform starts with no idea who is engaged. Expect to run both in parallel for a cycle, and expect your segments to be wrong until enough new history has accumulated.",
    },
    {
      question:
        "Which one is easier to hand to a marketer without engineering help?",
      answer:
        "Klaviyo, by a wide margin, and deliberately so. A marketer can build a flow, design a template, define a segment and read the revenue report without ever opening a ticket. Customer.io is usable by a marketer but not self-sufficient for one: the useful segments depend on events that only engineering can emit, and the most powerful parts of the workflow builder assume familiarity with templating and webhooks. That is not a flaw so much as a staffing requirement, and it is worth checking you can meet it before you sign.",
    },
  ],
};

const CUSTOMER_IO_VS_LOOPS: VersusPage = {
  slug: "customer-io-vs-loops",
  a: "customer-io",
  b: "loops",
  title: "Customer.io vs Loops",
  description:
    "A programmable behavioural messaging platform against an opinionated product built for small SaaS. The price floor filters most of the decision before the features get a vote.",
  search: {
    primaryQuery: "customer.io vs loops for saas lifecycle email",
    secondaryQueries: [
      "cheaper alternative to customer.io for a startup",
      "lifecycle and transactional email in one tool",
      "customer.io minimum monthly cost",
      "when do you outgrow loops",
    ],
    rationale:
      "Nearly every result for this pair compares features when the monthly floor decides it first, and neither vendor will say out loud that the deciding question is whether anyone on the team will actually own the messaging platform day to day.",
  },
  intro:
    "Two tools aimed at the same job — lifecycle email for a software product — from opposite ends of the market. Customer.io is a platform you configure, with a monthly floor that assumes a funded company and a person whose job this is. Loops is a product that has already made most of the decisions, aimed at a SaaS team that wants lifecycle and transactional mail working by Friday. For most teams the price floor answers this before any feature comparison starts, and that is not a criticism of either one.",
  dimensions: [
    {
      heading: "The floor filters the decision first",
      a: "Customer.io's entry plan carries a monthly minimum that is a real line item for a small company, and the tier above it is an order of magnitude higher again. It is priced for an organisation with a growth team, and the price is coherent with the product: you are buying a platform that expects someone to own it full time.",
      b: "Loops starts free at a small list and its paid bands begin at a number a bootstrapped SaaS pays without a conversation. That accessibility is not incidental to the design. The product is shaped around a team of a few people, at least one of whom writes code, and none of whom has lifecycle email as their entire job.",
    },
    {
      heading: "Transactional and lifecycle in one place",
      a: "Customer.io can send transactional mail, and plenty of teams route password resets through it. It is not what the product is optimised for, and the surrounding machinery — profiles, workflows, segments — is heavier than a receipt needs. Many Customer.io customers keep a separate transactional provider, which means two vendors, two suppression lists and two sets of templates.",
      b: "Loops treats transactional and lifecycle as one surface on purpose: the same template system, the same contact record, the same sending reputation. For a small SaaS that is a genuine reduction in moving parts, and it is the single most persuasive thing about the product. The catch is that it also couples them, so one vendor problem is now both kinds of mail.",
    },
    {
      heading: "How much a segment can express",
      a: "Customer.io's segmentation reaches as far as your instrumentation does. Arbitrary events with arbitrary payloads, relative-time conditions, computed attributes, and segments that update continuously as behaviour arrives. If you can describe a cohort in English, you can almost certainly express it, and doing so is a genuinely technical task.",
      b: "Loops keeps segmentation simple deliberately: contact properties, a smaller set of events, and straightforward filters. It covers the cohorts a small SaaS actually acts on — trialling, activated, churned, on a given plan — and it will not express something elaborate about behaviour over rolling windows. That is a real ceiling and also the reason it takes an afternoon rather than a quarter to get value from it.",
    },
    {
      heading: "Who operates it day to day",
      a: "Customer.io rewards an owner. Someone has to define the event taxonomy, keep the workflows tidy, and understand why a journey stopped firing. In a company with a growth engineer or a lifecycle marketer, that ownership produces things a simpler tool could not. In a company without one, the platform decays into a handful of half-finished workflows nobody dares to touch.",
      b: "Loops is designed for nobody owning it. A founder sets up the loops once, and the defaults are opinionated enough that the result is decent without curation. That is a real and underrated feature. It also caps the upside, because there is much less to tune even when tuning would pay.",
    },
    {
      heading: "What you pay for people you never message",
      a: "Customer.io bills per profile above its plan allowance, counting everyone you have sent it whether or not any message ever went out. For a product with a generous free tier and low conversion, that is a bill driven by signups rather than by customers, and pruning is a deliberate maintenance task nobody schedules.",
      b: "Loops bills on subscribed contacts with unlimited sending, which is the same trap wearing different clothes: a large dormant list stays on the invoice forever, and because sending is unlimited there is no volume dimension to optimise. The mitigation on both platforms is identical and equally unpopular, which is to delete people who are never coming back.",
    },
    {
      heading: "Writing the email",
      a: "Customer.io gives you Liquid templating with the full profile and event payload in scope, a code editor, and reusable layouts. It is powerful and it is a developer's tool: getting a beautiful responsive email out of it is work you do, not work the product does for you.",
      b: "Loops ships an editor whose output looks good without effort, which for a small team is worth more than templating power. The emails it produces have a recognisable house style, plain and typographic, and that suits a SaaS product announcement well. It suits a heavily designed brand campaign much less well, and there is no escape hatch into arbitrary HTML complexity.",
    },
    {
      heading: "What outgrowing each one looks like",
      a: "You outgrow Customer.io upward, into its higher tier or into a data-warehouse-native stack, and by then the messaging logic is spread across dozens of workflows that encode years of decisions nobody wrote down. The migration is expensive because the tool was load-bearing, which is the price of it having been useful.",
      b: "You outgrow Loops sideways, when a segment you need cannot be expressed or a flow needs to branch on something the product does not model. That arrives sooner than teams expect and it arrives gently: the tool keeps working for everything else while one important thing becomes impossible, and you start planning a move while still being reasonably happy.",
    },
    {
      heading: "Getting data in",
      a: "Customer.io accepts identifies and events over its API, through the common analytics pipelines, and from a data warehouse, and the warehouse path is the one mature teams end up on because it makes the warehouse authoritative rather than the messaging tool. Setting that up is a project with a data engineer in it, and it is the difference between segmentation you trust and segmentation you argue about.",
      b: "Loops takes contacts and events over a small API and through a handful of direct integrations, and the whole surface is designed to be wired up by one person in an afternoon. There is no warehouse sync to configure and no event taxonomy to design, which is exactly why it is fast to adopt and exactly why it cannot answer questions about behaviour it was never told about.",
    },
  ],
  pickA: [
    "Your lifecycle logic depends on behaviour only your application knows about, expressed over time windows rather than as simple flags.",
    "Someone will own this system — a growth engineer or a lifecycle marketer — and their time is better spent tuning than working around limits.",
    "You need journeys that call your own services and branch on the response, not just send messages.",
    "You are funded enough that the monthly floor is not the deciding factor.",
  ],
  pickB: [
    "You are a small SaaS team and want lifecycle plus transactional mail working this week, from one vendor and one template system.",
    "Nobody is going to own the messaging platform, so opinionated defaults are worth more than configurability.",
    "Your cohorts are the ordinary ones — trialling, activated, churned, on a plan — and you do not need to express anything exotic.",
    "The price floor matters, because the alternative is not a cheaper platform but no lifecycle email at all.",
  ],
  faqs: [
    {
      question: "Can Loops handle transactional email properly?",
      answer:
        "Yes, and for a small SaaS it is one of the better arguments for the product: password resets and lifecycle mail share a template system, a contact record and a sending reputation. What you should think about is the coupling. If Loops has a bad day, both your marketing and your password resets have a bad day, and some teams deliberately keep those on separate vendors for that reason alone.",
    },
    {
      question: "Is Customer.io overkill for a startup?",
      answer:
        "Usually, and the tell is not the feature list but whether anyone will own it. Customer.io produces excellent results for a team with a person whose job includes it and mediocre results for a team where it is everyone's fourth priority. If you cannot name the owner, the honest answer is that a simpler tool will outperform it in practice regardless of which is more capable on paper.",
    },
    {
      question: "How do the bills compare as a list grows?",
      answer:
        "Both meter people rather than messages, so both grow with your database. Customer.io counts profiles above a plan allowance; Loops counts subscribed contacts in bands with unlimited sending. Loops is far cheaper at small and medium lists, which is its whole market. The gap narrows as the list grows, and neither rewards you for keeping dormant contacts around.",
    },
    {
      question:
        "Can I use both, Loops for product mail and Customer.io for campaigns?",
      answer:
        "You can, and it is usually the wrong answer. Two tools sending to the same people means two suppression lists, two views of who is engaged, and two places a preference change has to land. If you are genuinely at the point of needing both, you have outgrown Loops and the cleaner move is to migrate rather than to straddle.",
    },
    {
      question: "What does moving from Loops to Customer.io involve?",
      answer:
        "Contacts and properties export cleanly. Everything else is a rebuild: Loops flows do not map onto Customer.io workflows, the templates are a different system, and the events Customer.io wants are ones your application is probably not emitting yet. Budget for instrumentation work in your own codebase, because that, rather than anything inside either tool, is the long pole.",
    },
    {
      question: "What should I instrument before evaluating either of them?",
      answer:
        "The handful of events that describe your activation path, and nothing else yet. Account created, the first action that signals genuine intent, the moment the product delivers its value, and whatever your churn signal looks like. Four well-defined events with stable names beat forty invented during a trial, because the ones invented during a trial encode whatever you happened to be measuring that month. Doing this first also makes the evaluation honest: with real events in place, both tools can be judged on whether they express the journeys you actually want.",
    },
  ],
};

const LOOPS_VS_RESEND: VersusPage = {
  slug: "loops-vs-resend",
  a: "loops",
  b: "resend",
  title: "Loops vs Resend",
  description:
    "Both are modern, developer-first, and pleasant to use. One is a finished product that bills per contact; the other is a primitive that bills per send. The billing units invert, and so does everything downstream.",
  search: {
    primaryQuery: "loops vs resend for product email",
    secondaryQueries: [
      "does resend do drip campaigns",
      "per contact or per send email pricing",
      "loops transactional email quality",
      "onboarding sequence without building it yourself",
    ],
    rationale:
      "These two look interchangeable from the outside and are not: Resend has no journeys at all, so a drip sequence is code you write. Stating that plainly, with the inverted billing units next to it, answers the question people are actually asking when they search the pair.",
  },
  intro:
    "These two are cross-shopped constantly because they look alike from the outside: modern, developer-first, good documentation, founded by people who clearly disliked the incumbents. Then you use them and they turn out to answer different questions. Loops is a finished product with opinions about how SaaS lifecycle email should work. Resend is a primitive you build on. Their billing units are literally inverted, which is the fastest way to see that they are not competitors so much as neighbours.",
  dimensions: [
    {
      heading: "A product versus a primitive",
      a: "Loops has already decided what your lifecycle email looks like. There is a contact record, there are loops that fire on events, there are campaigns, and there is a template editor whose output looks presentable without anyone designing anything. You adopt its model. In exchange you get something running end to end in an afternoon with no architecture decisions to make.",
      b: "Resend gives you an API, excellent SDKs, domain verification and a dashboard, and stops there by design. There is no opinion about lifecycle, because lifecycle is your application's business. That is the correct division of responsibility for a lot of teams and it means everything above the send call — scheduling, sequencing, suppression logic, who gets what and when — is code you write.",
    },
    {
      heading: "The billing unit inverts",
      a: "Loops bills subscribed contacts and includes unlimited sending. Send your list twice a day and the price does not move. Keep ten thousand people you will never mail and you pay for them every month. The model rewards frequent sending to a curated list and punishes a large dormant one, and there is no volume lever to pull.",
      b: "Resend bills sends, with marketing contacts as a separate line item on top. Storing a list you do not mail costs a little; mailing it a lot costs a lot. The model rewards low-volume transactional traffic and gets progressively less friendly as your sending grows, particularly once overage kicks in, which it now does automatically.",
    },
    {
      heading: "Who writes the email",
      a: "Loops expects a human to write in its editor, and the editor is good enough that a founder produces a decent-looking announcement without help. Templates live in the product rather than in your repository, which means a copy change does not require a deploy and also means your emails are not in version control.",
      b: "Resend expects a developer to write React Email components that live in your repository, reviewed in pull requests and deployed with your application. That is the better engineering story by a distance, and it makes a small copy change a deploy. Which of those two properties you care about more says most of what you need to know about this choice.",
    },
    {
      heading: "Automation and sequencing",
      a: "Loops has real lifecycle automation: event-triggered sequences with delays and conditions, aimed at onboarding, trial nudges and winback. It is modest compared to a dedicated lifecycle platform and it is enormously more than nothing, which is what the alternative on this page offers.",
      b: "Resend has broadcasts and audiences, and it does not have journeys. A drip sequence is something you build: a scheduled job, a state machine, and your own record of who has received which step. That is a few days of work the first time and a maintenance burden forever, and some teams would genuinely rather own it than configure someone else's canvas.",
    },
    {
      heading: "Throughput and the ceiling",
      a: "Loops sends campaigns on your behalf, so its throughput is its problem rather than yours: a blast to a large list is a queue it manages. The corollary is that you have less control over pacing, and for transactional mail you are relying on a product whose primary shape is campaign sending.",
      b: "Resend rate limits the API to two requests per second on every plan, Scale included. For request-response transactional traffic that is invisible. For anything that batches — an import, a nightly digest, a migration backfill — it is the constraint you design around, and it does not lift by paying more.",
    },
    {
      heading: "What the logs remember",
      a: "Loops keeps a per-contact activity view, which is the right shape for the question a small SaaS actually asks, which is what has this person been sent. It is a product view rather than a forensic log, and it is not the tool you would use to reconstruct an incident across a hundred thousand messages.",
      b: "Resend's logs are purged at thirty days on every plan short of Enterprise, and the dashboard is genuinely good inside that window. Past it there is nothing, so if you need a longer record you stream events to your own store from the beginning. The gap is small and it is the single most common complaint about the product.",
    },
    {
      heading: "The dormant list problem, from both sides",
      a: "On Loops, a list that stopped converting keeps billing. Because sending is unlimited there is no way to economise except deletion, and deleting contacts is the thing nobody wants to authorise. Teams end up paying a standing charge for an audience they stopped believing in, which is worth naming before you sign up rather than after.",
      b: "On Resend, the equivalent is subtler: marketing contacts bill separately from sends, so the same dormant list shows up as a line you might not have connected to your list size. The difference is that you can stop mailing it and the sending side of the bill genuinely falls, which makes the problem cheaper to ignore and therefore easier to leave unfixed.",
    },
    {
      heading: "Handling an unsubscribe",
      a: "Loops manages subscription state as part of being a product: a preference page exists, the unsubscribe link is handled, and a contact who opts out stops receiving campaigns without you writing anything. For a team with no compliance specialist, having that path correct by default removes a genuine legal risk rather than a chore.",
      b: "Resend gives you the primitives — an unsubscribe header, a broadcast audience with subscription state — and the responsibility. If you are sending marketing mail from your own sequencing code, honouring an opt-out across every message type is logic you own, and getting it subtly wrong is both an inbox-placement problem and a regulatory one.",
    },
  ],
  pickA: [
    "You want lifecycle email working this week without designing a sequencing system yourself.",
    "Non-engineers will write and send some of the mail, and waiting on a deploy for a copy change is not acceptable.",
    "You mail your list often, so unlimited sending on a per-contact price is straightforwardly good value.",
    "One tool for product announcements, onboarding sequences and transactional mail is worth more than best-in-class at any one of them.",
  ],
  pickB: [
    "Your email is transactional and your application already knows who to send what and when.",
    "You want templates as React components in your repository, versioned and reviewed like the rest of your code.",
    "You expect to build your own sequencing, and you would rather own that logic than express it in someone else's canvas.",
    "Your list is large and rarely mailed, so paying per send beats paying per stored contact.",
  ],
  faqs: [
    {
      question: "Can Resend do drip campaigns?",
      answer:
        "Not as a product feature. It has broadcasts and audiences, which cover sending a message to a list, but there are no journeys, delays or conditional branches. A drip sequence on Resend is a scheduled job in your application plus your own record of who is at which step. That is ordinary work, and it is work — usually a few days initially and a permanent maintenance obligation after.",
    },
    {
      question: "Does Loops handle transactional email as well as Resend?",
      answer:
        "It handles it, on the same templates and the same reputation as your marketing mail, which is a real convenience for a small team. Resend is the more focused transactional tool: better SDK ergonomics, idempotency behaviour you can reason about, and a dashboard built for debugging a single message. Whether that focus is worth a second vendor depends on how much transactional mail you send.",
    },
    {
      question: "Which is cheaper?",
      answer:
        "Depends entirely on the ratio between your list size and your send volume. A big list mailed rarely is cheaper on Resend; a small list mailed constantly is cheaper on Loops. Work out both numbers for your actual usage, and on Resend remember to add marketing contacts as a separate line rather than assuming they are included in the sending plan.",
    },
    {
      question: "Can I use React Email with Loops?",
      answer:
        "Not as the native authoring path. Loops expects its own editor, which is the point of the product: a non-engineer can change an email without a deploy. If having templates as components in your repository is a requirement rather than a preference, that requirement is pointing you at Resend, and it is a reasonable thing to let decide the question.",
    },
    {
      question:
        "Is Resend's two requests per second limit really on every plan?",
      answer:
        "Yes, including Scale. For request-response mail it never comes up. For anything batched you queue and drip, which is fine and is also an architectural constraint you should know about before you build. The relevant question is whether anything in your system ever wants to send thousands of messages in a short window, because if so the design has to account for it from the start.",
    },
    {
      question: "Could I run both at once?",
      answer:
        "Yes, and unlike most pairings on this site it is a defensible architecture, because they overlap so little: Resend for transactional mail triggered by your application, Loops for campaigns and onboarding sequences a human curates. Two things to get right. Send them from different subdomains so a marketing complaint rate cannot reach the reputation your password resets depend on, and pick one system as authoritative for subscription state so an unsubscribe in one is honoured by the other. Neither is hard, and neither happens by itself.",
    },
  ],
};

/**
 * Ordered roughly by search intent. The order is what the hub renders, so a
 * new pair goes where it belongs rather than on the end.
 */
export const VERSUS_PAGES: readonly VersusPage[] = [
  POSTMARK_VS_RESEND,
  LOOPS_VS_RESEND,
  MAILGUN_VS_SENDGRID,
  MAILGUN_VS_POSTMARK,
  CUSTOMER_IO_VS_KLAVIYO,
  BREVO_VS_KLAVIYO,
  BREVO_VS_SENDGRID,
  CUSTOMER_IO_VS_LOOPS,
];

/**
 * The hub's own search-intent entry. Lives here so the generator owns every
 * /versus row in `search-intent.ts` and adding a pair never means editing
 * two files.
 */
export const VERSUS_HUB_SEARCH_INTENT: VersusSearchIntent = {
  primaryQuery: "email vendor head to head comparisons",
  secondaryQueries: [
    "compare two email providers directly",
    "email api comparison not written by a vendor",
    "which email platform should i choose",
  ],
  rationale:
    "Every comparison hub in this space is a vendor listing itself against the field. This one indexes pairs it is not part of, which is both a different query shape and the only version of the page a reader has a reason to trust.",
};

/** Throws rather than returning undefined — a generated shim names a real slug. */
export function versusPageBySlug(slug: string): VersusPage {
  const page = VERSUS_PAGES.find((candidate) => candidate.slug === slug);
  if (!page) {
    throw new Error(`No versus page configured for slug "${slug}"`);
  }
  return page;
}

/** Route path for a page, the one place the /versus prefix is written. */
export function versusPath(page: VersusPage): string {
  return `/versus/${page.slug}`;
}
