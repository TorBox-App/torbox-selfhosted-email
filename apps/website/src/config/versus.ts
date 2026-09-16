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

const AMAZON_SES_VS_RESEND: VersusPage = {
  slug: "amazon-ses-vs-resend",
  a: "amazon-ses",
  b: "resend",
  title: "Amazon SES vs Resend",
  description:
    "Resend sends through Amazon SES, so this is not an argument about whose delivery network is better. It is an argument about who owns the account, the reputation and the event history — and what the layer on top is worth.",
  search: {
    primaryQuery: "should i use amazon ses directly or resend",
    secondaryQueries: [
      "resend is built on amazon ses",
      "what does resend add on top of ses",
      "moving from resend to raw ses",
      "ses sandbox versus a hosted email api",
    ],
    rationale:
      "Almost every result for this comparison is published by one of the two parties, and neither leads with the fact that decides it: they share a delivery substrate, so the real trade is ownership and tooling rather than inbox placement.",
  },
  intro:
    "These are not two competing delivery networks. Resend sends through Amazon SES, so the packets leaving for Gmail take substantially the same path either way, and most arguments about whose deliverability is better are arguing about the wrong thing. The real axis is ownership. On SES the account, the reputation, the quota and the event stream are yours, and so is every operational feature you decline to build. On Resend all of that belongs to Resend, and what you get in exchange is a product that works this afternoon.",
  dimensions: [
    {
      heading: "What signing up actually gets you",
      a: "An API endpoint, an IAM policy and a region. SES gives you a send call, verified identities, configuration sets and nothing else — no dashboard worth opening, no template editor a colleague could use, no stored record of what you sent. Every operational feature you expect from an email vendor is one you are going to build, and the building is not difficult so much as endless.",
      b: "A working integration and a dashboard in the time it takes DNS to propagate. The SDKs are small, domain verification is genuinely fast, React Email is first-party, and the log view answers did it send without you wiring anything up. That gap in time-to-first-email is the entire product and it is real value rather than marketing.",
    },
    {
      heading: "The approval that is not in your control",
      a: "Every new SES account starts in a sandbox that only delivers to addresses you have verified, and leaving it is an application a human at AWS reads. Most clear within a day or two; some come back asking you to explain your list practices and bounce handling in more detail, and some are refused. It is the most common reason an SES launch date slips, and no amount of engineering removes it.",
      b: "Resend has already been through that. Its sending account is out of the sandbox, warmed and operating, and you inherit the result the moment your domain verifies. This is the strongest practical argument for the layered model and it deserves to be stated plainly: you are renting a completed AWS approval along with the reputation that has accumulated behind it.",
    },
    {
      heading: "Whose reputation is on the line",
      a: "Yours, in isolation. SES puts you on shared addresses by default, but the sending identity, the complaint rate and the account-level reputation metrics belong to your account alone. A neighbour's bad month is not your problem, and your bad month is not absorbed by anybody else. Dedicated addresses are available and you warm them on a schedule you choose.",
      b: "Resend's, shared with every other customer on the same pools. Most of the time that helps, because their aggregate standing is better than a new sender's. The failure mode is the one that recurs in their public reviews: a sudden spike in your traffic looks like risk to a platform protecting everyone else's delivery, and the conservative response is to pause you first and talk afterwards.",
    },
    {
      heading: "Where your delivery events end up",
      a: "Wherever you point them. SES publishes deliveries, bounces, complaints, opens and clicks to SNS, EventBridge or a Firehose stream, and from there into your own database, warehouse or object storage, retained for exactly as long as you decide. There is no vendor window because there is no vendor. The cost is that none of it exists until somebody builds it, and a half-built version is worse than none at all.",
      b: "In Resend's log view, for thirty days, on every plan short of Enterprise. That is enough to debug a failing integration and not enough for a billing dispute, a compliance request or a year-over-year report. You can stream events into your own store from the first day and you should, but the default is a window that closes quietly and cannot be reopened.",
    },
    {
      heading: "Throughput, and the ceiling you meet first",
      a: "SES has a per-second rate and a daily quota, both of which start conservative and both of which AWS raises on request while your bounce and complaint rates stay healthy. The ceiling moves. A team with a large batch to push plans the quota increase a week ahead and then pushes it, without changing vendor or plan.",
      b: "Resend is capped at two requests per second on every tier including the most expensive, and that does not lift. For request-response mail it never matters. For anything batch-shaped it means a queue and a drip, which is ordinary engineering that nobody estimated, and which upgrading your plan will not save you from.",
    },
    {
      heading: "Templates and the person who edits them",
      a: "SES has a template API with simple substitution. It is serviceable for a handful of transactional messages and nobody enjoys it. In practice teams render HTML inside their own application and hand SES the finished string, which means the templates are code you already own — portable and reviewable, and entirely your problem to build a preview for.",
      b: "React Email, maintained by Resend and genuinely good, with components living in your repository and changes going through review like anything else. It is the stronger template story here by a distance, and it is also not a lock-in: the library renders to HTML that any provider accepts, so adopting it commits you to less than it appears to.",
    },
    {
      heading: "What shape the bill has",
      a: "Per message, no platform fee, no plan to outgrow, billed by AWS next to everything else you run there. The change worth knowing is that new accounts now land on a metered plan rather than the old flat rate, and plans are per-account and per-region, so a second region is a second decision. Free-tier assumptions from older blog posts are no longer correct.",
      b: "A plan ladder plus separately billed marketing contacts, so a list that grows raises the invoice in a month you sent nothing to it. Two ladders price the same volume differently depending which one you are sitting on, and overage bills automatically now that the hard caps have gone. More predictable than SES at small volume, steeper at large.",
    },
    {
      heading: "What leaving costs, in each direction",
      a: "Moving off SES is mostly a code change, because the verified domains and the accumulated reputation are attached to an account you keep. You can run a second provider from a separate subdomain and shift traffic across gradually, which is about the least dramatic migration available anywhere in this field.",
      b: "Moving off Resend means re-verifying domains elsewhere and starting reputation from nothing, because the warmed account was never yours. The code change is small since the SDK surface is deliberately minimal, but the infrastructure underneath does not travel with you, and the thirty-day window means you leave without your history.",
    },
  ],
  pickA: [
    "You are already on AWS, an engineer is willing to own the plumbing, and your volume is high enough that per-message price is worth engineering against.",
    "Delivery events have to land in storage you control on a retention policy you set, because of an audit trail, a dispute process or a regulator.",
    "You send in batches and need a rate limit that rises when you ask for it rather than a fixed ceiling that never moves.",
    "You want reputation attached to an account you keep, so that changing tooling later is a code change rather than a migration.",
  ],
  pickB: [
    "The deadline is this week, nobody wants to own a production-access application, and the volume is small enough that unit price is noise.",
    "Your templates are React components and you want the maintained first-party path rather than wiring a renderer yourself.",
    "Traffic is steady request-response mail comfortably under two calls a second, with nothing batch-shaped anywhere in the system.",
    "You would rather buy a dashboard, a verification flow and a log viewer than build three mediocre versions of them.",
  ],
  thirdOption:
    "This is the pair where the choice is most often presented as binary and most obviously is not. Resend exists because raw SES ships no product on top of itself, and SES is cheap because it is only a primitive — so the third shape is a platform layer over an SES account you own, which leaves the reputation, the quota and the event stream on your side of the line. Wraps is one way to do that. The honest cost is the same thing that pushes people to Resend to begin with: you need an AWS account and SES production access, an approval on AWS's schedule rather than ours, and our SDKs are TypeScript and Python only. Contacts, templates and workflow state live in our database — only sending and delivery events stay in your AWS — and we are not SOC 2 certified.",
  faqs: [
    {
      question: "Is Resend really just Amazon SES underneath?",
      answer:
        "Substantially, and Resend has never pretended otherwise. What differs is everything above the send call: SDKs, domain verification, the dashboard, React Email, webhooks with a sane shape. Because the substrate is shared, a claim that one of these two delivers to the inbox and the other does not is almost always describing a reputation difference between two accounts rather than a difference between two products.",
    },
    {
      question: "Will my inbox placement get worse if I move to raw SES?",
      answer:
        "Temporarily, and for a reason that has nothing to do with SES. You would be a brand new sending identity with no history, which every mailbox provider treats cautiously for a while. The fix is the ordinary one — ramp volume gradually, start with your most engaged recipients, keep bounce and complaint rates low, and get DKIM, SPF and DMARC aligned before the first send rather than after the first problem.",
    },
    {
      question: "How long does SES production access actually take?",
      answer:
        "Usually hours, sometimes a couple of days, and occasionally it comes back with questions. The application asks how you collect addresses, how you handle bounces and complaints, and what the mail is for. Vague answers get follow-up questions, which is the real cause of the multi-day cases. Write it as though a person is reading it, because one is, and have the bounce handling built before you apply rather than promised.",
    },
    {
      question: "Can I use React Email if I am sending through SES?",
      answer:
        "Yes, and plenty of teams do. React Email is an open-source renderer that turns components into an HTML string; nothing about it is coupled to Resend's API. You render, then hand the result to the SES send call. You lose the integrated preview and the first-party polish, and you keep the part that actually matters, which is that your templates are reviewable code rather than rows in somebody's database.",
    },
    {
      question: "What does it really cost to rebuild what SES does not have?",
      answer:
        "The naive estimate is a week and the honest one is that it never finishes. Sending is an afternoon. The rest is an event consumer, somewhere to store events, a way to search them, suppression handling, a template pipeline with previews, per-environment identities and enough alerting to notice a bounce-rate climb before AWS does. None of it is hard, all of it is real, and the maintenance does not stop.",
    },
    {
      question: "Can I run both at the same time?",
      answer:
        "Yes, and it is a sensible way to de-risk a migration in either direction. Use a separate subdomain per provider so DKIM keys, reputation and DMARC alignment stay independent, then move traffic class by class — start with something low-stakes like digests, keep password resets on the proven path until last. The cost is two suppression lists and two sets of webhooks that nobody reconciles until something has already gone wrong.",
    },
  ],
};

const AMAZON_SES_VS_SELF_HOSTED: VersusPage = {
  slug: "amazon-ses-vs-self-hosted",
  a: "amazon-ses",
  b: "self-hosted",
  title: "Amazon SES vs self-hosted mail",
  description:
    "You have decided not to pay a per-message platform fee. The remaining question is whether you rent delivery from AWS or run the mail server yourself — and what the second option costs in hours rather than invoices.",
  search: {
    primaryQuery: "is it worth running your own mail server instead of ses",
    secondaryQueries: [
      "postal mail server versus amazon ses",
      "self hosted smtp deliverability problems",
      "port 25 blocked on cloud provider",
      "cost of running your own outbound mail server",
    ],
    rationale:
      "The people asking this have already rejected the hosted-API tier on price, so a comparison that reasons about per-message rates is answering a question they stopped asking. What they need priced is the operational work, and nobody selling either option has a reason to itemise it.",
  },
  intro:
    "Nobody arrives at this comparison by accident. You have already looked at the hosted APIs, decided the per-message premium is not buying you anything you want, and are now choosing between the cheapest credible rental and owning the machine outright. The honest framing is that this is not a cost comparison at all. Both options are cheap in dollars. One of them is expensive in a currency that does not appear on any invoice, which is the attention of the person who will be paged when a mailbox provider stops accepting your mail.",
  dimensions: [
    {
      heading: "What the word free is doing in each pitch",
      a: "SES charges per message and nothing else, which at any volume below a few million is a rounding error next to one engineer-day a month. There is no server, no address to warm by hand, no package to patch. The bill is legible and it arrives from a vendor you are probably already paying, which also means it goes through a procurement process that already exists.",
      b: "The software genuinely is free. What is not free is a machine with a static address and clean history, a second one so that a reboot is not an outage, backups of the queue, TLS certificates that renew, and the person who reads the logs. Teams costing this out reliably count the first item and reliably omit the last one, which is the one that dominates.",
    },
    {
      heading: "Getting an address that anyone will accept mail from",
      a: "AWS hands you shared addresses with existing history on day one, and a dedicated address if you want one, with a managed warm-up path. Your job is to keep your bounce and complaint rates low enough that the shared pool stays healthy, which is a policy problem rather than a networking one.",
      b: "Your address starts with no history, which for a mailbox provider is indistinguishable from suspicious. You need forward and reverse DNS agreeing, a TLS certificate matching the hostname, DKIM signing, an SPF record and DMARC alignment before the first message, and then weeks of deliberately slow ramping. Most cloud providers also block outbound port twenty-five by default and unblocking it is a support request that can be refused.",
    },
    {
      heading: "The approval nobody warns you about",
      a: "SES puts new accounts in a sandbox and asks you to apply for production access. It is an application AWS can refuse, and it is the part of an SES rollout most likely to slip a date. The compensation is that once it is granted the gate is behind you permanently and the account is yours across every region you enable.",
      b: "There is no single approval and there are many small ones. Your hosting provider has to allow outbound mail. Microsoft runs its own sender support process and Google its postmaster tooling, and enrolment in feedback loops is per-provider paperwork. Each one is minor and there is no end to them, because a new blocklist listing is a new form to fill in on somebody else's schedule.",
    },
    {
      heading: "What happens at three in the morning",
      a: "Very little that is yours. A rate limit rejects a call and your retry logic handles it; a bounce arrives as an event and your consumer records it. The genuine SES incidents are regional and AWS is already working on them, which is a meaningfully different night from the alternative.",
      b: "The queue backs up because one large provider has started deferring you, and now the decision is whether that is a reputation problem, a content problem, a DNS problem or a full disk. Diagnosing a deferral means reading SMTP transcripts. Remediation means a delisting request and then waiting. That is a specific skill, it is rarer than it used to be, and the person who has it on your team is one person.",
    },
    {
      heading: "Bounce handling and feedback loops",
      a: "SES processes bounces and complaints for you, maintains an account-level suppression list, and publishes both as events you can consume. Complaint feedback loops with the major providers are already wired in, so an abuse report becomes a structured event rather than a message in a mailbox nobody reads.",
      b: "You parse bounce messages yourself, which means implementing enough of the delivery status notification format to distinguish a permanently dead address from a temporarily full one, and suppressing correctly on the basis of that distinction. Feedback loops are individual enrolments per provider. Getting this wrong is invisible for a month and then it is your deliverability problem.",
    },
    {
      heading: "Compliance, audit and the questionnaire",
      a: "Sending inherits the AWS control environment, so the security questionnaire that arrives with your first enterprise customer has an answer you can point at. Encryption in transit, key management, access control and logging are all existing AWS answers rather than things you have to write up about a box you administer.",
      b: "Every one of those questions is about a server you own. That can be exactly what you want — a regulator may require it, or an air-gapped environment may make the question moot — but it means the evidence is yours to produce, the patching cadence is yours to defend, and the incident response plan is a document somebody on your team has to write and test.",
    },
    {
      heading: "Where the arithmetic actually crosses over",
      a: "Rental wins for almost everyone, because the per-message rate has to be multiplied by a very large number before it rivals a fractional engineer. Below roughly a million messages a month the discussion is not close, and the honest reason to leave is a requirement about control rather than a number on a spreadsheet.",
      b: "Ownership wins when volume is enormous and steady, when you already staff people who run mail infrastructure for other reasons, or when a rule about where messages may physically transit makes a hosted service impossible. Those are real situations. They are also much rarer than the number of teams who decide to self-host after reading a pricing page.",
    },
    {
      heading: "Getting out again",
      a: "Your application talks to an API and your domains are verified against an account you control. Changing your mind means changing a client library and re-pointing DNS. Nothing in the decision is irreversible and nothing has to be scheduled around.",
      b: "Unwinding is mostly straightforward — you stop sending through your own host and start sending through something else — except for the part that is not, which is that any reputation you spent months building belonged to an address you are about to stop using. You start again from a cold identity, exactly as you did the first time.",
    },
  ],
  pickA: [
    "Sending email is a supporting function of your product rather than the product, and you would rather spend the engineering elsewhere.",
    "You want bounce processing, suppression and complaint feedback to exist on day one without anyone implementing the delivery status notification format.",
    "Your compliance answers can lean on a cloud provider's control environment rather than on a server you administer yourself.",
    "Volume is anywhere below the millions per month, where the per-message rate has not yet caught up with the cost of a person.",
  ],
  pickB: [
    "You already run mail infrastructure for other reasons and the marginal cost of one more sending host is genuinely small.",
    "A contractual or regulatory rule requires that messages never transit infrastructure you do not operate.",
    "Volume is large, steady and predictable enough that the per-message rate has become a line item somebody argues about.",
    "You have a person — not a plan to hire one — who can read an SMTP transcript and file a delisting request without it ruining their week.",
  ],
  faqs: [
    {
      question: "Can I run a mail server on a cheap cloud instance?",
      answer:
        "Technically yes and practically often not, because most providers block outbound port twenty-five by default and several will decline to unblock it for a new account. Address ranges belonging to the large clouds also carry poor reputation with mailbox providers, having hosted a great deal of abuse over the years. Teams who do this successfully usually rent from a host that specialises in mail and sells addresses with clean history, which is a different and more expensive thing than the cheapest instance available.",
    },
    {
      question: "How long does it take to warm a brand new sending address?",
      answer:
        "Weeks, not days, and the schedule is driven by engagement rather than by the calendar. The usual shape is a small volume to your most active recipients first, roughly doubling every few days while watching deferrals and complaint rates, and pausing the ramp the moment one provider starts throttling. Sending your full list on the first day is the single most reliable way to have a new address treated as a spam source for months.",
    },
    {
      question: "Does self-hosting help with data residency requirements?",
      answer:
        "It can, and it is one of the few arguments that survives scrutiny, but be precise about what the requirement says. Mail in transit crosses networks you do not own regardless of where the sending host sits, so self-hosting controls where messages are stored and processed rather than where they travel. If the requirement is about storage and processing, running your own host answers it. If it is about transit, nothing answers it except not sending email.",
    },
    {
      question: "What about Postal, Listmonk or Mailu specifically?",
      answer:
        "They solve different halves. Postal is a full outbound platform with a web interface, queues and webhooks, which is the closest open-source equivalent to a sending API. Listmonk is a newsletter and list manager that expects an SMTP relay underneath it rather than being one. Mailu and similar stacks are aimed at hosting mailboxes for people, which is a harder problem than sending and usually not the one you have.",
    },
    {
      question: "Is there a middle option between these two?",
      answer:
        "Yes, and it is the one most teams actually end up on: run open-source software for the parts you want to own, such as list management or template rendering, and hand the final delivery to a relay that maintains addresses and feedback loops professionally. You keep your data and your tooling, and you decline the part of the job that is a pager rotation. It is less ideologically clean than either pole and it is where most of the value is.",
    },
  ],
};

const AMAZON_SES_VS_CLOUDFLARE_EMAIL: VersusPage = {
  slug: "amazon-ses-vs-cloudflare-email",
  a: "amazon-ses",
  b: "cloudflare-email",
  title: "Amazon SES vs Cloudflare Email Routing",
  description:
    "Both let an application receive mail and run code on it. One is a receipt-rule engine wired into the rest of AWS; the other is a free forwarder that hands a raw message to a Worker and does not send at all.",
  search: {
    primaryQuery: "how to receive email in code with aws or cloudflare",
    secondaryQueries: [
      "cloudflare email workers versus ses inbound",
      "parse incoming email into a lambda",
      "free way to receive email programmatically",
      "ses receipt rules explained",
    ],
    rationale:
      "Inbound email is the half of the stack almost nobody writes about, so the query is answered today by product documentation on both sides and by nothing that puts the two next to each other — including the fact that only one of them can also send.",
  },
  intro:
    "This comparison looks lopsided until you notice what the person asking actually wants, which is usually not an email product at all. They want mail addressed to their domain to turn into a function call. Both of these do that and they do it from opposite directions: one is a receipt-rule engine inside a cloud you are probably already using, the other is a free forwarding layer bolted to the DNS you already run. The decisive difference is that only one of them will also send the reply.",
  dimensions: [
    {
      heading: "What each product is willing to do",
      a: "SES handles both directions. Inbound arrives through receipt rules you attach to a verified domain, and each rule can drop the raw message into object storage, invoke a function, publish to a topic or bounce it outright, with rules evaluated in order. The same account and the same verified identity then sends the reply, which means one vendor, one DNS setup and one bill for the whole conversation.",
      b: "Cloudflare Email Routing receives and forwards. It matches an address, then either forwards to a destination mailbox you have verified or hands the message to a Worker you wrote. It will not send on your behalf — outbound is a separate Cloudflare product with its own quota — so a system that needs to reply is wiring two things together no matter how you feel about that.",
    },
    {
      heading: "Where your handler runs, and what it may do",
      a: "In a Lambda function, with whatever runtime, memory and timeout you configure, inside a VPC if it needs one, holding an IAM role that can reach your database directly. Cold starts are real but the execution model has no unusual limits, and a message that needs thirty seconds of processing gets thirty seconds.",
      b: "In a Worker, which is a much tighter execution environment: short CPU budgets, no long-lived connections in the traditional sense, and an outbound story that goes through Cloudflare's own bindings. For a fast classify-and-store handler that is a feature, because there is nothing to provision and nothing to keep warm. For anything that wants to sit and think, it is a constraint you will meet quickly.",
    },
    {
      heading: "Large messages and attachments",
      a: "SES puts a size ceiling on what it will accept and the standard pattern for anything substantial is to write the raw message into object storage and pass your function a pointer. That indirection is mildly annoying and it is also the right design: your handler never has to hold a large attachment in memory, and the raw source is durably stored for reprocessing when your parser turns out to be wrong.",
      b: "Cloudflare accepts messages up to a stated size per message and streams the raw content to your Worker. There is no bundled storage behind it, so if you want the original preserved you write it somewhere yourself in the same invocation. That is a few lines, and it is a few lines nobody writes until the first time a parse failure loses a message with no way to replay it.",
    },
    {
      heading: "What it costs to receive a message",
      a: "Inbound is metered like the rest of SES, and then the function invocation, the storage and the notifications are each metered separately by their own services. Individually trivial, collectively a bill with several lines on it, and legible only if you already read AWS invoices for a living.",
      b: "Nothing. Email Routing is free within its published limits on rules and destination addresses, and the Worker invocations fall under whatever Workers plan you are already on. For a side project or an internal tool this is not a marginal advantage, it is the entire argument, and it removes the cost conversation completely.",
    },
    {
      heading: "What each demands of your DNS",
      a: "You point MX records at the SES inbound endpoint for the region you chose, and inbound receiving is only offered in a subset of regions, which occasionally forces a split between where you receive and where the rest of your application lives. Your DNS can stay wherever it already is.",
      b: "Your domain has to be on Cloudflare DNS. That is a small thing if it already is and a real migration if it is not, and it means an email decision is now coupled to your DNS provider. Once there the MX setup is automatic and correct, which removes the most common configuration mistake in inbound mail entirely.",
    },
    {
      heading: "Authentication verdicts and spam",
      a: "SES evaluates SPF, DKIM, DMARC, a spam verdict and a virus verdict before your code runs, and passes all of them to the handler. That is unusually useful: your function can refuse a message that failed DMARC for your own domain without you implementing any of the checking, which is how you avoid building a system that trusts forged senders.",
      b: "Cloudflare performs its own checks and exposes message headers to the Worker, and the ergonomics are closer to being handed the message and told to make your own decisions. It is workable and it puts more of the judgement in your code, which is more control and also more places to get authentication handling subtly wrong.",
    },
    {
      heading: "Failure modes when your code throws",
      a: "A failed Lambda invocation behaves like any other failed invocation: retries, dead-letter queues, alarms, the machinery you already have. Because the raw message is usually already in object storage by then, a bug in your parser costs you a reprocessing job rather than a lost message.",
      b: "A Worker that throws while handling a message causes the delivery to fail, which the sender eventually sees as a bounce. That is arguably the honest behaviour — the mail genuinely was not accepted — and it also means an unhandled exception in a code path you ship on a Friday is visible to people outside your company.",
    },
    {
      heading: "What this looks like a year in",
      a: "Usually it has grown into the rest of the account: events on a queue, messages archived with a lifecycle policy, replies sent from the same verified domain, permissions expressed as roles. The cost is the usual AWS cost, which is that a simple thing is now composed of five services and a diagram.",
      b: "Usually it is still small, which is the point. The pattern that ages badly is the one where the inbound half is free and elegant on Cloudflare while the outbound half lives with an entirely separate vendor, so your domain's authentication records, your suppression logic and your message history are split across two systems that do not know about each other.",
    },
  ],
  pickA: [
    "The same system has to reply, and you would rather not operate two vendors and two sets of authentication records for one conversation.",
    "You want authentication and spam verdicts computed before your code runs, rather than deciding how much to trust a header yourself.",
    "Messages can be large, and having the raw source durably stored for replay is worth the extra indirection.",
    "Your handler needs a VPC, a long timeout or a direct database connection — things a constrained edge runtime will not give you.",
  ],
  pickB: [
    "You only need to receive, and something else already sends, so the missing outbound half is not missing anything you wanted.",
    "Your DNS is already on Cloudflare and the cost of receiving mail dropping to zero is the deciding factor.",
    "The handler is a fast classify-and-store or forward-to-a-human, well inside a short CPU budget.",
    "You want the MX configuration to be somebody else's responsibility, because misconfigured MX records are the most common way inbound mail silently fails.",
  ],
  faqs: [
    {
      question: "Can Cloudflare Email Routing send email?",
      answer:
        "Routing itself cannot. It receives, matches and forwards, and a Worker can reply only through a separate Cloudflare sending product with its own quota, or through an outside provider you call from the Worker. Plan for that from the start: if the feature you are building is reply-by-email, the inbound half being free does not mean the whole feature is, and the sending half is where domain authentication and reputation actually live.",
    },
    {
      question: "Is SES inbound available in every region?",
      answer:
        "No, and this catches people out. Inbound receiving is offered in a subset of the regions that support sending, so if your application runs somewhere that does not offer it you either accept a cross-region hop or run receiving in one region and everything else in another. Check the region list before designing around it, because discovering the gap after the architecture diagram is drawn is an unpleasant afternoon.",
    },
    {
      question: "How do I test an inbound pipeline without a real sender?",
      answer:
        "Send yourself real mail from several different providers, because the differences that break parsers are exactly the ones a synthetic fixture will not have: multipart structures, inline images, quoted-printable encoding, mobile clients that top-post. Save the raw sources you receive as test fixtures afterwards. A parser tested only against messages your own code generated will fail the first time somebody replies from Outlook.",
    },
    {
      question: "Which one is better for a support inbox feature?",
      answer:
        "It depends on whether replies come from the same feature. A shared inbox where agents answer from the product needs sending, threading and a suppression story, which pulls you toward the option that also sends. A pipeline that only ingests — turning mail into tickets that get answered somewhere else entirely — is a good fit for the free forwarder, and the ingest half will stay simple.",
    },
    {
      question: "Can I use both, inbound on one and outbound on another?",
      answer:
        "You can, and plenty of teams do, but be deliberate about the seams. Your SPF and DMARC records describe who may send as your domain and have to cover the sending vendor specifically. Threading depends on message identifiers that your inbound side has to preserve and your outbound side has to reference. And you now have one system that knows about bounces and another that knows about replies, with nothing joining them unless you build it.",
    },
  ],
};

const COURIER_VS_KNOCK: VersusPage = {
  slug: "courier-vs-knock",
  a: "courier",
  b: "knock",
  title: "Courier vs Knock",
  description:
    "Two notification layers that sit above your email, push and SMS providers rather than replacing them. The difference that decides it is not features — it is whether you are buying a platform with a floor or a meter with none.",
  search: {
    primaryQuery:
      "notification infrastructure platform comparison for engineers",
    secondaryQueries: [
      "do we need a notification service or just send email",
      "in app notification inbox build or buy",
      "user notification preference centre off the shelf",
      "notification orchestration layer pricing",
    ],
    rationale:
      "Teams reach this comparison after deciding to stop hand-rolling notification fan-out, which means they are evaluating a category rather than two products — and the category question, whether this layer is worth paying for at all, is one neither vendor's site will answer honestly.",
  },
  intro:
    "Neither of these delivers a message. Both sit above the providers that do, and sell you the things that get ugly when notifications outgrow a send call in a request handler: routing across channels, per-user preferences, digesting, batching, an in-app feed, and a place where the templates live that is not four files in two repositories. The decision between them turns less on capability, where they overlap heavily, than on pricing shape and on who you expect to be editing a workflow six months from now.",
  dimensions: [
    {
      heading: "The shape of the bill, and where it bites",
      a: "Courier meters sends with no platform fee, so a system that notifies rarely costs almost nothing and the line item scales linearly and predictably with usage. That makes it easy to adopt for one feature without a budget conversation, and it means the cost of fanning a single event across four channels is four times the cost of one, which is a real incentive to be thoughtful about routing.",
      b: "Knock charges a substantial monthly platform fee before the first notification, then meters on top. Below a certain volume you are paying for the platform rather than for delivery, which is a defensible thing to buy and an awkward thing to justify for a small product. Above it, the per-notification rate is what dominates and the floor stops being the thing anyone talks about.",
    },
    {
      heading: "The in-app inbox",
      a: "Courier offers an in-app component and treats it as one channel among several, consistent with its identity as a routing layer. It works, and the emphasis of the product is clearly on getting a message to the right place through the right provider rather than on the feed being the centrepiece of the experience.",
      b: "Knock treats the in-app feed as a first-class product with its own API, real-time updates, seen and read state and prebuilt components. If what you are actually shopping for is the bell icon with the unread badge — the thing that is deceptively expensive to build well, because of read state, pagination and real-time sync — this is the more complete answer of the two.",
    },
    {
      heading: "Preferences, and who is allowed to set them",
      a: "Courier models preferences per recipient and per notification type and exposes a hosted preference page you can drop in. It covers the common requirement, which is letting a user turn a category off without you writing a settings screen, and it is deliberately not trying to be a consent management platform.",
      b: "Knock's preference model is more structured, with categories, per-channel granularity and conditions, and it is one of the reasons teams with a compliance requirement end up there. The cost of that structure is that you have to model your notification taxonomy properly up front, which is more design work on day one and much less pain the first time legal asks what a user consented to.",
    },
    {
      heading: "How a workflow gets authored and changed",
      a: "Courier leans on a visual designer for templates and automation, which means a non-engineer can change copy and, within limits, behaviour. That is genuinely valuable and it introduces the problem every hosted editor has, which is that your notification logic now partly lives somewhere your version control cannot see.",
      b: "Knock pairs a visual workflow builder with a command-line tool and environment promotion, so a workflow can be pulled down, committed, reviewed and promoted from development to production like any other artefact. For an engineering organisation that treats configuration drift as a real risk, this is the single strongest argument in Knock's favour.",
    },
    {
      heading: "Who actually sends the message",
      a: "Your providers do. Courier holds credentials for your email, push and SMS vendors and calls them, so the cost of delivery is on top of the routing fee and the deliverability is whatever your underlying vendor's is. The upside is that switching a provider is a configuration change rather than a migration.",
      b: "Also your providers, with the same consequence: two invoices for one notification, and a platform fee underneath both. This is the fact that most surprises teams evaluating either product, because the pricing page of an orchestration layer naturally talks about orchestration and not about the sending bill that continues to arrive separately.",
    },
    {
      heading: "Batching, digests and not being annoying",
      a: "Courier supports throttling and digesting so that twenty events in a minute become one message, which is the feature that justifies this whole category more than any other. Hand-rolling a correct digest — with a window, a collapse key, and sensible behaviour when the window ends while the user is online — is a week of work that always gets deprioritised.",
      b: "Knock's batching primitives are a first-class part of the workflow model rather than an option on a send, with explicit batch windows and keys you control per step. If digesting is the reason you are shopping, examine both carefully against your exact case, because the difference between these two is in the edge behaviour rather than in whether the feature exists.",
    },
    {
      heading: "What you are not building if you buy either",
      a: "A fan-out layer, a preference store, a template registry, a retry policy per channel and a deduplication key. Courier's pitch is that this is unglamorous plumbing every product rebuilds badly, and that pitch is correct. The question to ask is whether you need all of it or whether you need one piece of it.",
      b: "The same list, plus the feed and the read state, plus environment promotion. Knock's larger surface is worth more when the notification system is a real part of your product rather than a supporting function. It is worth less when what you needed was to send three emails reliably and you have just acquired a platform to maintain.",
    },
    {
      heading: "Seeing what a notification looked like afterwards",
      a: "Courier keeps a log of each notification with the rendered content and the provider response, which is the thing you need when a customer says they never received anything and you have to determine whether the failure was routing, rendering or delivery. Retention follows the plan, and because sending happened at your own provider there is a second log elsewhere that has to agree with this one.",
      b: "Knock exposes per-workflow and per-recipient message history with the state each step reached, which is a better fit for debugging a conditional workflow than a flat event log is. The same caveat applies about the provider's own record being the authority on delivery, and the same discipline applies: decide early which of the two systems is the one you actually trust.",
    },
    {
      heading: "What happens if you leave",
      a: "Your templates are in their designer and your routing logic is in their model, so the export is partial by nature. The mitigating factor is that the providers underneath were always yours, so leaving costs you the orchestration layer and not your sending reputation or your domain setup.",
      b: "The command-line tooling means your workflows exist as files you already have, which makes the shape of your logic portable even though the runtime is not. That is a meaningfully better exit than a purely hosted configuration, and it is a reason to take the code-first path even if you like the visual builder.",
    },
  ],
  pickA: [
    "Volume is low or spiky and a monthly platform fee before the first notification is hard to justify to whoever signs it off.",
    "You want to adopt a notification layer for one feature without committing the whole product to it.",
    "A non-engineer changing notification copy in a visual editor is a benefit rather than a governance problem in your organisation.",
    "Routing across providers with failover is the specific pain, and the in-app feed is not part of what you need.",
  ],
  pickB: [
    "The in-app inbox with unread state is one of the things you are buying, not an extra you might use later.",
    "Workflows need to live in version control and be promoted between environments like any other code.",
    "Your preference requirements are granular enough that somebody will eventually ask you to prove what a user opted into.",
    "Notification volume is high enough that the platform fee is a small fraction of the total and the per-message rate is what matters.",
  ],
  faqs: [
    {
      question: "Do I need a notification layer at all?",
      answer:
        "Not until three things are true at once: you send through more than one channel, users can turn categories off, and somebody has asked for digesting. With one channel and no preferences, a send call in your application is the correct architecture and a notification platform is overhead. The moment the second channel arrives, the fan-out logic, the preference checks and the per-channel retry policy start multiplying, and that is the point where buying beats building.",
    },
    {
      question: "Do these replace my email provider?",
      answer:
        "No, and this is the most common misunderstanding about the category. Both orchestrate across providers you already have, holding your credentials and calling your vendor's API. You keep paying for sending, you keep owning your domain authentication, and deliverability remains a property of the provider underneath. What you are buying is everything that happens before the send call, not the send itself.",
    },
    {
      question: "How much of this could I build myself in a sprint?",
      answer:
        "The naive version, easily: a table of preferences, a switch on channel, a template lookup. What takes longer than a sprint is the part that shows up later — idempotency so a retried job does not notify twice, digest windows that behave correctly at the boundary, per-channel backoff, read state that syncs across two open tabs, and a way to change copy without a deploy. Teams usually build the first version, ship it, and buy the second one.",
    },
    {
      question: "Can I use one of these only for the in-app feed?",
      answer:
        "Yes, and it is a reasonable way in. Keep sending your email the way you already do, and use the notification layer only for the feed and the read state, which is the piece that is genuinely awkward to build. The risk is the seam: two systems now decide independently what a user should be told, and they will drift, so plan to consolidate rather than treating the split as permanent.",
    },
    {
      question: "What does either do when a downstream provider is failing?",
      answer:
        "Both retry and both support routing to an alternative channel or provider, which is one of the better arguments for the category. Read the specifics carefully, because the useful behaviour is not retrying — everything retries — it is whether a provider returning success while silently dropping mail counts as failure. Neither product can know that, which means your fallback strategy still depends on delivery telemetry you are collecting yourself.",
    },
  ],
};

const AGENTMAIL_VS_MAILSLURP: VersusPage = {
  slug: "agentmail-vs-mailslurp",
  a: "agentmail",
  b: "mailslurp",
  title: "AgentMail vs MailSlurp",
  description:
    "Both hand your code an email address over an API. One was designed for AI agents that need to hold a conversation; the other was designed for test suites that need a throwaway inbox, and it shows in the send limits.",
  search: {
    primaryQuery: "api that gives an ai agent its own email inbox",
    secondaryQueries: [
      "programmatic inbox for autonomous agents",
      "how many inboxes can i create over an api",
      "email address per agent instead of per user",
      "receive and reply to email from code",
    ],
    rationale:
      "The agent-inbox category is new enough that search results are still dominated by test-automation tooling, so a buyer looking for a production sender of record for a fleet of agents is being shown products whose outbound allowance is measured in hundreds a month.",
  },
  intro:
    "The superficial description of these two products is identical: call an API, get an email address, receive mail at it, send mail from it. The difference is what each was built to survive. MailSlurp came out of test automation, where inboxes are created by the thousand, live for the length of a CI run, and almost never send. AgentMail came out of the agent boom, where one inbox represents a persistent identity that will hold a real conversation with a real person. That origin decides almost everything else.",
  dimensions: [
    {
      heading: "What each product was built to survive",
      a: "AgentMail assumes the inbox is an identity. An agent has an address, people reply to it, the thread has history, and the expectation is that a human on the other end cannot tell the difference between this and a colleague's mailbox. The design pressure is on threading, on replying correctly and on being a legitimate sender, because the counterparty is a person rather than an assertion in a test.",
      b: "MailSlurp assumes the inbox is a fixture. Create it, wait for the message your application under test just triggered, assert on its contents, throw it away. The design pressure is on creation speed, on polling and waiting primitives, and on never colliding between parallel test runs. It is very good at that, and being good at that does not imply being good at the other thing.",
    },
    {
      heading: "How much you are allowed to send",
      a: "Sending is the product, so the allowances scale with the plan in the way you would expect from a mail vendor, with volume rather than mailbox count being the thing you eventually renegotiate. An agent that answers every message it receives roughly doubles its own traffic, and the pricing model anticipates that.",
      b: "Outbound is deliberately small. The Pro tier's monthly outbound allowance is in the hundreds, because a test suite verifying a password-reset flow receives constantly and sends almost never. Overage exists, but a product whose plan copy counts outbound in hundreds is telling you clearly what it expects, and an agent fleet that replies to customers will exhaust that in a week.",
    },
    {
      heading: "Protocols, and what can talk to it",
      a: "A REST API with webhooks, which is the right surface for an agent runtime and is a narrow one. If something in your stack speaks only SMTP or only IMAP — a legacy connector, an off-the-shelf tool, a client somebody wants to point at the mailbox to look at it by hand — you are writing an adapter or you are not doing it.",
      b: "REST, SMTP and IMAP together, which is unusually broad and is the strongest reason to pick MailSlurp for something it was not designed for. You can point an existing mail client at an inbox, integrate a tool that only knows how to relay over SMTP, and use the REST API from your tests, all against the same mailbox.",
    },
    {
      heading: "What the plan actually meters",
      a: "Inboxes before volume. The lower tiers cap how many mailboxes exist rather than how much they send, so a fleet that spawns an inbox per task outgrows the tier long before it approaches the send limit. That is worth modelling before you adopt it, because the natural agent architecture and the natural plan ladder point in opposite directions.",
      b: "Permanent inboxes are unlimited above the free tier, with the metering on message counts instead. For high inbox churn that is the friendlier model by a wide margin, and it is exactly the shape you want if every task in a queue gets its own address. The constraint simply moves to the outbound number, which is the one you will hit.",
    },
    {
      heading: "Being a legitimate sender",
      a: "AgentMail is positioned as a sender of record, which means domain authentication, reputation and the ordinary obligations of sending mail that people will reply to are part of what the product is for. That matters more than it sounds: an agent whose mail lands in spam is not a degraded agent, it is a non-functional one, and nothing about the agent framework fixes it.",
      b: "Test-automation tooling is under no pressure to keep a warm sending reputation, because in the intended use nobody receives the mail at a real mailbox. If you send production traffic from an address on a shared testing platform, you are relying on infrastructure that was never optimised for the thing you are doing, and you will find out at the worst moment.",
    },
    {
      heading: "Threading and conversation state",
      a: "Threading is a first-class concern: replies are associated with the conversation, and the model your code sees is closer to a thread than to a list of independent messages. For an agent, that is the difference between a coherent exchange and a series of unrelated messages that happen to share a subject line.",
      b: "The model is message-centric, which is correct for assertions and awkward for conversations. You can reconstruct a thread from the standard headers yourself — the identifiers are all there — and reconstructing threading correctly, including the clients that get the references header wrong, is a surprisingly deep rabbit hole to go down for something you expected to be free.",
    },
    {
      heading: "Where the mail lives and who can answer for it",
      a: "In their storage, under their policy, and there is no published compliance certification to point at. That is worth knowing before an agent starts handling anything a customer would consider confidential, because the question will eventually arrive from somebody's security review and it needs an answer that is not a shrug.",
      b: "Also in their storage, with the extra wrinkle that a platform designed for disposable test data is not making the same durability promises a mail provider does. Treat anything you need to keep as something to copy out promptly, and assume the platform's retention is tuned for a CI artefact rather than a business record.",
    },
    {
      heading: "What each costs you when the product changes",
      a: "A young company in a young category, which means the roadmap is moving quickly in your favour and the terms can move too. The mitigation is the ordinary one: keep the inbox abstraction thin in your own code so that swapping the provider is a module rather than a rewrite.",
      b: "An established product whose centre of gravity is somewhere else. The risk is not that it disappears, it is that the features you depend on for a use case it was not built for stay where they are while the test-automation features improve. You are a guest in someone else's roadmap.",
    },
  ],
  pickA: [
    "Your agents hold real conversations with real people and the outbound volume is comparable to the inbound volume.",
    "Threading matters, because a reply that loses its context reads to the recipient as a broken system.",
    "You want the vendor to be responsible for being a legitimate sender rather than treating deliverability as your problem.",
    "The inbox is a durable identity for an agent rather than a fixture created and destroyed inside one job.",
  ],
  pickB: [
    "The inboxes are for testing — signup flows, one-time codes, password resets — and almost nothing needs to be sent.",
    "Something in your stack speaks SMTP or IMAP and is not going to be rewritten to speak REST.",
    "You create and destroy inboxes at high churn and want that to be unmetered rather than the thing your plan caps.",
    "You need a permanent inbox and a disposable one from the same API, because staging and CI have different lifetimes.",
  ],
  faqs: [
    {
      question: "Can I use a test-automation inbox service in production?",
      answer:
        "You can, and the failure is gradual rather than immediate, which is what makes it a trap. Sending works until volume grows past an allowance sized for test suites, deliverability holds until a mailbox provider looks at the reputation of infrastructure it associates with automated traffic, and retention is fine until you need a message from four months ago. None of those break on the day you launch. All of them break later, at once, under load.",
    },
    {
      question: "Why do agents need their own address instead of a shared one?",
      answer:
        "Because replies have to route back to the right agent, and because a shared address makes every reply an ambiguity your code has to resolve from the body of the message. A per-agent address turns routing into an addressing problem, which is solved, rather than a parsing problem, which is not. The cost is that you now have many identities to authenticate, warm and monitor, which is precisely what these products exist to absorb.",
    },
    {
      question: "How do I stop an agent from being treated as spam?",
      answer:
        "Authenticate the domain properly, keep the volume proportionate to the replies you receive, and make sure a human can reply and reach a human. The thing that gets agent mail blocked is almost never the fact that a machine wrote it — it is unauthenticated sending from a fresh identity at a rate no human correspondence would produce, to recipients who never asked. Mailbox providers are pattern matching on behaviour, not on authorship.",
    },
    {
      question: "What happens to a conversation if I change providers?",
      answer:
        "The addresses change unless you were sending from your own domain, which is the argument for doing that from the beginning. Message history has to be exported while you still have access, and threading will break across the boundary because the identifiers your new provider generates have no relationship to the old ones. Plan the cutover at a quiet moment and accept that in-flight conversations are the casualty.",
    },
    {
      question:
        "Can I just run my own inbox with IMAP against a normal mailbox?",
      answer:
        "For one agent, yes, and it is a perfectly reasonable place to start — a real mailbox at a provider you already pay, polled over IMAP. It stops working at about the point you want the tenth one, because provisioning becomes a manual step, the polling model gets expensive in latency, and consumer mailbox providers actively rate-limit automated access. The API products exist because that curve is steeper than it looks from the first agent.",
    },
  ],
};

const AGENTMAIL_VS_NYLAS: VersusPage = {
  slug: "agentmail-vs-nylas",
  a: "agentmail",
  b: "nylas",
  title: "AgentMail vs Nylas",
  description:
    "Should your agent have an address of its own, or act from inside the user's existing mailbox? The two products answer that differently, and the answer decides your billing model, your launch date and your failure modes.",
  search: {
    primaryQuery: "should an ai agent have its own mailbox or use the users",
    secondaryQueries: [
      "connect gmail and outlook to an ai agent",
      "google oauth verification for email scopes timeline",
      "agent sending email on behalf of a user",
      "unified email api versus hosted agent inbox",
    ],
    rationale:
      "This is an architecture decision disguised as a vendor comparison, and the expensive part — a third-party security review of your Gmail scopes, on Google's schedule — appears in neither vendor's marketing and routinely slips launch dates by months.",
  },
  intro:
    "This is not really a comparison of two APIs. It is a decision about whose mailbox the agent lives in, and the vendor follows from the answer. If the agent is a participant — a teammate with a name, an address and a signature — it wants a mailbox of its own. If the agent is an assistant acting for a specific person, it has to be inside that person's mailbox, seeing what they see and sending as them. Those are different products because they are different problems, and picking the wrong one is not a preference mistake, it is a rewrite.",
  dimensions: [
    {
      heading: "Whose name is on the message",
      a: "The agent's. It has its own address, ideally on your own domain, and the recipient sees a correspondent that is visibly not a person. That is honest, it keeps the audit trail clean, and it works when there is no specific human the agent is acting for — a support triage bot, a procurement agent, a scheduler that talks to counterparties on behalf of a company rather than a person.",
      b: "The user's. Nylas connects to a real Gmail or Outlook mailbox and acts inside it, so replies land in the thread the human is already reading and outgoing mail appears in their sent folder. For an assistant that is exactly right, and it means everything the agent does is visible to the person it works for, in the tool they already have open.",
    },
    {
      heading: "The approval that decides your launch date",
      a: "There is none from a mailbox provider, because you are not touching one. You verify a domain, authenticate it and start sending, which is a process measured in hours and controlled entirely by you. This is the single largest practical advantage of the agent-owned-inbox model and it is rarely the one that gets talked about.",
      b: "Google and Microsoft both gate the scopes that read a user's mail. Reaching general availability with restricted scopes means a verification process that includes an independent security assessment, conducted on the assessor's schedule and repeated annually. Teams routinely discover this after building the integration, and it is the most common reason an assistant product ships to a handful of test users for a very long time.",
    },
    {
      heading: "What the meter counts",
      a: "Mailboxes and volume. Your cost scales with how many agents exist and how much they send, which is a curve you control directly: consolidate agents and the bill falls. The lower tiers cap mailbox count fairly aggressively, so a fleet architecture needs checking against the plan before you commit to one inbox per task.",
      b: "Connected accounts. Every user who links their mailbox is a line on the bill whether the agent did anything for them this month or not, which makes the economics a function of activation rather than usage. A free tier full of connected-but-idle accounts is a real cost, and it pushes you toward gating the connection behind a paid plan.",
    },
    {
      heading: "History the agent can see",
      a: "Nothing, until the agent has been talking for a while. A new agent inbox starts empty, which is clean and also means the agent has no idea what was agreed with this customer last quarter unless you feed it from somewhere else. Context has to come from your own systems, which you probably want anyway.",
      b: "Everything the user has. That is the feature: an assistant can search years of correspondence, understand a thread before replying and pick up context the user never explicitly gave it. It is also the reason the security review exists, and the reason your data-handling story has to be considerably more careful than it would be for an agent with its own address.",
    },
    {
      heading: "Beyond email",
      a: "Email is the scope. If the agent needs to schedule something it does that through whatever calendar integration you build separately, which is more moving parts and also a clean separation you may prefer.",
      b: "Calendar and contacts arrive on the same connection, which is why scheduling assistants gravitate here. One OAuth grant gets you the mailbox, the availability and the address book, and for an agent whose job is arranging things between people that consolidation is most of the value.",
    },
    {
      heading: "Rate limits you did not set",
      a: "The provider's, which are commercial limits attached to your plan and negotiable in the ordinary way. If an agent needs to process a burst, that is a conversation with a vendor who wants your business.",
      b: "Google's and Microsoft's, applied per connected account, and not negotiable by you or by Nylas. A backfill of a large mailbox is throttled by the mailbox provider, and a user with an enormous archive is slow to onboard for reasons no amount of engineering on your side fixes.",
    },
    {
      heading: "How the integration breaks",
      a: "Ordinarily. An API call fails, a domain's DNS is misconfigured, a message bounces. Everything that goes wrong is inside a system you or your vendor operates, which means it is diagnosable and fixable on your own timeline.",
      b: "Sideways. A user changes their password, an administrator revokes application access for the whole tenant, a token expires, a security policy changes, or the account is a shared mailbox with different permissions than the personal one you tested against. Each of these silently stops the agent for one user, and your product needs a reconnection flow and a monitoring story for it on day one.",
    },
    {
      heading: "Onboarding friction for the person being helped",
      a: "None worth naming. The agent has an address because you gave it one, and the user does not have to authorise anything, install anything or understand anything. For a product where activation rate is the metric that matters, removing an authorisation screen from the first-run flow is worth more than most features you could ship instead.",
      b: "A consent screen listing the access you are requesting, shown to somebody who has been trained to be suspicious of exactly that screen. In an organisation it may be blocked outright by an administrator policy, which turns activation into an internal approval request the user has to champion on your behalf. That is a real and measurable drop-off, and it is structural rather than something better copy fixes.",
    },
    {
      heading: "What a security reviewer asks about each",
      a: "Where the mail is stored, who at the vendor can read it, and what certification backs that. Those are answerable questions, and with a young vendor the honest answer may be thinner than an enterprise buyer wants. The surface is at least small: one vendor, one class of data.",
      b: "Everything above, plus why your application needs read access to an employee's entire mailbox, what you do with it, how long you keep it and who else sees it. That conversation is harder, it involves the customer's own administrators, and it is the reason mailbox-connected assistants sell more easily to individuals than to enterprises.",
    },
  ],
  pickA: [
    "The agent represents your company rather than a specific person, so there is no user mailbox it could plausibly live inside.",
    "You want to ship this quarter and cannot absorb a third-party security assessment on somebody else's schedule.",
    "Recipients should be able to see they are corresponding with an automated system, because that is the honest design.",
    "Your economics work per agent rather than per connected user, and idle accounts should not appear on the bill.",
  ],
  pickB: [
    "The agent assists one named person and has to see and act on the mail that person already receives.",
    "Calendar and contacts are part of the job, and consolidating them into one authorisation is a real simplification.",
    "Users need to see the agent's work in their own sent folder, because that visibility is what makes them trust it.",
    "You are prepared to fund and schedule the verification work that reading a user's mailbox requires.",
  ],
  faqs: [
    {
      question: "Why can I not just ask users for an app password?",
      answer:
        "Because that door is closing. Google removed less secure app access for most accounts, Microsoft has been disabling basic authentication across tenants, and administrators in any organisation with a security team block what remains. An integration built on stored credentials also fails the first serious security review you face, and it makes you responsible for holding a credential that unlocks far more than your feature needs.",
    },
    {
      question: "How long does Google verification actually take?",
      answer:
        "Plan in months rather than weeks for restricted scopes, and note that most of the elapsed time is not Google reviewing your form — it is the independent security assessment, scheduled against a third party's availability and repeated annually. The practical advice is to start it the day you decide on the architecture rather than the day the feature is ready, because the engineering finishes long before the paperwork does.",
    },
    {
      question:
        "Can an agent send from a user's address without the user's mailbox?",
      answer:
        "Only in the sense that you can put their name and address in the from header, and doing that without authorisation for the domain is exactly what authentication standards exist to stop. If the domain belongs to the user's employer and they are willing to authorise you, sending as them is legitimate and a matter of configuration. If it is a personal address at a large consumer provider, the answer is effectively no, and messages that attempt it land in spam.",
    },
    {
      question: "Which model is better for an inbound support agent?",
      answer:
        "Usually its own address, because support mail already arrives at a company address rather than a person's, and because the agent needs to keep working when an individual employee is on holiday or leaves. The mailbox-connected model fits better when the agent is triaging one person's inbox for them, which is a different product even though the phrase support agent covers both.",
    },
    {
      question: "Can I combine the two?",
      answer:
        "Yes, and mature products often do: an owned address for outbound campaigns and automated correspondence, plus optional mailbox connection for users who want the assistant to work inside their own inbox. The cost is two integrations, two failure modes and two compliance stories, so it is worth doing in sequence rather than at once — ship the one your core use case needs and add the other when customers actually ask.",
    },
  ],
};

const MAILSLURP_VS_MAILTRAP: VersusPage = {
  slug: "mailslurp-vs-mailtrap",
  a: "mailslurp",
  b: "mailtrap",
  title: "MailSlurp vs Mailtrap",
  description:
    "Two ways to stop your test suite emailing real people. One intercepts what your application sends; the other gives your test a real address that can receive from anywhere. Those catch different bugs.",
  search: {
    primaryQuery: "how to test email flows in an automated test suite",
    secondaryQueries: [
      "capture outgoing email in staging instead of sending",
      "assert on a one time code sent by email",
      "end to end test for signup email verification",
      "fake smtp server for integration tests",
    ],
    rationale:
      "The common framing treats these as interchangeable email-testing tools, which hides the distinction that actually matters to somebody writing the test: only one of them can receive a message that your own application did not send.",
  },
  intro:
    "Both of these exist because sending real email from a test suite is a bad idea, and both solve it, but they solve it at different points in the pipe. Mailtrap sits where your outbound mail would leave, catching it before it reaches the internet, so you see exactly what your application produced. MailSlurp gives you a genuine address on the internet that can receive from anything, so your test can act like a real recipient. If you have ever needed to assert on a code sent by a third party, only one of these two was ever going to work.",
  dimensions: [
    {
      heading: "Which direction the mail is travelling",
      a: "Outward-facing. MailSlurp inboxes are real addresses with real deliverability, reachable by anyone on the internet, which means a test can trigger a signup at a third-party service and then read the confirmation mail that service sends. That capability is the reason people reach for it and it has no equivalent in an interception product.",
      b: "Inward-facing. Mailtrap's sandbox replaces your SMTP endpoint, so everything your application sends lands in a fake inbox and nothing escapes. The guarantee is absolute — nothing you send in staging can ever reach a customer, because there is no route out — and that is a genuinely different kind of safety than an address that merely nobody is watching.",
    },
    {
      heading: "What the assertion in your test looks like",
      a: "You create an inbox, hand its address to the code under test, and then wait on a primitive built for exactly this — block until a message matching a condition arrives, with a timeout. That waiting primitive is the part that makes email tests tolerable instead of flaky, and it is better developed here than anywhere else in the category.",
      b: "You trigger the action and then query the sandbox for messages in the project, filtering by recipient or subject. It works cleanly and the polling is your concern to get right, which matters because a test that sleeps a fixed two seconds is a test that will fail on a slow continuous-integration runner and nowhere else.",
    },
    {
      heading: "Looking at the message as a human would",
      a: "The tooling is API-first and the interface reflects that: adequate for inspecting a message you are debugging, not designed as a place a designer or a product manager would spend time. The intended reader of a MailSlurp message is a test assertion.",
      b: "This is Mailtrap's strongest suit. A captured message is rendered as it would appear in various clients, alongside the HTML source, a spam score, and checks on the links and authentication headers. Before a template ships, that is a much faster feedback loop than sending yourself copies and squinting, and it catches the class of problem that no assertion would have been written for.",
    },
    {
      heading: "Running the suite in parallel",
      a: "Inbox creation is cheap and unlimited above the free tier, so the natural pattern is one inbox per test, torn down afterwards, with no shared state between workers at all. For a large parallel suite that isolation is worth more than any individual feature, because the alternative is chasing a flake that only appears when two tests run at once.",
      b: "Isolation is by project and inbox rather than per test run, so parallel workers share a space and your tests need a discriminator — a unique address per case, or a subject token — to avoid reading each other's mail. Entirely workable with a small helper, and something you have to remember to build rather than something the model gives you.",
    },
    {
      heading: "What happens after the test passes",
      a: "Nothing, by design. MailSlurp is a testing dependency; when you want to send production mail you bring a different vendor, which means one more account, one more set of credentials and one more thing in the deployment configuration.",
      b: "Mailtrap sells production sending as well, on the same account, which is the neatest version of this story: the same vendor captures your staging mail and delivers your production mail, with one integration and one dashboard. The honest caveat is that the sandbox is the older and more mature half, and the sending half is a younger product competing with specialists.",
    },
    {
      heading: "Protocol surface",
      a: "REST, SMTP and IMAP, so an application under test can be pointed at it without code changes, and a mail client can be pointed at the same inbox for a human to look at. That breadth is unusual and it is what lets MailSlurp cover cases well outside its original purpose.",
      b: "SMTP for capture, with an API for reading the sandbox. Because interception happens at the transport layer, your application needs no awareness of the test environment beyond credentials, which is the cleanest possible integration and the reason the setup takes minutes.",
    },
    {
      heading: "Cost as the suite grows",
      a: "Metered on messages, with inbox count effectively free, so the bill tracks how many emails your tests generate. A suite that runs on every commit across many branches generates more than teams expect, and it is worth measuring before committing rather than after the first surprising month.",
      b: "Plan-based, with the sandbox priced separately from production sending, so an organisation using both is paying two line items to one vendor. For a small team the entry tier covers a suite comfortably; for a large one the calculation is about seats and projects as much as it is about volume.",
    },
    {
      heading: "Seeding a mailbox with mail that is already there",
      a: "An inbox starts empty and fills only with what arrives during the test, which is exactly right for a flow that begins with a trigger. It is the wrong shape when the scenario under test assumes a mailbox with history, and building that history means sending the setup messages yourself, which is slower than it sounds at suite scale.",
      b: "The sandbox accumulates whatever your application has sent into the project, so a shared environment naturally carries a backlog. That is convenient for a human browsing recent output and hazardous for an automated assertion, because yesterday's message with the same subject is still sitting there waiting to be matched by a query that was not specific enough.",
    },
    {
      heading: "What each cannot tell you",
      a: "Whether the message would have reached an inbox. A test address at a testing vendor tells you a message was sent and what it contained, and nothing at all about how a mailbox provider would treat it. That is a different question requiring seed addresses at real providers, and no amount of green tests substitutes for it.",
      b: "The same limitation with an extra twist: the spam score in the sandbox is an analysis of content and configuration, not a prediction of placement, because placement depends overwhelmingly on the sending reputation the sandbox is deliberately not using. It is a genuinely useful smoke test and it is not an answer about the inbox.",
    },
  ],
  pickA: [
    "Your tests need to receive mail your own application did not send, such as a one-time code from a third-party service.",
    "The suite runs heavily in parallel and you want one disposable inbox per test rather than a shared space with discriminators.",
    "Something in the stack speaks only SMTP or IMAP and you would rather not change it to be testable.",
    "You want a blocking wait-for-message primitive instead of writing your own polling loop in every test.",
  ],
  pickB: [
    "The guarantee you want is that staging mail physically cannot reach a real person, not that it probably will not.",
    "Somebody needs to look at rendered templates across clients before release, and that review is part of your process.",
    "You would rather have one vendor for both captured staging mail and delivered production mail.",
    "Integration should require no code change at all — a different set of SMTP credentials per environment and nothing else.",
  ],
  faqs: [
    {
      question: "Can I not just run a local fake SMTP server?",
      answer:
        "For unit tests, yes, and a local catcher is the right answer when all you need is to prove your code called send with the right arguments. It stops being enough when tests run in continuous integration where a local process is awkward to reach, when several people need to look at the same captured message, or when the test has to receive mail from outside your own system — which a local server on a private network cannot do at all.",
    },
    {
      question: "Which one prevents an accidental send to real customers?",
      answer:
        "Interception, decisively. Replacing the SMTP endpoint in staging means there is no path to the internet, so a bug that loops over the production user table sends ten thousand messages into a sandbox and nowhere else. A real test address protects only the recipients you controlled; it does nothing about the ones your code chose by mistake, which is the incident people actually have.",
    },
    {
      question: "How do I stop email tests being flaky?",
      answer:
        "Never sleep for a fixed interval. Wait for a condition with a generous timeout, isolate each test's mail so a slow neighbour cannot be mistaken for yours, and assert on stable content rather than on exact rendered HTML, which changes every time someone edits a template. Most email test flakiness is one of those three mistakes rather than anything about the provider.",
    },
    {
      question: "Do either of these tell me whether my email lands in spam?",
      answer:
        "No, and a spam score is not the same claim. Placement is dominated by the reputation of the sending identity and by recipient engagement, neither of which exists in a test environment. Content and authentication checks catch the mistakes you can fix before sending — a missing text part, a misconfigured signature, a link on a blocklisted domain — and then you find out about placement by seeding real mailboxes at the major providers and looking.",
    },
    {
      question:
        "Can I use one for continuous integration and the other for staging?",
      answer:
        "Yes, and the split is defensible: interception for the shared staging environment where the priority is that nothing escapes, and disposable real addresses in the test suite where the priority is isolation and receiving from outside. The cost is two vendors and two sets of helper code, so make somebody responsible for the decision about which tests belong where before it becomes folklore nobody can explain.",
    },
  ],
};

const MAILTRAP_VS_SMTP2GO: VersusPage = {
  slug: "mailtrap-vs-smtp2go",
  a: "mailtrap",
  b: "smtp2go",
  title: "Mailtrap vs SMTP2GO",
  description:
    "Two SMTP relays with unusually good reporting, arrived at from opposite ends. One grew out of email testing and added delivery; the other has been relaying mail for applications and appliances for years.",
  search: {
    primaryQuery: "reliable smtp relay with good delivery reporting",
    secondaryQueries: [
      "smtp relay for an application that cannot use an api",
      "send email from a device or appliance over smtp",
      "which smtp service has the best logs",
      "smtp relay with a staging sandbox",
    ],
    rationale:
      "Buyers searching for a relay rather than an API are usually constrained — a device, a legacy application, a framework with an SMTP transport — and the comparison content in this space is written for people choosing a modern SDK, which is a different reader entirely.",
  },
  intro:
    "If you are comparing these two, you almost certainly need SMTP specifically. Something in your stack — a device, a purchased application, a framework whose mail transport was configured years ago — speaks that protocol and is not going to be rewritten to speak anything else. Both of these do relaying properly rather than treating it as a compatibility shim, which already separates them from most of the field. Where they differ is what else comes in the box, and which half of the product each vendor has been polishing for longest.",
  dimensions: [
    {
      heading: "What each has been doing the longest",
      a: "Mailtrap spent years as the place developers pointed staging at, and the sandbox is a mature, well-liked product. Production delivery is the newer half, built out afterwards, which means the rendering previews and the inspection tooling are excellent while the delivery side is competing against vendors who have done nothing else for a decade.",
      b: "SMTP2GO has been relaying production mail for a long time and the product reflects a company that treats the relay as the whole job. There is no testing sandbox to speak of; there is a service that accepts your connection reliably from many locations and tells you in detail what happened to each message afterwards.",
    },
    {
      heading: "The staging story",
      a: "This is the clearest differentiator and it is a real one. Pointing staging at a sandbox that physically cannot deliver removes an entire category of incident, the one where a job runs against production data in a pre-production environment. Having that and production delivery from the same vendor means one integration, one set of documentation and one bill.",
      b: "There is no equivalent, so staging goes to a local catcher, a separate testing vendor, or a suppression rule you have to remember to configure. That is the ordinary state of affairs for most teams and it is a gap worth pricing honestly, because the incident it prevents is embarrassing and expensive when it happens.",
    },
    {
      heading: "Getting the connection to succeed at all",
      a: "Standard submission ports with the usual authentication, which covers most applications. If your constraint is an unusual one — an old device that only speaks a legacy port, or a network that blocks the common ones — check before committing, because relay compatibility is exactly the kind of thing that is fine until it is not.",
      b: "This is where a specialist relay earns its keep. Multiple ports including the fallbacks that exist precisely because networks and hosting providers block the obvious ones, and infrastructure in several regions so a connection from an awkward network has somewhere to land. If your problem is that mail is not leaving the building at all, this is the product built for that problem.",
    },
    {
      heading: "Reporting depth",
      a: "Strong on what the message is: rendering across clients, HTML analysis, authentication checks, a spam score before you send. That is content-side reporting, aimed at the person who wrote the template and is asking whether it is any good.",
      b: "Strong on what happened to the message: per-recipient delivery events, the remote server's response text, bounce categorisation, and reporting you can slice by time and by sending source. That is delivery-side reporting, aimed at the person on call who is asking why one provider started rejecting traffic this afternoon.",
    },
    {
      heading: "Dedicated addresses and when they unlock",
      a: "Gated behind the higher plan, along with automatic warm-up, which is a reasonable place to put it since a dedicated address below a certain volume performs worse than a well-run shared pool. It does mean a mid-sized sender wanting isolation is buying a tier for one feature.",
      b: "Also on the upper plan, with inbound parsing arriving at the same threshold. The practical difference is the shape of what you get alongside it: the higher tier here is a relay tier with more capability, rather than a bundle that also contains a testing product you may not want.",
    },
    {
      heading: "Log retention, and the question you ask three months later",
      a: "Retention is shorter on the lower plans, which is the usual arrangement and the usual trap. The scenario that catches people is a billing or compliance dispute about a message sent last quarter, where nothing went wrong technically and the window simply closed.",
      b: "Retention is likewise plan-dependent, with the detail per message being unusually good inside the window. Either way, the discipline is the same and almost nobody adopts it in time: stream delivery events into your own store from the beginning, so the vendor's retention policy is a convenience rather than the only copy.",
    },
    {
      heading: "Working with things that are not your application",
      a: "Serviceable. A printer, a monitoring appliance or an off-the-shelf tool can authenticate and relay, and nothing about the product is hostile to it. The documentation and the product's centre of gravity are aimed at development teams rather than at whoever is configuring a device in a rack.",
      b: "This is core territory. A great deal of SMTP2GO's traffic is exactly this — applications, appliances and platforms whose mail configuration is a form with a hostname, a port and a password. The documentation is written for that person, and the failure modes they hit are the ones the support team sees all day.",
    },
    {
      heading: "Suppression, and who remembers a bad address",
      a: "The delivery half maintains suppression for hard bounces and complaints in the usual way, and the useful consequence of the sandbox sitting beside it is that a staging run cannot pollute that list with test addresses. Keeping test traffic out of a production suppression list sounds like a detail and is the reason some teams end up unable to mail a legitimate customer.",
      b: "Suppression is handled at the relay, which is the right place for it when the senders are devices and applications that have no concept of a bounce and will cheerfully retry the same dead address every night forever. The relay absorbing that is precisely what you are paying for, and it is worth verifying how long a suppressed address stays suppressed before you rely on it.",
    },
    {
      heading: "Where each one stops",
      a: "There is no lifecycle automation, no segmentation and no campaign tooling, which is correct for the product and worth saying out loud, because the testing heritage sometimes leads people to expect a broader platform than exists.",
      b: "Same boundary, drawn more deliberately. It is a relay with reporting, and it does not pretend that a modern SDK, a React renderer or a marketing surface is coming. If you need those, this is not a product that will grow into them and you should plan for a second vendor rather than a future release.",
    },
  ],
  pickA: [
    "You want staging mail captured somewhere it physically cannot escape, from the same vendor that delivers production mail.",
    "Somebody on the team reviews rendered templates across clients before release and wants that in the same place.",
    "Your senders are applications you wrote, so documentation aimed at developers is the documentation you need.",
    "The volume is modest and the entry tier covers both halves without buying a plan for one feature.",
  ],
  pickB: [
    "Getting a connection out of an awkward network is the actual problem, and port fallbacks matter more than tooling.",
    "The senders include devices and purchased software that will be configured once by someone who is not an engineer.",
    "Per-recipient delivery detail with the remote server's own response is what you need when something starts failing.",
    "You want a vendor whose entire product is the relay, with no adjacent half competing for its attention.",
  ],
  faqs: [
    {
      question: "Is SMTP slower or less reliable than an API?",
      answer:
        "Slower per message, yes, because a connection and a handshake cost more than a single HTTP request, and it matters when you are sending in bulk from application code. Less reliable, no — the protocol is decades old and thoroughly understood. The practical reasons to prefer an API are batching, structured error responses and per-message metadata, none of which are reliability problems. If your sender cannot speak anything else, none of this is a decision you get to make.",
    },
    {
      question: "Can I point a device or an appliance at either of these?",
      answer:
        "Both accept authenticated submissions from anything that speaks the protocol. Check the port and encryption options against what the device supports before buying, because older hardware is often the constraint — it may insist on a legacy port, or refuse a modern encryption negotiation. Use a separate credential per device so you can revoke one without touching the rest, which is advice everyone gives and nobody follows until the first time it matters.",
    },
    {
      question: "How do I keep staging mail from reaching real people?",
      answer:
        "The reliable answer is that there is no route out: point non-production environments at something that captures rather than delivers. Every other approach depends on your code being correct, and the incident always comes from code that was not — a job that iterated the wrong table, a seeded database with real addresses in it, an environment variable that was not overridden on one host.",
    },
    {
      question: "What does a per-recipient delivery log actually get me?",
      answer:
        "The remote server's own words, which is the difference between knowing a message failed and knowing why. A rejection quoting a rate limit is a throttling problem you fix by slowing down; one quoting a blocklist is a reputation problem you fix by getting delisted and finding the cause; one quoting an unknown recipient is a list-hygiene problem. Without that text you are guessing, and the three fixes have nothing in common.",
    },
    {
      question: "Do I need a dedicated sending address?",
      answer:
        "Usually not, and taking one too early makes things worse. A dedicated address with low volume has no established pattern for mailbox providers to trust, and it will perform below a well-managed shared pool until it has been warmed properly. Take one when your volume is consistently high, when you are sending for multiple brands that need separating, or when you have a specific reason not to share a reputation with strangers.",
    },
  ],
};

const AHASEND_VS_ZEPTOMAIL: VersusPage = {
  slug: "ahasend-vs-zeptomail",
  a: "ahasend",
  b: "zeptomail",
  title: "AhaSend vs ZeptoMail",
  description:
    "The two cheapest credible transactional email APIs, and they get there by opposite routes: a small independent metering plainly, and a division of a large software company selling prepaid credits with a rule attached.",
  search: {
    primaryQuery: "cheapest transactional email api that is not amazon ses",
    secondaryQueries: [
      "transactional only email provider policy",
      "prepaid email credits that expire",
      "low cost email api without an aws account",
      "email api under a cent per message",
    ],
    rationale:
      "Price-led comparisons in this category are written by vendors who are not the cheapest, so the two products that genuinely are get described in terms of what they lack rather than in terms of the two very different bets a buyer is choosing between.",
  },
  intro:
    "Somebody comparing these two has already decided that the mid-market APIs are charging for things they do not want. Both of these are near the bottom of the market on unit price and neither is cheap by accident, but the reason differs completely. One is a small independent company competing on a clean meter and nothing else. The other is a wing of a very large software business that can afford to run transactional email close to cost because the point is the rest of the suite. Those are different risks to take.",
  dimensions: [
    {
      heading: "How you actually pay",
      a: "A meter. You send, you are billed per thousand, and there are no brackets to outgrow and nothing to forecast beyond your own volume. For a team whose traffic is unpredictable that is the least stressful billing model available, because a quiet month simply costs less rather than wasting an allowance you already bought.",
      b: "Prepaid credits with an expiry. You buy capacity in advance, each block covers a large number of messages, and unused capacity disappears after a fixed period whether you sent anything or not. For steady volume that is fine and cheap. For seasonal or bursty sending it is a quiet tax on being wrong about next quarter.",
    },
    {
      heading: "What you are permitted to send",
      a: "Transactional traffic is the intent, as with everyone, and the framing is the ordinary one: keep your complaint rate down and your list clean. There is no separate category of message the product refuses on principle, so the boundary is the usual abuse boundary rather than a product rule.",
      b: "Transactional only, and this is enforced policy rather than guidance. Marketing content on a ZeptoMail account is a terms violation, not merely unwise, and the separation is the entire premise of the service — it is why the shared reputation stays as clean as it does. If your newsletter and your receipts currently leave through the same integration, this product is telling you to split them.",
    },
    {
      heading: "What is around the product",
      a: "Very little, deliberately. A send API, webhooks, a dashboard and documentation. That is the product, the surface is small enough to read in an afternoon, and nothing is trying to sell you an adjacent module. Whether that is a feature depends entirely on whether the absent things are things you wanted.",
      b: "An enormous suite. ZeptoMail sits inside a software company with a customer relationship manager, a helpdesk, a marketing platform and dozens of other applications, and the integration story is strongest if you already live there. If you do not, you get a transactional API with a login flow and an administrative console designed for a much larger product than the one you came for.",
    },
    {
      heading: "Track record, and what you are betting on",
      a: "Short, and honestly so. A small company with a young deliverability record means a shared reputation with fewer senders behind it, which cuts both ways: less accumulated goodwill and also fewer neighbours to be dragged down by. The bet you are taking is on a small team continuing to run a clean pool.",
      b: "Long, in a sense that is slightly misleading. The parent company has operated mail infrastructure at scale for many years and ZeptoMail benefits from that, but the transactional product itself is more recent than the company is. The bet you are taking is that a large company keeps investing in a low-margin corner of its portfolio.",
    },
    {
      heading: "Events and what you can see",
      a: "Webhooks for the standard delivery lifecycle plus a searchable view in the dashboard, which is adequate for debugging and is not a analytics product. Given the price that is the right trade, and it means anything you want to keep long term is something you are streaming into your own store from the start.",
      b: "Event data and reporting exist and are shaped by the suite around them, which means the console is more capable than the price suggests and also more clicks away from what you wanted. Retention is tied to the account rather than to a plan tier, which is unusual and worth confirming against your own requirements rather than assuming.",
    },
    {
      heading: "Where your mail is processed",
      a: "A small footprint, so region choice is limited and worth checking against any residency requirement you have before you integrate. For most teams this is a non-question; for anyone with a data protection clause in a customer contract it is the first question.",
      b: "A genuine multi-region operation, with data centres across several jurisdictions and account creation tied to the region you pick. For a European or Indian company with a residency requirement that is a concrete advantage over most of the low-cost field, and it is one of the better reasons to choose this product that has nothing to do with price.",
    },
    {
      heading: "What happens when something goes wrong",
      a: "You are dealing with a small team, which in practice means a real person replies and understands the product, and also that there is no round-the-clock coverage to appeal to. For most projects the first property matters more than the second, right up until the night it does not.",
      b: "You are dealing with a support organisation, with the ordinary consequences: a ticket system, tiers, and a first response that may be reading from a script. The compensation is that it exists at every hour and that the company is not going to vanish.",
    },
    {
      heading: "Getting an integration finished",
      a: "A short API with conventional client libraries and an SMTP path, documented tersely enough to read in one sitting. There is little to configure and little to misunderstand, which is what you want from a component you intend to forget about after the first afternoon.",
      b: "The API is straightforward and the surrounding account setup is not, because it inherits the suite's identity and administration model. Expect to spend longer on account structure, region selection and access control than on the sending code, and expect the documentation to occasionally assume familiarity with the rest of the platform.",
    },
    {
      heading: "What neither of them does",
      a: "No dedicated addresses, no managed warm-up, no lifecycle automation, no template design surface worth the name. At this price point those absences are the product working as intended, and they mean a team that later needs any one of them is changing vendor rather than upgrading a plan.",
      b: "The same absences, plus the policy boundary. Because marketing is prohibited rather than merely unsupported, there is no future version of this account that also sends your newsletter, which makes the second vendor a certainty rather than a possibility for most growing products.",
    },
  ],
  pickA: [
    "Volume moves around unpredictably and you would rather pay for exactly what you sent than forecast a block of capacity.",
    "You want the smallest possible product surface, with nothing adjacent trying to become part of your stack.",
    "Your sending is not cleanly divisible into transactional and marketing, and you do not want a policy boundary running through it.",
    "Talking to somebody who actually knows the product matters more to you than a support organisation that runs overnight.",
  ],
  pickB: [
    "Your transactional mail is genuinely separate from your marketing mail and keeping it that way is something you consider a virtue.",
    "Volume is steady enough that prepaid capacity will be used rather than expiring unnoticed.",
    "A data residency requirement makes the choice of processing region a contractual matter rather than a preference.",
    "You already use the wider suite, so authentication, billing and support are relationships that exist rather than new ones.",
  ],
  faqs: [
    {
      question: "Is a cheap provider worse for deliverability?",
      answer:
        "Not inherently, and the correlation people notice runs the other way round. Cheap providers attract price-sensitive senders, some of whom have poor list practices, and a shared pool is only as good as the senders in it. What matters is how aggressively the vendor polices its own pool, not what it charges. Ask what happens to an account with a high complaint rate; a vendor that cannot answer crisply is one whose pool you should not join.",
    },
    {
      question: "What does transactional only actually prohibit?",
      answer:
        "Broadly, anything sent because you wanted to reach the recipient rather than because they did something. A receipt, a password reset, a shipping notification and an alert are transactional. A product announcement, a newsletter, a re-engagement nudge and a promotion are not, even when they go to existing customers and even when they are useful. The grey area is genuine and the enforcing vendor's interpretation is the one that counts, so ask about your specific edge case before building on it.",
    },
    {
      question: "What happens to prepaid credits if I stop sending?",
      answer:
        "They expire at the end of their validity period, used or not, and that is the main structural risk in a prepaid model. Buy in small increments until your volume is genuinely predictable, and be particularly careful if your product is seasonal — a block sized for your busy quarter can quietly evaporate during a slow one, which converts a cheap provider into an expensive one without anything appearing to change. Ask whether unused capacity can be extended by a new purchase before assuming it cannot, because the answer differs by vendor and it materially changes how large a block is safe to buy.",
    },
    {
      question: "Should I worry about a small vendor disappearing?",
      answer:
        "Worry proportionally, and mitigate structurally rather than emotionally. Send from your own domain so the addresses your customers reply to are yours, keep a copy of your suppression list, and keep the provider behind a thin interface in your own code so that swapping it is a module rather than an archaeology project. Do those three things and vendor risk becomes a bad week instead of a quarter.",
    },
    {
      question:
        "Can I move to one of these from a more expensive provider without downtime?",
      answer:
        "Yes, and the safe shape is gradual. Authenticate the new provider on a subdomain, send a low-stakes traffic class through it first, and watch bounce and complaint rates for a week before moving anything that a customer would notice missing. Import your existing suppression list on day one — that is the step people skip, and mailing addresses that previously bounced or complained is the fastest way to damage a reputation you have not finished building.",
    },
  ],
};

const AHASEND_VS_BAVIMAIL: VersusPage = {
  slug: "ahasend-vs-bavimail",
  a: "ahasend",
  b: "bavimail",
  title: "AhaSend vs Bavimail",
  description:
    "Two young, inexpensive transactional APIs aimed at the same person: someone who thinks the established vendors are charging for a platform they do not use. What they include differs more than the price does.",
  search: {
    primaryQuery:
      "small independent alternatives to resend for transactional mail",
    secondaryQueries: [
      "new transactional email providers worth trying",
      "email api with inbound inboxes included",
      "is a new email provider safe to rely on",
      "flat rate transactional email pricing",
    ],
    rationale:
      "Both vendors are too new to appear in the comparison content that ranks today, so the person evaluating them is doing it from two pricing pages and no independent read of what each actually includes or what the risk of either is.",
  },
  intro:
    "This pair is for someone who has looked at the established transactional APIs, concluded the premium is buying a platform they will never open, and started looking further down the market. Both of these are young, both are cheap, and both are broadly shaped like the developer-first API that popularised the category. The useful question is not which is cheaper, because at these prices the difference is unlikely to change anyone's budget. It is what each one includes, and what you are accepting by depending on a company this new.",
  dimensions: [
    {
      heading: "The metering model",
      a: "A single rate per thousand messages with no plan brackets and no recipient limits, which means there is nothing to outgrow and nothing to model. Your bill is a multiplication. That simplicity is the product's clearest idea and it removes the most common source of surprise in this category, which is discovering that the tier you are on caps something you did not know was capped.",
      b: "Plan brackets that bundle volume with counts of domains and inboxes, so the ceiling you meet may have nothing to do with how much mail you sent. That is a fine model if your shape fits a bracket, and it means a team with many domains or many inboxes can hit a wall at very modest volume, which is a different failure than running out of sends.",
    },
    {
      heading: "Receiving mail, not just sending it",
      a: "Outbound is the product. If your application needs to receive — replies, inbound parsing, an address per customer — that is another vendor and another integration, and the domain authentication for the two halves has to be kept coherent between them.",
      b: "Inbound comes in the box, with per-domain inboxes included in the plan, which is an unusual amount of capability at this price and is the strongest reason to look at Bavimail specifically. For an application that wants an address per agent or per ticket without wiring a second service, that consolidation is worth more than the unit price difference either way.",
    },
    {
      heading: "What the free tier is good for",
      a: "A meaningful monthly allowance at no cost, which makes it a reasonable place to run a staging environment as well as a small production workload. The daily shape of the limit matters more than the monthly figure for anything that sends in bursts, and it is worth checking against your own traffic pattern rather than the headline.",
      b: "A larger free monthly allowance with a daily ceiling and several inboxes included, which is generous enough that a small project may never leave it. Generosity at the free tier is also a signal worth reading carefully: it is a customer-acquisition decision, and it can be revised.",
    },
    {
      heading: "Deliverability tooling, and its absence",
      a: "There is no dedicated address option and no managed warm-up, so you are on a shared pool whose quality you cannot inspect and cannot influence. For low volume from a clean list that is genuinely fine. For a sender with enough volume to care about isolation there is nothing to buy, at any price, which is a hard ceiling rather than an upgrade path.",
      b: "The same gap, with the same consequence, and it is worth stating twice because both vendors present a feature list that otherwise reads like a mature product. Neither publishes a deliverability record, neither offers isolation, and both are asking you to take the health of a shared pool on trust.",
    },
    {
      heading: "The SDK and integration surface",
      a: "A conventional API with the usual client libraries and an SMTP path, which covers most integrations without argument. The surface being small is the point, and it means adopting or removing it is a short piece of work in either direction.",
      b: "Client libraries in a small number of languages, so a team working outside that set is writing against the HTTP interface directly. That is not difficult and it is friction that a mature vendor would have absorbed for you, which is one of the concrete ways a young product costs you time rather than money.",
    },
    {
      heading: "Overage, and reading the pricing page carefully",
      a: "There are no brackets, so there is no overage concept — every message is priced the same whether it is the first or the millionth, and a traffic spike produces a proportionally larger invoice and nothing worse.",
      b: "Plans have included volume and the rate beyond it is not published clearly, which is a meaningful gap when you are budgeting. Ask before you depend on it, because the two possible answers — a published rate, or sending stopping at the ceiling — have very different consequences for a product where mail is part of the critical path.",
    },
    {
      heading: "The risk you are taking, stated plainly",
      a: "A small company with a short history holding the reputation your transactional mail depends on. The mitigations are structural and cheap: send from your own domain, keep your own suppression list, and keep the client behind a thin interface. Do those and a vendor failure costs you a day rather than a migration.",
      b: "The same risk, slightly higher, because the inbound feature that makes it attractive is also the one that is hardest to replace. An address per agent held at a vendor that changes its plans is a harder unwind than an outbound integration, and it is worth deciding early whether that inbound data is something you are copying into your own storage as it arrives.",
    },
    {
      heading: "Who neither of these is for",
      a: "Anyone who needs a named deliverability contact, a dedicated address, a contractual uptime commitment or a compliance certification to show a customer. Those are the things the expensive vendors are actually selling, and if you need them the saving here is not a saving.",
      b: "The same list, plus anyone whose sending is large enough that a bracket boundary becomes an operational event. The economics of both products are best at small volume and the case weakens steadily as you grow, which is the opposite of how it feels when you are choosing.",
    },
  ],
  pickA: [
    "You want one rate, no brackets and nothing in the plan that can run out other than your own budget.",
    "Sending is all you need, and receiving mail is either not part of the product or already handled somewhere else.",
    "Traffic is spiky enough that a bracket you occasionally exceed would be an operational problem rather than an accounting one.",
    "You value a product surface small enough to understand completely in an afternoon.",
  ],
  pickB: [
    "Your application needs to receive as well as send, and consolidating both into one vendor removes a real integration.",
    "You want an address per domain or per agent without standing up a separate inbound service to provide them.",
    "The free tier's size means a small project can run there indefinitely while you decide whether to commit.",
    "Your volume fits comfortably inside a bracket and is predictable enough that the ceiling is not a live concern.",
  ],
  thirdOption:
    "Both of these ask you to put your sending reputation inside a company with a short history and no published deliverability record, and that — rather than price — is the thing worth thinking hardest about here. If the appeal is mostly that you are tired of paying a platform premium, the other way to stop paying it is to send through an AWS account you own, where the reputation, the suppression list and the event history belong to you and no vendor's plan change can reach them. Wraps is one way to do that. It is a worse fit than either product on this page if you want to send something today: you need an AWS account and SES production access, an approval that is AWS's to grant rather than ours, our SDKs cover TypeScript and Python only, contacts and templates live in our database rather than yours, and we are not SOC 2 certified.",
  faqs: [
    {
      question: "How do I evaluate a vendor with no deliverability record?",
      answer:
        "Test rather than read. Send to seed addresses you control at each of the major mailbox providers, from a properly authenticated domain, and look at where the messages land before you migrate anything that matters. Then ask the vendor directly what their process is for an account with a rising complaint rate. A specific answer indicates somebody is minding the pool; a vague one tells you the reputation you are about to share is not being actively defended.",
    },
    {
      question:
        "What should I keep a copy of, in case I have to leave quickly?",
      answer:
        "Your suppression list above all, because mailing addresses that previously bounced or complained is the fastest way to damage a fresh reputation, and that list is the one thing you genuinely cannot reconstruct. After that, your templates, your domain authentication records and enough delivery history to answer a dispute. Export on a schedule rather than when you are already unhappy, because the moment you want this data is usually the moment access is least convenient.",
    },
    {
      question:
        "Is sending from my own domain enough to make a vendor replaceable?",
      answer:
        "It is the single most important step and it is not sufficient on its own. Owning the domain means the addresses your customers see and reply to survive a change of vendor, which removes the worst class of lock-in. What does not survive is the reputation accumulated at the provider's own sending infrastructure, so a move still means a ramp period. Own the domain, expect the ramp, and do not schedule a migration during your busiest week.",
    },
    {
      question: "Are inbound inboxes at a sending vendor a good idea?",
      answer:
        "They are convenient and they concentrate risk. One vendor for both directions means one integration, one authentication story and one bill, which is genuinely simpler. It also means an outage or a policy change touches your ability to receive as well as to send, and inbound data — actual correspondence with customers — is more painful to lose than send logs. If you use them, copy what arrives into storage you control as it arrives.",
    },
    {
      question: "At what point should I outgrow both of these?",
      answer:
        "When you first want something neither can sell you: a dedicated sending address, a managed warm-up, a compliance document for a customer's security review, or a contractual response time. Those requirements do not arrive gradually — one enterprise deal produces all four at once — so the useful signal is not your volume but the size of the customer you are trying to close.",
    },
  ],
};

const MAILERSEND_VS_SENDGRID: VersusPage = {
  slug: "mailersend-vs-sendgrid",
  a: "mailersend",
  b: "sendgrid",
  title: "MailerSend vs SendGrid",
  description:
    "A focused email API with a template builder against the incumbent platform with subusers, marketing and a procurement department behind it. The decision is usually about who edits templates and how many brands you send for.",
  search: {
    primaryQuery: "email platform with a template builder a marketer can use",
    secondaryQueries: [
      "sendgrid alternative for a small team",
      "email api with drag and drop templates",
      "sending for multiple brands from one account",
      "moving off sendgrid after the free tier ended",
    ],
    rationale:
      "Searches in this space spiked after SendGrid retired its free tier, and the results are dominated by developer-first APIs — which is the wrong recommendation for the substantial share of these teams whose actual requirement is a template a non-engineer can edit.",
  },
  intro:
    "These two get cross-shopped because they answer the same sentence — we need an email service our marketing person can also use — from very different sizes of company. MailerSend is a focused product that put a real drag-and-drop builder in front of a competent API. SendGrid is an incumbent platform inside a large communications company, with a feature surface that covers far more and a reputation among its own customers that is more complicated than its market share suggests. The decision usually comes down to two questions: who edits templates, and how many brands you send for.",
  dimensions: [
    {
      heading: "Who is expected to edit the template",
      a: "A non-engineer, comfortably. The drag-and-drop builder is a first-class part of the product rather than a checkbox, with variables that an engineer can wire up once and copy that a marketer can change afterwards without a deploy. For a small team where one person writes the code and another writes the words, this removes a recurring source of friction.",
      b: "Either, awkwardly. There is a design library and a template editor with a templating syntax, and both are perfectly usable, and neither feels like the centre of the product. SendGrid's centre is the sending platform, and the editing experience carries the accumulated compromises of a product that has had to keep many kinds of customer happy for a long time.",
    },
    {
      heading: "What moving up a tier actually buys",
      a: "Seats, retention and support rather than headroom. The higher plan can cost substantially more than the lower one for identical sending volume, which reads as strange until you understand it as a per-organisation price rather than a per-message one. If you are one developer, the entry tier is the product and the upgrade is not for you.",
      b: "Infrastructure. The step up unlocks dedicated addresses, subusers and higher-grade support, which are capabilities rather than allowances, and the ladder is structured around what a larger sending operation needs. It is a coherent design and it means a small team can find itself paying for a tier because of one feature buried in it.",
    },
    {
      heading: "Sending for more than one brand",
      a: "Domains are supported and the model is flat: several verified domains on one account, sharing the same reputation and the same suppression list. For one company with a couple of domains that is correct and simple. For an agency or a platform sending on behalf of many customers, the absence of real separation becomes a problem as soon as one of those customers has a bad list.",
      b: "The subuser model is the strongest thing SendGrid has and it is genuinely hard to replace. Each subuser has its own credentials, its own reputation, its own suppression and its own reporting, so one tenant's behaviour is isolated from the others. If you send on behalf of customers, this feature alone frequently decides the evaluation before anything else is compared.",
    },
    {
      heading: "Marketing email, and what it costs",
      a: "Campaign and automation capability lives alongside the transactional API in the same product, which suits the team that wanted one tool. The depth is modest next to a dedicated marketing platform, and modest is often exactly right — most teams comparing these two are not running sophisticated lifecycle programmes, they are sending an announcement every few weeks.",
      b: "Marketing Campaigns is priced as its own plan rather than bundled, so the one-vendor story costs two subscriptions. That structure is worth noticing at evaluation time, because the comparison people run is usually transactional plan against transactional plan, and the marketing line arrives later as a surprise.",
    },
    {
      heading: "The free tier, and where staging goes",
      a: "Small. The monthly free allowance is low enough that it is a demonstration rather than an environment, so a staging system needs either a paid plan or a separate capture tool. That is easy to arrange and worth arranging deliberately rather than discovering when a test run exhausts the month.",
      b: "Gone. The free tier ended in 2025 and was replaced with a time-limited trial, which is the specific event that sent a large number of long-standing SendGrid users looking for alternatives. Any recommendation that assumes a permanent free SendGrid account is describing a product that no longer exists.",
    },
    {
      heading: "Reporting and what you can answer from it",
      a: "Clean, current and adequate: deliveries, opens, clicks and bounces with enough filtering to answer most questions, presented in an interface that is pleasant to use. It is not built for an analyst who wants to slice a year of history by cohort, and it is not pretending to be.",
      b: "Deeper and more configurable, with categories, custom arguments and an event webhook carrying enough metadata to rebuild your own analysis downstream. At volume this is the more capable half of the pair by some distance, and the price of that capability is an interface that requires somebody to have learned it.",
    },
    {
      heading: "Support, and what the reviews actually say",
      a: "Responsive for a company of its size, with the usual caveat that the lowest tier gets the slowest queue. There is no widespread pattern of complaint about arbitrary account action, which is not nothing in a category where that is the dominant fear.",
      b: "The most consistent theme in public reviews is support latency and abrupt account suspension, and it recurs often enough to be a planning input rather than a rumour. Large platforms are conservative about shared reputation and they act first when a sending pattern looks unusual. If your traffic is spiky, budget for the possibility and keep a fallback path warm.",
    },
    {
      heading: "Validation and list hygiene",
      a: "There is verification tooling available to check addresses before you send to them, which is the direct answer to the most common cause of a bounce-rate problem. Screening an imported list inside the same vendor that will judge you for bouncing it removes a whole category of self-inflicted incident.",
      b: "Validation is offered as part of the wider platform, and at the scale SendGrid operates it is backed by a great deal of observed data. The caveat is the one that applies to every validation service: it reduces obvious bounces and cannot tell you whether a valid mailbox belongs to somebody who wants your mail, which is the thing complaint rates actually measure.",
    },
    {
      heading: "Legacy integration surface",
      a: "SMTP and a modern API, which covers nearly everything. What you will not find is a decade of accumulated third-party integrations built by other people against this specific vendor, because the product has not been around for a decade.",
      b: "This is the incumbent advantage. Almost every content platform, ecommerce system and internal tool with an email setting has a SendGrid option in a dropdown somewhere, and a great deal of infrastructure was configured against it years ago by people who have since left. That inertia is a real reason accounts stay, independent of whether the product is the best choice today.",
    },
  ],
  pickA: [
    "A non-engineer needs to change email copy without a deploy, and the builder being good is a requirement rather than a nice extra.",
    "You are one company with a small number of domains, so tenant-level reputation separation is not something you need.",
    "You want the transactional API and a modest campaign capability on one plan rather than two subscriptions.",
    "The interface being modern and pleasant matters, because the people using it are not all engineers.",
  ],
  pickB: [
    "You send on behalf of customers and need per-tenant credentials, reputation and suppression rather than a shared account.",
    "Something you already run has a SendGrid integration built in, and rewiring it is work nobody has budgeted.",
    "Your volume and reporting needs are large enough that event metadata and categories are how you would answer questions.",
    "Procurement prefers a vendor inside a large public company, and that preference is a real constraint rather than a preference.",
  ],
  faqs: [
    {
      question:
        "Why did so many people start looking at SendGrid alternatives in 2025?",
      answer:
        "The free tier was retired in May 2025 and replaced by a sixty-day trial. A large number of small projects and internal tools had been running on that tier for years, and they all had to make a purchasing decision in the same window. If you are reading a comparison written before that change, its recommendations were formed under different economics and should be re-checked rather than trusted.",
    },
    {
      question: "What exactly is a subuser and do I need one?",
      answer:
        "A subuser is an isolated sending identity under one parent account, with its own credentials, reputation, suppression list and reporting. You need it when a bad list belonging to one of your customers must not affect the delivery of everyone else's mail — which is to say, when you are a platform sending on behalf of tenants. A single company with several of its own domains does not need it and should not pay for it.",
    },
    {
      question:
        "Can a marketer really edit templates without breaking anything?",
      answer:
        "With a proper builder, largely yes, and the failure mode is worth designing around. Copy edits are safe. What breaks things is someone removing a variable placeholder, deleting an unsubscribe link or pasting styling that renders badly in one client. Give the non-engineers a template with the variables clearly marked, keep a reviewed version to roll back to, and send a test to yourself after every change — that discipline matters more than which builder you chose.",
    },
    {
      question: "Should transactional and marketing mail share an account?",
      answer:
        "They can share a vendor and they should not share a sending identity. Use a separate subdomain for marketing so that reputation, authentication and any blocklisting stay isolated from the mail your product depends on. The failure you are avoiding is concrete and common: a campaign to a stale list raises complaint rates, the domain's reputation drops, and suddenly password resets are landing in spam for everybody.",
    },
    {
      question: "How hard is it to migrate between these two?",
      answer:
        "The sending code is a small change; everything around it is not. Templates have to be rebuilt because the syntaxes differ, webhook consumers have to be rewritten against different event shapes, and your suppression list has to be exported and imported before the first send rather than after. Budget for the surrounding work and move one traffic class at a time, keeping the mail your customers would notice missing on the proven path until last.",
    },
  ],
};

const MANDRILL_VS_POSTMARK: VersusPage = {
  slug: "mandrill-vs-postmark",
  a: "mandrill",
  b: "postmark",
  title: "Mailchimp Transactional (Mandrill) vs Postmark",
  description:
    "One is an add-on you cannot buy without the marketing platform underneath it. The other is a standalone specialist that has spent a decade declining to become a marketing platform. That asymmetry is the whole comparison.",
  search: {
    primaryQuery:
      "moving transactional email off mailchimp to a dedicated provider",
    secondaryQueries: [
      "mandrill requires a paid mailchimp plan",
      "is mandrill still being developed",
      "transactional email separate from marketing platform",
      "mailchimp transactional email alternatives",
    ],
    rationale:
      "The people asking this are already Mailchimp customers evaluating whether to keep transactional there, so the decisive fact is a purchasing constraint rather than a feature gap — and a comparison written for greenfield buyers never mentions it.",
  },
  intro:
    "Hardly anyone chooses Mandrill from a blank page. You arrive at it because you already pay for Mailchimp and someone noticed there is a transactional product attached, or because you have been on it for years and are wondering whether to stay. That framing matters, because the most important fact about this comparison is not a feature. It is that one of these two cannot be purchased on its own, and the other has spent a decade refusing to become the thing the first one is attached to.",
  dimensions: [
    {
      heading: "What you have to buy to get it",
      a: "Mandrill is not sold standalone. It is an add-on requiring a paid Mailchimp plan underneath, so the real cost of transactional sending includes a marketing platform subscription you may not otherwise want. For a company already running campaigns in Mailchimp that is free marginal capability. For anybody else it is the single fact that ends the evaluation.",
      b: "Postmark is a product you buy by itself, with a plan that includes an allowance and a rate beyond it. Nothing else has to be purchased for it to work, and nothing in the pricing depends on a decision you made about a different category of software.",
    },
    {
      heading: "Where each product is in its life",
      a: "Mature to the point of stasis. Mandrill works, it has worked for years, and the pace of visible investment is slow. That is not automatically bad — a transactional sender that stopped changing is a transactional sender that stopped breaking — but it does mean you should not choose it expecting the surrounding tooling to improve.",
      b: "Actively developed inside a company for which this is the entire business. Message streams, the activity view and the template system have all been meaningfully improved in recent years, and the early-2026 repricing is itself evidence of a product being managed rather than maintained.",
    },
    {
      heading: "Keeping marketing away from your receipts",
      a: "Mandrill sits beside a marketing platform under one corporate roof, but the sending infrastructure is separate and your transactional traffic is not mixed with campaign traffic. What is shared is the account relationship, which matters mostly in the direction people do not expect: a problem with the marketing side is a problem with the account that transactional sending lives under.",
      b: "Message streams make the separation a product concept rather than a convention. Transactional and broadcast traffic are split by the system, with different reputations, so a newsletter cannot quietly degrade the delivery of your password resets. It is the single design decision that best explains Postmark's deliverability reputation.",
    },
    {
      heading: "Templates and merge syntax",
      a: "Templates are edited in Mailchimp's editor and sent through Mandrill with merge tags, which is genuinely convenient if your marketing team already works in that editor and slightly strange if they do not. The syntax is inherited rather than designed for transactional use, and teams end up doing more in their application code than the feature list suggests.",
      b: "Layouts and templates designed for transactional mail specifically, with versioning inside the product and a preview before you send. It is aimed at engineers, it is testable, and a non-engineer can safely change copy in it. Nobody would mistake it for a design tool, and that boundary is deliberate.",
    },
    {
      heading: "Finding out what happened to one message",
      a: "Mandrill keeps outbound activity with content and delivery state, searchable within a retention window, which is adequate and does what you would expect. The interface shows its age, and the workflow for a support person chasing one customer's missing receipt involves more steps than it should.",
      b: "The activity view is the feature customers name second after deliverability: the rendered message, the delivery path and the raw bounce text in one place, searchable without exporting anything. Answering did you get my email takes one search, which is the difference between a support tool and a log viewer.",
    },
    {
      heading: "Rejection lists and why a message did not send",
      a: "Mandrill maintains a rejection list covering hard bounces, complaints and manual blocks, and it is stricter than people expect — an address can land there and stay there, silently, so that future sends to a customer who has since fixed their mailbox simply do not happen. Knowing the list exists and checking it is part of operating Mandrill competently.",
      b: "Suppression works on the same principle with clearer surfacing, and the message streams concept means a suppression on your broadcast stream does not stop a transactional message the recipient actually needs. That distinction matters the first time a customer unsubscribes from a newsletter and then wonders why their receipt stopped arriving.",
    },
    {
      heading: "How the money is counted",
      a: "Capacity is bought in blocks covering a fixed number of messages, with the blocks carrying a validity period, and a dedicated address available as a monthly extra. Combined with the mandatory platform subscription underneath, working out your true per-message cost requires arithmetic that the pricing page does not do for you.",
      b: "A monthly plan with an included allowance and a published rate beyond it, where moving up the ladder buys capability rather than headroom. It is easy to forecast, and it is the steeper of the two at large volume, which is worth modelling honestly if your sending is growing quickly.",
    },
    {
      heading: "Inbound mail and replies",
      a: "Mandrill supports inbound routing to a webhook, which is enough to build reply handling on and has been stable for a long time. The configuration lives alongside the rest of the account, and like much of the product it works well and has not changed much.",
      b: "Postmark parses inbound mail into structured JSON and posts it to your endpoint, with the parsing being the part that saves you real work — multipart bodies, attachments and quoted replies arrive already separated. For reply-by-email on a support thread it is the cleaner of the two, and neither is a routing engine if you need conditional fan-out.",
    },
    {
      heading: "What migration actually involves",
      a: "Leaving Mandrill means rebuilding templates elsewhere, rewriting webhook consumers against different event shapes and exporting a rejection list that your new provider needs before its first send. The part people forget is the Mailchimp subscription: if transactional was the only reason it existed, cancelling it is part of the saving and part of the decision.",
      b: "Arriving at Postmark means verifying domains, choosing your message streams deliberately rather than putting everything in one, and importing suppression on day one. The streams decision is the one worth spending an hour on, because reorganising traffic types after reputation has accumulated is considerably more annoying than modelling it correctly at the start.",
    },
  ],
  pickA: [
    "You already pay for Mailchimp for marketing, so transactional sending is marginal cost on a subscription that exists regardless.",
    "Your marketing team owns the templates and already works inside that editor every day.",
    "The integration has run untouched for years, nothing is wrong with it, and change has a cost nobody is proposing to fund.",
    "Volume is moderate and the arithmetic, once you include the platform subscription you were paying anyway, still works.",
  ],
  pickB: [
    "Inbox placement for transactional mail is the requirement, and you want it to be the vendor's whole business.",
    "You do not want a marketing platform subscription to be a prerequisite for sending a password reset.",
    "Support debugs individual messages often enough that seeing the rendered email beats filtering an event log.",
    "You want the separation between transactional and broadcast enforced by the product rather than by everyone remembering.",
  ],
  faqs: [
    {
      question: "Can I use Mandrill without paying for Mailchimp?",
      answer:
        "No. It is an add-on that requires an active paid Mailchimp plan, and that requirement is the most common reason evaluations of it end early. When you compare per-message costs, include the subscription underneath in the total, because a transactional product that looks inexpensive per message can be the more expensive option overall once the prerequisite is counted.",
    },
    {
      question: "Is Mandrill being abandoned?",
      answer:
        "There is no announcement to that effect and it continues to operate, so treating it as discontinued would be inaccurate. What is fair to say is that visible investment has been modest for years, which is a legitimate input to a decision about where to put something your product depends on. If you are already there and it works, that is not a reason to move today; it is a reason not to build new dependencies on features you hope will improve.",
    },
    {
      question: "What is a message stream and why would I want one?",
      answer:
        "It is a separate sending channel with its own reputation inside the same account, so your receipts and your newsletter are kept apart by the product rather than by convention. The value shows up the first time a campaign to a stale list raises your complaint rate: with streams, the damage is contained to the broadcast side, and the mail your product actually depends on keeps arriving.",
    },
    {
      question: "Will my deliverability improve if I switch?",
      answer:
        "Possibly, and not automatically, because most deliverability problems belong to the sender rather than the vendor. If your issue is a stale list, a missing authentication record or marketing sent from a transactional domain, changing provider relocates the problem without solving it. If your issue is that transactional and campaign traffic share a reputation, then a product that separates them structurally does address the actual cause.",
    },
    {
      question: "What should I export before I leave either one?",
      answer:
        "Your suppression or rejection list first, because sending to addresses that previously bounced is the fastest way to damage a reputation you are still building. Then templates, delivery history far enough back to answer a dispute, and a written list of every system that calls the API — the forgotten cron job on an old server is what turns a clean migration into a month of stragglers. Grep for the credential rather than for the vendor name, because the integration nobody remembers is usually the one that was configured by hand rather than committed to a repository, and it will keep sending happily from an account you thought you had finished with.",
    },
  ],
};

const BREVO_VS_SCALEWAY_TEM: VersusPage = {
  slug: "brevo-vs-scaleway-tem",
  a: "brevo",
  b: "scaleway-tem",
  title: "Brevo vs Scaleway Transactional Email",
  description:
    "Two European options that answer a residency requirement from opposite ends: a full marketing and messaging platform, and a cloud provider's bare sending endpoint with almost nothing above it.",
  search: {
    primaryQuery: "european email provider for gdpr data residency",
    secondaryQueries: [
      "send email without any us cloud provider",
      "eu hosted transactional email api",
      "scaleway transactional email review",
      "european alternative to sendgrid and mailgun",
    ],
    rationale:
      "Residency-driven searches return marketing pages asserting EU hosting without distinguishing where data is stored from who the subprocessors are, which is the distinction a procurement questionnaire actually asks about.",
  },
  intro:
    "People compare these two for one reason: somebody has decided that email must not leave European infrastructure, and the American vendors are therefore off the list. Once that constraint is fixed, the remaining field is small and unusually polarised. One of these is a complete messaging platform with campaigns, automation and a light customer database. The other is a sending endpoint from a cloud provider with essentially nothing built on top. There is very little in between, and the choice is really about how much you intend to build.",
  dimensions: [
    {
      heading: "Platform against primitive",
      a: "Brevo is a full platform: campaigns, automation, a contact database, forms, SMS and a transactional API at the edge of it. For a small company that wants one European supplier for everything it sends, that breadth is the reason to be here, and the transactional API is a component of a marketing product rather than the point of it.",
      b: "Scaleway Transactional Email is a send call and a console. There is no campaign builder, no contact storage, no automation and no template design surface worth the name. It is the European equivalent of raw cloud sending, priced accordingly, and everything a person would want to click on is something you will build.",
    },
    {
      heading: "What European actually means in each case",
      a: "A European company with European infrastructure and a data protection posture built for that market, which is what most procurement questionnaires are asking about. The detail worth checking against your specific obligation is the subprocessor list, because a platform this broad integrates with many services and the edges of it are where non-European processing tends to appear.",
      b: "A European cloud provider running the service in its own regions, which is about as unambiguous as this gets — the sending infrastructure belongs to the same company as the data centre. For an organisation whose requirement is written as no American cloud anywhere in the path, this is a much shorter conversation than any platform answer can be.",
    },
    {
      heading: "How the price is counted",
      a: "By send volume rather than by contacts stored, which is friendlier than the contact-priced marketing platforms and means a large dormant list does not sit on the invoice. The tier you need is usually not the headline one, because automation and removing the vendor's own branding both sit a step up.",
      b: "Per thousand messages with no monthly platform fee, and a higher plan that bundles volume with a dedicated address. It is close to raw cloud sending economics and it is the cheapest credible European option for anyone sending a meaningful volume, provided the absent tooling really is absent from your requirements.",
    },
    {
      heading: "Reputation and isolation",
      a: "A shared pool serving a very large number of small senders, including a great many with marketing lists of uneven quality. Public reports on Brevo deliverability are mixed for exactly that reason, and the mitigations available to you are the ordinary ones: authenticate properly, keep your list clean, and separate transactional from campaign traffic by subdomain.",
      b: "Also shared by default, with a dedicated address available on the higher plan, which is a straightforward path to isolation that the platform side does not match as cleanly. Fewer senders overall and a more technical customer base tend to make for a quieter pool, though there is no published record to check that against.",
    },
    {
      heading: "Consent, unsubscribes and the compliance surface",
      a: "Brevo ships the machinery a European marketing programme needs: consent capture, preference handling, unsubscribe management and audit-friendly records. If your residency requirement came from the same conversation as your consent requirement, having both handled by one vendor is a real reduction in work.",
      b: "None of that exists. Unsubscribe links, consent records and preference management are entirely yours to build and store, which is fine for purely transactional sending where none of it applies, and a significant amount of work the moment anything you send is marketing.",
    },
    {
      heading: "Tooling above the endpoint",
      a: "A complete interface that non-engineers use daily, which is the product. The trade is the one every platform makes: your templates, segments and automations live in their system rather than in your repository, and exporting the shape of that logic is not something any platform makes easy.",
      b: "A console for configuration and basic visibility, and that is all. Everything else — templates, previews, searchable history, analytics, suppression beyond the basics — is yours. If you are already building an internal tool this is a virtue, because there is nothing to fight with. If you expected a product, it is a surprise.",
    },
    {
      heading: "Beyond email",
      a: "SMS, chat and a light customer relationship manager are part of the same account, which matters more in Europe than the feature list suggests, because consolidating suppliers is often part of the same procurement decision that created the residency requirement in the first place.",
      b: "Email only, sitting inside a broader cloud that has compute, storage and databases. Different kind of consolidation: one supplier for your infrastructure rather than one supplier for your messaging, and which of those is the useful consolidation depends on who in your organisation asked the question.",
    },
    {
      heading: "What happens as volume grows",
      a: "The plan ladder is designed for marketing volumes, and a transactional workload with high message counts and low contact counts sits slightly awkwardly on it. Model your actual shape against the tiers rather than trusting the headline, because the fit is better for a company sending campaigns than for one sending receipts.",
      b: "The economics improve with scale in the ordinary metered way, which is the main structural argument for a primitive over a platform. What does not improve is the tooling, so the operational cost of the missing features grows alongside the volume, and eventually somebody is maintaining an internal email console nobody planned to own.",
    },
  ],
  pickA: [
    "You need campaigns, automation and consent handling as well as transactional sending, from a single European supplier.",
    "Non-engineers will use the product daily and the interface is therefore part of the requirement.",
    "SMS or a light customer database on the same account removes another supplier from your procurement list.",
    "Your sending is mostly marketing, where the compliance tooling is worth considerably more than the per-message rate.",
  ],
  pickB: [
    "The requirement is precisely that no American cloud sits anywhere in the sending path, and you want the shortest possible answer to it.",
    "You send transactional mail only, so consent machinery and campaign tooling are features you would never open.",
    "You are already building your own internal tooling and want a plain endpoint underneath it rather than a platform to work around.",
    "Volume is high enough that metered pricing without a platform fee is a material difference.",
  ],
  thirdOption:
    "If the constraint driving this page is residency rather than features, it is worth noticing that the constraint is about where infrastructure runs and not about who writes the software on top of it. Sending through a cloud account you own in a European region satisfies the same requirement while leaving you free to choose tooling on its merits, and that is a third shape neither column here describes. Wraps is one way to do it, and the honest caveats are specific: you need an AWS account and SES production access, an approval on AWS's schedule rather than ours, our SDKs are TypeScript and Python only, we are not SOC 2 certified, and while sending and delivery events stay inside your own AWS region, contacts, templates and workflow state live in our database — which is a question you would need to put to your own data protection assessment rather than take on our word.",
  faqs: [
    {
      question:
        "Does EU hosting satisfy a data residency requirement on its own?",
      answer:
        "It depends entirely on how the requirement is written, and this is where evaluations go wrong. Some obligations concern where personal data is stored, which EU hosting answers directly. Others concern who can be compelled to access it, which turns on corporate ownership rather than server location, and a European data centre operated by an American company may not satisfy that reading. Get the actual wording before shortlisting, because the two readings produce different shortlists.",
    },
    {
      question:
        "Can I send marketing email through a transactional-only endpoint?",
      answer:
        "Technically yes, since it is a send call and it does not inspect your intent. Practically it is a poor idea, because you would be building consent records, unsubscribe handling and preference management yourself, and because mixing campaign traffic into the same sending identity as your receipts is the classic way to damage transactional delivery. If you do it, use a separate subdomain and treat the compliance work as a real project.",
    },
    {
      question: "Is a smaller European provider worse for deliverability?",
      answer:
        "Not necessarily, and the variables are different from the ones people assume. Smaller pools have fewer senders to be dragged down by, which helps, and less accumulated goodwill with the large mailbox providers, which hurts. What matters far more is your own authentication, your list quality and whether you separate traffic types. Test with seed addresses at the major providers before committing, rather than reasoning about it from company size.",
    },
    {
      question: "What do I lose by choosing the primitive?",
      answer:
        "Everything that is not the send call: a template editor with previews, searchable delivery history, analytics, suppression management beyond the basics, and any interface a non-engineer could use. Each is a few days of work and together they are a product somebody has to own indefinitely. That is a reasonable trade if you were building internal tooling anyway, and a bad one if you assumed the vendor would cover it.",
    },
    {
      question: "How do I keep the option of changing my mind?",
      answer:
        "Send from your own domain, keep your own copy of the suppression list, and keep templates in your repository rather than only in a vendor's editor. Those three habits cost very little while you are happy and they are what make a future migration a code change rather than an archaeology project. They also protect you against the more common outcome, which is not that you leave but that you add a second provider for one traffic class.",
    },
  ],
};

const CUSTOMER_IO_VS_KNOCK: VersusPage = {
  slug: "customer-io-vs-knock",
  a: "customer-io",
  b: "knock",
  title: "Customer.io vs Knock",
  description:
    "Both promise to stop your application hand-rolling notifications. One is a lifecycle platform a marketing team runs; the other is infrastructure your engineers version-control. They are rarely interchangeable.",
  search: {
    primaryQuery: "lifecycle messaging platform or notification infrastructure",
    secondaryQueries: [
      "product notifications versus marketing automation tool",
      "who should own notification logic engineering or marketing",
      "in app notification feed with preferences",
      "notification system billed per profile or per send",
    ],
    rationale:
      "Teams discover late that these two are answering different questions, having evaluated them on an overlapping feature list; the decisive difference is organisational — which team owns the workflow — and no vendor page frames it that way.",
  },
  intro:
    "These two turn up on the same shortlist because both replace a pile of ad hoc send calls with something structured, and they part company on a question that is organisational rather than technical: who owns a notification six months from now. Customer.io assumes a marketing or lifecycle team does, working in an interface, reasoning about segments and campaigns. Knock assumes engineers do, working in version control, reasoning about workflows and environments. Buying the one that does not match your org chart is the most common way this decision goes wrong.",
  dimensions: [
    {
      heading: "Who changes a message next quarter",
      a: "Somebody in a marketing or lifecycle role, in the interface, without a deploy. That is the design intent and it is genuinely valuable — the campaign that gets iterated weekly is the one that improves. The cost is that your messaging logic is configuration in someone else's system, invisible to code review and to your deployment pipeline.",
      b: "An engineer, in a pull request. Knock's workflows can be pulled down, committed and promoted between environments with its command-line tooling, so a change to notification behaviour goes through the same review as any other change. For organisations that treat undocumented configuration drift as a real operational risk, this is the main reason to be here.",
    },
    {
      heading: "The data model you have to adopt",
      a: "People with attributes and events, organised into segments. You stream your product's behaviour in and then reason about audiences — everyone who did this and not that in the last fortnight. It is a powerful model for lifecycle work, and it means your customer data now lives in a second system that has to be kept correct.",
      b: "Recipients, workflows and triggers. You call a workflow when something happens and Knock decides what to send, to which channels, in what order. There is no audience-building layer because that is not the job; the product assumes your application knows who to notify and why, which most applications do.",
    },
    {
      heading: "What the meter counts",
      a: "Profiles, whether or not you message them. A signup who never returns still appears on the bill, which makes the cost a function of total registrations rather than of messaging activity. Products with large free tiers and low conversion feel this sharply, and the usual response — pruning inactive profiles — is a chore with real consequences for your analytics.",
      b: "Notifications, on top of a monthly platform fee. The fee is substantial enough to be the dominant cost at low volume and irrelevant at high volume, so the shape strongly favours products that notify frequently. Nobody is billed for a user who was quiet this month.",
    },
    {
      heading: "Channels, and the in-app feed",
      a: "Email, push, SMS, in-app and webhooks, with the emphasis on email as the channel most campaigns use. The in-app capability exists and is not the centre of gravity; if the bell icon with the unread badge is what you came for, examine it carefully against what you actually need.",
      b: "The in-app feed is a first-class product with real-time updates, seen and read state and prebuilt components, and it is one of the strongest arguments for Knock specifically. That feature is deceptively expensive to build well — read state that syncs across tabs, pagination, real-time delivery — and buying it is an easy decision once you have tried building it.",
    },
    {
      heading: "Preferences and proving consent",
      a: "Subscription groups and unsubscribe handling shaped by marketing compliance, which is the right shape for campaigns and slightly awkward for product notifications, where a user turning off one category should not affect whether they get a security alert. You can model that, and you have to think about it.",
      b: "A structured preference model with categories, per-channel granularity and conditions, designed for product notifications where the distinction between a critical alert and an optional digest genuinely matters. It requires you to model a notification taxonomy up front, which is more work on day one and much less argument later.",
    },
    {
      heading: "Who delivers the message",
      a: "Customer.io does, including the sending, so it is one vendor and one invoice for both the orchestration and the delivery. That is simpler, and it also means the deliverability of your product notifications is a property of a platform whose other customers are running marketing campaigns.",
      b: "Your own providers do. Knock holds your credentials and calls them, so delivery is on top of the platform fee and the deliverability is whatever your sending vendor's is. Two invoices for one notification, and in exchange your product mail can sit on a sending identity you chose for exactly that purpose.",
    },
    {
      heading: "Testing and environments",
      a: "Workspaces separate production from testing, and the workflow for verifying a campaign before it goes out is built for a marketer sending a test to themselves. It works. It is not a story about continuous integration, and it does not put your messaging behaviour under automated test.",
      b: "Environments with promotion, plus tooling that fits a pipeline, so a workflow change can be exercised before it reaches production in the same way any other change is. If you have ever been paged because someone edited a live notification in a web interface, this difference is not a nicety.",
    },
    {
      heading: "Idempotency, and not telling someone twice",
      a: "Deduplication is handled at the campaign level: a person enters a journey once and the platform tracks where they are in it, which is the right abstraction for a sequence and an awkward one for a single event that your backend might emit twice because a job retried. You end up guarding against duplicates in your own code before the event is ever sent.",
      b: "Workflows take an idempotency key on the trigger, which is the primitive you actually want when the caller is a distributed system that will occasionally deliver the same event more than once. It is a small feature that decides whether a retried queue message results in one notification or two, and getting it wrong is the kind of bug that only appears under load.",
    },
    {
      heading: "Timing, quiet hours and time zones",
      a: "Send-time logic is a strength, because marketing has cared about it for decades: schedule by the recipient's local time, hold sends outside a window, and optimise delivery time per person. If your messaging is campaign-shaped, this is mature and you will use it.",
      b: "Scheduling and throttling exist inside the workflow model as explicit steps, which is a more programmatic take on the same problem and fits event-driven notification better. What you do not get is the decades of send-time optimisation research; what you do get is behaviour you can read in a file and reason about.",
    },
    {
      heading: "When you eventually need both",
      a: "Plenty of companies run a lifecycle platform for marketing and something else for product notifications, and this is the natural half to keep for onboarding sequences, re-engagement and anything where audience logic is the point.",
      b: "And this is the natural half to keep for the notifications your product emits in response to events, where the trigger is an action rather than a segment. The seam to watch is preferences: two systems each believing they know what a user opted into will drift, and reconciling them afterwards is worse than deciding early which one is the authority.",
    },
  ],
  pickA: [
    "A lifecycle or marketing team owns messaging day to day and needs to iterate without engineering time.",
    "Audience logic is the point — behavioural segments, onboarding sequences, re-engagement based on what someone did or did not do.",
    "You would rather have one vendor that also delivers the mail than an orchestration fee plus a separate sending bill.",
    "Your active profile count is modest relative to your message volume, which is where per-profile pricing is at its kindest.",
  ],
  pickB: [
    "Engineers own notifications and want the workflows in version control, reviewed and promoted like any other artefact.",
    "The in-app inbox with unread state is part of the product you are shipping rather than a channel you might add.",
    "Your preference requirements are granular enough that somebody will eventually have to prove what a user consented to.",
    "You have a large base of dormant accounts, and paying for profiles you never message would dominate the bill.",
  ],
  faqs: [
    {
      question: "Are these actually competitors?",
      answer:
        "They overlap enough to appear on the same shortlist and they are aimed at different buyers. One is bought by a growth or lifecycle team to run campaigns; the other is bought by an engineering team to stop hand-rolling notification fan-out. When a company runs both, nobody thinks it odd. The failure case is buying one while describing the requirements of the other, which usually surfaces about two months in.",
    },
    {
      question: "Does either replace my email provider?",
      answer:
        "One does and one does not, and it is the most consequential practical difference between them. Customer.io sends the mail itself, so it is a single relationship. Knock orchestrates across providers you already have, so you keep paying for delivery separately and you keep owning your domain authentication. Neither model is better in the abstract; the second gives you more control over which identity your product mail sends from.",
    },
    {
      question: "How do I stop paying for users I never message?",
      answer:
        "Under per-profile pricing, only by not having them in the system, which means being deliberate about which signups are synchronised and pruning dormant ones on a schedule. Both have costs: partial synchronisation makes your segments less complete, and pruning loses history. If your product has a large free tier with low conversion, model this carefully before committing, because it is the single biggest driver of a surprising invoice in this category.",
    },
    {
      question:
        "Should product notifications and marketing email share a system?",
      answer:
        "They can share a vendor and they should not share a sending identity or a preference model. A receipt and a promotion have different consent requirements and different consequences for failure, and sending both from one reputation means a campaign to a stale list can degrade delivery of the mail your product depends on. Separate subdomains at minimum, and be explicit about which categories a user can actually turn off.",
    },
    {
      question: "What does it cost to move off either one later?",
      answer:
        "The messages are portable and the logic mostly is not. Campaign definitions, segment rules and workflow configuration are expressed in each vendor's own model, and there is no export that turns one into the other. Knock's file-based workflows preserve the shape of your logic even though the runtime does not travel, which is a genuine advantage and a reason to prefer the code-first path even if the visual builder is pleasant.",
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
  AMAZON_SES_VS_RESEND,
  AMAZON_SES_VS_SELF_HOSTED,
  AMAZON_SES_VS_CLOUDFLARE_EMAIL,
  COURIER_VS_KNOCK,
  AGENTMAIL_VS_MAILSLURP,
  AGENTMAIL_VS_NYLAS,
  MAILSLURP_VS_MAILTRAP,
  MAILTRAP_VS_SMTP2GO,
  AHASEND_VS_ZEPTOMAIL,
  AHASEND_VS_BAVIMAIL,
  MAILERSEND_VS_SENDGRID,
  MANDRILL_VS_POSTMARK,
  BREVO_VS_SCALEWAY_TEM,
  CUSTOMER_IO_VS_KNOCK,
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
