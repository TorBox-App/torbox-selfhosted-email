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
  /**
   * Scannable strengths and trade-offs, three or four each, written against
   * THIS counterpart rather than in the abstract. A SERP snippet pulls these
   * more often than it pulls prose, which is the reason they are separate
   * fields rather than another dimension.
   *
   * Optional only while the depth pass is mid-flight. All four arrive together
   * or none of them do, and the final run of that pass makes them required.
   */
  prosA?: readonly string[];
  consA?: readonly string[];
  prosB?: readonly string[];
  consB?: readonly string[];
  /**
   * What actually moves when you switch between these two, in the order you
   * would do it. Five to nine items naming real artefacts on both sides —
   * a suppression list, a template syntax, a webhook payload shape, an IP that
   * does not travel. A generic checklist pasted across pairs is exactly what
   * the shingle guard exists to reject, so write it per pair or omit it.
   */
  migrationChecklist?: readonly string[];
  /**
   * Five to eight questions to put to a sales rep or find the answer to in the
   * docs, aimed at this pair's real failure modes rather than at a feature
   * grid. Optional until the depth pass completes.
   */
  buyingQuestions?: readonly string[];
  /** Four to six, unique to this pair. Eight to ten once deepened. */
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
      "which transactional provider stores the message body",
      "moving postmark layouts into react email components",
      "enforced separation between bulk and transactional mail",
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
  prosA: [
    "A decade of operating its own mail network, with inbox placement treated as the thing being sold rather than as a property inherited from whatever runs underneath.",
    "Bulk and transactional traffic travel on separate streams by construction, so a newsletter cannot quietly spend the standing that your password resets depend on.",
    "The activity view holds the rendered message, so somebody in support answers did this arrive from a search box today, without a log pipeline needing to exist first.",
    "Throughput is not a constraint anyone meets here, which removes an entire category of architectural decision from the project before it is made.",
  ],
  consA: [
    "Address isolation is gated behind the higher plans with a monthly volume minimum attached, so a small team with a reputation problem has nothing available to buy its way out of it.",
    "There is no campaign builder and the company has spent a decade declining to build one, which makes lifecycle marketing a second product and a second record of consent.",
    "The template editor is aimed squarely at engineers. Somebody in marketing can change a line of copy in it and nobody would mistake it for a design tool.",
    "The curve steepens past a few hundred thousand messages a month, and an account opened years ago is not sitting on the figures a new one gets quoted.",
  ],
  prosB: [
    "React Email is first-party and actively maintained, so templates are components under code review in your repository rather than rows in a vendor's database.",
    "Domain verification and a working integration complete in roughly the time DNS takes, and the delivery floor underneath is AWS's, which is a high floor to inherit for free.",
    "A permanent free allowance exists, which is what makes a staging environment or a weekend project something that does not generate an invoice.",
    "The product surface is small enough that nobody spends their first hour picking between four supported ways to accomplish one task.",
  ],
  consB: [
    "Logs are purged at thirty days on every plan short of Enterprise, and the scenario that breaks is concrete: a customer disputes a notice from March and you are looking in June.",
    "Two requests per second on every tier, unmoved by any upgrade, so a batch job becomes a drip you build, operate and never get to delete.",
    "Suspension during a traffic spike is the complaint that recurs across its public reviews, and it lands on exactly the mail you least want to lose.",
    "The account and the standing behind it belong to the vendor, so leaving means verifying elsewhere and earning reputation again from nothing.",
  ],
  migrationChecklist: [
    "Pick the direction on the constraint rather than on the price, because the two moves are not symmetrical. Going one way buys enforced stream separation and a stored message archive; going the other buys React Email and a free allowance and costs you retention. Only one of those is cheap to reverse once the identity has warmed.",
    "Export the suppression record from every stream and every audience rather than from the main one. Postmark scopes suppressions per message stream and Resend keeps its own bounce and complaint record, so a single export in either direction is partial — and the addresses it omits are precisely the ones that must not be mailed.",
    "Take the message archive with you if you are leaving the side that keeps one. Postmark stores rendered bodies and the other does not, so the activity view a support agent relied on stops existing on the morning of the cutover. Teams generally learn this during the dispute that needed it.",
    "Rebuild the templates instead of converting them. Layouts and substitution syntax are evaluated on the vendor's side; components are evaluated on yours. In either direction the HTML travels and the logic does not, and rendering inside your own application is what makes the move after this one a code change.",
    "Map the streams onto whatever the destination actually has, and be honest that it is less. The transactional and broadcast split is enforced on one side; on the other it is a convention you maintain with separate domains, which works exactly as reliably as somebody remembering to maintain it.",
    "Test the traffic shape against a two-per-second ceiling before committing in that direction. There is no comparable limit on the other side, so a nightly batch that is unremarkable today becomes a queue you build and then own, and no plan removes it afterwards.",
    "Re-point the webhooks and re-derive everything downstream. Both providers post signed payloads to a URL you nominate, and that surface resemblance is misleading: event names, bounce subtypes and payload shapes differ enough that a dashboard built against one produces wrong numbers when fed the other.",
    "Ramp across subdomains rather than switching in an evening. Whichever direction you travel, you arrive as an identity with no history, and the placement you were enjoying was a property of the vendor's operation rather than of your domain. Start with digests, keep receipts last, and watch the numbers for weeks.",
  ],
  buyingQuestions: [
    "When support asks whether a customer received a particular message, do they need the status or the content — and which of these two can still answer that in six months?",
    "Does anybody send bulk mail from the same domain as our password resets today, and what specifically stops that continuing after the switch?",
    "Is any of our traffic batch-shaped, and has somebody counted calls per second at peak rather than messages per month?",
    "How long must we be able to prove what we sent, and is that a written obligation or a habit nobody has examined?",
    "Who writes and edits our transactional copy, and does that person open pull requests as part of their normal week?",
    "If sending stopped tomorrow morning, who would we contact, and would that person be able to tell us what triggered it?",
    "Are we deciding on deliverability or on developer experience — and if it is deliverability, what evidence do we have that is not one of the two vendors' own pages?",
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
    {
      question: "Does Resend have anything like Postmark's message streams?",
      answer:
        "Not as an enforced mechanism. You can achieve the same separation by sending marketing and transactional traffic from different domains or subdomains with their own DKIM keys, which is genuinely effective and is what a careful team does everywhere. The difference is that Postmark makes it structural and will argue with you about bulk mail on the transactional path, whereas everywhere else it is a convention. Conventions work until an engineer who was not in the original conversation adds a send call to the obvious place.",
    },
    {
      question: "Can either of these receive inbound mail?",
      answer:
        "Postmark can, through an inbound stream that parses the message and posts structured fields to your webhook, with the same activity view over what arrived. Resend does not, and treats that as a scope decision rather than a gap. Teams needing replies alongside Resend generally put Cloudflare Email Routing or an SES receipt rule in front and parse the result themselves, which means a second system, a second set of credentials and an outgoing message tracked in a different place from the reply to it.",
    },
    {
      question: "Which one copes better with a sudden large send?",
      answer:
        "Postmark, and not by a small margin, because the constraint on that side is the plan's included volume rather than a request rate. A burst costs money and completes. On Resend the same burst meets a fixed two-per-second ceiling that no tier lifts, so it becomes a queue that drains over hours. Batch endpoints accepting several recipients per call stretch that considerably, so the real answer depends on how your send loop is written — but it is an architectural constraint rather than a commercial one, which means you engineer around it rather than paying to remove it.",
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
      "mailgun routes compared with inbound parse",
      "subaccounts versus subusers for multi tenant sending",
      "keeping category reporting across an email migration",
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
  prosA: [
    "Inbound Routes and address validation are both first-party, so the two capabilities a sending platform usually leaves to somebody else arrive inside the relationship you are already buying.",
    "A dedicated address is included from the middle plans rather than reserved for the top of the ladder, which lets a multi-brand sender isolate per brand without an enterprise conversation first.",
    "Log search shows the receiving server's SMTP response on the relay path as well as the API path, so an appliance nobody owns is as debuggable as code somebody wrote.",
    "Marketing stays deliberately out of the way, which keeps the sending account's purpose unambiguous and its suppression semantics about one kind of traffic.",
  ],
  consA: [
    "Flex closed to new signups in December 2025 and the legacy pay-as-you-go rate doubled, so any cost model assembled from remembered numbers is wrong by a factor that changes the decision.",
    "The free allowance is a hard hundred a day, which is a demo rather than a staging environment and will not survive a CI pipeline that sends verification mail per pull request.",
    "Response time on the lower plans is the complaint that recurs, and account actions tend to arrive carrying less explanation than the sender expected.",
    "Roadmap gravity follows the parent group's portfolio, so the product is durable and slow rather than responsive to anything you might ask for.",
  ],
  prosB: [
    "The broadest relay compatibility surface in the category, which matters precisely at the moment the sender is a system nobody is allowed to rewrite and nobody wants to own.",
    "Automated IP warm-up, which is a genuine difference for a team that has never warmed an address and would rather not learn the schedule on production traffic.",
    "A Twilio relationship consolidates email alongside SMS and voice under one agreement, which is procurement leverage rather than a product feature and is often the whole argument.",
    "Subusers give per-tenant credentials, reputation and reporting, which is the structural answer for anybody sending on behalf of customers rather than only for themselves.",
  ],
  consB: [
    "The free tier ended in May 2025 and became a sixty-day trial at the same daily cap, so neither vendor in this pair now offers anything a staging environment could live on.",
    "Marketing Campaigns runs on its own plan and its own meter, so a quote compared against the other side covers less product than it appears to and the gap only shows up at renewal.",
    "Dedicated addresses are reserved for the upper tier, so you buy the tier to reach the address whether or not anything else in that tier was wanted.",
    "Support latency and abrupt suspension dominate its public reviews with more volume behind them than any other vendor in this comparison, which is a planning input rather than a rumour.",
  ],
  migrationChecklist: [
    "Price the entire surface on both sides before writing a number down, because the plan page is not the invoice. Campaign tooling is a separate meter on one side and largely absent on the other, additional dedicated addresses are monthly on both, and the two quotes being compared routinely cover different amounts of product.",
    "Inventory the SMTP senders first, because they are the long pole on a migration between two incumbents. Application code is a configuration change; an appliance, a CMS plugin or a partner system that only knows how to be pointed at one relay is a ticket on somebody else's calendar, and there are always more of them than the first count found.",
    "Map subusers onto subaccounts, or establish early that you cannot. Per-tenant credentials, reputation and reporting are structured differently on the two sides, and an agency or platform leaning on that isolation needs to confirm the destination's equivalent before anything else in the plan matters.",
    "Export suppression state from every construct that holds it. Unsubscribe groups, bounces, spam reports and blocks are separate collections rather than one list, and a migration that imports the unsubscribes and forgets the complaints produces a complaint rate on an identity with no history to absorb it.",
    "Re-implement the templates rather than exporting them. Both vendors evaluate their own substitution syntax on their own side, so the HTML is portable and the logic is not. Teams that use the occasion to move rendering into the application make the migration after this one a code change instead of a project.",
    "Rewrite the event consumer and then re-derive everything downstream of it. Payload shapes, event names and batching behaviour all differ, so every dashboard, alert and finance report built on the old vocabulary is quietly wrong until somebody has re-derived it against the new one.",
    "Reproduce inbound deliberately if you use it. Routes on one side and Inbound Parse on the other are similar in intent and different in matching syntax, in what arrives at your endpoint and in how a failure surfaces, so treat it as a re-implementation with its own test plan rather than as a change of hostname.",
    "Plan the reputation ramp as a quarter rather than a sprint. The dedicated IP does not travel and neither does its warm-up, so the standard approach is both vendors running in parallel with a percentage of traffic shifting weekly — which means two invoices for a while, and that number belongs in the business case rather than in a surprise.",
  ],
  buyingQuestions: [
    "Does the quote in front of us include campaign tooling, or is that a second plan on a second meter that nobody folded into the comparison?",
    "How many of our senders are systems we cannot modify, and has somebody enumerated them rather than estimated from memory?",
    "Which tier do we have to buy to get a dedicated address, and do we actually want the rest of what that tier contains?",
    "Do we need per-tenant isolation, and does the destination structure it the way the thing we depend on today is structured?",
    "What response commitment comes with the plan we are buying, and what comes with the one above it — because that difference is what a bad day costs?",
    "How spiky is our traffic, and has anybody considered what that pattern looks like to an enforcement system that acts before a human reads anything?",
    "How many weeks of paying both vendors are in the budget, and who signs off when the ramp takes longer than the plan said?",
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
    {
      question: "How do Mailgun Routes and SendGrid Inbound Parse compare?",
      answer:
        "They answer the same question differently. Routes use an expression syntax matching on recipient, sender or header, and can forward to a URL, an address or storage. Inbound Parse binds a hostname you point MX records at and posts the parsed message to one endpoint. Routes are the more expressive of the two and Inbound Parse is the simpler to set up. Neither maps onto the other mechanically, so treat a move between them as a small re-implementation with its own tests rather than as a configuration change.",
    },
    {
      question: "Does Mailgun have an equivalent to SendGrid subusers?",
      answer:
        "It has subaccounts, which serve the same purpose — isolating one customer's sending, suppression and reporting from another's underneath one parent — and they are structured differently enough that a migration is a modelling exercise rather than a mapping. The questions to settle before committing are whether reputation is genuinely isolated per tenant or only reporting is, how credentials are scoped, and whether a parent-level view exists across all of them. Get those three answers in writing, because an agency's whole operating model sits on top of them.",
    },
    {
      question: "Can we keep our category and tag reporting across a move?",
      answer:
        "The mechanism survives and the reports do not. Both vendors let you attach a label to a message and slice delivery statistics by it, so the dimension you have been analysing by continues to exist. What does not continue is the aggregation: the console's charts, the saved views and any historical series behind them stay with the vendor you left, so year-on-year comparisons acquire a seam at the migration date. Snapshot whatever anybody cites regularly before the account closes, and rebuild the dashboard as part of the project rather than after it.",
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
      "exporting resend logs before the window closes",
      "does a hosted provider reputation transfer to my aws account",
      "requesting an ses sending rate increase",
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
  prosA: [
    "The throughput limit is an opening position rather than a ceiling. AWS raises the per-second rate and the daily quota on request while bounce and complaint numbers stay healthy, so a batch job becomes a capacity request instead of a permanent drip.",
    "Events land wherever you send them and stay for exactly as long as you decide, because there is no vendor window to close — retention becomes a line in your own infrastructure rather than a plan feature.",
    "The account, the warmed addresses and everything the mailbox providers have learned about them belong to you, which turns replacing the layer above into a code change rather than a migration with a warm-up attached.",
    "Standing is isolated to your own identity, so no neighbour's bad month reaches you and no shared-pool protection decision ever gets made about your traffic on someone else's behalf.",
  ],
  consA: [
    "Every operational feature is missing and each one is a small project of its own — a dashboard, a suppression view, a template preview, an event store, something to search it with. None is hard and collectively they never finish.",
    "The sandbox is the first thing you meet, and leaving it is an application a person reads on AWS's schedule rather than on yours. It is the most common reason a launch date on this side slips.",
    "React Email works against it perfectly well, but the integrated preview and the maintained first-party path are not there, so the template workflow is something you assemble from parts.",
    "Nothing warns you before an enforcement. The thresholds are published and the metrics are in your account, but only a team that built the alarm actually sees the number climbing.",
  ],
  prosB: [
    "The AWS approval has already happened. You inherit a sending account that is out of the sandbox, warmed and operating, the moment your DNS verifies, which is the strongest practical argument the layered model has.",
    "Time to a first delivered message is bounded by DNS propagation rather than by anybody's review queue, and the SDK surface is small enough that the integration really is finished the same afternoon.",
    "React Email is first-party and actively maintained, with the preview tooling and the polish that the open-source renderer on its own does not hand you.",
    "A dashboard, a domain verification flow and a log view exist without anybody wiring them up, which is three projects that never appear on your backlog.",
  ],
  consB: [
    "Two API requests per second on every tier including the most expensive, with no plan that lifts it, so anything batch-shaped gets a queue that is permanent rather than a temporary workaround.",
    "Logs are purged at thirty days on every plan short of Enterprise, which covers an integration bug and does not cover a billing dispute, a compliance request or a year-over-year comparison.",
    "The standing you send on is theirs and shared, so a spike in your traffic can be paused by a platform making the correct decision for everybody else on the pool.",
    "Marketing contacts are metered separately from sends, so a list that grows on its own raises the invoice in a month when nothing was mailed to it.",
  ],
  migrationChecklist: [
    "Apply for production access first and assume it is the critical path. You are asking AWS to grant what the incumbent already holds, and the answer turns on how convincingly you describe address collection, bounce handling and complaint processing. Nothing else in this move is gated by a human reading prose.",
    "Export the log history while the window is still open. Thirty days is the entire archive on any plan short of Enterprise, so this cannot be scheduled for after the cutover — everything older than the window has already gone, and no support request brings it back.",
    "Copy the suppression record across before the first production send rather than after it. A brand-new AWS account starts with an empty account-level suppression list, so the first campaign following a migration is the one that re-mails every person who previously filed a complaint.",
    "Keep React Email and abandon the idea that it was ever the lock-in. The library renders components to an HTML string and the destination send call accepts one, so templates move unchanged. What you rebuild is the preview environment and the review workflow that surrounded them.",
    "Swap the webhook consumer for an event destination. The incumbent posts a signed payload to an endpoint you nominate; the replacement publishes through SNS, EventBridge or Firehose, where the event types, the field names and the delivery guarantees all differ — so the consumer and every alert built on it are new code.",
    "Request the sending-rate increase before you need it rather than during the first batch. Both the per-second rate and the daily quota start conservative, and the increase is granted against a healthy history that a one-day-old account has not accumulated yet.",
    "Build the bounce-rate alarm before the first production send. AWS acts on published thresholds and does not telephone anybody, and that single alarm is the entire difference between a week of warning and a suspension you learn about from a drop in signups.",
    "Ramp across subdomains rather than switching over. Run both providers from separate subdomains so DKIM keys and DMARC alignment stay independent, start with digests and other low-stakes traffic, and leave password resets on the warmed path until the new identity has weeks of clean data behind it.",
  ],
  buyingQuestions: [
    "Is any of our traffic batch-shaped — a digest, a nightly job, a launch announcement — and has anybody checked that shape against a fixed per-second ceiling that no plan lifts?",
    "How far back do we need to answer a question about one specific message, and is that number written down anywhere or merely assumed?",
    "Who would own production access, the quota increases and the bounce alarm, and does that person have the time this quarter rather than in principle?",
    "If our sending were paused during a traffic spike tomorrow, what breaks first, and how many hours can the business tolerate it?",
    "Are marketing contacts in the cost model or only sends, given that one of these two prices a list that grows while nobody is mailing it?",
    "What would we lose on the day we left, and could a regulator or a customer ask us for any of it afterwards?",
    "Do we actually want the AWS approval, or are we renting somebody else's completed one and describing that as a product decision?",
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
    {
      question: "How do I keep more than thirty days of delivery history?",
      answer:
        "By not relying on the vendor's view for it. Resend exposes webhooks, so the durable answer is to consume every delivery, bounce and complaint event into your own store from the first day and treat the dashboard purely as a convenience. That is roughly a day of work and it is the single highest-value thing a team on a hosted provider can build, because it is the only version of the history that survives both the retention window and the relationship. Doing it later does not recover what already expired.",
    },
    {
      question: "What happens to suppressions and unsubscribes when I switch?",
      answer:
        "Nothing automatic, and this is where migrations do real damage. Each provider keeps its own record of who bounced, who complained and who opted out, and a new AWS account begins with that record empty. Export it and load it into the account-level suppression list before the first production send, not as a follow-up task. The failure is loud and public: the first mail after the cutover reaches everybody the previous provider had correctly stopped mailing, and the complaints that follow land against an identity with no history to absorb them.",
    },
    {
      question: "Should I request a sending quota increase before migrating?",
      answer:
        "Yes, and earlier than feels necessary. Both the per-second rate and the twenty-four-hour quota start conservative on a new account, and AWS grants increases against a record of healthy bounce and complaint rates — which a freshly approved account does not yet have. The practical sequence is to get production access, send real but modest traffic for a while, then ask, with the metrics to point at. Leaving the request until the evening of a large batch is how a migration ends up throttled on the one night it had an audience.",
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
      "reverse dns ptr record for a sending mail server",
      "enrolling in complaint feedback loops for a new ip",
      "what aws asks in the ses production access request",
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
  prosA: [
    "Shared addresses with existing history accept your mail on day one, so there is no period during which the product works and the email does not.",
    "Bounces and complaints arrive as structured events and an account-level suppression list already exists, which removes the need to implement any of the delivery status notification format.",
    "Complaint feedback loops with the major providers are already wired in, so an abuse report becomes an event your code handles rather than a mailbox nobody reads.",
    "The security questionnaire from your first enterprise customer has an existing answer about encryption, key management and access control that you did not have to write about a box you administer.",
  ],
  consA: [
    "A new account sits in a sandbox until AWS grants production access, and that is an application a person reviews and can refuse on their own timetable.",
    "Quotas and rate limits start conservative and rise by request, so a large first send is a ticket filed in advance rather than a thing you simply do.",
    "The bill is small and it is a bill, which means a staging environment and a hobby project both generate an invoice line where the alternative generates none.",
    "You are renting the delivery, so the pool health and the policy decisions behind it belong to somebody whose incentives are not identical to yours.",
  ],
  prosB: [
    "The software genuinely costs nothing, and for a team that already operates mail infrastructure the marginal cost of one more sending host really is small.",
    "Messages never transit infrastructure somebody else operates, which is the one argument on this page that a regulator or a contract can actually require.",
    "Nothing about the arrangement has a quota, a rate limit or an approval queue, so a large send is a capacity question rather than a permission question.",
    "You see the entire SMTP conversation, which makes a stubborn deliverability problem diagnosable in a way that a hosted abstraction never quite is.",
  ],
  consB: [
    "The address starts with no history, which a mailbox provider treats as indistinguishable from suspicious, and most cloud hosts block outbound port twenty-five by default with no obligation to unblock it.",
    "You parse bounce messages yourself, which means implementing enough of the notification format to tell a permanently dead address from a temporarily full one, and suppressing on that basis.",
    "Feedback loop enrolment is separate paperwork with each provider, and the consequence of skipping it is invisible for a month and then is your problem.",
    "Diagnosing a deferral means reading SMTP transcripts and filing delisting requests, which is a specific skill held by one person on your team who also has other work.",
  ],
  migrationChecklist: [
    "Decide which direction you are actually going, because the hard parts sit in different places. Moving onto AWS means one approval — the production access application — after which the operational burden mostly disappears. Moving off it means acquiring an address, a hostname, a port twenty-five exemption, feedback loop enrolments and a person who reads logs, none of which is a single gate and all of which have no end date.",
    "Treat the address and its history as the asset that does not travel. Whichever way you go, the thing you built is reputation attached to an address you are about to stop using, and the new one arrives at every mailbox provider as an unknown. Every other item on this list is work; this one is time, and the only way to spend less of it is to ramp deliberately rather than to switch on an evening.",
    "Solve reverse DNS before anything else if you are leaving. Forward and reverse records have to agree, the HELO name has to match, and only whoever owns the address block can set the pointer record — which means it is a support request to your host rather than a change you make. Providers that reject on a mismatch do so silently from your perspective, so this is a thing to confirm rather than assume.",
    "Get the port twenty-five position in writing before committing. Most cloud providers block outbound mail by default, several decline to unblock it for a new account, and the ones that do often want to know what you intend to send. Discovering this after the machine is built and the software is configured is the single most common way a self-hosting plan stalls, and it is answerable with one support ticket up front.",
    "Build or dismantle the bounce parser deliberately. On AWS a bounce arrives as a structured event with a type and a subtype and the suppression happens whether or not you act. On your own host it arrives as a delivery status notification you have to interpret well enough to distinguish a dead mailbox from a full one, and getting that distinction wrong quietly poisons your standing over weeks rather than failing loudly.",
    "Enrol in the feedback loops one provider at a time, and note that they are tied to the address. Microsoft and the other large providers each run their own process, enrolment is per sending address rather than per company, and moving addresses means doing it again. Google's postmaster tooling is domain-scoped rather than a feedback loop, so it survives an address change and tells you a different set of things.",
    "Write down what happens to the queue when a provider starts deferring you. On a managed service a deferral is retried by somebody else's infrastructure. On your own host it is disk, a retry schedule you chose and a point at which you give up and bounce. Those three numbers are a policy decision, and the time to make it is not the morning the queue is full.",
    "Cost the compliance evidence on the side you are moving to. Every question about encryption, patching and access control is answered by a cloud provider's control environment on one side and by a document you write and test on the other. If a security questionnaire is already part of your sales process, that document is a deliverable with a deadline rather than a background task.",
  ],
  buyingQuestions: [
    "Who on this team has read an SMTP transcript to diagnose a deferral, and what happens to our mail during their holiday?",
    "Has our hosting provider confirmed in writing that outbound port twenty-five will be open for this account?",
    "Does our requirement say messages must not be stored by a third party, or must not transit one — and does anybody know the difference matters?",
    "What is our volume, and at that volume how many engineer-days a month would the per-message rate have to buy before renting looks expensive?",
    "Who files the delisting request the first time we appear on a blocklist, and how quickly can they do it?",
    "If we move, how long are we prepared to ramp before sending our full volume — weeks, or until somebody loses patience?",
    "When the first enterprise security questionnaire arrives, who writes the answers about patching and incident response?",
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
    {
      question: "What is reverse DNS and why does it block so many people?",
      answer:
        "It is the record that maps your sending address back to a hostname, and receiving servers check that it exists and that it agrees with the name your server announces itself as. It blocks people because only the owner of the address block can set it, which means your hosting provider does it and not you. On a managed service the question never arises. On your own host it is a support ticket that has to be resolved before the first message, and a mismatch produces rejections that look like a reputation problem rather than a configuration one.",
    },
    {
      question: "Do feedback loop enrolments survive changing servers?",
      answer:
        "Mostly not, because most of them are tied to the sending address rather than to your company or your domain. Move the address and you enrol again with each provider that offers one, and in the interim complaints stop arriving as structured reports and start being invisible. The exception is the domain-scoped postmaster tooling, which follows the domain and keeps working. Plan the re-enrolment as part of any move rather than discovering the silence a month later.",
    },
    {
      question: "How many messages a month justifies running the server?",
      answer:
        "Rather more than most people assume, because the comparison is a per-message rate against a fraction of a person rather than against a server. At the rates a managed service charges, you need a very large number before the monthly spend approaches even a quarter of an engineer's time, and the operational work does not scale down neatly below that. Below roughly a million messages a month the arithmetic is not close, and the honest reasons to own the machine are about control rather than about the number.",
    },
    {
      question: "What does the AWS production access application actually ask?",
      answer:
        "How you obtained the addresses you intend to mail, what kind of mail you will send, how you handle bounces and complaints, and how someone unsubscribes. It is a human reading an answer, deciding whether to lend you a shared reputation. Concrete answers referencing a suppression mechanism you have already built go through quickly; vague ones earn a request for more detail and another wait. It is the only step in an AWS rollout whose timing is not yours, which is a good reason to start it first.",
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
      "does cloudflare email routing require cloudflare dns",
      "what happens when an email worker throws an error",
      "switching mx records without losing inbound mail",
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
  prosA: [
    "Both directions live in one account, so the message that arrives and the reply that leaves share a verified identity, a DNS setup and a bill.",
    "Authentication and spam verdicts are computed before your code runs and handed to it, which is how a handler refuses a forged sender without anybody implementing the checking.",
    "The raw message is written to durable storage as a matter of course, so a bug in your parser costs a reprocessing job rather than a message nobody can recover.",
    "Your handler is an ordinary function with the runtime, memory, timeout, network placement and database access you configure, which removes a whole class of execution constraint.",
  ],
  consA: [
    "Receiving is offered in a subset of regions, so the place you receive and the place the rest of your application lives are sometimes not allowed to be the same place.",
    "The cost is spread across the inbound charge, the function invocation, the storage and the notifications, which is individually trivial and collectively an invoice several lines long.",
    "Anything substantial arrives as a pointer to an object rather than as a message, so the handler starts with a fetch before it starts with logic.",
    "Rules, actions, roles and destinations are all separate pieces of configuration, and the simple thing you wanted is now a diagram with five services on it.",
  ],
  prosB: [
    "Receiving costs nothing within the published limits, which for a side project or an internal tool removes the cost conversation from the design entirely.",
    "The MX configuration is handled for you and is correct, which eliminates the single most common way an inbound setup silently fails.",
    "The raw message streams straight into your handler with nothing to provision and nothing to keep warm, which suits a fast classify-and-store perfectly.",
    "Rules and destinations are a short list in one place rather than an ordered rule set with actions attached, which is genuinely easier to reason about at small scale.",
  ],
  consB: [
    "It will not send, so anything that replies is wiring in a second product with its own quota, its own authentication records and its own idea of what happened.",
    "Your domain has to be on Cloudflare DNS, which turns an email decision into a coupling with your DNS provider and a real migration if you are not there already.",
    "The execution environment is tight — short CPU budgets, no long-lived connections in the traditional sense — which is a feature for a quick handler and a wall for anything that thinks.",
    "Nothing stores the original unless you write it somewhere in the same invocation, and a handler that throws turns into a bounce visible to the person who mailed you.",
  ],
  migrationChecklist: [
    "Check whether this is an email migration or a nameserver migration. One of these two requires your domain to be on its own DNS before it will route anything, so if you are not already there the first task is moving authoritative DNS for the whole domain — every record, not just the mail ones — with whatever coordination that implies. The other only wants an MX record pointing at a regional endpoint and does not care who serves your zone.",
    "Translate the rule model rather than copying it. An ordered receipt rule set with actions attached — store the raw message, invoke a function, publish, reject, stop processing — is a different shape from matching an address to a destination or a handler. Catch-all behaviour and the notion of a rule that stops later rules from running have no clean equivalent in the other direction, so write down what each rule is for before trying to reproduce it.",
    "Rewrite the handler's entry point, because the two are not the same function with a different signature. One side receives an event carrying verdicts for SPF, DKIM, DMARC, spam and viruses already computed. The other receives the message and expects you to form your own opinion from the authentication headers. Any code branching on a verdict has no counterpart and has to be reimplemented, and getting that wrong means trusting a forged sender.",
    "Decide where the original is stored before you move, not after. Durable storage of the raw message is automatic on one side and is a few lines you write in the handler on the other. Those few lines are the difference between a parse failure you replay and a parse failure that lost a customer's email, and nobody writes them until the first time it happens.",
    "Compare the accepted message sizes against your real traffic. The ceilings differ, and the failure is not a truncated message but a rejected one, which the sender sees. Sample what you actually receive — invoices with attachments and forwarded threads are the usual offenders — rather than reasoning from what you expect people to send.",
    "Verify every forwarding destination if you are moving toward the free forwarder, and budget for the humans involved. Destination addresses have to be confirmed by whoever owns them clicking a link, which is fine for your own mailbox and slow for a shared inbox at a client. It is the one step in this migration whose duration depends on somebody else reading their email.",
    "Plan the outbound half explicitly, including the DNS consequences. If the sending moves to a different vendor from the receiving, your SPF record has to name that vendor, your DMARC alignment has to hold for it, and the message identifiers your inbound side preserves have to be the ones your outbound side references or threading breaks. Two systems now know half the story each, and nothing joins them unless you build it.",
    "Rewrite the failure handling around the new semantics, because they are opposites. On one side a failing handler is a failed invocation with retries, a dead-letter queue and an alarm, and the message is already stored. On the other a handler that throws causes the delivery itself to fail, which the sender eventually sees as a bounce. Code written against the forgiving model ships an outage that is visible outside your company.",
  ],
  buyingQuestions: [
    "Does the feature we are building ever reply, and if so which product is sending that reply and under whose authentication records?",
    "Is our domain already on the DNS provider this requires, and if not who owns the zone migration?",
    "What is the largest message we actually receive today, and have we checked it against the accepted size on both sides?",
    "Does our handler need a database connection, a long timeout or a private network, and does the runtime we are choosing allow any of that?",
    "When our parser fails, do we want a bounce the sender sees or a retry we handle — and which one are we about to get?",
    "Who verifies each forwarding destination, and how long will waiting for those people take?",
    "Are we happy computing our own authentication judgement from headers, or do we want the verdicts handed to us?",
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
    {
      question: "Do I have to move my DNS to use the free option?",
      answer:
        "Yes, and it is worth naming as the real cost rather than a detail. Routing requires the domain to be on Cloudflare's authoritative DNS, which means moving the whole zone — web records, verification tokens, existing mail records, everything — not just the parts concerned with email. If your domain already lives there this is nothing. If it does not, an inbound email decision has just become a change with a blast radius across every service that resolves your name.",
    },
    {
      question: "What happens if my handler crashes?",
      answer:
        "Opposite things, and this is the difference most likely to surprise somebody porting code. A failing function invocation on the AWS side retries, lands in a dead-letter queue and raises an alarm, with the raw message already stored so you can reprocess it once the bug is fixed. A Worker that throws while handling a message causes the delivery itself to fail, and the sender eventually receives a bounce. The second behaviour is arguably more honest and it is also a Friday deploy that strangers can see.",
    },
    {
      question: "Which one gives me SPF and DMARC results?",
      answer:
        "The AWS side computes SPF, DKIM, DMARC, spam and virus verdicts before your code runs and passes them to the handler, so refusing a message that failed DMARC for your own domain is a conditional rather than a project. The Worker route exposes headers and expects you to interpret them, which is more control and more surface to get subtly wrong. If your inbound feature makes any trust decision at all — acting on a reply, accepting a command, matching a sender to an account — this dimension matters more than cost.",
    },
    {
      question: "Can I migrate an inbound pipeline without losing mail?",
      answer:
        "Not cleanly with a single MX switch, because during propagation some senders will resolve the old records and some the new. The approach that works is to stand up the new path on a subdomain first, prove the handler against real mail from several providers, then change MX and keep the old path alive and monitored for at least a day afterwards. Keep both sets of raw messages for that period so anything that lands on the wrong side can still be reprocessed rather than reconstructed from a log line.",
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
const AMAZON_SES_VS_SENDGRID: VersusPage = {
  slug: "amazon-ses-vs-sendgrid",
  a: "amazon-ses",
  b: "sendgrid",
  title: "Amazon SES vs SendGrid",
  description:
    "SendGrid sells a company one vendor relationship covering API, SMTP relay, marketing and a procurement contact. SES sells an endpoint. The question is not which delivers better, it is how much of that relationship you actually consume.",
  search: {
    primaryQuery: "is amazon ses cheaper than sendgrid",
    secondaryQueries: [
      "what does sendgrid do that amazon ses cannot",
      "sendgrid free tier retired replacement",
      "sendgrid smtp relay versus ses smtp endpoint",
      "aws support plan cost when running ses",
      "migrating sendgrid dynamic templates to ses",
      "is there a subuser equivalent in amazon ses",
      "sendgrid event webhook compared to ses notifications",
    ],
    rationale:
      "Everyone answering this compares a plan price to a per-thousand rate and stops. The costs that decide it in practice — an AWS support plan you did not previously need on one side, a marketing plan sold separately on the other — appear on neither pricing page next to the number people quote.",
  },
  intro:
    "SendGrid is the email vendor most teams tried first, and the one an unusual number are quietly costing out an exit from. That is not because it delivers badly. It is because it is sold as a company-wide relationship — relay for the systems nobody owns, a marketing console for people who do not write code, a procurement contact, a certification pack — and a team that only sends application email from one codebase is paying for the whole relationship to use a tenth of it. SES is the other extreme: an endpoint and a bill, with everything above it left to you.",
  dimensions: [
    {
      heading: "What the first afternoon looks like",
      a: "You create an IAM policy, verify a domain with three DKIM records, pick a region and call a send API. There is a console, but it exists to manage identities and quotas rather than to look at mail, and nothing in it answers did message X reach the recipient. Every part of an email vendor a non-engineer would recognise is absent by design, and you will either build it or go without it.",
      b: "You get an account, an API key, SMTP credentials, a template editor, a suppression manager, an activity feed and a catalogue of integrations for platforms you have not thought about yet. The breadth is the product. It also means the first afternoon involves choosing between four ways to do the same thing, and the default for most teams ends up being whichever one the documentation opened on.",
    },
    {
      heading: "Neither one still has the free tier people remember",
      a: "The old arrangement where mail sent from EC2 was effectively free is gone, and so is the assumption behind a great many tutorials. New accounts now land on a metered plan rather than the flat per-message rate, plans are scoped per account and per region, and the à la carte rate is something you select rather than something you are given. It is still the cheapest credible option at volume by a wide margin — just not free, and not what a 2021 blog post describes.",
      b: "The permanent free tier was retired in May 2025 and replaced by a time-boxed trial at a low daily cap. This matters more than it sounds: a large number of side projects, internal tools and staging environments were quietly running on that tier, and every one of them became a billing decision on a deadline. If your reason for being on SendGrid was that it cost nothing, that reason has expired.",
    },
    {
      heading: "SMTP relay, and the systems nobody is allowed to rewrite",
      a: "SES speaks SMTP too, with a per-region endpoint and credentials derived from an IAM user through a conversion step. It works, and it is the path a lot of legacy traffic takes. The rough edges are real: credentials are an IAM artefact so rotating them is an IAM change rather than a button, the endpoint is region-specific so a failover plan has to name a second one, and appliances with opinionated TLS behaviour occasionally need a port argued over.",
      b: "This is SendGrid's most under-discussed strength. A decade of being the default relay means there is a documented path for WordPress, for Jira, for a Salesforce org, for the CI system and for the warehouse printer, usually written by the other vendor rather than by SendGrid. When the question is how do we get mail out of a system we are not allowed to modify, breadth of prior art is worth more than unit price.",
    },
    {
      heading: "The marketing half, which is a separate purchase",
      a: "SES has no equivalent and does not pretend to. There are no campaigns, no segments, no audience, no visual builder and no report a marketer would open. Teams that need that alongside SES run a second tool for it, which is a coherent architecture — but it is two vendors, two suppression concepts and two answers to the question of who unsubscribed.",
      b: "SendGrid has a real marketing product with lists, segments, a drag-and-drop designer and campaign stats. The part that surprises people at renewal is that it is priced as its own plan rather than bundled into the sending tier, so the invoice that looked like one number becomes two. The upside is genuine: the marketing side and the transactional side share a suppression list and a sending reputation, which is exactly the reconciliation problem the two-vendor architecture creates.",
    },
    {
      heading: "Getting cut off, and who you talk to when it happens",
      a: "AWS will pause sending on an account whose bounce or complaint rate crosses published thresholds, and it is not gentle about it. The difference is that the thresholds are documented, the metrics that lead to them are in your own console and your own CloudWatch, and you can watch the number climb for a week before anything happens. Nothing about it is a surprise unless you never built the alert.",
      b: "Abrupt suspension is the single most common theme in SendGrid's public reviews, and the accounts describing it are usually not sending anything abusive — a traffic spike, a new domain, an unfamiliar pattern. The compliance team operates on its own schedule and the first-line support tier does not overrule it. If your business stops when mail stops, the operational question is not how good is delivery, it is how long is the phone call.",
    },
    {
      heading: "Support is a line item on one side and a plan on the other",
      a: "Basic AWS support gets you documentation and forums. A human who will look at your SES account is a paid support plan sitting on top of the sending bill, and for a small team that plan can cost several multiples of the mail itself. This is the cost most SES comparisons omit, and leaving it out is how a cheap-on-paper migration ends up merely competitive.",
      b: "Support is included in the plan, with the tier you are on deciding the queue you sit in. Response latency is the other recurring complaint in its reviews, so included is not the same as fast, but there is a ticket system, a named severity scale and no additional purchase required to open one. For a team without an AWS account manager already, that is a genuine difference rather than a marketing bullet.",
    },
    {
      heading: "Procurement, paperwork and the contract you already signed",
      a: "If the company already runs on AWS, SES arrives under an agreement legal has read, on an invoice finance already reconciles, inside a compliance boundary the security team has already assessed. Adding it is a configuration change rather than a vendor onboarding. That is not a small thing in a regulated shop, where the cost of a new supplier is measured in weeks of questionnaire rather than dollars.",
      b: "SendGrid is a new vendor, with a new security review, a new data processing agreement and a new annual renewal. Twilio maintains the certification pack that makes this survivable and enterprise buyers do get through it routinely. But it is a process with a calendar attached, and a team that discovers it two weeks before launch is going to miss the launch.",
    },
    {
      heading: "What the invoice is actually shaped like",
      a: "Per message, with no platform fee and no plan to outgrow, billed by AWS alongside everything else. The complications are the ones AWS complications always are: the plan is per account and per region, so a second region is a second decision, and dedicated addresses are a separate line. Cost scales linearly and predictably, which is precisely why large senders end up here.",
      b: "A sending plan, plus a marketing plan if you use that side, plus dedicated IP charges above a certain tier. Each of those is predictable on its own and the total is the thing people underestimate. The crossover against SES is not close at high volume, and it is genuinely arguable at low volume once an AWS support plan and a week of engineering are in the comparison.",
    },
  ],
  pickA: [
    "The company already runs on AWS, so SES is a configuration change inside an existing contract rather than a supplier onboarding with a security questionnaire attached.",
    "Volume is high enough that a per-thousand rate beats a plan ladder even after you price an AWS support plan and the engineering time to build a console.",
    "You need delivery events in your own warehouse on your own retention schedule, for an audit trail or a dispute process rather than for debugging.",
    "Nobody at the company needs a visual campaign builder, because nothing about SES will ever provide one.",
  ],
  pickB: [
    "Mail has to leave systems you do not control — a CRM, a ticketing tool, an appliance — and a documented relay path for each of them is worth more than the unit price.",
    "A marketing team and an engineering team both need to send from the same domain and you would rather they shared one suppression list than reconciled two.",
    "You need a support ticket to be included rather than purchased, and an enterprise certification pack that a procurement team can read in one sitting.",
    "Volume is modest and stable, so the plan price is noise against the engineering cost of building what SES omits.",
  ],
  prosA: [
    "Metered per message with no platform fee and no tier to outgrow, arriving on an invoice finance already reconciles if the company is on AWS — which turns adding email into a configuration change rather than a supplier onboarding.",
    "The sending identity, the quota and the accumulated standing sit in an account you keep, so replacing the tooling above them later is a code change rather than a warm-up you have to serve a second time.",
    "The thresholds AWS enforces against are published and the metrics that approach them are in your own CloudWatch, so the enforcement that stops sending is one a single alarm gives you a week of notice on.",
    "Choosing a jurisdiction is a per-account setting rather than a sales conversation, which makes a residency clause something an engineer satisfies in an afternoon.",
  ],
  consA: [
    "Nothing above the send call exists, and a half-built replacement is worse than none: the event consumer that captures deliveries but silently drops complaints looks like it is working right up until AWS pauses you.",
    "Getting a human to look at your account means buying an AWS support plan on top of the sending bill, and for a small team that plan is several multiples of the mail it protects.",
    "There is no campaign product and there is not going to be one, so the marketing team's requirements become a second vendor, a second consent record and a second answer to who opted out.",
    "A new account starts in a sandbox that only delivers to addresses you verified, and leaving it is an application a person at AWS reads on their timetable rather than yours.",
  ],
  prosB: [
    "Fifteen years as the industry default relay means the instructions for pointing your CRM, your ticketing tool or a warehouse appliance at it already exist, usually written by that system's own vendor rather than by SendGrid.",
    "Suppression management, an activity feed, a template editor and campaign tooling are all there on day one, so the first afternoon ends with an email operation instead of a backlog of things to build.",
    "A support ticket is included in the plan rather than purchased as a separate contract, with a defined severity scale and a queue that exists before you need it.",
    "Campaign traffic and application traffic share one suppression list and one standing with the mailbox providers, which is exactly the reconciliation nobody performs when those two live at different vendors.",
  ],
  consB: [
    "The permanent free allowance ended in May 2025 and became a time-boxed trial, so every staging environment and internal tool quietly parked there turned into a billing decision with a deadline attached.",
    "Marketing Campaigns is metered as its own plan rather than folded into the sending tier, so a cost model drawn from the sending price alone will be short by an entire line.",
    "Being cut off without notice is the theme that dominates its public reviews, and the compliance function that does it is not reachable through the first-line queue you would be escalating in.",
    "It is a new supplier: a security review, a data processing agreement and an annual renewal, which in a regulated shop is weeks of questionnaire that nobody put on the launch plan.",
  ],
  migrationChecklist: [
    "Apply for SES production access before writing a line of integration code. The form asks how you collect addresses and how you process bounces, a person reads the answer, and a vague one buys a round of follow-up questions rather than a refusal. This is the step that moves launch dates.",
    "Verify the sending domains in SES and publish its DKIM records alongside SendGrid's rather than instead of them. Both sets coexist happily, and removing the incumbent's records early is how a rollback quietly stops being available halfway through the cutover.",
    "Export all four of SendGrid's suppression collections — global unsubscribes, bounces, spam reports and blocks — and load every one into the SES account-level suppression list. They live behind separate endpoints, and a team that exports only the unsubscribe group will mail people who previously filed a complaint.",
    "Rewrite anything built on SendGrid dynamic templates. The handlebars-style substitution is evaluated inside SendGrid and the SES template API is not a comparable destination, so most teams end up rendering finished HTML in the application and handing SES a string. Plan for that rather than for a translation.",
    "Replace the event consumer rather than reconfiguring it. SendGrid posts a batched array to a single URL; SES publishes individual notifications through SNS, EventBridge or Firehose under different field names, so the webhook handler is new code and the delivery-status mapping is a decision somebody has to make.",
    "Choose where the campaign mail is going before the transactional cutover, not after. SES will not take it, and a marketing send due the week after the switch is the most reliable way to get a migration reversed by somebody who was not in the planning meeting.",
    "Convert the SMTP senders one system at a time. SES credentials are derived from an IAM user through a conversion step instead of being issued directly, and the endpoint belongs to one region, so a failover story has to name a second. Budget a day for each appliance with opinions about TLS.",
    "Treat the dedicated IP as unrecoverable. The address and everything the mailbox providers learned about it stay with SendGrid, so raise volume on the new identity across several weeks, leading with the recipients who open most, and keep the old path live until placement data says you can stop paying for it.",
  ],
  buyingQuestions: [
    "Which AWS support plan would we genuinely need, and what does it add to the sending bill — because on the default tier a mail problem gets you documentation and a forum thread?",
    "Does the SendGrid quote in front of us cover Marketing Campaigns, or is that a second plan on a second meter that nobody added to the spreadsheet?",
    "How many of our senders are systems we are not permitted to modify, and does a documented relay path exist for each of them on the side we are proposing to move to?",
    "On the morning sending stops, who do we contact, what response time are we contractually owed, and does that commitment exist on the plan we are actually buying rather than the one above it?",
    "Where do delivery events land, how long are they kept, and could we answer a billing dispute about a message sent eleven months ago without asking the vendor for a favour?",
    "Who inside the company needs a visual campaign builder, and has anybody asked them — because one side of this comparison has no answer and is not building one?",
    "How many calendar weeks does a new-supplier security review take here, and is that shorter or longer than waiting on an AWS production-access decision?",
  ],
  thirdOption:
    "The specific trap on this pair is that the two ends are so far apart. A team leaving SendGrid over price is usually not leaving over the product, and discovers at month two that it has traded an invoice for a backlog: an event consumer, a suppression view, a template pipeline, somewhere to look up a message. That is the gap a platform layer over your own SES account fills, and Wraps is one way to buy it while the account, the reputation and the sending data stay in AWS you control. The honest costs: you still need an AWS account and SES production access, which is an AWS approval on AWS's timetable and not ours to grant, our SDKs cover TypeScript and Python only, contacts and templates live in our database rather than yours, and we are not SOC 2 certified — so a procurement team that chose SendGrid for the certification pack has not been answered by this.",
  faqs: [
    {
      question: "Is SendGrid built on Amazon SES?",
      answer:
        "No, and this is the main place the SES comparison differs from the one people make with Resend. SendGrid operates its own mail infrastructure and has done since well before it was acquired by Twilio, so moving between the two genuinely changes the network your mail leaves from, the IP pools it uses and the relationships behind them. Arguments about deliverability between these two are therefore about real differences, not about two accounts on the same substrate.",
    },
    {
      question: "How much cheaper is SES really, once everything is counted?",
      answer:
        "At high volume, several multiples, and the gap widens as you grow because one side is metered and the other is a ladder. At low volume the honest answer is that it depends on two costs nobody puts on the slide: an AWS support plan if you want a human to answer, and the engineering weeks to build the console, event pipeline and suppression tooling that arrive free with SendGrid. Below roughly a few hundred thousand messages a month, those two can eat the entire saving.",
    },
    {
      question: "Can I keep SendGrid's SMTP integrations if I move to SES?",
      answer:
        "Usually yes, because most of those integrations only want a host, a port and a username and password. SES provides all four. The work is in the details: SMTP credentials are generated from an IAM user rather than issued directly, the endpoint is specific to one region so a failover plan has to name a second, and a few older appliances are fussy about TLS negotiation on the submission port. Budget a day per awkward system, not a week.",
    },
    {
      question: "What happens to my marketing emails if I switch to SES?",
      answer:
        "They need a home, because SES will not provide one. The common patterns are a dedicated marketing tool alongside SES, or a platform layer that adds campaigns on top of it. What you should not do is have a developer rebuild segmentation and a visual builder, because that project has a well-documented habit of consuming a quarter and producing something the marketing team refuses to use.",
    },
    {
      question: "Will my deliverability drop if I leave SendGrid?",
      answer:
        "For a while, yes, and not because SES is worse. You would be a new sending identity with no history, which every mailbox provider treats cautiously until it has evidence. Ramp volume over a few weeks, start with your most engaged recipients, and have DKIM, SPF and DMARC aligned before the first message rather than after the first spam-folder complaint. Teams that move a large list in one evening are the ones who write the blog posts about how SES has bad deliverability.",
    },
    {
      question: "Does AWS suspend accounts the way SendGrid does?",
      answer:
        "AWS will pause sending, and it does so on published bounce and complaint thresholds you can watch approach in your own metrics. That is the substantive difference: the mechanism is documented and the leading indicator is visible to you, so a team with a single CloudWatch alarm gets a week of warning. Whether the recovery conversation is faster depends entirely on whether you are paying for a support plan, which is the cost that keeps reappearing in this comparison.",
    },
    {
      question: "Does SES have anything equivalent to SendGrid subusers?",
      answer:
        "Not as one feature. The pieces exist scattered across AWS primitives — separate verified identities, separate configuration sets, separate IAM principals, separate dedicated addresses — and assembling them into per-tenant credentials with per-tenant reporting and per-tenant suppression is a project rather than a setting. Agencies and platforms sending on behalf of customers should price that project honestly, because it is the single largest thing SendGrid gives you that SES does not, and it is considerably more work than the send path it sits around.",
    },
    {
      question:
        "Can we run both during the migration, and how long should the overlap be?",
      answer:
        "Yes, and you should. Put each provider on its own subdomain so the DKIM keys, the reputation and the DMARC alignment stay independent, then move one traffic class at a time and leave the highest-stakes mail until last. The overlap is dictated by placement data rather than by engineering progress: you are watching complaint and bounce rates on the new identity climb into normal range, which usually takes several weeks at meaningful volume. Budget for two invoices during that period explicitly, because the alternative is discovering it at the end of the month.",
    },
    {
      question: "Do SendGrid's event webhooks map cleanly onto SES events?",
      answer:
        "No, and assuming they do is a common way to lose a week. SendGrid posts a batch of events as a JSON array to one endpoint you nominate. SES emits individual notifications through SNS, EventBridge or Firehose, with a different envelope, different field names and a different set of event types — and you choose the destination and the delivery guarantees yourself. The consumer is new code, and somebody has to decide explicitly how the two vocabularies line up before the reporting built on the old shape can be trusted again.",
    },
  ],
};

const AMAZON_SES_VS_POSTMARK: VersusPage = {
  slug: "amazon-ses-vs-postmark",
  a: "amazon-ses",
  b: "postmark",
  title: "Amazon SES vs Postmark",
  description:
    "Postmark is the most deliberately narrow product in transactional email and SES is the least opinionated infrastructure in it. Comparing them on price misses what each is actually selling.",
  search: {
    primaryQuery: "does postmark deliver better than amazon ses",
    secondaryQueries: [
      "postmark message streams explained",
      "how long does postmark keep message content",
      "is postmark worth the price over raw ses",
      "transactional email that never shares a pool with marketing",
      "exporting postmark suppressions before leaving",
      "replacing postmark activity search on aws",
      "what to do with postmark layouts when moving to ses",
    ],
    rationale:
      "The interesting claim on this pair is not the price gap, which is obvious, but whether a managed sender's inbox placement is structurally better than a well-run account of your own. Nobody neutral writes that down, because both parties have an interest in the answer.",
  },
  intro:
    "Postmark has spent over a decade refusing to become a platform. It sends transactional email, keeps the marketing mail off the same pipes on purpose, stores what it sent so you can read it back, and answers support tickets with people who know how mail works. SES has spent the same decade being infrastructure: enormous, cheap, indifferent, and entirely willing to let you make a mess. The choice is not between a good product and a bad one. It is between buying a mail operation and running one.",
  dimensions: [
    {
      heading: "Separating transactional mail from everything else",
      a: "SES gives you configuration sets and verified identities, which are the raw materials for the same separation, and nothing that enforces it. A team that puts its password resets and its product newsletter behind one identity with one set of defaults has done something SES considers perfectly reasonable, right up until a campaign's complaint rate drags the account reputation down and the resets start landing in spam. The separation is available. Nothing reminds you to build it.",
      b: "Postmark makes it structural. Transactional and broadcast mail live in separate streams that do not share reputation, and the product will argue with you if you try to push bulk mail down the transactional one. That is an opinion enforced in software, and it removes the single most common self-inflicted deliverability injury in this category — which is the honest version of why its placement reputation is what it is.",
    },
    {
      heading: "Reading back what you actually sent",
      a: "SES stores nothing. Deliveries, bounces, complaints, opens and clicks can be published to SNS, EventBridge or Firehose, but only if you configure it, and the message body is never retained anywhere by AWS. When support asks what did the email say, the answer comes from your own rendering code and your own archive, both of which you built. The archive ceiling for stored mail, where you enable it, is permanent rather than a rolling window — but again, only once you have built toward it.",
      b: "Postmark keeps the rendered message, not just the event, and the activity view will show you the headers, the HTML and the delivery trace for a specific recipient. This is the feature that quietly justifies the price for support-heavy products: a customer says they never got it, and somebody who is not an engineer resolves the question in under a minute without opening a log query.",
    },
    {
      heading:
        "Who owns the reputation, and what that means when it goes wrong",
      a: "You do, alone. Your bounce rate, your complaint rate, your account standing, visible in your own console and nobody else's problem. The upside is isolation: a neighbour's bad month cannot touch you. The downside arrives the first time something does go wrong, because there is no one whose job it is to notice. Diagnosing a placement problem on SES means reading your own DMARC reports, your own engagement data and a postmaster tool, and the tooling to do that is not supplied.",
      b: "Postmark's, managed by people who do it professionally and shared across its transactional pool. Their incentive to keep it clean is direct and their willingness to remove customers who damage it is well established. What you are buying is not a secret technique — it is diligence performed continuously by somebody else, plus a support channel staffed by people who can read a bounce trace.",
    },
    {
      heading: "The support conversation",
      a: "AWS support is a separate purchase, and on the free tier it is documentation and forums. For a mail problem specifically this is worse than it sounds, because the failure modes are subtle — an alignment mismatch, a Gmail policy change, a reputation dip with no obvious cause — and the first-line response to a paid ticket will not be from a deliverability specialist. Most SES teams end up self-sufficient by necessity rather than choice.",
      b: "Support is the product as much as the API is. Tickets go to people who have operated mail infrastructure, the answers address the actual question, and a placement problem gets a real investigation rather than a link to a runbook. Teams describe this as the reason they stay after the invoice stops being the cheapest option, which is an unusual thing to be true of a support department.",
    },
    {
      heading: "Where the economics invert, and how sharply",
      a: "Metered per message with no platform fee, and cheap enough at any meaningful volume that the comparison stops being close. The subtleties are that new accounts land on a metered plan rather than the old flat rate, and that the plan is scoped per account and per region. Nothing about the shape changes as you grow, which is the entire argument for it: the bill is a straight line with a small slope.",
      b: "A plan with an included allowance and an overage rate that falls as the plan rises. At ten thousand messages a month the difference against SES is small enough that it should not decide anything. At half a million a month the same comparison is a substantial recurring number, and the early-2026 repricing means an account opened years ago is not on the figures a new one is quoted. Check what you are actually on before modelling anything.",
    },
    {
      heading: "Templates and who is allowed to touch them",
      a: "SES has a template API with token substitution and nobody likes it. The prevailing pattern is to render HTML inside the application and hand SES a finished string, which makes templates part of the codebase — reviewable, versioned and portable, and also invisible to anyone who cannot open a pull request. A preview environment for non-engineers is another thing you build.",
      b: "Postmark ships a template editor with layouts, a set of well-tested starting points, and a preview that renders against real clients. It is deliberately not a marketing designer and it is not trying to be one. For a product with twenty transactional messages that occasionally need a copy change, it is close to exactly the right size, and the copy change does not need a deploy.",
    },
    {
      heading: "What leaving costs in each direction",
      a: "Leaving SES is mostly a code change, because the verified domains and the reputation are attached to an account you keep. You can run a second provider from a separate subdomain and move traffic class by class with no drama. That reversibility is a real asset and it is worth more than it looks on the day you sign up.",
      b: "Leaving Postmark means re-verifying elsewhere and starting reputation from nothing, because the pool you were delivering from was never yours. The API surface is small so the code is a day, but the stored history does not travel and the placement you enjoyed was a property of their operation rather than of your domain. Plan the move as a ramp, not a cutover.",
    },
  ],
  pickA: [
    "Volume is high enough that the difference is a headcount rather than a rounding error, and somebody on the team genuinely wants to own mail operations.",
    "Message content and delivery events have to live in storage you control, on a retention policy you set, because of an audit or a regulator rather than a debugging habit.",
    "You are already inside AWS and want mail under the same account, the same IAM model and the same invoice as everything else.",
    "You need throughput that rises on request rather than a fixed included allowance, because the traffic is batch-shaped.",
  ],
  pickB: [
    "Inbox placement for password resets and receipts is a business risk rather than an engineering preference, and you would rather rent diligence than perform it.",
    "Support agents need to answer did this customer get the email without escalating to an engineer, using the rendered message rather than a log line.",
    "You want the transactional and broadcast separation enforced by the product, because in practice nobody on the team will enforce it by convention.",
    "Volume is in the tens of thousands a month, where the price difference does not fund the operational work that SES requires.",
  ],
  prosA: [
    "Metered with no included allowance to price around, which past the low hundreds of thousands a month stops being a close comparison and becomes the reason large senders are here at all.",
    "Identities, configuration sets and dedicated addresses are raw materials rather than an opinion, so a traffic split nobody else anticipated — per brand, per tenant, per regulatory boundary — is something you can actually construct.",
    "Where you configure archiving, the ceiling is permanent rather than a rolling window, which is the difference between a retention policy a regulator accepts and a debugging convenience.",
    "Leaving is about as cheap as it gets in this field: the verified domains and the standing behind them live in an account you keep, so a second provider runs from a sibling subdomain and takes traffic at whatever pace you choose.",
  ],
  consA: [
    "Nothing stops you putting a campaign and a password reset behind the same identity, so the most common self-inflicted placement injury in the category is the default behaviour and no part of the console will mention it.",
    "The rendered message is never kept, so what did we actually send them is answerable only from an archive you built in advance — and it is not a question you can answer retroactively.",
    "Diagnosing a placement problem means reading DMARC aggregate reports, engagement data and postmaster tooling, none of which AWS supplies and all of which somebody on the team has to learn on a bad week.",
    "First-line support is not staffed by deliverability specialists, and no support plan reliably converts a mail question into a conversation with somebody who has operated mail.",
  ],
  prosB: [
    "The split between bulk and transactional traffic is enforced by the software rather than left to a convention the team will abandon in eighteen months, which removes the failure that puts receipts in the spam folder the week after a campaign.",
    "The activity view holds the rendered body and the delivery trace for a named recipient, so a support agent closes the did-it-arrive ticket in under a minute without escalating to engineering or opening a query console.",
    "Tickets are answered by people who have run mail infrastructure, and a placement question produces an investigation instead of a runbook link — which is most of what the per-message premium is actually buying.",
    "Templates have layouts, versioning inside the product and a preview rendered against real clients, so changing the wording of a receipt is not a deploy.",
  ],
  consB: [
    "The standing you deliver on belongs to their pool, so leaving means verifying elsewhere and earning reputation from zero while the stored history stays behind on their side of the line.",
    "The plan ladder crosses a metered rate somewhere in the low hundreds of thousands a month, and the early-2026 repricing means a long-standing account is not on the figures a new one is quoted — confirm which you are on before modelling anything.",
    "No segmentation engine, no visual campaign designer, no automation, and a decade of the company declining to build them, which makes lifecycle marketing a second product and a second consent record by design.",
    "Retention is a window rather than a policy. The tooling inside it is unusually good and there is nothing whatsoever outside it.",
  ],
  migrationChecklist: [
    "Open the SES production-access application first, and answer it the way you would answer an onboarding questionnaire rather than a form: how addresses are collected, how bounces and complaints are processed, what the mail is for. The decision is on AWS's calendar, and this is the step most likely to move the date.",
    "Map the message streams onto separate verified subdomains, not just onto configuration sets. The streams were performing reputational isolation; configuration sets only separate event routing. Reproducing what you had means distinct sending identities, and above a certain volume distinct dedicated addresses behind them.",
    "Export the suppression list from every stream rather than from the transactional one. Postmark keeps suppressions per stream, so a single export is a partial export, and the broadcast stream is precisely where the complaints you least want to repeat were recorded.",
    "Pull the activity history you still care about while the account is open. Postmark holds the rendered message and AWS will hold nothing, so anything not exported is the last copy of what you sent. Teams generally discover this during the dispute that needed it rather than during the move.",
    "Re-implement the templates rather than translating them. Layouts and the substitution syntax are evaluated inside Postmark, and the SES template API is not somewhere you want them to land. Rendering in the application and sending finished HTML is where these migrations end up anyway, so go straight there.",
    "Rebuild the support workflow before the cutover, because the activity search an agent was using is the feature the invoice was paying for. On the other side that is a pipeline — configuration set, event destination, somewhere to store it, an index, and an interface a non-engineer can use — and a half-finished version is worse than being honest about not having one.",
    "Rewrite the event consumers. Postmark posts one JSON object per event to a URL nominated per stream; SES publishes through SNS, EventBridge or Firehose with a different envelope, and the two vocabularies of bounce subtype do not line up, so the reporting built on the old shape needs re-deriving before anyone trusts it.",
    "Ramp instead of cutting over. You are a sending identity with no history and the placement you enjoyed was a property of somebody else's operation, so keep receipts and password resets on the proven path while the low-stakes traffic proves itself clean for several weeks.",
  ],
  buyingQuestions: [
    "On the day placement drops, who on our team diagnoses it, with which data, and has that person read a DMARC aggregate report before?",
    "How often does support need the content of a specific message rather than its status, and what happens to those tickets when only the status is available?",
    "At the volume we actually send, does the price gap fund the person who would own mail operations, or is it a saving that reappears as a salary line nobody wrote down?",
    "Is our retention requirement a debugging habit or a written obligation — and if it is written, how many months, and who audits it?",
    "Who sends the next marketing campaign, from which domain, and is there anything in the proposed arrangement that stops it sharing standing with the password resets?",
    "If a plan price has been quoted to us, is it the current list or the terms an existing account happens to be grandfathered onto?",
    "How many weeks would we be paying both vendors while the new identity warms, and has that overlap been budgeted rather than assumed away?",
  ],
  thirdOption:
    "This is the pair where the crossover is most often mis-modelled. Teams look at the invoice at half a million messages, decide SES wins, and quietly commit to rebuilding the activity view, the stored message body and the support workflow that made Postmark worth paying for — which is the actual product, not the sending. If the thing you want is SES economics with a console that a support agent can use, a platform over your own AWS account is the shape that gives you both, and Wraps is one implementation of it. What it does not give you is Postmark's deliverability operation: you still need an AWS account and SES production access, an approval on AWS's timetable rather than ours, and the reputation that follows is yours to earn and yours to lose. Contacts and templates sit in our database rather than yours, our SDKs are TypeScript and Python only, and we are not SOC 2 certified.",
  faqs: [
    {
      question:
        "Is Postmark's deliverability actually better, or is that marketing?",
      answer:
        "It is real, and the mechanism is less mysterious than the marketing implies. Postmark keeps bulk mail off the transactional pool by design, removes customers who damage it, and monitors placement continuously with staff who know what they are looking at. A well-run SES account can reach the same place; the difference is that on SES nobody performs those three activities unless you hire someone to. You are buying operational discipline rather than a delivery secret.",
    },
    {
      question: "Does SES keep a copy of the emails I send?",
      answer:
        "Not by default, and this surprises people who assume a mail service is also a mail archive. Events can be published to SNS, EventBridge or Firehose and from there into anything you like, but the rendered message body is not retained by AWS unless you deliberately configure archiving. If you want to answer what did that email say six months ago, that is a system you build, and building it after you need it is not possible.",
    },
    {
      question: "What are message streams and does SES have an equivalent?",
      answer:
        "Streams are Postmark's enforced split between transactional and broadcast mail, so the two do not share sending reputation. SES has the raw materials — separate identities, separate configuration sets, separate dedicated addresses — and no enforcement whatsoever. The equivalent exists if you build and maintain it. The reason it matters is that the most common cause of transactional mail landing in spam is a campaign sent from the same reputation the week before.",
    },
    {
      question: "At what volume does SES clearly win on cost?",
      answer:
        "Somewhere in the low hundreds of thousands a month the gap becomes large enough to fund real engineering, and past that it is not arguable. Below that, run the comparison including an AWS support plan and a realistic estimate of the operational work, because a great many SES migrations that looked like a saving turned out to be a transfer of cost from a vendor invoice to a salary line nobody wrote down.",
    },
    {
      question: "Can I use Postmark for transactional and SES for bulk?",
      answer:
        "Yes, and it is a more common architecture than either vendor advertises. Use separate subdomains so DKIM keys, reputation and DMARC alignment stay independent, and keep the highest-stakes messages on the path with the best placement. The cost is two suppression lists, two sets of webhooks and a reconciliation nobody performs until a customer who unsubscribed receives a newsletter and complains.",
    },
    {
      question: "How much of my Postmark data can I actually take with me?",
      answer:
        "Suppressions and templates come out cleanly, per stream, and are the parts everybody remembers. The rendered message archive is the part people forget, and it is the one with no equivalent waiting on the other side, so whatever you do not export is simply the last copy. Delivery events export within the retention window only. Plan the extraction as a task with an owner and a deadline before the account is cancelled, because a closed account is not a slow export — it is no export.",
    },
    {
      question:
        "What does a support agent use on SES instead of the activity view?",
      answer:
        "Whatever you built. The usual shape is a configuration set publishing events to EventBridge or Firehose, landing in a store, indexed, behind an interface that accepts an email address and a date range. None of it is difficult and all of it is real work, and the version that shows delivery events but not the message body only answers half the tickets. Decide before the migration whether a support agent is a user of this system, because retrofitting them into it later is considerably more expensive than designing for them once.",
    },
    {
      question: "Does SES receive inbound mail the way Postmark does?",
      answer:
        "Both can receive, and they hand you very different things. Postmark's inbound stream parses the message and posts structured fields to your webhook. SES receipt rules, available in a subset of regions, can drop the raw message into S3, invoke a Lambda, publish to SNS or reject it — and the parsing, the threading and the attachment handling are yours to write. If replies are a feature of your product rather than an afterthought, that difference is a subsystem rather than a configuration line.",
    },
    {
      question: "Is a dedicated IP worth buying on either side?",
      answer:
        "Only above a volume floor that both vendors will tell you about if you ask, and for the same underlying reason: an address needs consistent traffic to hold a reputation, and a dedicated one sending sporadically performs worse than the shared pool it left. On Postmark it is gated behind the higher plans with a monthly minimum attached. On SES you can provision one at any volume, including a managed option that runs the warm-up schedule, which means it is easier to buy and just as easy to buy too early.",
    },
  ],
};

const AMAZON_SES_VS_MAILGUN: VersusPage = {
  slug: "amazon-ses-vs-mailgun",
  a: "amazon-ses",
  b: "mailgun",
  title: "Amazon SES vs Mailgun",
  description:
    "Mailgun is the closest thing on the market to SES with the missing parts filled in — routing, validation, searchable logs. That makes it the most direct comparison SES has, and the one where pricing stability matters most.",
  search: {
    primaryQuery: "what mailgun adds on top of amazon ses",
    secondaryQueries: [
      "mailgun inbound routes versus ses receipt rules",
      "email address validation api alternatives",
      "mailgun flex plan closed to new signups",
      "searchable email logs without building a pipeline",
      "turning mailgun routes into ses receipt rules",
      "replacing mailgun validation after a migration",
      "mailgun webhook signing versus sns notifications",
    ],
    rationale:
      "Mailgun sits closer to SES on the stack than any other hosted vendor, so the comparison turns on specific capabilities rather than on philosophy — and on a repricing in December 2025 that existing customers noticed and prospective ones have not heard about.",
  },
  intro:
    "Most comparisons in this category pit a primitive against a product with a completely different shape. This one does not. Mailgun is a sending API with inbound routing, address validation and log search bolted on, which is recognisably the list of things a team builds in its first year on SES. That makes the comparison unusually concrete: for each capability you can ask whether you would rather buy it or build it, and the answer differs per capability rather than being decided once by taste.",
  dimensions: [
    {
      heading: "Receiving mail, not just sending it",
      a: "SES can receive, in a subset of regions, through receipt rule sets that can drop a message into S3, invoke a Lambda, publish to SNS or bounce it. It is powerful and it is assembly. You get the raw MIME and everything after that — parsing, threading, attachment handling, deciding what a reply even is — is code you write, in a runtime you operate, with a rule set that is easy to misconfigure in ways that silently drop mail.",
      b: "Mailgun Routes are expression-based and match on recipient, sender or header, then forward to a URL, an address or a store. The parsed fields arrive already extracted, which removes the least interesting week of work in any inbound project. The constraint is that the parsing is theirs, so an unusual message shape is handled the way they decided, and a route that behaves oddly is a support ticket rather than a debugging session.",
    },
    {
      heading: "Address validation, which SES has no answer for at all",
      a: "There is nothing. SES will attempt delivery to whatever you hand it, and you discover the address was a typo when the bounce arrives — which is the expensive way to find out, because bounces are the metric AWS suspends accounts over. Teams on SES either accept a higher bounce rate on signup flows, or buy validation from a third vendor and wire it in, which is one more contract and one more integration.",
      b: "Validation is a first-class product with syntax checks, domain checks and mailbox-level verification, callable at signup rather than at send time. For any product with a self-serve registration form this is a directly measurable improvement to the number AWS would have suspended you over, and it is the single clearest example on this page of something worth buying rather than building.",
    },
    {
      heading: "Finding one message among millions",
      a: "SES has no log to search because SES stores no logs. You build the pipeline — configuration set event destination, a stream, somewhere to put it, an index, a query interface — and until all five exist, the answer to what happened to this message is unavailable. The pipeline is not hard. It is also not a weekend, and the half-finished version that captures deliveries but not complaints is worse than useless because it looks like it works.",
      b: "Log search is in the console on day one, with retention that lengthens as the plan does. You can filter by recipient, status and time, read the SMTP response the receiving server gave, and hand the result to a support agent. The trade is the one every hosted log makes: retention is a plan feature, the window is not long on the cheaper tiers, and the history is not yours to keep when you leave.",
    },
    {
      heading: "Price stability, and the December 2025 change",
      a: "AWS reprices SES rarely and moves in visible steps. The recent change worth knowing is that new accounts are defaulted to a metered plan rather than the old flat rate, and that plans are scoped per account and per region — but the per-message economics remain the reason large senders are here, and nothing about the pricing model punishes you for growing into it.",
      b: "The Flex plan closed to new signups in December 2025 and the legacy rate doubled. That is the part of this comparison nobody arrives knowing, and it is the strongest argument for owning the account rather than renting it: the price of a hosted plan is a decision the vendor makes on its own schedule, and the only response available to a customer is to migrate. Teams still on grandfathered terms should confirm what they are actually paying before modelling anything.",
    },
    {
      heading: "Dedicated addresses and warming",
      a: "SES offers dedicated IPs, including a managed option that handles the warm-up schedule, and standard ones you warm yourself. Because the account is yours, the warmed address stays yours across any tooling change above it — which is the piece people undervalue until they have spent six weeks warming something and then changed vendor.",
      b: "Dedicated addresses come included from the mid plans upward, with extra ones charged monthly. That bundling is genuinely convenient at the volume where a dedicated address starts making sense. It is also a plan feature, meaning a downgrade takes it away and a migration leaves it behind, and the warm-up you paid for in patience does not travel with you.",
    },
    {
      heading: "Regions, residency and where the mail physically is",
      a: "SES runs in a long list of AWS regions and the choice is yours per account, which makes an EU-only or a specific-jurisdiction deployment a configuration decision rather than a sales conversation. The caveat a European buyer will raise is ownership rather than geography, and it is a fair one: an EU region operated by a US company is not the same answer as an EU company, whatever the data map says.",
      b: "Mailgun offers a European region and has done for years, which covers the common GDPR requirement cleanly. The region is selected at domain level and the API endpoint differs, which is a small but real source of confusion for teams that verify a domain in one region and then call the other one for a week wondering why nothing works.",
    },
    {
      heading: "Who is actually behind each one",
      a: "AWS, with the stability and the indifference that implies. SES will not be discontinued, will not be acquired and will not change its API out from under you. It also will not call you, will not notice your problem and will not have an opinion about your sending practices until a threshold is crossed. For infrastructure, indifference is mostly a feature.",
      b: "Sinch, following an acquisition, alongside several other messaging brands. The product is mature and well documented, and the honest risk is the ordinary one for an acquired platform: investment follows the parent's priorities rather than yours, and the December repricing is the kind of event that follows from that. Suspensions also recur in its reviews, on the same pattern as the rest of the hosted field.",
    },
  ],
  pickA: [
    "You want the account, the reputation and the warmed addresses to belong to you, so that changing the tooling above them is never a migration.",
    "Volume is high enough that a metered rate versus a plan ladder is worth real engineering, and someone is willing to own the event pipeline.",
    "Inbound handling is genuinely unusual — custom parsing, odd attachment shapes, strict retention — and a vendor's parsed fields would not fit anyway.",
    "A vendor changing its price list is a risk you specifically want removed from the plan.",
  ],
  pickB: [
    "You need inbound routing and address validation now, and would rather buy two solved problems than spend a quarter building mediocre versions.",
    "Support agents need searchable logs with the receiving server's response visible, without a data pipeline existing first.",
    "A dedicated address bundled into a plan is more attractive than provisioning and warming one yourself.",
    "The team has no AWS presence and adding one for email alone is more organisational work than the saving justifies.",
  ],
  prosA: [
    "The price list belongs to a company that reprices rarely and in visible steps, which is the direct answer to watching a plan close to new signups and a legacy rate double while you hold no lever at all.",
    "A dedicated address you warmed stays yours through every change in the tooling above it, so six weeks of patient ramping is an investment rather than something you spend again at the next migration.",
    "Jurisdiction is an account-level choice from a long list of regions, and because the identity belongs to you it is a configuration decision rather than a per-domain setting with a second API hostname attached to it.",
    "It will not be discontinued, will not be acquired and will not change its API underneath you. For infrastructure, that indifference is the feature.",
  ],
  consA: [
    "There is no address validation of any kind, so the typo that would have been caught at the registration form instead becomes a bounce against the precise metric AWS uses to decide whether you keep sending.",
    "Inbound arrives as raw MIME behind a rule set that is easy to misconfigure into dropping mail silently, and parsing, threading, attachment handling and deciding what a reply even is are all yours to write and to maintain.",
    "There is no log to search because nothing is stored, and the five moving parts that fix that are routinely estimated as a weekend by people who have not built them.",
    "Nobody is watching the account on your behalf, so the first signal that something is wrong usually arrives as an enforcement rather than as a warning.",
  ],
  prosB: [
    "Routes match on recipient, sender or header and deliver already-extracted fields to your endpoint, which removes the least interesting week of work in any inbound project and removes it permanently.",
    "Validation is a real product — syntax, domain and mailbox-level, callable at the signup form rather than at send time — and it is the clearest case on this page of a capability worth buying rather than building.",
    "Log search exists in the console from the first day and shows the receiving server's own SMTP response, which is the field that settles an argument about whether a message was delivered or merely accepted.",
    "A dedicated address comes bundled from the middle plans upward, which is genuine convenience at exactly the volume where having one starts to make sense.",
  ],
  consB: [
    "Flex closed to new signups in December 2025 and the legacy pay-as-you-go rate doubled, which is a concrete demonstration that a hosted price is somebody else's decision and migration is the only response a customer has.",
    "Retention is a plan feature, so the searchable history shortens the moment you downgrade and none of it comes with you when you leave.",
    "The European region is chosen per domain and has its own API hostname, so verifying in one and calling the other produces a week of failures that the error messages do not explain.",
    "Investment now follows an acquiring parent's portfolio priorities rather than the sending product's, and a repricing is precisely the kind of event that follows from that.",
  ],
  migrationChecklist: [
    "Work out which region can receive before choosing where to send from. SES inbound exists in a subset of regions and need not be the region you send in, so an inbound requirement can quietly dictate the whole account layout, and discovering that after the identities are verified is a rebuild rather than a setting change.",
    "Open the production-access application early and write it as prose. It asks how addresses are collected and how bounces and complaints are processed; a person reads the answer, and the cases that take days are almost always the ones answered vaguely.",
    "Decide what replaces validation before the signup form loses it. The realistic options are a third-party validation API, a syntax and MX check of your own, or accepting a higher bounce rate — and the third is riskier than it sounds, because bounce rate is the number the new provider watches to decide whether you keep sending.",
    "Turn the Routes into receipt rules, then write the parser that Routes was. Mailgun hands your endpoint extracted fields; the replacement hands you raw MIME in object storage or a function invocation. Threading, attachments and what counts as a reply all become yours, and a misconfigured rule set drops mail with no error anywhere to notice.",
    "Stand the event pipeline up before the cutover rather than beside it. Configuration set, event destination, a stream, somewhere to keep it, an index, an interface — until all six exist, what happened to this message has no answer at all, and the partial build that records deliveries but not complaints is the dangerous one.",
    "Export suppressions and whatever searchable history still matters. Retention is a plan feature, so the window on your current tier is the whole of what you can take, and the console search that made a support agent self-sufficient is being replaced rather than moved.",
    "Replace the webhook verification as well as the payload handling. Mailgun signs its posts with a timestamp and token scheme your handler checks; the replacement delivers through SNS, EventBridge or Firehose, each with its own authentication model and envelope, so the security review is separate work from the field mapping.",
    "Warm a new dedicated address instead of expecting to keep the old one. The IP and everything the mailbox providers learned about it stay behind, and a managed warm-up option exists if you would rather not run the schedule by hand — but either way the unit is weeks, and the shared pool is the better place to be during them.",
  ],
  buyingQuestions: [
    "Does our product receive mail, and if it does, are we willing to own the parser — or is that a subsystem we have quietly been assuming somebody else maintains?",
    "What is the bounce rate on our signup traffic today, and what does it become if validation stops happening at the form?",
    "Who answers a support ticket about one specific message, and which interface are they using on the morning after the switch?",
    "How long is log retention on the exact plan being quoted, and what does extending it cost — because the tier's headline volume is not the number that decides this?",
    "If the price list moves next December the way it moved last December, what is our response, and how many weeks would executing it take?",
    "Does our residency requirement name a region, and does the inbound capability we need actually exist in the region that would satisfy it?",
    "What does a dedicated address cost on each side once the warm-up period is counted as a cost rather than as free waiting?",
  ],
  thirdOption:
    "Of every pair in this cluster, this is the one where the middle position is least hypothetical, because Mailgun's feature list is close to a specification for what teams build on top of SES. The reason to think about a platform over your own AWS account here is narrow and specific: it removes the December-2025 problem, where a vendor reprices and your only response is to migrate an account you never owned. Wraps is one way to take that shape. It does not match Mailgun feature for feature — there is no address validation product, and inbound is a thinner story. You will need an AWS account and SES production access, an approval AWS grants on its own timetable and not ours, our SDKs cover TypeScript and Python only, contacts and templates live in our database while sending data and delivery events stay in your AWS, and we are not SOC 2 certified.",
  faqs: [
    {
      question: "Is Mailgun built on Amazon SES?",
      answer:
        "No. Mailgun runs its own mail infrastructure and predates most of the vendors that do resell SES, so switching between these two genuinely changes the network, the IP pools and the sending relationships behind your mail. That is worth knowing because it makes deliverability differences between them real rather than an artefact of two accounts on the same substrate, which is the situation with several other hosted providers.",
    },
    {
      question: "Can SES receive inbound email?",
      answer:
        "Yes, in a subset of regions, through receipt rule sets that can store to S3, invoke a Lambda, publish to SNS or reject the message. What it does not do is parse. You receive raw MIME and write everything after that yourself, including threading, attachment extraction and deciding what counts as a reply. If inbound is central to your product that control is worth having; if you just need replies to reach a webhook, it is a lot of work for a small feature.",
    },
    {
      question: "What replaced Mailgun's Flex plan?",
      answer:
        "Flex closed to new signups in December 2025 and the pay-as-you-go rate for legacy accounts doubled, so new customers start on the plan ladder. The relevance to this comparison is structural rather than emotional: a hosted plan's price is set by the vendor and changed on the vendor's schedule, and a customer's only lever is to move. Owning the AWS account removes that lever from somebody else's hands, which is a different kind of value from a lower number.",
    },
    {
      question: "How do I do address validation on SES?",
      answer:
        "You buy it separately or you do without. SES has no validation product, so the options are a third-party validation API called at signup, a lightweight syntax and MX check you write yourself, or accepting a higher bounce rate. The last of those is riskier than it sounds, because bounce rate is precisely the metric AWS uses to decide whether to pause your account, and a self-serve signup form with typos in it is the most common way that number climbs.",
    },
    {
      question: "Which is better for high-volume sending?",
      answer:
        "SES on economics, decisively, once volume is high enough for the per-message rate to matter. Mailgun's argument at volume is not price, it is that routing, validation and log search arrive already built, and that a dedicated address comes with the plan. The real question is whether your team wants to operate a mail pipeline. If the answer is yes, SES is cheaper and more durable; if it is no, the saving becomes a backlog.",
    },
    {
      question: "Can SES receive mail in the same region I send from?",
      answer:
        "Sometimes, and it is worth checking before anything else, because inbound is supported in fewer regions than outbound. The two do not have to match — you can receive in one region and send from another — but that is an architectural decision with latency, data-residency and IAM consequences, not a checkbox. Teams with an inbound requirement should pick the receiving region first and let the rest of the account layout follow, because reversing that order means re-verifying identities you have already warmed.",
    },
    {
      question: "How do Mailgun's webhooks compare to SES event notifications?",
      answer:
        "They solve the same problem with different assumptions. Mailgun posts events to a URL you nominate and signs each request with a timestamp and token your handler verifies. SES publishes to SNS, EventBridge or Firehose, and you choose which — each with its own authentication story, its own delivery guarantees and its own envelope around the payload. The field names and the event vocabulary differ throughout, so migrating the consumer is a rewrite plus a security review rather than a configuration change.",
    },
    {
      question: "What happens to my Mailgun log history when I leave?",
      answer:
        "It stays. Retention is a plan feature, the search interface belongs to the vendor, and there is no historical archive handed over on the way out — which is the ordinary arrangement everywhere, not a Mailgun peculiarity. If any of that history has a use beyond debugging, export it while the account is live, and treat the export as a dated task with an owner. The broader lesson is worth acting on early: history you need to outlive a vendor relationship has to land somewhere you own from the start.",
    },
    {
      question: "Can I keep tag-based reporting after moving to SES?",
      answer:
        "The mechanism exists and the reporting does not. SES lets you attach message tags and configuration sets, both of which flow through to the events you publish, so the dimension you were slicing by survives. What does not survive is a console that aggregates by it — that becomes whatever your own store and query layer can do. If the tags were feeding a dashboard somebody reads weekly, rebuild that dashboard as part of the migration rather than as a follow-up, because a metric nobody can see is one nobody acts on.",
    },
  ],
};

const RESEND_VS_SENDGRID: VersusPage = {
  slug: "resend-vs-sendgrid",
  a: "resend",
  b: "sendgrid",
  title: "Resend vs SendGrid",
  description:
    "One is four years old, built for the developer who will integrate it this afternoon. The other has spent fifteen years becoming the email vendor an entire company shares. They barely want the same customer.",
  search: {
    primaryQuery: "resend or sendgrid for a new product",
    secondaryQueries: [
      "sendgrid replacement for a small dev team",
      "resend rate limit two requests per second",
      "sendgrid trial after free tier ended",
      "does resend have marketing campaigns",
      "converting sendgrid dynamic templates to react email",
      "per tenant sending credentials for an agency",
      "what to do when a sendgrid trial expires",
    ],
    rationale:
      "Almost every result is a migration guide published by one of the two. The facts that decide it — a fixed request-rate ceiling on one side that no plan lifts, a retired free tier on the other — are in neither guide, because neither company benefits from raising them.",
  },
  intro:
    "These two are competing for the same search term and not really for the same customer. Resend is built around one person's first hour: a small SDK, fast domain verification, React Email, and a log view that answers did it send. SendGrid is built around an organisation's next three years: relay for systems nobody owns, a marketing console, a certification pack, a procurement contact. If you are one developer shipping a product, the second list is overhead. If you are a company with a marketing team and a compliance review, the first list is a toy.",
  dimensions: [
    {
      heading: "Who the product is actually designed for",
      a: "One developer, working alone, who wants the email part finished before lunch. Everything follows from that: the SDK surface is deliberately small, the documentation assumes you can read code, domain verification is genuinely quick, and there is no settings page that requires a decision you are not qualified to make. The design succeeds at what it targets. It also means the second and third people who need to touch email — a support agent, a marketer — find much less waiting for them.",
      b: "An organisation, where email is something several departments do for different reasons. The console reflects that: separate sections for the API user and the campaign user, permission scopes, subusers, an integration catalogue. It is more product than a solo developer needs and the extra surface is the cost of serving everyone from one account. Teams who only ever use the send endpoint experience that breadth purely as friction.",
    },
    {
      heading: "The free tier, which only one of them still has",
      a: "Resend has a genuinely usable free allowance with a daily cap alongside the monthly one, and it is the reason a very large number of side projects are on it. The daily ceiling is the thing to check against your traffic shape, because a batch that fits comfortably in the monthly number can still fail on a Tuesday. But it exists, it is permanent, and it costs nothing.",
      b: "SendGrid's permanent free tier was retired in May 2025 and replaced with a time-boxed trial at a low daily cap. Every internal tool, staging environment and side project that was quietly living there became a paid decision on a deadline. If you are comparing these two because a SendGrid trial is running out, that is not a coincidence — it is the most common reason this comparison gets made at all.",
    },
    {
      heading: "The ceiling you hit first",
      a: "Resend caps API requests at two per second on every tier, including the most expensive one, and upgrading does not lift it. For request-response mail triggered by user actions this never matters. For anything batch-shaped — a digest, an announcement, a nightly job — it means a queue and a drip, which is ordinary engineering that nobody estimated and that no amount of money removes. Check the shape of your traffic before the plan price.",
      b: "SendGrid's throughput is not the constraint people meet; the plan's included volume is. That is a fundamentally different kind of ceiling, because it is a billing event rather than an architectural one. A campaign that goes out faster than expected costs more, rather than taking six hours. Whether that is better depends entirely on whether your problem is the invoice or the clock.",
    },
    {
      heading: "Marketing mail, and how each one handles it",
      a: "Resend has broadcasts and an audience concept, with marketing contacts billed separately from sends. That last detail is the one that catches people: a list that grows raises the bill in a month you sent nothing to it, which is a contact-priced model quietly attached to a send-priced product. The campaign tooling itself is deliberately light — enough for an announcement, not enough for a marketing team with a segmentation strategy.",
      b: "Marketing Campaigns is a full product with lists, segments, a visual designer and campaign reporting, priced as its own plan rather than bundled. It is the better tool for the job by a wide margin, and the reason to notice the pricing structure is that a comparison built on the sending plan alone will understate the invoice by an entire line item. The upside is a shared suppression list across marketing and transactional, which two separate vendors cannot give you.",
    },
    {
      heading: "Templates and where they live",
      a: "React Email is maintained by Resend, genuinely good, and lives in your repository so template changes go through review like any other code. It is also not a lock-in, because it renders to HTML any provider will accept. The catch is the same one every code-based template system has: a copy change requires a developer and a deploy, and the marketing person who wants to fix a typo cannot.",
      b: "A template editor in the console with versioning and test sends, editable by someone who has never opened the codebase. It produces less pleasant HTML than a React renderer and it is much more useful on a Friday afternoon when the person who needs to change a subject line is not an engineer. The two approaches are not really competing on quality; they are competing on who is allowed to make a change.",
    },
    {
      heading: "Legacy systems and the SMTP question",
      a: "Resend supports SMTP, and the support is adequate rather than a focus. If your mail comes from application code calling an API, this never comes up. If it comes from a CRM, a ticketing system, a WordPress install and a build server, you are going to be writing your own integration instructions, because nobody else has written them for you yet.",
      b: "This is SendGrid's quiet moat. Fifteen years as the default relay means a documented path exists for almost any system that sends mail, frequently written by that system's own vendor. When the requirement is get mail out of a platform we are not allowed to modify, the existence of prior art is worth more than a nicer SDK.",
    },
    {
      heading: "What happens when something goes wrong",
      a: "Suspension during traffic spikes is the complaint that recurs in Resend's public reviews, and the mechanism is the ordinary one for a shared-pool provider: an unfamiliar surge looks like risk to a platform protecting everyone else, so the conservative move is to pause first. Support is responsive by the standards of a company this size, but there is no severity scale and no contractual response time on the self-serve plans.",
      b: "Abrupt suspension also dominates SendGrid's reviews, and support latency is the other half of the same complaint. The difference is procedural rather than qualitative: there is a ticket system, a defined severity scale and an escalation path that a customer-success contact can push on at the higher tiers. Neither company comes out of this dimension well; one of them at least has a documented process for the bad day.",
    },
    {
      heading: "Log retention, and what you can still answer next quarter",
      a: "Thirty days on every plan short of Enterprise, after which the record is gone. That is enough to debug an integration and not enough for a billing dispute, a compliance request or a year-over-year comparison. Streaming events into your own store from day one fixes it and costs a day of work, and almost nobody does it until the first time somebody asks a question about March.",
      b: "Activity history is available further back, with the window widening on higher plans and an additional retention product available on top. It is more generous than thirty days and it is still a vendor window on a vendor's terms. The structural point is identical for both: if you need the history to outlive the relationship, it has to land somewhere you own, and neither vendor will do that for you by default.",
    },
  ],
  pickA: [
    "You are a small team shipping application email from your own codebase, and time-to-first-send is the metric that actually matters this month.",
    "Templates as reviewable React components in the repository is how you want them, and a developer changing copy is acceptable.",
    "Traffic is request-response and comfortably under two API calls a second, with nothing batch-shaped anywhere in the system.",
    "A permanent free allowance matters, because a side project or a staging environment should not generate an invoice.",
  ],
  pickB: [
    "Mail has to leave systems you do not control, and a documented relay integration for each of them is worth more than a pleasant SDK.",
    "A marketing team needs segmentation and a visual designer, and you would rather they shared a suppression list with the transactional side than ran a second vendor.",
    "Procurement needs a certification pack, a data processing agreement and a named support escalation before anything ships.",
    "A campaign going out fast is a billing question rather than an architecture question, because the rate ceiling is not something you can engineer around.",
  ],
  prosA: [
    "A permanent free allowance still exists here, with a daily cap sitting alongside the monthly one, which is the reason an enormous number of side projects and staging environments now live on this side of the comparison.",
    "The SDK is small enough to read in one sitting and domain verification genuinely completes in minutes, so the email portion of a new product is finished before the rest of the afternoon is.",
    "Templates are React components in your own repository, reviewed like any other code, and they render to plain HTML that any provider will accept — so adopting them commits you to less than it appears.",
    "There is no settings page asking for a decision you are not qualified to make, which sounds like a small thing until you have spent an hour choosing between four supported ways to do one job.",
  ],
  consA: [
    "Two API requests per second on every tier, unlifted by any upgrade, so batch-shaped traffic gets a queue rather than a plan change and the queue is permanent.",
    "Marketing contacts are metered apart from sends — a contact-priced model quietly attached to a send-priced product — so an accumulating list raises the invoice with no campaign behind it.",
    "SMTP is supported rather than cultivated, so pointing a CRM, a build server and a WordPress install at it means writing the configuration notes that nobody else has written yet.",
    "Thirty days of log retention on every plan short of Enterprise, in a view designed to debug this week's integration rather than to answer a question about last quarter.",
  ],
  prosB: [
    "Fifteen years as the default relay, which means whatever appliance, plugin or unloved internal system needs configuring, somebody has already documented pointing it here — usually that product's own vendor.",
    "A template editor a non-engineer can actually use, with versioning and test sends, so the person who needs to fix a subject line before the weekend does not need a developer or a deploy.",
    "Subusers give per-tenant credentials, reputation, suppression and reporting beneath one parent account, and for anybody sending on behalf of customers that single feature frequently decides the evaluation.",
    "The procurement machinery exists and works: a certification pack, a data processing agreement, a defined severity scale and a named escalation contact on the higher tiers.",
  ],
  consB: [
    "The permanent free tier ended in May 2025 and became a sixty-day trial at a low daily cap, which is the specific event that sends most people to this comparison in the first place.",
    "Marketing Campaigns runs on its own plan and its own meter, so the promised consolidation happens at the login screen rather than on the invoice.",
    "Being cut off abruptly and waiting on support are the two themes that dominate its public reviews, and the compliance function responsible for the first is not reachable through the queue handling the second.",
    "The console carries fifteen years of accumulated surface, and a team that only ever calls the send endpoint experiences every bit of that breadth as friction.",
  ],
  migrationChecklist: [
    "Measure the traffic shape against the rate ceiling before committing to anything else. Two requests per second on every tier is the one constraint here that money cannot remove, and a nightly job that loops over a list making one call per recipient will meet it on the first run. Batch endpoints taking several recipients per call are the mitigation; rewriting the send loop is the work.",
    "Export all four SendGrid suppression collections — global unsubscribes, bounces, spam reports and blocks — and import them before the first message goes out. They sit behind separate endpoints, and a partial export is precisely how a migration re-mails everybody who previously complained.",
    "Re-implement the dynamic templates as components. The handlebars-style substitution is evaluated inside SendGrid and does not travel; the HTML does. This is usually the largest single chunk of the project, and unusually for a migration task it leaves the codebase better than it found it.",
    "Settle where the campaign mail lives. Broadcasts and an audience concept exist on the destination and are deliberately lighter than Marketing Campaigns — no segmentation engine, no visual designer. If a marketing team is working in that console today, have the conversation before the sending cutover rather than the week after it.",
    "Inventory every SMTP sender and cost each one on its own. Anything currently pointed at SendGrid through a documented integration has to be re-pointed using instructions nobody has written yet, and the awkward ones — an appliance, a legacy plugin, a vendor that only knows one relay — are where the schedule actually slips.",
    "Rewrite the event consumer. SendGrid posts a batched array of events to one URL; the destination posts individually signed payloads with a different vocabulary, so every alert and report derived from the old shape has to be re-derived before anybody trusts the new numbers.",
    "Plan around thirty days of history rather than whatever you had. The destination purges at thirty days on every plan short of Enterprise, so if any process depends on older records, building the event pipeline into your own store belongs inside this migration rather than on the list after it.",
    "Warm the new identity before moving the mail that matters. The dedicated IP and everything the mailbox providers learned about it stay behind, so begin on a subdomain with low-stakes traffic, watch the complaint and bounce rates settle, and move password resets last.",
  ],
  buyingQuestions: [
    "Does anything in our system send in batches, and has somebody counted API calls per second at peak rather than on a monthly average?",
    "Who edits email copy today — an engineer or somebody in marketing — and what does that person's Friday afternoon look like after the switch?",
    "How many of our senders are systems we cannot modify, and does a written integration path exist for each of them on the side we are moving to?",
    "Do we send on behalf of customers, and if so does the destination offer per-tenant credentials, suppression and reporting, or would we be building that ourselves?",
    "What is our current invoice actually made of — one plan, or a sending plan plus a marketing plan plus dedicated IP charges nobody folded into the comparison?",
    "Will procurement accept the new vendor's certification posture, and has anybody asked them before the engineering work started rather than after?",
    "How far back do we need delivery records to reach, and does that answer survive a thirty-day window?",
  ],
  faqs: [
    {
      question: "Why is Resend so much cheaper at small volume?",
      answer:
        "Partly because it sends through Amazon SES rather than operating its own network, so the underlying delivery cost is low and the product is the layer above it. Partly because it is not carrying the cost of a marketing platform, a certification programme or an enterprise sales organisation. The gap narrows considerably at volume and once marketing contacts are billed alongside sends, so a comparison drawn at a thousand messages a month will not predict the one at a million.",
    },
    {
      question:
        "Can I move from SendGrid to Resend without changing my templates?",
      answer:
        "The HTML moves fine, since both accept a rendered string. What does not move is anything using SendGrid's dynamic template system with its handlebars-style substitution, because those templates live in SendGrid and are evaluated there. You either re-implement them as React Email components or keep rendering them yourself and send finished HTML. Budget for the second option; it is the one most teams end up on regardless of what they planned.",
    },
    {
      question: "Does the two-requests-per-second limit apply to bulk sends?",
      answer:
        "It applies to API requests, so a batch endpoint that accepts multiple recipients in one call goes considerably further than sending one message per call. The constraint bites hardest on architectures that loop over a list making individual calls, which is the shape most application code arrives in. The point worth internalising is that no plan removes the ceiling, so if your traffic is batch-shaped the queue is permanent rather than temporary.",
    },
    {
      question: "Which one is better for deliverability?",
      answer:
        "Neither, in any way that generalises. Both run shared pools, both have public complaints about suspension during spikes, and both will deliver well for a sender with clean list practices and correct authentication. The variable that actually predicts your placement is your own sending behaviour — engagement, bounce rate, complaint rate, DMARC alignment — and it dominates the difference between these two vendors by a wide margin.",
    },
    {
      question: "Is SendGrid's free tier really gone?",
      answer:
        "Yes. It ended in May 2025 and was replaced by a sixty-day trial with a low daily cap, after which a paid plan is required. This is worth stating plainly because a large amount of the writing comparing these two predates the change and still describes an allowance that no longer exists, and because it is the specific event that pushed a great many small projects into running this comparison in the first place.",
    },
    {
      question: "Does Resend have an equivalent of SendGrid subusers?",
      answer:
        "Not in the same shape. SendGrid's subusers are a genuine multi-tenancy primitive: each one carries its own credentials, its own sending reputation, its own suppression list and its own reporting, all underneath a parent account somebody administers. Resend's model is an account with domains and API keys, which serves a single product well and does not give an agency or a platform per-customer isolation. If you send on behalf of other businesses, price rebuilding that isolation honestly, because it is not a feature request you can wait out.",
    },
    {
      question: "We pay for a dedicated IP on SendGrid. Does it come with us?",
      answer:
        "No, in the same way that no dedicated address travels anywhere: the IP is the vendor's asset and the reputation attached to it is a record mailbox providers keep about that address, not about your domain. What you are really giving up is the calendar — weeks of gradually increasing volume that somebody already served. Resend offers dedicated addresses on its higher tiers, so the capability exists, but you start the schedule again. For most senders below a few hundred thousand messages a month the shared pool is the better place to be anyway.",
    },
    {
      question: "What can Resend's broadcasts actually do?",
      answer:
        "Send a message to an audience, with a basic contact record and unsubscribe handling. That covers a product announcement, a changelog mail or a newsletter with one list. What it does not cover is behavioural segmentation, a visual designer a marketer would choose to work in, branching automations, or campaign analytics beyond opens and clicks. Teams treating it as a Marketing Campaigns replacement generally discover the gap during the first campaign somebody in marketing owns, which is a bad time to discover it.",
    },
    {
      question:
        "How long does a migration between these two realistically take?",
      answer:
        "The send path is days. The schedule is set by three other things: re-implementing dynamic templates, re-pointing the SMTP senders you do not control, and warming a new identity. The first two are estimable once you have counted them, and the third cannot be compressed — you are raising volume gradually while watching complaint and bounce rates, which takes weeks at meaningful volume. Run both providers in parallel on separate subdomains and budget for two invoices during the overlap, because that cost arrives whether or not anybody planned it.",
    },
  ],
};

const MAILGUN_VS_RESEND: VersusPage = {
  slug: "mailgun-vs-resend",
  a: "mailgun",
  b: "resend",
  title: "Mailgun vs Resend",
  description:
    "Fifteen years of routing, validation and log search against four years of getting one developer to a sent email faster than anyone else. The gap between them is capability against ergonomics, and which of those is scarce for you.",
  search: {
    primaryQuery: "mailgun replacement for a modern stack",
    secondaryQueries: [
      "does resend support inbound email routing",
      "resend api rate limit for bulk sending",
      "mailgun pay as you go plan discontinued",
      "email api with address validation built in",
      "what to do with mailgun routes when switching provider",
      "how long does mailgun keep logs on each plan",
      "sending bulk email under a strict api rate limit",
    ],
    rationale:
      "Teams arrive at this comparison after the December 2025 Mailgun repricing and evaluate Resend on developer experience alone, which is the half that is easy to see. The capabilities they would be giving up — inbound routing, validation, deep log search — are not on Resend's feature page to be missed.",
  },
  intro:
    "This comparison usually starts with a Mailgun invoice that changed and a Resend demo that looked delightful, which is a bad way to choose infrastructure because it weighs the two most visible attributes and ignores the rest. Mailgun is a broad platform: it receives mail as well as sending it, validates addresses before you burn a bounce on them, and lets you search a year of logs from a console. Resend is narrow and excellent inside that narrowness. Whether the missing breadth matters is a question about your product, not about either vendor's taste.",
  dimensions: [
    {
      heading: "Inbound mail, which only one of them does",
      a: "Routes match on recipient, sender or header using an expression syntax, then forward to a URL, an address or storage, with the message already parsed into fields. If your product has replies, ticket ingestion, per-customer addresses or anything else where mail arrives rather than leaves, this is a whole subsystem you get for free, and it is the single largest capability gap on this page.",
      b: "Resend does not do inbound. That is a deliberate scope decision rather than an oversight, and the usual workaround is a second service in front — Cloudflare Email Routing into a Worker, a Postmark inbound stream, an SES receipt rule — which means a second vendor, a second set of credentials and a seam where replies and sends do not share a view of the conversation.",
    },
    {
      heading: "Address validation before the bounce happens",
      a: "Validation is a product here: syntax, domain and mailbox-level checks callable at signup rather than at send. For anything with a self-serve registration form this measurably lowers your bounce rate, which is the metric that gets accounts suspended across the entire industry. Buying it from the same vendor that sends the mail also means the suppression and the validation share a view of an address.",
      b: "Nothing equivalent. You are expected to keep your list clean by other means, which in practice means a third-party validation API or a syntax check you write. This is fine for a product with invited users and genuinely risky for one with an open signup form, because the first sign of trouble is usually a warning email about bounce rate rather than a dashboard number you were watching.",
    },
    {
      heading: "Finding a message six months later",
      a: "Log search is in the console with retention that widens as the plan does, and it shows the receiving server's actual SMTP response — which is the field that resolves an argument about whether a message was delivered or merely accepted. A support agent can use it without an engineer. The limit is that the retention is a plan feature and the history leaves with you only if you exported it.",
      b: "Thirty days on every plan short of Enterprise, in a log view designed for debugging an integration rather than for answering questions about last quarter. The view itself is clean and fast. The window is the problem, and it is not a problem you notice during evaluation, because during evaluation everything you want to look at happened this week.",
    },
    {
      heading: "The throughput ceiling",
      a: "Mailgun's constraint is the plan's included volume rather than a request rate, so a burst costs money rather than time. Batch sending is ordinary and the API expects it. For a nightly digest to a large list this is simply not a design consideration, which is a quiet luxury that only becomes visible when you compare against something that caps you.",
      b: "Two API requests per second on every tier, and no plan lifts it. Batch endpoints that take several recipients per call stretch this considerably, but any architecture that loops over a list making individual calls will meet the ceiling immediately and permanently. This is the most consequential single fact about Resend for anyone whose traffic is not purely request-response, and it is not on the pricing page.",
    },
    {
      heading: "Templates and the developer experience gap",
      a: "Handlebars-style templates stored in the vendor, plus a drag-and-drop builder, plus the option of sending finished HTML. It works and nobody enjoys it. The templates live outside version control unless you build a sync, so a change is not reviewable the way code is, and reproducing a production template locally is more effort than it should be.",
      b: "React Email, first-party and genuinely good, with templates as components in your repository going through the same review as anything else. This is the clearest quality win Resend has and it is why most of these migrations get proposed. Worth knowing before you count it as a reason to switch: React Email renders to plain HTML and works perfectly well with Mailgun, so you can have this half without the migration.",
    },
    {
      heading: "Price, and what changed in December 2025",
      a: "The Flex pay-as-you-go plan closed to new signups in December 2025 and the legacy rate doubled, which is why a great many teams are running this comparison at all. New customers start on the plan ladder, with dedicated addresses included from the middle tiers. The lesson generalises past this vendor: a hosted plan's price is set by the vendor on the vendor's schedule, and the customer's only lever is migration.",
      b: "Two plan ladders that price the same volume differently depending which you are on, plus marketing contacts billed separately from sends. That last item is the one that surprises people, because a growing list raises the bill in a month you sent nothing to it. Cheaper than Mailgun at small volume, and the gap narrows as contacts accumulate.",
    },
    {
      heading: "Who runs it and what that implies",
      a: "Sinch, following an acquisition, alongside a portfolio of other messaging brands. The product is mature and thoroughly documented; the risk is the usual one for an acquired platform, which is that investment tracks the parent's priorities rather than yours. The repricing is the sort of event that follows from that, and it is the reason to read the pricing page rather than a two-year-old comparison.",
      b: "An independent company four years old, sending through Amazon SES underneath, growing quickly. The upside is obvious in the product. The risks are the ones any young vendor carries — a smaller operations team, less history behind the sending reputation, and a suspension policy that leans conservative during spikes because protecting the shared pool is the correct call for everyone except you.",
    },
    {
      heading: "European deployment",
      a: "A European region has existed for years, selected per domain, with its own API endpoint. It covers the ordinary GDPR requirement cleanly. The endpoint split is a small but real trap: verify a domain in one region and call the other for a week and nothing will work in a way the error messages do not explain.",
      b: "Resend's data handling is documented and its subprocessors are published, which is enough for most buyers, but there is no equivalent of picking a region and having mail stay inside it. If your requirement is written as a residency clause rather than as a preference, this is the dimension that ends the comparison rather than informing it.",
    },
  ],
  pickA: [
    "Your product receives mail as well as sending it, and running a second vendor for inbound would split the conversation across two systems.",
    "An open signup form makes address validation a bounce-rate control rather than a nicety.",
    "Support needs to search logs far enough back to answer a question about last quarter, with the receiving server's response visible.",
    "A written data residency requirement needs a named region rather than a documented policy.",
  ],
  pickB: [
    "Mail is triggered by user actions from your own codebase, comfortably under two API calls a second, and nothing in the system is batch-shaped.",
    "Templates as reviewable components in the repository is worth more to the team than any capability on the other side of this page.",
    "Volume is small enough that the cheaper plan and the permanent free allowance genuinely change the monthly number.",
    "You want the integration finished this afternoon and are willing to add a second service later if inbound ever becomes a requirement.",
  ],
  prosA: [
    "Inbound routing is a whole subsystem arriving for free: expression matching on recipient, sender or header, with the message already broken into fields your endpoint can read.",
    "Validation is callable at the registration form, which lowers the bounce rate that gets accounts paused before any bounce has actually happened.",
    "Log search surfaces the receiving server's own SMTP response and reaches back as far as the plan allows, which is what makes a support agent self-sufficient rather than a queue for engineering.",
    "The binding constraint is the plan's included volume rather than a request rate, so a burst costs money and completes instead of draining over several hours.",
  ],
  consA: [
    "Flex closed to new signups in December 2025 and the legacy pay-as-you-go rate doubled, which is the event that put most people on this page and the reason a remembered figure is now wrong.",
    "Templates sit in the vendor rather than in version control unless somebody builds a sync, so a change is not reviewable and reproducing production locally is harder than it should be.",
    "Retention, dedicated addresses and support latency are all plan features, so a downgrade silently removes capability the team had come to rely on.",
    "Investment follows an acquiring group's portfolio, which is a slower kind of risk than a bad quarter and considerably harder to plan around.",
  ],
  prosB: [
    "React Email is the clearest quality win on this page: components in the repository, reviewed alongside everything else, rendering to HTML that any provider will accept.",
    "The integration is genuinely done the same afternoon, with domain verification completing inside the time DNS takes to propagate.",
    "A permanent free allowance, which is what turns a staging environment or a prototype into something that does not appear on an invoice at all.",
    "Cheaper at small volume, and the product surface is small enough that nothing in the first hour requires a decision you are unqualified to make.",
  ],
  consB: [
    "There is no inbound, so replies mean a second service in front and a seam where a sent message and the answer to it are tracked in different systems.",
    "No validation product either, which on an open signup form leaves a third-party API, a check you write, or a bounce rate you are gambling with.",
    "Two API requests per second on every tier, which is an architectural constraint rather than a commercial one and therefore not something money removes.",
    "No named region to satisfy a residency clause, and thirty days of retention on everything short of Enterprise.",
  ],
  migrationChecklist: [
    "Count what you actually use inbound for before anything else, because there is none on the other side. Reply handling, ticket ingestion, per-customer addresses and catch-all forwarding each need a named replacement — Cloudflare Email Routing, an SES receipt rule, or keeping a minimal account open purely for Routes — and every answer costs a second set of credentials.",
    "Decide what happens at the signup form once validation stops. The realistic choices are a third-party validation API, a syntax and MX check of your own, or a higher bounce rate against an identity with no history to absorb it. The third is the one that gets accounts paused in the first month.",
    "Measure peak calls per second against a fixed two-per-second ceiling. Mailgun does not constrain request rate the way the destination does, so send loops written without that in mind meet the limit on the first run. Batch endpoints accepting several recipients per call are the mitigation; rewriting the loop is the work.",
    "Export the searchable history you still need while the plan's retention window is still yours. It shortens on downgrade and ends at cancellation, and the destination purges at thirty days on every plan short of Enterprise — so if anything downstream reads older records, the pipeline into your own store belongs inside this project.",
    "Pull the suppression list and the bounce record and load them before the first send. Each side keeps its own and neither hands anything to the other, so the first campaign after the cutover is exactly where an incomplete export turns into a complaint rate you cannot explain away.",
    "Move the templates out of the vendor. Handlebars-style templates are evaluated on Mailgun's side and the drag-and-drop builder emits HTML that does not want to become a component, so re-authoring is real work — and it is the part of this migration that leaves the codebase better than it found it.",
    "Replace the signature verification as well as the payload handler. Mailgun signs with a timestamp and token pair; the destination signs differently and uses a different event vocabulary, so the verification code and the field mapping are both new and both belong in the security review rather than in a follow-up ticket.",
    "Warm a new identity and keep the old one alive while you do. Mailgun's dedicated address and everything the mailbox providers learned about it stay behind, so run the destination on a subdomain with low-stakes traffic and accept several weeks of two invoices rather than compressing the ramp.",
  ],
  buyingQuestions: [
    "Does anything in our product depend on mail arriving rather than leaving, and have we listed every one of those flows rather than the obvious ones?",
    "What is our bounce rate on self-serve signups today, and what does it become if nothing validates the address at the form?",
    "Has anybody measured peak API calls per second, or are we reasoning about throughput from a monthly total?",
    "Is our data residency requirement a written clause naming a region, or a preference somebody expressed in a meeting once?",
    "How far back does a support agent search today, and how often does that search go past thirty days?",
    "Who owns our templates — an engineer in a pull request or a marketer in a builder — and which of these two suits that person's week?",
    "If we are on grandfathered pay-as-you-go terms, what are they precisely, and is the comparison being drawn against those or against the current list?",
  ],
  faqs: [
    {
      question: "Can I use React Email with Mailgun?",
      answer:
        "Yes, and it is worth knowing before you treat React Email as a reason to migrate. The library is open source and renders components to an HTML string; nothing about it is coupled to Resend's API. You render, then hand the result to Mailgun's send call. What you lose is the integrated preview and the first-party polish, and what you keep is the part that mattered, which is that templates are reviewable code rather than rows in a vendor's database.",
    },
    {
      question: "Does Resend have anything like Mailgun Routes?",
      answer:
        "No. Resend sends; it does not receive. Teams that need inbound alongside it typically put Cloudflare Email Routing or an SES receipt rule in front and handle parsing themselves, or run a second provider that does inbound properly. Either way it is another system, another set of credentials and a seam where an outgoing message and the reply to it are tracked in different places, which is exactly the integration cost the single-vendor option avoids.",
    },
    {
      question: "Why did my Mailgun bill change?",
      answer:
        "The Flex plan closed to new signups in December 2025 and the legacy pay-as-you-go rate doubled, moving most pay-as-you-go accounts either onto the ladder or onto the new rate. If you are on grandfathered terms, confirm what they actually are before comparing anything, because a model built on the old figure will be wrong by a factor that matters. This is the most common reason people arrive at this comparison in 2026.",
    },
    {
      question: "Is Resend's rate limit really fixed on every plan?",
      answer:
        "Two requests per second, on every tier including the most expensive, and upgrading does not lift it. Batch endpoints that accept multiple recipients per call give you substantially more headroom than one call per message, so the practical impact depends heavily on how your code is shaped. The point to internalise is that it is architectural rather than commercial: if your traffic is batch-shaped, the queue you build is permanent.",
    },
    {
      question: "Which is better for deliverability?",
      answer:
        "The honest answer is that this is decided by your own sending behaviour rather than by the choice. Both run shared pools, both will deliver well for a sender with clean lists and correct authentication, and both have public complaints about suspension. Mailgun has a longer operating history and its own network; Resend rides on Amazon SES. Neither of those facts predicts your placement as strongly as your bounce rate and your engagement do.",
    },
    {
      question: "Can I export my Mailgun logs before I leave?",
      answer:
        "Within whatever retention your current plan gives you, yes, and outside it there is nothing to export. That window is the thing to check first, because it shortens if you downgrade and it disappears entirely when the account closes. Treat the export as a dated task with a named owner rather than a cleanup item, and while you are at it consider whether any of that history should have been landing in your own store all along — because the same question arrives again at the next vendor, with a shorter window.",
    },
    {
      question: "Does Resend offer a European region?",
      answer:
        "Not in the sense a residency clause means. Resend publishes its subprocessors and documents its data handling, which satisfies a great many buyers, but there is no equivalent of selecting a region and having your mail stay inside it — which Mailgun has offered for years, chosen per domain with its own API hostname. If your requirement is written down as a jurisdiction rather than expressed as a preference, this dimension ends the comparison rather than contributing to it, and it is worth establishing before anybody builds a prototype.",
    },
    {
      question: "How do I replace address validation after leaving Mailgun?",
      answer:
        "Three options, in descending order of how well they work. Buy a dedicated validation API and call it at the signup form, which is the closest substitute and one more contract. Write a syntax and MX check yourself, which catches obvious typos and misses disposable addresses and full mailboxes. Or accept a higher bounce rate, which is only sane if your users are invited rather than self-serve. The reason this matters more than it sounds is that bounce rate is the metric providers use to decide whether you keep sending at all.",
    },
    {
      question: "Which is better for an agency sending on behalf of clients?",
      answer:
        "Mailgun, on structure rather than on quality. Sending for other businesses needs per-tenant credentials, per-tenant suppression and per-tenant reporting, so that one client's list practices cannot reach another client's placement and so that a report means one customer. Mailgun's subaccount model addresses that directly. Resend's model is an account with domains and API keys, which serves one product well and leaves an agency administering a collection of separate accounts with no shared view across them.",
    },
  ],
};

const POSTMARK_VS_SENDGRID: VersusPage = {
  slug: "postmark-vs-sendgrid",
  a: "postmark",
  b: "sendgrid",
  title: "Postmark vs SendGrid",
  description:
    "One company decided to be excellent at a narrow thing and stay there. The other decided to be the email vendor a whole organisation shares. Choosing between them is mostly a question about how many departments send mail.",
  search: {
    primaryQuery: "postmark or sendgrid for transactional email",
    secondaryQueries: [
      "leaving sendgrid after the free tier ended",
      "postmark message streams versus sendgrid categories",
      "which email provider suspends accounts less",
      "transactional email with a real support team",
      "moving sendgrid suppression lists to another provider",
      "per client sending isolation without subusers",
      "inbound parse alternatives for transactional email",
    ],
    rationale:
      "This pair is searched by people already on SendGrid and unhappy about something specific — a suspension, a support ticket, a retired free tier. The comparison they need is operational rather than a feature grid, and nobody writes the operational one because it makes both vendors look partly bad.",
  },
  intro:
    "Postmark and SendGrid are both mature, both operate their own mail infrastructure and both will deliver your password resets. The difference is the size of the problem each decided to solve. Postmark solves transactional email for a product team and refuses almost everything else, which is why it has a support department people write nice things about and a marketing feature set people complain is thin. SendGrid solves email for an organisation, which is why it has a marketing console, a relay integration for every legacy system, and a compliance department that occasionally turns your sending off.",
  dimensions: [
    {
      heading: "Keeping bulk mail away from transactional mail",
      a: "Postmark enforces the split in software. Transactional and broadcast messages travel on separate streams with separate reputation, and the product actively resists you pushing bulk down the transactional path. That constraint is the single largest reason its placement record is what it is, and it is an opinion rather than a technique — the same discipline is available anywhere, and almost nowhere is it mandatory.",
      b: "SendGrid gives you categories, subusers, IP pools and unsubscribe groups, which together can produce the same separation and none of which oblige you to. The common failure is ordinary organisational drift: marketing sends a large campaign from the same account and the same pool as the transactional traffic, complaint rate rises, and the receipts start landing in promotions. Nothing in the product stops that from happening, and by the time it is visible it has been true for weeks.",
    },
    {
      heading: "What happens when support asks about one message",
      a: "The activity view holds the rendered message, the headers and the delivery trace for a specific recipient, and it is usable by someone who is not an engineer. This is the feature Postmark customers cite most often when explaining why they stopped price-shopping. A customer says the email never arrived, a support agent resolves it in under a minute, and nobody opens a log query or a ticket with the vendor.",
      b: "The activity feed will tell you a message was processed, delivered, bounced or dropped, with the receiving server's response attached, and the window depends on your plan with additional retention sold separately. It answers the status question well. It is less good at the content question, so did we send them the right thing frequently becomes an engineering task even though it is a support problem.",
    },
    {
      heading: "The support relationship itself",
      a: "Tickets reach people who have operated mail infrastructure, and a placement problem produces an investigation rather than a link to a runbook. That level of support is unusual enough that it functions as a product feature, and it is a large part of what the higher per-message price is actually buying. For a small team with no deliverability expertise in-house, renting some is a rational purchase.",
      b: "Support is included with the plan and the tier decides the queue. Latency is the recurring complaint in its public reviews, and the substance of the complaint is usually not rudeness but round-trip time during an incident. Higher tiers add a customer success contact who can escalate, which is a meaningful difference — but it is a difference you buy, and it does not exist on the plans most teams start on.",
    },
    {
      heading: "Losing your sending, and how each one handles it",
      a: "Postmark will remove a customer whose sending damages the shared transactional pool, and is open about that being the policy. In practice the removals people describe involve bulk mail on the wrong stream or list practices that would fail anywhere. The conversation is with people who explain what triggered it, which does not make the outage shorter but does make it recoverable.",
      b: "Abrupt suspension is the dominant theme in SendGrid's public reviews, usually described by accounts sending nothing unusual: a traffic spike, a new domain, an unfamiliar pattern. Compliance operates independently of first-line support and cannot be overruled by it. If your business stops when mail stops, the metric to evaluate is not delivery rate, it is how long the bad day lasts and who you can call during it.",
    },
    {
      heading: "The marketing half, and whether you want it here",
      a: "Deliberately thin. There are broadcast streams and templates, and there is no segmentation engine, no visual campaign designer and no reporting a marketing team would accept. Postmark's position is that you should use a marketing tool for marketing, and it is a defensible position that also means a second vendor, a second suppression concept and a reconciliation nobody performs.",
      b: "Marketing Campaigns is a real product — lists, segments, a designer, campaign analytics — priced as its own plan rather than bundled with sending. The genuine advantage is that the marketing and transactional sides share a suppression list and a reputation, which is exactly the problem the two-vendor architecture creates. The genuine cost is that a comparison built on the sending plan alone will understate what you pay by a whole line.",
    },
    {
      heading: "Reaching systems nobody is allowed to modify",
      a: "Postmark speaks SMTP and that is the extent of the ambition. There is no integration catalogue, because the product is aimed at application email sent from a codebase you control. Point a CRM, a ticketing system and a build server at it and you will be writing your own instructions for each, which is fine for one system and tiresome for six.",
      b: "Fifteen years as the default relay means somebody has already documented how to point almost anything at SendGrid, frequently the other vendor rather than SendGrid itself. When the requirement is get mail out of a platform we cannot change, prior art is worth more than elegance, and this is the dimension where the breadth that annoys developers earns its keep.",
    },
    {
      heading: "What the bill looks like at each end of the range",
      a: "A plan with an included allowance and an overage rate that improves as the plan grows, plus a dedicated address as an optional extra above a volume floor. Predictable, and increasingly expensive as volume climbs — the economics genuinely invert somewhere in the hundreds of thousands per month, and the early-2026 repricing means a long-standing account is not on the numbers a new one sees.",
      b: "A sending plan, plus a marketing plan if you use that side, plus dedicated IP charges above a tier. Each is predictable alone and the total is what gets underestimated. At high volume SendGrid is the cheaper of these two by a clear margin, which is the trade the whole page comes down to: Postmark charges more per message and spends part of it on the operation that keeps your message out of the spam folder.",
    },
    {
      heading: "Procurement, certification and who signs",
      a: "Postmark is a straightforward vendor to buy from and a small one. The paperwork exists and is proportionate. For an enterprise security review that expects a thick certification pack and a named compliance contact, expect more back-and-forth than with a Twilio company, simply because the machinery on the other side is smaller.",
      b: "Twilio maintains the certification programme, the data processing agreements and the enterprise contracting machinery, and an enterprise buyer gets through the review routinely. That is a real advantage in a regulated shop, where the cost of a new supplier is measured in weeks of questionnaire. It is also an annual renewal with a sales relationship attached, which smaller teams experience as overhead they did not want.",
    },
  ],
  pickA: [
    "Password resets and receipts reaching the inbox is a business risk, and you would rather rent an operation that watches placement than build the habit yourself.",
    "Support agents should resolve did this customer get the email from the rendered message, without escalating to engineering.",
    "You want the transactional and bulk separation enforced by the product, because nobody on the team will enforce it by convention for eighteen months.",
    "Volume is in the tens or low hundreds of thousands a month, where the price difference is smaller than the cost of one deliverability incident.",
  ],
  pickB: [
    "Several departments send mail from the same domain and you would rather they shared one suppression list than reconciled two vendors.",
    "Mail must leave systems you do not control, where a documented relay path for each matters more than per-message quality.",
    "Procurement needs a certification pack, a data processing agreement and a named escalation contact before anything ships.",
    "Volume is high enough that the per-message gap is a real recurring number rather than a rounding error.",
  ],
  prosA: [
    "Stream separation is enforced by the software rather than offered as an option, which is a mechanism rather than a slogan and the honest explanation for why its placement record reads the way it does.",
    "The activity view carries the rendered message alongside the trace, so a support agent closes the did-it-arrive ticket without an engineer and without a query console.",
    "Tickets reach people who have run mail infrastructure, and a placement problem produces an investigation rather than a link to a runbook somebody wrote in 2019.",
    "The product is small enough that there is nothing to learn beyond the thing you came for, which is an underrated property in a tool three people have to share.",
  ],
  consA: [
    "No campaign builder, no segmentation and no automation, by a decade of stated policy, which makes marketing a second vendor and a second understanding of who has opted out.",
    "There is no integration catalogue, so every system you do not control needs its own configuration note, written by you, for an audience of one.",
    "A small company meeting an enterprise security review means more back-and-forth — not because the paperwork is missing but because the machinery answering the questionnaire is smaller.",
    "The per-message price genuinely inverts against the other side somewhere in the hundreds of thousands a month, and it keeps going in that direction afterwards.",
  ],
  prosB: [
    "One vendor covering the API, the relay and the campaigns, which is a single procurement conversation instead of three and a single annual renewal instead of two.",
    "Subusers provide per-tenant credentials, reputation, suppression and reporting under one parent account, and there is nothing corresponding on the other side of this pair.",
    "Twilio's certification programme and contracting machinery, which an enterprise buyer gets through routinely rather than as an exception negotiated by somebody's manager.",
    "The widest relay compatibility surface in the category, accumulated over fifteen years rather than designed, and worth more than elegance when the sender is a system nobody may rewrite.",
  ],
  consB: [
    "Nothing obliges you to keep bulk mail off the transactional path. Categories, subusers and IP pools can produce that separation and none of them require it, and organisational drift does the rest.",
    "The activity feed answers the status question well and the content question poorly, so did we send them the right thing becomes an engineering task despite being a support problem.",
    "Being cut off abruptly dominates its public reviews, and the compliance function that does it operates independently of the queue you would be escalating in.",
    "Marketing Campaigns is priced as its own plan, so the one-vendor story is two subscriptions and a comparison drawn on the sending tier alone is short by a line.",
  ],
  migrationChecklist: [
    "Divide the traffic into streams before writing any code, because that is the decision the narrower product is built around. Transactional and broadcast mail go on separate streams with separate standing, and mail that has been leaving one SendGrid account for years frequently turns out to belong in two places that must never share reputation.",
    "Export all four suppression collections and then map them per stream. SendGrid keeps global unsubscribes, bounces, spam reports and blocks separately; the destination scopes suppressions by stream. Getting that mapping wrong means either re-mailing people who complained or silently dropping people you are perfectly entitled to contact.",
    "Re-author the dynamic templates. Handlebars-style substitution evaluated inside SendGrid has no counterpart on the other side, and a layouts-plus-templates model is a different shape rather than a different syntax. The HTML travels; the logic is rewritten by somebody who understands what it was for.",
    "Find a home for the campaign mail, because no segmentation engine and no visual designer is waiting for it, and the company is explicit that this is policy rather than roadmap. A marketing team currently working in Marketing Campaigns needs a named destination before the transactional cutover, not after it.",
    "Account for the subusers explicitly. If you send on behalf of customers, per-tenant credentials, reputation and reporting are a SendGrid primitive with nothing equivalent on the other side, so that isolation becomes separate accounts or separate streams that somebody on your team administers by hand.",
    "Re-point the SMTP senders and expect to write the instructions yourself. Fifteen years of accumulated prior art does not transfer, so each appliance, plugin or unloved internal system becomes its own small task with nobody else's documentation to follow.",
    "Rebuild the webhook consumers around a per-stream model. SendGrid posts batched arrays of events to one URL for the whole account; the destination posts per event type to URLs nominated per stream, which is a different architecture as well as a different payload, and the alerting has to follow.",
    "Warm the new identity on the low-stakes stream first. The dedicated IP stays behind with everything the mailbox providers learned about it, and a shared pool only carries a sender whose own behaviour justifies it — so ramp across weeks and keep the receipts on the old path until the last possible moment.",
  ],
  buyingQuestions: [
    "How many departments send mail from our domain, and would every one of them fit inside the narrower product without complaining?",
    "What does our support team do today when a customer says an email never arrived, and does that workflow still exist after the move?",
    "Is there anything in our account that is marketing mail wearing a transactional label, and who gets to decide which it is?",
    "Do we send on behalf of customers, and if so who is rebuilding the per-tenant isolation and on what timeline?",
    "What does procurement require in writing, and has the smaller vendor's paperwork been checked against that list rather than assumed adequate?",
    "At the volume we expect in eighteen months rather than today, which side of the price crossover are we standing on?",
    "On the morning sending stops, what is the written escalation path, and does it exist on the plan we are buying or only on the one above it?",
  ],
  faqs: [
    {
      question:
        "Is Postmark actually better at deliverability, or is that just its marketing?",
      answer:
        "It is better in a way that has a mechanism rather than a mystery. Postmark keeps bulk mail off the transactional pool by design, removes senders who damage it, and watches placement continuously with staff who know what they are looking at. SendGrid's pool is much larger and much more varied, which is both its strength and the reason a neighbour's behaviour is more likely to be part of your experience. You are buying enforced discipline, not a secret.",
    },
    {
      question: "I am on SendGrid's retired free tier. What are my options?",
      answer:
        "The permanent free tier ended in May 2025 and was replaced by a sixty-day trial with a low daily cap, so the choices are a paid SendGrid plan, another vendor, or moving that traffic somewhere cheap. If the sending in question is a side project or a staging environment, it is worth separating it from production first — a great many teams discover during this exercise that two quite different workloads had been sharing one account and one reputation for years.",
    },
    {
      question:
        "Can I keep my SendGrid dynamic templates if I move to Postmark?",
      answer:
        "Not directly. SendGrid's dynamic templates use a handlebars-style syntax evaluated inside SendGrid, and Postmark's templating is its own. The HTML moves fine; the logic does not. Most teams take the opportunity to move rendering into their own application and send finished HTML, which removes the lock-in entirely and makes the next migration a code change. Budget for that rather than for a direct translation.",
    },
    {
      question: "Does Postmark do marketing email at all?",
      answer:
        "It has broadcast streams, which are enough to send an announcement to a list, and it deliberately stops there. There is no segmentation engine and no visual designer, and the company is clear that this is intentional rather than a roadmap gap. If a marketing team needs campaign tooling, plan for a second product alongside Postmark and accept that you will be reconciling two suppression lists, because the alternative is asking Postmark to be something it has spent a decade refusing to become.",
    },
    {
      question: "Which one is less likely to cut me off without warning?",
      answer:
        "Both will stop your sending if your metrics justify it, and neither will consult you first. The difference people report is what the conversation is like afterwards: Postmark's is with a small team that explains the trigger, SendGrid's is with a compliance function that operates independently of the support queue you are shouting into. Neither is a guarantee, and the only real protection on either side is clean list practices and a bounce-rate alert you built before you needed it.",
    },
    {
      question: "Does Postmark have anything like subusers?",
      answer:
        "No, and for a platform sending on behalf of other businesses that is the most consequential gap in this comparison. Message streams separate traffic types within one account; they do not give each of your customers their own credentials, their own reputation and their own report. The workaround is one Postmark account per tenant, administered by you, with no consolidated view across them — which works at five customers and does not work at two hundred. Price that honestly before the deliverability argument wins the evaluation.",
    },
    {
      question: "Can Postmark handle our inbound mail too?",
      answer:
        "Yes, through an inbound stream that parses the message and posts structured fields to your webhook, with the same activity view over what arrived as over what left. SendGrid's Inbound Parse does the equivalent job, matching on a hostname you point at it. The two are close enough in intent that either will serve, and different enough in matching rules, payload shape and how failures surface that moving between them is a re-implementation with its own testing rather than a change of URL.",
    },
    {
      question: "What happens to our dedicated IP and the warm-up behind it?",
      answer:
        "Both stay with the vendor you are leaving. The address is theirs and the reputation is a record the mailbox providers keep about that address rather than about your domain, so the weeks of gradually increasing volume somebody already served are spent again. On the narrower side a dedicated address is gated behind the higher plans with a monthly volume minimum, so check you clear that floor before assuming the option exists — and remember that a dedicated address sending sporadically performs worse than the shared pool it left.",
    },
    {
      question: "How long should we run both providers in parallel?",
      answer:
        "Until the placement data says stop, which is weeks rather than days at meaningful volume and is not compressible by working harder. The standard shape is both vendors live on separate subdomains with a percentage of traffic shifting each week, lowest-stakes class first, while somebody watches complaint and bounce rates at every step. The part teams forget is the invoice: two subscriptions for the duration, which is a real number that belongs in the business case rather than arriving as a surprise in month two.",
    },
  ],
};

const AMAZON_SES_VS_BREVO: VersusPage = {
  slug: "amazon-ses-vs-brevo",
  a: "amazon-ses",
  b: "brevo",
  title: "Amazon SES vs Brevo",
  description:
    "An AWS primitive against a European all-in-one suite with email, SMS and a light CRM on one invoice. Anyone comparing these is really asking whether they need a marketing tool or just a way to send.",
  search: {
    primaryQuery: "european email platform or aws ses for a small business",
    secondaryQueries: [
      "brevo transactional api versus raw ses",
      "gdpr compliant email sending without a us vendor",
      "which brevo plan includes automation",
      "do i need a marketing platform or just a send api",
      "how to move from brevo to amazon ses",
      "does amazon ses generate an unsubscribe link",
      "exporting brevo blocklisted contacts to a suppression list",
    ],
    rationale:
      "These two sit in different categories, so the search that produces this comparison is usually a small European team deciding what kind of tool they need at all. That question has no neutral answer published anywhere, because every vendor answering it sells one of the two shapes.",
  },
  intro:
    "This is a category mismatch that people compare anyway, and the mismatch is the useful part. Brevo is a marketing suite that happens to expose a transactional API. SES is sending infrastructure that will never have a campaign builder. If your company has someone whose job is to write emails to customers, that person needs a tool, and SES is not one. If your email is entirely generated by code, Brevo's suite is a cost you are carrying to use one endpoint. Most teams comparing these two already know which description fits and are looking for permission.",
  dimensions: [
    {
      heading: "Who opens the tool on a Monday morning",
      a: "Nobody, ideally. SES is configured once by an engineer and then runs, and the console exists to manage identities, quotas and configuration sets rather than to be visited. There is no campaign to schedule, no list to segment, no report to read. A non-technical colleague has no reason to have an account and would find nothing to do with one.",
      b: "A marketer, a founder wearing the marketing hat, or an operations person. Brevo's whole shape assumes a human sits down and decides who receives what — a contact list, a segment, a designed email, a send time, a report afterwards. That is a different product category from an endpoint, and it is why the comparison is really about org chart rather than technology.",
    },
    {
      heading: "European data residency, and the argument underneath it",
      a: "SES runs in European AWS regions and the choice is yours, so mail can be processed inside the EU as a configuration decision. The objection a European buyer raises is about ownership rather than geography, and it is a fair objection: an EU region operated by a US-headquartered company is a different answer from an EU-headquartered company, whatever the data flow diagram says. Whether that distinction matters is a legal question for your counsel, not a technical one.",
      b: "Brevo is a French company operating in the EU, which answers the ownership version of the question rather than only the geography version. For a buyer whose requirement was written by a data protection officer rather than an architect, that is frequently the end of the evaluation. The consent and preference tooling is also built for that regime rather than retrofitted, which shows in the parts of the product concerned with who agreed to what.",
    },
    {
      heading: "Everything that is not email",
      a: "SES is email. There is SMS in a separate AWS service with its own setup, its own approvals and its own console, and there is no CRM anywhere in the picture. Assembling a multi-channel story on AWS is entirely possible and is genuinely several projects, each with its own registration and compliance steps. Nothing arrives bundled.",
      b: "Email, SMS, a light CRM, chat and automation on one invoice with one contact record underneath. For a small business this is a real simplification, because the alternative is three vendors and a reconciliation problem. The honest caveat is that each individual piece is less capable than a specialist tool, so the value is in the integration rather than in any one component being best.",
    },
    {
      heading: "The tier that has the feature you assumed was included",
      a: "SES has no tiers in this sense. The plan affects the rate you pay rather than the capability you get, and there is no feature behind a paywall because there are barely any features. What you have on day one is what you will have in year three, which is either reassuring or bleak depending on what you needed.",
      b: "The headline tier is usually not the one that works. Automation and A/B testing sit a step up, and removing the Brevo logo from your emails is also not on the entry plan. This is not hidden, but it is consistently how the evaluation goes wrong: a price is quoted from the cheapest row and the requirement list turns out to need the row above it. Price the tier that has the features, not the tier on the homepage.",
    },
    {
      heading: "Deliverability and the shared pool",
      a: "Your reputation, isolated to your account, visible in your own metrics, and nobody else's problem or benefit. A new SES identity starts from nothing and must be warmed, which is real work. Once warmed, the standing belongs to your account and travels with you across any tooling change, which is the durable half of the argument for owning this layer.",
      b: "Brevo's shared pools, which draw mixed reports — the common pattern being that a sender with good engagement is fine and a sender with a purchased list discovers that everyone on the pool shares the consequences. Dedicated options exist higher up the range. For a small sender with a clean list the shared pool is usually a net benefit, since their aggregate standing is better than a brand new domain's.",
    },
    {
      heading: "Consent, unsubscribes and the compliance surface",
      a: "SES gives you an account-level suppression list and a configuration-set-level one, and nothing else. It will not manage consent, will not store a preference centre, will not record why somebody is on your list and will not generate an unsubscribe link. Every one of those is a thing you build, and every one of them is a thing a regulator may ask about. The suppression list is a safety net, not a compliance programme.",
      b: "Contact attributes, consent tracking, subscription preferences and a hosted unsubscribe flow are part of the product, built for a regime where a data protection officer will ask to see them. For a team without an engineer to spare this is a substantial amount of work you are not doing, and it is probably the strongest non-marketing argument for the suite shape.",
    },
    {
      heading: "What the price is charged against",
      a: "Messages. No platform fee, no plan to outgrow, billed by AWS with everything else, and the per-message economics are why large senders end up here. New accounts land on a metered plan rather than the old flat rate, and the plan is scoped per account and per region, so a second region is a second decision. The line is straight and the slope is small.",
      b: "Send volume rather than contacts, which is an unusually sane choice in the marketing-suite category and means a large dormant list does not by itself raise the bill. The tier step is the thing that does. Compared against SES the per-message cost is much higher and the comparison is not really the point, because a substantial part of what you are paying for is the person-shaped tooling SES does not have.",
    },
    {
      heading: "What happens when you outgrow it",
      a: "You do not, in the sense that matters. SES scales past any volume a small business will reach and the quota rises on request. What you outgrow is the absence of everything else, and the response is to add tooling on top rather than to change providers — which is a much less disruptive kind of growth than a migration.",
      b: "Growth here tends to mean either climbing the tiers until the invoice provokes a review, or discovering that the automation engine cannot express what your lifecycle has become. Both lead to the same conversation, and the migration is harder than a sending migration because contacts, segments, automations and consent records all have to move rather than just a send call.",
    },
  ],
  pickA: [
    "All of your email is generated by code, and nobody at the company will ever want to schedule a campaign or open a report.",
    "Volume is high enough that per-message economics dominate, and you are already inside AWS with an engineer to own the plumbing.",
    "You need delivery events in your own storage on your own retention schedule rather than in a vendor's reporting view.",
    "Sending reputation should belong to an account you keep, so that changing the tooling above it is never a migration.",
  ],
  pickB: [
    "Someone whose job is not engineering needs to write, schedule and measure emails without waiting for a deploy.",
    "A data residency requirement was written by a data protection officer, and an EU-headquartered vendor answers it more cleanly than an EU region of a US one.",
    "Email, SMS and a contact database on one invoice is worth more than any individual component being best in class.",
    "Consent tracking, preference management and hosted unsubscribe flows are things you would rather buy than build and maintain.",
  ],
  prosA: [
    "The per-message rate carries no platform fee and no seat count, so a company of four and a company of four hundred pay the same rate for the same traffic.",
    "European regions are a configuration choice rather than a product tier, so mail can be processed inside the EU without paying for a plan that mentions it.",
    "Sending reputation accrues to an AWS account you continue to own, which means every later change to the tooling above it is a refactor rather than a migration.",
    "Raw MIME is accepted, so a header a regulator asked for, an unusual content type or a specific threading behaviour is something you can simply set.",
  ],
  consA: [
    "There is no preference centre, no consent record and no generated unsubscribe link, so the compliance surface a European buyer cares about is entirely yours to build.",
    "Suppression exists only as bounce and complaint entries. An unsubscribe has no representation at all in SES, which means the most common opt-out in marketing mail lives in your database or nowhere.",
    "SMS is a wholly separate AWS service with its own registration, its own approvals and its own console, so the one-invoice multi-channel story does not exist.",
    "New accounts start in a sandbox and must apply for production access, which is an AWS decision on AWS's timetable and the step most likely to slip a launch date.",
  ],
  prosB: [
    "An EU-headquartered company operating in the EU answers the ownership form of a residency question, not merely the geography form, which is frequently the whole evaluation.",
    "Billing follows send volume rather than stored contacts, so a large dormant list costs nothing to keep — the opposite of almost everything else in this category.",
    "Consent tracking, subscription preferences and a hosted unsubscribe flow ship as product, built for a regime where somebody will eventually ask to see them.",
    "Email, SMS, chat and a light CRM sit against one contact record, which for a small business replaces three vendors and the reconciliation between them.",
  ],
  consB: [
    "Automation, A/B testing and removing the Brevo logo from your mail all live above the entry plan, so the tier people price is reliably not the tier they need.",
    "The shared sending pools draw mixed reports, and a sender with a purchased list discovers that the pool is shared in the direction they did not want.",
    "Each component is less capable than the specialist tool it replaces, so the value is in the integration rather than in any one piece being the best available.",
    "Growth ends either in climbing tiers until the invoice provokes a review or in an automation engine that cannot express what your lifecycle became.",
  ],
  migrationChecklist: [
    "Be clear that the two directions are not mirror images. Leaving Brevo for SES means acquiring the things Brevo was quietly doing: sandbox approval, bounce and complaint processing, a suppression story, reputation monitoring and a dashboard for whoever asks what happened. Coming the other way you hand all of that back and buy a campaign tool. Only one of those directions has an approval gate in it.",
    "Export the blocklisted contacts by reason rather than as one file. Brevo distinguishes hard bounces, spam complaints and unsubscribes in its blocklist, and SES has exactly two suppression reasons and no concept of an unsubscribe at all. Two of the three exports load into the SES account-level suppression list; the third has no destination in AWS and must become a table in your own database before the first send.",
    "Build the opt-out before you need it. Brevo hosts the unsubscribe page, stores the preference selections behind it and writes the link into every campaign. SES writes no link, hosts no page and records no preference. The List-Unsubscribe header, the one-click POST endpoint behind it and the page a recipient lands on are three things to have working on the day you cut over, not the week after.",
    "Move the contact attributes somewhere they can still be queried. Brevo's attributes, lists and folders are the segmentation model, and SES has no model of a person at all. Whatever decides who receives a message has to exist as a query in your own database, which for a team that only ever segmented in the Brevo UI is a schema conversation rather than an export.",
    "Re-author the templates instead of exporting them. Brevo's designer emits builder HTML wrapped around its own substitution tags, and SES either takes finished HTML or its own minimal template API with token replacement and nothing else. The visual layout can be salvaged; the conditional logic in the Brevo template cannot, because it is evaluated on their side and there is nothing on the other side to evaluate it.",
    "Start the SES production access application before anything else is ready. It is the only step on this list that somebody outside your company decides, and it asks concretely how you collect addresses and how you handle bounces — questions that are easier to answer honestly once the suppression work above is done rather than before it.",
    "Pick the SES region deliberately if residency was the reason you were on Brevo in the first place. An EU region keeps processing inside the EU, and it does not convert AWS into a European company. If the requirement was written about the entity rather than the data path, this migration does not satisfy it and it is cheaper to discover that now.",
    "Plan the SMS and CRM traffic as separate projects or accept that they stop. AWS End User Messaging is a different service with its own registration, its own sender approvals and its own console, and there is no AWS product that corresponds to Brevo's deals pipeline. Teams that count only the email work are usually the ones who find this out after the Brevo subscription has been cancelled.",
  ],
  buyingQuestions: [
    "Who at this company will open an email tool in a normal week, and does that person write code?",
    "Does our residency requirement name a region, or does it name the nationality of the company holding the data?",
    "If we stop paying for a hosted unsubscribe page and a consent record, who is building those and when?",
    "Which Brevo tier actually contains everything on our requirements list, and is that the number we have been comparing against?",
    "Do we send SMS today, and has anybody priced the separate AWS registration and approval that would replace it?",
    "Who owns the SES production access application, and what is the plan if AWS comes back asking for more detail?",
    "Is our list clean enough that a shared pool helps us, or engaged enough that an isolated reputation would serve us better?",
  ],
  faqs: [
    {
      question: "Can I use Brevo for marketing and SES for transactional?",
      answer:
        "Yes, and it is a common arrangement for teams whose developers and marketers want different things. Use separate subdomains so DKIM keys, reputation and DMARC alignment stay independent of each other. The cost is the reconciliation: two suppression concepts, two definitions of unsubscribed, and a real chance that somebody who opted out of marketing keeps receiving it because the opt-out landed in the system that was not sending it.",
    },
    {
      question: "Does Brevo charge per contact like most marketing tools?",
      answer:
        "No, and this is the most genuinely distinctive thing about its pricing. Brevo charges on send volume rather than on stored contacts, which means a large dormant list does not raise the bill by itself — the opposite of how Klaviyo, Customer.io and Loops all work. If your list is big and your sending is occasional, that difference can be larger than every other factor in the comparison combined.",
    },
    {
      question: "Is SES compliant with GDPR?",
      answer:
        "AWS provides the contractual machinery, and SES can be run entirely in European regions, so the infrastructure side is answerable. What SES does not provide is the compliance programme: consent records, preference management, unsubscribe handling and the ability to show a regulator who agreed to what. Those are yours to build. Compliance here is a property of your system rather than a property of the sending service, which is the part that catches teams out.",
    },
    {
      question: "Which Brevo plan do I actually need?",
      answer:
        "Almost certainly not the cheapest one. Automation and A/B testing live a tier up, and removing the Brevo logo from your emails is likewise not on the entry plan. Write down the features you need first, find the lowest row that has all of them, and compare that number rather than the headline. Evaluations of this product go wrong at this exact step more often than at any other.",
    },
    {
      question: "How much cheaper is SES in practice?",
      answer:
        "Per message, dramatically, and the comparison is close to meaningless on its own because you are comparing an endpoint to a suite. The fair version prices the whole job: SES plus whatever you would run for campaigns, consent and reporting, against Brevo at the tier that has the features you need. Done that way SES still usually wins at volume, and at small volume with a marketing person in the loop it frequently does not.",
    },
    {
      question: "What does SES give me for unsubscribes?",
      answer:
        "A suppression list that understands bounces and complaints, and nothing that understands an unsubscribe. There is no generated link, no hosted page and no preference record. Modern mailbox providers expect a List-Unsubscribe header with a one-click endpoint behind it on bulk mail, so you build the header, the endpoint and the page, and you store the result somewhere you can prove later. On a suite this is a checkbox. Here it is a small feature with a compliance consequence, and it is the single most underestimated item in a move from Brevo.",
    },
    {
      question: "How long does SES production access take?",
      answer:
        "Frequently under a day and sometimes considerably longer, and the variance is the problem rather than the average. AWS is deciding whether to lend you its shared reputation, so the application asks how you obtained the addresses, what you will send and what happens to a bounce. A vague answer gets a request for more detail and another wait. Teams that have already built bounce handling and a suppression path answer it in three concrete sentences and are usually through quickly. Nobody should plan a launch date around it being instant.",
    },
    {
      question: "Will my Brevo unsubscribe links keep working after a move?",
      answer:
        "No, and this is worth checking before the account is closed rather than after. Those links point at Brevo-hosted pages tied to your Brevo account, so they stop resolving when the subscription ends, and any message already sitting in someone's inbox carries a dead opt-out. The safe sequence is to publish your own unsubscribe endpoint first, send from it for a full campaign cycle, and only then wind the old account down — which also gives you a period where both records are being written and can be reconciled.",
    },
    {
      question: "What replaces Brevo's contact attributes on SES?",
      answer:
        "Your own database, and the honest version of that answer is that the work is not the storage but the queries. Brevo's attributes exist so somebody without SQL can build an audience in a UI, and moving them into a table gives you the data while removing the person who was using it. Teams that make this move successfully either accept that audiences are now engineering requests, or put a platform layer over SES that restores a contact model. Exporting the attributes is an afternoon; deciding who builds segments afterwards is the actual decision.",
    },
  ],
};

const AMAZON_SES_VS_KLAVIYO: VersusPage = {
  slug: "amazon-ses-vs-klaviyo",
  a: "amazon-ses",
  b: "klaviyo",
  title: "Amazon SES vs Klaviyo",
  description:
    "Klaviyo sells attributed revenue to an ecommerce marketing team. SES sells delivery to a program. Comparing their prices is comparing a salary to a utility bill, and most teams that run this comparison end up using both.",
  search: {
    primaryQuery: "can i replace klaviyo with amazon ses",
    secondaryQueries: [
      "klaviyo active profile billing explained",
      "klaviyo sending limit ten times profile count",
      "cheaper way to send ecommerce campaigns",
      "shopify transactional email without klaviyo",
      "does klaviyo attributed revenue data export",
      "moving order confirmations off klaviyo",
      "rebuilding abandoned cart without a marketing platform",
    ],
    rationale:
      "The search is driven by a Klaviyo invoice, and the answers available are written either by Klaviyo or by competitors selling a similar shape. Nobody explains that the honest replacement for Klaviyo is not a send API, which is the thing the person asking most needs to hear.",
  },
  intro:
    "People arrive at this comparison holding a Klaviyo invoice and a memory that SES costs almost nothing, and the arithmetic looks irresistible. It is also mostly wrong, because the two products are not selling the same thing. Klaviyo's product is attributed revenue: it knows what a customer bought, segments on it, and tells a marketing team which campaign paid for itself. SES delivers bytes. You can build a campaign tool on SES; what you cannot cheaply build is the data model and the attribution that made the invoice feel worth paying in the first place.",
  dimensions: [
    {
      heading: "What each one actually knows about a customer",
      a: "Nothing. SES has no concept of a person, a profile, an order or a purchase. It has verified identities and destination addresses, and if you want to send to everyone who bought a specific product and has not returned in ninety days, that query runs in your database and the result is a list you feed to a send loop. The sending is trivial; the segmentation is a system you already have or a system you are about to write.",
      b: "A profile per customer, populated by an ecommerce integration, carrying orders, browsing behaviour, lifetime value and campaign history. Segments are built against that in a UI by someone who cannot write SQL, and they update themselves. This data model is the product. The email sending attached to it is comparatively ordinary and is not why anyone chooses Klaviyo.",
    },
    {
      heading: "Revenue attribution, which is the actual purchase",
      a: "SES reports deliveries, bounces, complaints, opens and clicks if you configure event publishing. It has no idea whether any of that produced a sale, because it has no idea what a sale is. Connecting mail to revenue means joining your event stream to your orders table and building the report, which is an ordinary data engineering task and is nobody's favourite quarter.",
      b: "Attributed revenue per campaign and per flow, out of the box, against a configurable attribution window. This is the number a marketing team defends its budget with, and it is the reason the invoice survives review. Whether the attribution is generous is a fair argument to have; that it exists as a first-class report, produced without a data team, is not really arguable.",
    },
    {
      heading: "How the bill is calculated, and the trap inside it",
      a: "Per message sent. A dormant customer costs nothing until you mail them. A list of a million people you never contact is free. That property is unusual in this comparison and it is the strongest financial argument on the SES side, particularly for a business with a long tail of one-time buyers who will never open anything again.",
      b: "Per active profile, billed on everyone in the account rather than only the people you mail, and the definition of active broadened in February 2025. The plan auto-upgrades as profiles accumulate and never auto-downgrades, so a list that grew during a promotion keeps charging after the promotion ends until somebody manually suppresses or deletes profiles. List hygiene is a billing activity here, not just a deliverability one.",
    },
    {
      heading: "The ceiling nobody reads until it stops them",
      a: "SES has a sending rate and a daily quota, both of which start conservative and both of which AWS raises on request while your bounce and complaint rates stay healthy. The ceiling moves when you ask. A large seasonal push is planned a week ahead as a quota increase, not as a plan change, and the cost of the push is exactly proportional to its size.",
      b: "Volume is capped at roughly ten times your profile count, and sending halts when you cross it. For most ecommerce patterns this is generous and invisible. For a business that mails a small, extremely engaged list frequently — a membership, a daily deal, a back-in-stock heavy catalogue — it is a hard stop that can only be lifted by paying for more profiles than you have customers, which is a strange shape to discover mid-campaign.",
    },
    {
      heading: "Flows, and what building them yourself would mean",
      a: "There is no automation in SES whatsoever. An abandoned-cart sequence on SES is a state machine you write: an event source, a scheduler, a suppression check at send time, an exit condition when the order completes, and a way for a marketer to change the copy without a deploy. None of it is difficult and all of it is real, and the version that exists after one sprint is the version that mails people who already bought.",
      b: "Flows are the half of Klaviyo that quietly earns the money — abandoned cart, browse abandonment, post-purchase, winback — built in a visual editor, with the exit conditions and timing handled. A marketing team changes them without engineering involvement. This is the capability most likely to be underestimated by someone modelling a migration from the sending cost alone.",
    },
    {
      heading: "Who operates it day to day",
      a: "An engineer, always. Every change to what is sent, to whom and when is a code change, a deploy and a review. That is genuinely the right arrangement for transactional mail, where you want exactly that level of control. It is the wrong arrangement for promotional mail, where the person with the ideas is not the person with commit access and the round trip kills the tempo.",
      b: "A marketer, entirely. Campaigns, segments, flows, subject lines, send times and reports are all theirs, and engineering's involvement ends once the integration is connected. For a business where marketing moves faster than the release cycle, this independence is the product benefit even more than the features are.",
    },
    {
      heading: "Deliverability, and who is responsible for it",
      a: "You are, alone. Your reputation, your bounce rate, your complaint rate, your DMARC reports, your warming schedule. The isolation is real and cuts both ways: no neighbour can hurt you and nobody will notice your problem for you. Ecommerce list practices — purchased lists, aggressive popup capture, resurrecting three-year-old customers — are exactly the practices that damage a reputation, and on SES the damage is entirely yours.",
      b: "Klaviyo's shared infrastructure, with a deliverability function that monitors it and a commercial interest in keeping the pool clean. Being on a pool with other ecommerce senders during the same seasonal peaks is a mixed blessing, and Klaviyo actively polices sending practices for that reason. For a merchant with no in-house expertise this is a real service, and it is invisible until you leave.",
    },
    {
      heading: "The arrangement most teams actually land on",
      a: "SES for transactional — order confirmations, shipping notices, password resets, receipts — where the volume is high, the content is generated by code, the placement requirement is strict and the marketing features are irrelevant. This traffic is often the majority of messages and a small minority of the marketing bill, which makes it the cheapest thing to move and the least disruptive.",
      b: "Klaviyo for campaigns and flows, where the segmentation and the attribution are the whole point. Splitting this way keeps each workload on the tool shaped for it and reduces the profile count Klaviyo bills for, since transactional-only recipients no longer need to be profiles. Use separate subdomains so the reputations stay independent, and accept that you now reconcile two views of who unsubscribed.",
    },
  ],
  pickA: [
    "The mail in question is transactional — receipts, shipping, resets — where code generates the content and no marketer needs to touch it.",
    "A long tail of dormant customers is inflating a profile-based bill for people you have no intention of emailing.",
    "You need to mail a small, highly engaged list far more often than a profile-count multiplier would allow.",
    "Your team already has the customer data model and the reporting, so what you need from a vendor is delivery rather than a database.",
  ],
  pickB: [
    "A marketing team needs to segment on purchase behaviour and see attributed revenue without asking a data team for anything.",
    "Abandoned-cart, browse-abandonment and post-purchase flows are the mechanism, and rebuilding them is a quarter you do not have.",
    "The person who writes the emails does not have commit access and should not need it.",
    "Nobody in-house owns deliverability, and a vendor whose commercial interest is a clean sending pool is worth paying for.",
  ],
  prosA: [
    "A shopper who bought once in 2021 and will never open anything again is free to keep, because the meter counts messages rather than people.",
    "The sending rate and daily quota rise on request while your bounce and complaint numbers stay healthy, so a seasonal push is a ticket rather than a plan change.",
    "Delivery events can be published to your own storage on your own retention schedule, which is what makes joining mail to orders a query rather than a vendor report.",
    "Reputation sits inside an AWS account you keep, so replacing whatever composes the messages above it never restarts the warm-up.",
  ],
  consA: [
    "There is no concept of a person, an order or a purchase, so every segment that Klaviyo evaluates continuously becomes a query somebody has to write and schedule.",
    "Nothing in SES knows what a sale is, so attributed revenue — the number that defends a marketing budget — has to be reconstructed by joining an event stream to an orders table.",
    "Abandoned cart, browse abandonment and winback are not features that are weaker here; they are absent, and the state machine behind each one is a real project.",
    "A new identity starts cold and the ecommerce list practices that inflate a store's list are exactly the ones that damage an isolated reputation fastest.",
  ],
  prosB: [
    "The profile carries orders, browsing and lifetime value straight from the store integration, so a segment like bought twice and lapsed is a UI action rather than a data project.",
    "Revenue attributed per campaign and per flow exists as a first-class report, produced without a data team, which is why the invoice survives review.",
    "Flows do the majority of the per-message work in most stores, and they run continuously without anybody remembering to schedule them.",
    "Sending practices are policed by a vendor with a commercial stake in the pool staying clean, which is a real service for a merchant with no in-house expertise.",
  ],
  consB: [
    "The meter counts active profiles across the account rather than the people you actually mail, and the plan ratchets upward across thresholds while never stepping back down.",
    "Monthly volume is capped near ten times the profile count, so a small devoted list mailed frequently can only buy headroom by paying for profiles it does not have.",
    "The attribution series that justified the spend is computed inside the platform's data model, so it leaves as a table of numbers rather than as something another tool can reproduce.",
    "Everything valuable depends on the store integration continuing to sync, which makes the platform harder to leave than the monthly figure suggests.",
  ],
  migrationChecklist: [
    "Split the traffic before you cost the move, because only one half of it can travel. Order confirmations, shipping notices and receipts are high volume, code-generated and indifferent to segmentation, and they move to SES in a sprint. Campaigns and flows are a customer data model with attribution attached, and moving those is a quarter of engineering that usually ends back where it started.",
    "Suppress rather than delete while the profile count is still the billing meter. Klaviyo bills on active profiles and the plan steps up without stepping back down, so the first useful action is not a migration at all — it is suppressing shoppers who have not engaged in a year and seeing what the invoice does. Teams that skip this step frequently discover the platform was never the expensive part.",
    "Export the three suppression states separately and understand that only two of them have anywhere to land. Klaviyo distinguishes people who unsubscribed, people you suppressed by hand and addresses that bounced or were judged invalid. SES keeps bounces and complaints and has no representation of an unsubscribe, so that third group becomes a table you own and check at send time or it becomes a compliance incident.",
    "Snapshot the attributed revenue series before the account closes. The per-campaign and per-flow revenue numbers are computed inside Klaviyo's own model against a configurable attribution window, and what exports is the output rather than the mechanism. If anyone reports that series to a board quarterly, the last export you take is the last comparable figure you will ever have, because the replacement report will draw its own window differently.",
    "Decide where the store event stream lands. The integration is bidirectional — orders, browse events, back-in-stock interest all flow in and campaign engagement flows back — and nothing in SES consumes any of it. Either that stream terminates in your own warehouse from the day of the cut, or the segmentation you were relying on quietly stops being computable a week later with nobody noticing.",
    "Replace the hosted signup forms and popups, which are doing more than they appear to. They capture the address, write the profile, timestamp the consent and start the welcome flow in one action. On the other side that is a form on your site, a row in your database, a consent record you can produce on request and a trigger you wrote. Leaving them live on a cancelled account is how you collect addresses into nothing.",
    "Set up DKIM on your own domain and run both senders in parallel through a full campaign cycle. Klaviyo signs through domains it manages via records you delegate; SES signs with keys on identities in your account. Because the two do not share reputation, a sudden cutover arrives at the mailbox provider as a brand new sender behind a familiar domain, which is the exact pattern that gets throttled during a peak week.",
    "File for SES production access early and answer it with the work above. The sandbox application asks how addresses were collected and what happens to a bounce, which are precisely the questions the suppression export and the form replacement have just forced you to answer properly. Doing it in that order turns an unpredictable gate into a short one.",
  ],
  buyingQuestions: [
    "How much of our profile count is shoppers we have no intention of contacting again, and what happens to the invoice if we suppress them this week?",
    "Which specific flows are earning their keep, and has anyone measured them against campaigns per message rather than in total?",
    "If the attributed revenue report stopped existing tomorrow, who would notice and what would they use instead?",
    "Is our monthly volume anywhere near ten times our profile count, and do we know what happens the day it crosses?",
    "Who would own segmentation once it becomes a query, and are they the same person who currently builds audiences?",
    "What is the transactional share of our total messages, and what would moving only that do to both the bill and the profile count?",
    "Are we within eight weeks of our busiest season, and is that a period in which anybody should be warming a new sender?",
  ],
  faqs: [
    {
      question: "Can I actually replace Klaviyo with SES?",
      answer:
        "Only if you replace the parts of Klaviyo you use with something, and for most merchants that means building a segmentation engine, a flow engine and an attribution report on top of SES. The sending is the easy tenth. Teams that try this usually finish the sending in a week, produce a campaign tool in a quarter that the marketing team refuses to use, and end up back on a marketing platform with a year of work behind them.",
    },
    {
      question: "Why did my Klaviyo bill go up when I did not send more?",
      answer:
        "Because it is charged on active profiles rather than on sends, and the definition of active broadened in February 2025. Profiles accumulate from signups, from checkout, from integrations, and the plan auto-upgrades as the count crosses each threshold while never auto-downgrading when it falls. Suppressing or deleting profiles you will never mail is a billing action here, and it is the first thing to do before concluding the product is too expensive.",
    },
    {
      question: "What is the ten-times sending limit?",
      answer:
        "Klaviyo caps monthly email volume at roughly ten times the number of profiles your plan covers, and sending stops once you cross it. Most ecommerce patterns never approach it. The businesses that do are the ones mailing a small, devoted list frequently — memberships, daily deals, back-in-stock alerts — and their only route past the cap is paying for more profiles than they have customers, which is worth discovering before a peak season rather than during one.",
    },
    {
      question: "Can I send transactional email through Klaviyo?",
      answer:
        "There is a transactional path, and it is not what the product is optimised for. Order confirmations and shipping notices are frequently routed through a platform or an ecommerce host instead, and password resets almost always live elsewhere. The more common split is transactional on a cheap reliable sender and campaigns on Klaviyo, which also lowers the profile count you are billed for because transactional-only recipients no longer need to be profiles.",
    },
    {
      question:
        "If I move transactional email to SES, will my marketing deliverability change?",
      answer:
        "It can, and you should plan for it deliberately. Transactional mail has high engagement and contributes positively to a domain's reputation, so removing it from one sender and adding it to another shifts the signal both ways. Use separate subdomains so the two reputations are genuinely independent, warm the new SES identity gradually, and do not make this change in the four weeks before your busiest season.",
    },
    {
      question: "Does my attributed revenue history come with me?",
      answer:
        "The numbers export; the method does not. Attribution is computed inside the platform against a window you configured, joining campaign engagement to orders it learned about through the store integration, and no other system will reproduce that arithmetic from a spreadsheet of totals. Take a final export covering as long a period as the account will give you, and expect the first report you build afterwards to disagree with it — not because either is wrong, but because you will have chosen a different window and a different definition of a touch.",
    },
    {
      question: "What happens to my signup forms if I leave?",
      answer:
        "They stop, and they were doing four jobs rather than one. A hosted form captures the address, creates the profile, records when consent was given and triggers the welcome sequence. Move the capture to your own site before the account closes, write the consent timestamp somewhere you could produce it if asked, and have the welcome sequence working on the new sender first. Teams that cancel before this is done keep collecting addresses through embedded forms that write into an account nobody is paying for.",
    },
    {
      question: "How do I rebuild abandoned cart on SES?",
      answer:
        "As a state machine, and the honest inventory is longer than it sounds. You need the cart event, a delay that survives a deploy, per-shopper state so a restart does not send twice, an exit condition that fires the moment the order completes, a suppression check immediately before sending, and alerting for the week the job silently stops. The first version runs in about a week. The version that does not email people who already bought is a great deal further out, and that failure is visible to customers.",
    },
    {
      question: "Is it worth moving only order confirmations?",
      answer:
        "Frequently yes, and it is the move most merchants should evaluate before any other. Confirmations and shipping notices are often the majority of messages and a minority of the value the platform provides, so shifting them cuts the sending cost and can cut the profile count as well, because recipients who only ever received transactional mail no longer need to exist as profiles. Do it on a separate subdomain, warm it gradually, and keep the marketing programme exactly where it is while you measure the result.",
    },
  ],
};

const AMAZON_SES_VS_CUSTOMER_IO: VersusPage = {
  slug: "amazon-ses-vs-customer-io",
  a: "amazon-ses",
  b: "customer-io",
  title: "Amazon SES vs Customer.io",
  description:
    "Customer.io is a behavioural workflow engine that happens to send email. SES is the sending with no behaviour attached. Teams comparing them are deciding whether lifecycle logic belongs in a product or in their own codebase.",
  search: {
    primaryQuery: "build lifecycle emails in house or buy a messaging platform",
    secondaryQueries: [
      "customer.io profile billing for unengaged signups",
      "what it takes to build drip campaigns on ses",
      "who should own onboarding email logic",
      "cheaper alternative to a behavioural messaging platform",
      "migrating liquid templates off a messaging platform",
      "topic level unsubscribe with amazon ses",
      "exporting customer.io workflows to another system",
    ],
    rationale:
      "The build-or-buy question for lifecycle messaging is asked constantly by SaaS teams and answered almost exclusively by vendors selling the buy side. The specific thing missing from those answers is an honest account of what the build actually contains after the first sprint.",
  },
  intro:
    "Every SaaS team eventually asks whether the onboarding sequence should live in a platform or in the application, and this pair is that question in its purest form. Customer.io ingests events and attributes, holds a profile per user, and lets a non-engineer compose the logic that decides who receives what and when. SES takes a rendered message and an address. The gap between them is not sending — it is a workflow engine, a data model and an editor, and the argument is entirely about whether those belong to you.",
  dimensions: [
    {
      heading: "The data model, which is the real difference",
      a: "SES has no model of a user. There is a destination address and a message, and that is the whole vocabulary. If the decision to send depends on what someone did last Tuesday, that decision happens in your application against your database, and SES is told the answer. For teams whose product data is already rich and already queryable, this is not a gap at all — it is a refusal to duplicate something they have.",
      b: "A profile per person, fed by an event stream and an attribute payload from your application, with segments evaluated continuously against it. The platform holds a second copy of the part of your user model that matters for messaging. That duplication is the price of admission and also the entire benefit, because it is what lets somebody who cannot query your database express when a user has not completed setup in five days.",
    },
    {
      heading: "What building the workflow engine actually involves",
      a: "More than the first estimate and less than the horror stories. A credible in-house sequence needs a trigger source, a scheduler that survives a deploy, per-user state so a restart does not re-send, exit conditions when the user does the thing you were nagging about, a suppression check at send time, a way to change copy without shipping code, and enough observability to notice the sequence stopped firing. Each piece is a day. The integration and the edge cases are the quarter.",
      b: "All of that exists and is the product. Workflows are built in a visual editor with branches, waits, exit conditions and A/B splits, and they run whether or not your deploy went well. The parts that are hard to build yourself — idempotency across restarts, timezone-aware sends, a person leaving a branch mid-flight — are handled and mostly invisible. That invisibility is why the build estimate is always low.",
    },
    {
      heading: "The bill, and what it is charged against",
      a: "Messages. Somebody who signed up, never activated and will never be emailed again costs nothing at all. For a product with a wide free tier and a long tail of abandoned accounts, that property is worth more than the per-message rate, because it means list growth and cost growth are decoupled entirely.",
      b: "Profiles, whether or not you ever message them, with the entry tier covering a fixed count and each additional profile adding a small increment. The structural consequence is that a freemium product with a large dormant signup base pays for people it has given up on. Profile hygiene becomes a recurring billing activity, and it is the first lever to pull before concluding the platform is too expensive.",
    },
    {
      heading: "Who changes the copy on a Thursday",
      a: "An engineer, with a pull request and a deploy. That is entirely appropriate for transactional messages where the content is generated from data and correctness matters more than tempo. It is a poor fit for lifecycle messaging, where the value comes from iterating on copy and timing quickly, and where a two-day round trip through the release process means the iteration simply does not happen.",
      b: "Whoever owns lifecycle, usually in marketing or growth, without engineering involvement once the event integration exists. The independence is the point. The cost is the familiar one for any system where business logic lives outside the repository: the behaviour is not in version control, is not covered by your tests, and the reason a particular email fires is discoverable only by opening the platform.",
    },
    {
      heading: "Transactional mail, and where it ends up",
      a: "This is SES's home ground and it is very hard to beat here. Receipts, password resets and notifications are high volume, code-generated, latency-sensitive and completely uninterested in segmentation. Running them through SES costs almost nothing and keeps them on a path whose reputation you control, independent of whatever marketing is doing that week.",
      b: "Customer.io can send transactional messages and many teams route everything through it for the single-pane benefit. The consequence worth thinking about is billing and coupling: transactional recipients become profiles, and profiles are the billed unit, so your cheapest and highest-volume traffic starts influencing the price of your lifecycle tooling. A split architecture avoids that and costs you one reconciliation.",
    },
    {
      heading: "Channels beyond email",
      a: "SES is email only. SMS lives in a separate AWS service with its own registration, its own approvals and its own console, and push is a third. Building a cross-channel sequence on AWS is possible and is several projects, each with its own compliance steps, coordinated by code you write. Nothing about the pieces is designed to be used together.",
      b: "Email, push, SMS, in-app and webhooks are all channels inside one workflow, with per-person preferences honoured across them. For a product that genuinely needs to reach people in more than one place, orchestrating that from one engine is a substantial simplification and is hard to reproduce piecemeal. If you only ever send email, you are paying for an engine whose shape you are not using.",
    },
    {
      heading: "Deliverability and whose reputation is in play",
      a: "Yours, isolated, visible in your own metrics, and entirely your responsibility to defend. A new identity starts cold and needs warming. Once warm it stays yours across any change to the tooling above it, which is the durable half of this argument — the reputation is an asset on your side of the line rather than a benefit of a subscription.",
      b: "Shared infrastructure with a deliverability function attached and a commercial interest in keeping the pool healthy. There are also arrangements where a customer sends through their own provider credentials, which changes this dimension considerably, so check what your plan actually supports rather than assuming either answer. Whichever applies, the operational monitoring is somebody else's job by default.",
    },
    {
      heading: "What the exit looks like",
      a: "Leaving SES is a code change, because the domains and the reputation attach to an account you keep. Nothing about your lifecycle logic is trapped anywhere, because it was always in your repository. This is the strongest structural argument for the build side and it is rarely weighed properly, because it is a benefit that only shows up on a day that has not happened yet.",
      b: "Leaving means re-implementing every workflow somewhere else, because the logic lives in the platform rather than in your code. Profiles and events export; branching logic, wait steps and the accumulated judgement about timing do not, in any form that another system will accept. The migration cost grows with every sequence somebody adds, which is worth knowing while there are still only three of them.",
    },
  ],
  pickA: [
    "Your lifecycle logic is simple enough to live in the application, and the team would rather own it in version control than in a vendor's editor.",
    "A large dormant signup base makes per-profile billing a charge for people you have already given up on.",
    "The messages in question are transactional and code-generated, where segmentation adds nothing and unit cost adds up.",
    "Reversibility matters: you want the reputation and the logic to stay on your side of the line so a future change is a refactor, not a migration.",
  ],
  pickB: [
    "Growth or marketing should be able to change who receives what without a deploy, and the iteration speed is the point of the exercise.",
    "The sequences involve branches, waits, exit conditions and timezone-aware sends, which is exactly the part of the build that runs long.",
    "You need email, push and SMS coordinated by one engine with per-person preferences honoured across them.",
    "Nobody on the team wants to own a scheduler whose failure mode is silently not sending anything for a week.",
  ],
  prosA: [
    "Somebody who signed up, never activated and will never be messaged again costs nothing, which decouples list growth from cost entirely for a product with a wide free tier.",
    "The lifecycle logic stays in the repository, so it is reviewed, tested, greppable and covered by whatever you already do to keep the application correct.",
    "Nothing about your user model gets duplicated into a vendor, which for a team whose product data is already rich is a refusal to maintain two sources of truth rather than a missing feature.",
    "Leaving is a code change, because the verified domains and the earned reputation sit in an account that stays yours whatever else changes.",
  ],
  consA: [
    "There is no scheduler, no per-user workflow state and no exit condition, so the parts of a lifecycle build that overrun are all in front of you rather than behind you.",
    "Every change to who receives what is a pull request and a deploy, which is correct for a receipt and fatal for a growth experiment somebody wanted to run this afternoon.",
    "Push, SMS and in-app are separate AWS services with their own registrations, so a cross-channel sequence is several projects coordinated by code you write.",
    "Nobody is watching your bounce rate, your complaint rate or your DMARC reports unless you build the thing that watches them and the alert that fires.",
  ],
  prosB: [
    "A profile per person, continuously evaluated against your segments, which is what lets somebody who cannot query your database express has not finished setup in five days.",
    "Idempotency across restarts, timezone-aware sending and a person leaving a branch mid-flight are all handled, and their invisibility is exactly why in-house estimates come in low.",
    "Email, push, SMS, in-app and webhooks are steps inside one workflow with per-person preferences honoured across all of them.",
    "Whoever owns lifecycle changes the sequence without engineering involvement, which removes the release cycle from the path between an idea and a test.",
  ],
  consB: [
    "The meter counts profiles whether or not you ever message them, so a freemium product with a wide funnel pays monthly for the people it has already given up on.",
    "The behaviour lives outside version control, so the reason a particular message fired is discoverable only by opening the tool and reading the branch somebody drew.",
    "Workflows do not export in any form another platform will ingest, and the cost of that grows with every sequence added after the third one.",
    "A misconfigured workflow can message the wrong segment at scale with no code review standing between the mistake and the send.",
  ],
  migrationChecklist: [
    "Name the asymmetry before estimating anything. Moving onto SES means acquiring a scheduler, per-user state, an exit condition mechanism, a copy editor for non-engineers, bounce and complaint processing, a suppression story and a production access approval from AWS. Moving the other way hands all of that back and buys a per-profile bill. Only one of those directions has a quarter of engineering hidden inside it.",
    "Rewrite the Liquid rather than porting it. Customer.io renders Liquid against the profile at send time, so a template is full of conditionals, default filters and date formatting that execute on their infrastructure with access to attributes you never sent in the payload. SES either takes finished HTML or does flat token substitution. Every one of those expressions becomes application code, and the ones that silently fall back to a default are the ones you will not notice are missing.",
    "Transcribe every workflow by hand while there are still few of them. Triggers, wait durations, branch conditions, exit conditions and the accumulated judgement about timing exist as a diagram in the editor and as nothing anywhere else. There is no export that another system reads. A written description of each campaign, produced before anyone is under migration pressure, is the single highest-value hour on this list.",
    "Work out what a subscription topic becomes. Customer.io hosts a preference centre where a person opts out of a topic rather than out of everything, and the platform honours that on every subsequent send. SES has an account-level suppression list keyed to an address with only bounce and complaint as reasons, and configuration-set scoping on top. Topic-level preferences have no home in AWS, so they become rows you own and a check you perform immediately before every send.",
    "Repoint the identify and track calls, and count them first. The event stream that feeds the profiles is a set of call sites scattered through your application pointing at their API, and they do not stop when the subscription does — they keep succeeding against an account nobody is reading. Inventory them, decide where events land instead, and cut them over in the same change as the sending.",
    "Reproduce the timezone behaviour deliberately. Sending at nine in the morning local to each recipient is a per-profile attribute and a scheduler working together, and on SES it is a column, a job that wakes hourly and a decision about what to do with people whose timezone you never captured. That last group is usually larger than anybody expects and defaults badly if nobody chooses.",
    "Decide what happens to the non-email channels rather than discovering it. Push tokens and in-app message state live on the profile, and there is no AWS service that takes over that role without its own registration, its own console and its own consent handling. A sequence that currently reaches somebody by push when email fails simply stops doing so, and the fallback logic was a checkbox rather than code.",
    "Check whether reputation is already yours before assuming a cold start. Some arrangements send through the platform's pools and some send through credentials you supplied, and the two produce completely different warm-up plans. Confirm which one your account actually uses, then ramp across a subdomain either way, because the identity is new to the mailbox provider even when the domain is not.",
  ],
  buyingQuestions: [
    "How many sequences do we run today, and could somebody write down what each one does without opening the editor?",
    "What share of our profiles have never received a message, and what would the invoice look like without them?",
    "Who changes lifecycle copy today, and how long does it currently take from idea to sent?",
    "Do any of our sequences depend on push, SMS or in-app, and what is the plan for those if the engine goes away?",
    "How many identify and track call sites exist in our codebase, and does anybody know where they all are?",
    "If the scheduler stopped firing on a Friday, what would tell us, and how long would it take?",
    "Are we comparing the subscription against the sending cost, or against the sending cost plus the engineering we would need to replace the engine?",
  ],
  thirdOption:
    "The trap on this pair is treating it as build everything or buy everything, when the expensive part of the build is narrow. What teams actually want is the workflow editor and the contact model without the per-profile bill and without the lifecycle logic becoming unportable. A platform layer over your own AWS account is one way to split that difference, and Wraps is one implementation — contacts are unlimited on every tier precisely because the dormant-signup problem is the thing that makes profile billing hurt. The honest costs are real: you need an AWS account and SES production access, an approval on AWS's timetable rather than ours, our SDKs cover TypeScript and Python only, our workflow engine is considerably less capable than Customer.io's and has no push or in-app channel, contacts and workflow state live in our database while only sending data and delivery events stay in your AWS, and we are not SOC 2 certified.",
  faqs: [
    {
      question: "How long does it really take to build drip campaigns on SES?",
      answer:
        "The first version takes about a week and the version you can trust takes a quarter. The week gets you a scheduled job that sends a sequence. The quarter gets you per-user state that survives deploys, exit conditions so people who converted stop receiving the nag, timezone handling, a suppression check at send time, an editor non-engineers can use, and alerting for the day the scheduler stops silently. The last item is the one teams discover by not having it.",
    },
    {
      question: "Why does Customer.io charge for users I never message?",
      answer:
        "Because the billed unit is the profile rather than the send, and a profile exists from the moment your application identifies someone. This is deliberate — the platform is storing and continuously evaluating those profiles against your segments whether or not a message results. The practical consequence for a freemium product is that dormant signups carry cost, and deleting or suppressing profiles you will never contact is a legitimate and frequently overlooked way to lower the bill.",
    },
    {
      question:
        "Can I use Customer.io for lifecycle and SES for transactional?",
      answer:
        "Yes, and it is a common and sensible split. Transactional mail is high volume and low complexity, so running it through the cheapest reliable path keeps it out of your profile count and off your lifecycle bill. Use separate subdomains so DKIM keys and reputation stay independent. The cost is two suppression concepts and the risk that someone who opted out in one system keeps hearing from the other, which needs deliberate reconciliation rather than good intentions.",
    },
    {
      question: "What happens to my workflows if I leave Customer.io?",
      answer:
        "Profiles and event history export cleanly. The workflows do not, in any form another platform will ingest — branches, wait steps, exit conditions and the accumulated tuning of timing and copy have to be rebuilt by a human reading the old ones. The cost scales with how many sequences exist, which is an argument for documenting them outside the tool early, while there are three of them rather than thirty.",
    },
    {
      question: "Is SES cheaper if I count the engineering?",
      answer:
        "At a large dormant user base, frequently yes, because per-profile billing and per-message billing diverge fastest exactly where freemium products live. At a small, engaged user base with complex sequences, usually not, because the engineering is a fixed cost that does not shrink with your size. Run the comparison with a real estimate of the build rather than a hopeful one, and include the maintenance rather than just the first delivery.",
    },
    {
      question: "What happens to Liquid templates if I move to SES?",
      answer:
        "They stop being templates and become code. Liquid is evaluated against the profile on the platform's side, which is how a message can branch on an attribute your send call never mentioned, apply a default when a field is empty and format a date in the recipient's locale. SES does flat token substitution or takes finished HTML. The conditionals move into your rendering layer, and the quiet hazard is the filters — a default that used to fill a gap now renders an empty string, and nothing fails loudly.",
    },
    {
      question: "How do I honour topic-level unsubscribes on SES?",
      answer:
        "You build it, because there is nothing to configure. SES suppression is keyed to an address with bounce and complaint as its only reasons, so a person who wants product updates but not the weekly digest has no representation in AWS at all. The working pattern is a preferences table, a hosted page behind a signed link, a List-Unsubscribe header that points at it, and a check immediately before every send. It is a small feature whose absence is a compliance problem rather than an inconvenience.",
    },
    {
      question: "Do my events keep flowing after I cancel?",
      answer:
        "Yes, and that is the trap. The identify and track calls are ordinary HTTP requests scattered through your application, and they keep returning success against an account you are no longer reading. Nothing breaks, nothing alerts, and six weeks later somebody notices the new system has a gap where the old call sites never got repointed. Inventory the call sites before the migration rather than during it, and cut them over in the same change that moves the sending.",
    },
    {
      question: "Can I keep the platform and move only transactional mail?",
      answer:
        "Yes, and it is usually the first move worth making. Receipts, resets and notifications are high volume, code-generated and uninterested in segmentation, so running them through SES lowers the sending cost and keeps transactional-only recipients out of the profile count. Use a separate subdomain so the two reputations stay independent, and be explicit about which system owns an opt-out — the failure mode of a split is somebody who unsubscribed in one place continuing to hear from the other.",
    },
  ],
};

const AMAZON_SES_VS_LOOPS: VersusPage = {
  slug: "amazon-ses-vs-loops",
  a: "amazon-ses",
  b: "loops",
  title: "Amazon SES vs Loops",
  description:
    "Loops charges for contacts and sends as much as you like. SES charges for sends and does not know what a contact is. For a SaaS product with a large free tier, those two sentences decide the whole comparison.",
  search: {
    primaryQuery: "contact based pricing versus per send email costs",
    secondaryQueries: [
      "loops unlimited sends contact pricing explained",
      "email tool for saas with a big free tier",
      "dormant signups inflating email bill",
      "one tool for product and marketing email",
      "single subscription state across product and marketing mail",
      "how to preview transactional email on amazon ses",
      "exporting mailing list membership when changing email tools",
    ],
    rationale:
      "The two pricing models are genuinely opposite and the crossover point depends entirely on a ratio — sends per contact — that no vendor calculator asks you for. A page that names the ratio is more useful than either pricing page.",
  },
  intro:
    "Loops made two opinionated choices that define this comparison: it charges on subscribed contacts rather than sends, and it puts product and marketing email in one tool with one contact list. SES made the opposite choice on both counts, charging per message and having no concept of a contact at all. Which of these suits you is not a matter of taste. It is a ratio: how many messages do you send per contact per month, and how much of your list is dormant? Work that out and the answer falls out of it.",
  dimensions: [
    {
      heading: "The pricing model, stated as the trade it is",
      a: "Per message, with a dormant contact costing exactly nothing. A product with fifty thousand signups and four thousand active users pays for the four thousand, because the other forty-six thousand are never sent anything. For freemium SaaS with a wide funnel, this is the single most consequential property of SES and it is frequently worth more than the low unit rate.",
      b: "Per subscribed contact, with sending unlimited on top. A dormant contact costs the same as your most engaged one, so a large free-tier list is a permanent line on the invoice regardless of whether anything is sent to it. In exchange, a heavily engaged list costs nothing extra to mail more often, and the bill stops moving when your sending does.",
    },
    {
      heading: "What unlimited sends changes about behaviour",
      a: "Every message has a marginal cost, and while the cost is tiny, the accounting is real: a weekly digest to a large list is a line item somebody can point at. Teams on SES tend to be slightly conservative about volume for this reason, which is occasionally good discipline and occasionally means a useful message does not get sent because nobody wanted to defend it.",
      b: "Sending more costs nothing, which genuinely changes what teams do. Onboarding sequences get longer, digests get more frequent, re-engagement gets tried. That freedom is real value for a team iterating on lifecycle. It also removes the natural brake on volume, and the constraint that replaces it is your recipients' patience, which gives much less prompt feedback than an invoice does.",
    },
    {
      heading: "One tool for transactional and marketing, or two",
      a: "SES sends whatever you hand it and knows nothing about the difference, which means the separation is yours to design and yours to forget. Most teams end up with SES for transactional and a second product for marketing, which is coherent and produces the usual seam: two suppression lists, two definitions of unsubscribed, and a reasonable chance of mailing someone who opted out of the other system.",
      b: "Both in one product against one contact record, with transactional messages triggered by API and marketing campaigns composed in the UI, sharing a subscription state. That shared state is the strongest argument for the single-tool shape: unsubscribed means unsubscribed, once, everywhere, without an integration keeping two systems honest. For a small SaaS team this removes a whole category of embarrassing mistake.",
    },
    {
      heading: "How much control you have over the message",
      a: "Total. SES accepts a raw MIME message if you want one, so headers, encoding, attachments, list-unsubscribe behaviour and multipart structure are all yours to determine. If you have a genuine requirement about how an email is constructed — a compliance header, an unusual content type, a specific threading behaviour — SES will do it and most products in this category will not.",
      b: "Considerably less, by design. Loops is a product rather than a primitive: you work within its template model, its sending behaviour and its assumptions about what an email is. For the overwhelming majority of SaaS email that is fine and the constraint is invisible. It becomes visible the first time you need something specific and find that the product simply does not expose it.",
    },
    {
      heading: "Who edits the email",
      a: "An engineer, in the codebase, through a deploy, because the rendering lives in your application. Templates are reviewable and versioned, which is a real benefit, and completely inaccessible to anyone who does not write code, which is a real cost. A founder who wants to change an onboarding subject line waits for the release cycle.",
      b: "Anyone, in the editor, immediately, with a preview. The audience Loops is designed for is a small SaaS team where the person writing the copy is the founder or a growth hire, and the round trip through engineering is the bottleneck they are paying to remove. The trade-off is the usual one: the content is not in version control and not covered by your tests.",
    },
    {
      heading: "Segmentation and the data behind it",
      a: "Whatever your database can express, evaluated by your own code, which is unlimited in principle and unavailable in practice to anybody without SQL access. SES receives a list of addresses and asks no questions. For teams with a strong data layer this is the more powerful option by a distance; for teams without one it is an empty room.",
      b: "Contact properties and events synced from your application, with audiences built against them in the UI. Less expressive than SQL and enormously more accessible, which is the right trade for the product's audience. The limit people meet is usually a segment that needs a join or a computation the property model cannot express, at which point the answer is to compute it in your application and sync it as a property.",
    },
    {
      heading: "Deliverability and the shape of the sender",
      a: "You are the sender, alone, and both the isolation and the responsibility are yours. A new identity is cold and needs warming, the metrics are in your console, and nobody will notice a problem on your behalf. The compensating benefit is that the reputation is an asset attached to an account you keep rather than a feature of a subscription you might cancel.",
      b: "Loops operates the sending and carries the operational burden, which for a small team with no deliverability expertise is a genuine service rather than a checkbox. The corresponding exposure is the one every managed sender has: you inherit both the benefit and the risk of the pool, and the standing you enjoy is not portable to wherever you go next.",
    },
    {
      heading: "What the exit costs",
      a: "Little, structurally. Domains and reputation stay with an account you keep, templates are already code, and the sending call is a few lines. Running a second provider from a separate subdomain and shifting traffic gradually is straightforward. This reversibility is undervalued at signup and extremely valuable on the day the decision is revisited.",
      b: "Contacts and their properties export. Campaign history, the visual templates and the accumulated lifecycle configuration mostly do not, and the sending reputation was never yours. The code change is small because the API surface is small; the part that hurts is that the product was doing more for you than the code suggested, and all of that has to be rebuilt or rebought.",
    },
  ],
  pickA: [
    "A large share of your list is dormant, so paying per contact means paying for people you have no intention of emailing.",
    "You send relatively few messages per contact per month, which is the ratio that makes per-send billing cheaper.",
    "You need control over how the message is constructed — headers, encoding, attachments — that a product-shaped tool will not expose.",
    "The engineering to own templates and segmentation already exists, and duplicating your user model in a vendor buys you nothing.",
  ],
  pickB: [
    "Your list is small and engaged and you want to send to it far more often without a bill that grows every time you do.",
    "The person writing the emails is not an engineer and the release cycle is the actual bottleneck.",
    "Product and marketing email sharing one subscription state matters more than the flexibility of running two systems.",
    "Nobody on the team wants to own deliverability, templates and a segmentation UI as a side project.",
  ],
  prosA: [
    "Fifty thousand signups and four thousand active users costs you four thousand users' worth of messages, because the meter never counts a person you do not contact.",
    "Raw MIME is accepted, so a compliance header, an unusual content type or specific threading behaviour is a field you set rather than a feature request you file.",
    "Segmentation is whatever your database can express, which for a team with a real data layer is unlimited rather than capped at what a property model can represent.",
    "Templates are code, so they are reviewed, versioned and tested alongside the application that renders them, and reproducing production output locally is trivial.",
  ],
  consA: [
    "There is no contact, no subscription state and no list, so the one flag that decides whether a person hears from you at all is a table you design and a check you remember.",
    "Nothing composes, schedules, segments or measures a campaign, and the person who wanted to change a subject line now waits for the release cycle.",
    "A new identity starts cold, the metrics live in a console nobody opens, and no one notices a rising complaint rate on your behalf.",
    "Every message carries a marginal cost, which is tiny and is still an accounting line somebody has to defend before a weekly digest gets sent.",
  ],
  prosB: [
    "Product and marketing mail share one subscription state, so unsubscribed means unsubscribed once and everywhere without an integration keeping two systems honest.",
    "Sending more costs nothing, which genuinely changes behaviour: onboarding sequences get longer and re-engagement gets tried because nobody has to justify the marginal message.",
    "Anyone can edit a message in the editor with a preview and publish it immediately, which for a small team removes the release cycle from the copy loop entirely.",
    "The sending, the templates and the deliverability monitoring are operated by somebody else, which is a service rather than a checkbox for a team of five.",
  ],
  consB: [
    "A dormant contact costs exactly what your most engaged one costs, so a wide free tier is a permanent line on the invoice for people nobody intends to email.",
    "You work inside the product's model of what an email is, and the constraint is invisible until the day you need something it simply does not expose.",
    "Removing the marginal cost also removes the natural brake on volume, and the signal that replaces it arrives as a complaint rate rather than as an invoice.",
    "Campaign history, the visual templates and the accumulated lifecycle configuration mostly do not export, and the reputation was never attached to anything you keep.",
  ],
  migrationChecklist: [
    "Understand that the thing you are giving up is a single flag. The whole argument for the one-tool shape is that a contact has one subscription state that both the product mail and the marketing mail consult. SES has no contact and no state, so the first thing to build is not a send path — it is the table that decides whether this person hears from you, plus the rule that transactional mail ignores it and marketing mail does not.",
    "Export the mailing lists separately from the contacts. Per-list subscription is a different fact from whether somebody is subscribed at all, and a flat contact export flattens the two together. If people opted out of the changelog but not the product notices, that distinction exists only in the list membership, and losing it means either mailing people who opted out or silencing people who did not.",
    "Move the message bodies out of the editor and settle the variable contract while you do it. A transactional message here is referenced by an identifier and rendered from a template the platform stores, filled from a data payload whose shape was whatever the editor happened to reference. Once the body lives in your repository that contract becomes explicit, and the fields nobody realised were being used are the ones that render blank.",
    "Re-forecast with the marginal cost switched back on. Unlimited sending is not just a price — it is a behaviour, and teams on it send longer sequences and more frequent digests precisely because nothing pushes back. Count the messages you actually send today rather than the ones you planned, because that number is what meets a per-message rate, and it is routinely larger than the mental model of the person doing the comparison.",
    "Rebuild the event triggers. Sequences here start from events your application posts to the platform, and those call sites keep succeeding against an account you are closing. Inventory them, decide what consumes those events afterwards, and cut them over in the same change as the sending rather than leaving a stream writing into nothing.",
    "Set up DKIM on the SES side and keep the old sender live through one full cycle. The two sign with different keys through different records, and the standing you built belongs to the platform's pools rather than to your domain. Running both for a few weeks across a subdomain split is what turns a cutover into a ramp, and this is a place where a fortnight of patience is much cheaper than a month of throttling.",
    "Start the production access application early, because it is the one gate somebody else controls. The questions are about how addresses were collected and what happens to a bounce, which the subscription-state work above has just made answerable in concrete terms. Answering it vaguely earns a request for more detail and another wait.",
    "Decide who edits copy afterwards and write the answer down. This is the migration's real cost and it is not technical: the person who currently opens an editor and publishes is about to start filing tickets. Either that is acceptable, or a preview environment and an editing path is scope you are adding, and pretending otherwise is how a move that looked cheap becomes a standing complaint.",
  ],
  buyingQuestions: [
    "What fraction of our contacts received a message in the last ninety days, and what are we paying for the rest?",
    "How many messages does an engaged contact actually receive from us in a month, and has anybody counted rather than guessed?",
    "If unsubscribed had to be checked by our own code before every send, who writes that check and who verifies it is being called?",
    "Who publishes copy changes today, and are they willing to open a pull request instead?",
    "Do we send anything that needs a header, an encoding or an attachment behaviour a product-shaped tool would not expose?",
    "Would our sending volume change if each message had a price, and is that change one we would actually want?",
    "Who would be responsible for noticing a rising complaint rate, and how would they notice it?",
  ],
  thirdOption:
    "The tension on this page is narrower than it first looks: most teams comparing these want the tooling Loops has and object specifically to paying for contacts who will never open anything. That is a solvable shape rather than a law of nature — a platform layer over your own AWS account can meter the platform and let AWS meter the sending, so contacts stop being the billed unit. Wraps does exactly that, with unlimited contacts on every tier. What it costs you is concrete: an AWS account and SES production access, which is an AWS approval on AWS's schedule rather than ours, SDKs in TypeScript and Python only, a template and campaign experience less polished than Loops', contacts and templates stored in our database rather than yours, and no SOC 2 certification.",
  faqs: [
    {
      question: "At what point does contact-based pricing stop being worth it?",
      answer:
        "Work out your sends per contact per month. If most of your list receives one message a month or fewer, per-send billing is dramatically cheaper and the dormant portion of the list is pure waste. If your engaged contacts receive several messages a week, unlimited sending starts to justify the per-contact rate quickly. The crossover is a ratio rather than a headcount, which is why comparing the two pricing pages directly tells you almost nothing.",
    },
    {
      question: "Can I delete dormant contacts to lower a contact-based bill?",
      answer:
        "Yes, and on any contact-priced tool it is the first thing to do before deciding the price is unreasonable. The awkward part is that deletion is usually irreversible and takes the engagement history with it, so a contact you remove to save money is a contact you cannot later analyse or win back. Suppression where it is available is the gentler version. Either way it is a recurring hygiene task rather than a one-time cleanup.",
    },
    {
      question: "Does SES do marketing email at all?",
      answer:
        "It sends whatever you give it, including a campaign, and it provides nothing that helps you compose, schedule, segment or measure one. There is no list, no audience, no editor and no report. Teams doing marketing on SES either run a separate marketing product alongside it or use a platform layer that adds those things on top. Building the campaign tooling in-house is a well-documented way to spend a quarter producing something your marketing person refuses to use.",
    },
    {
      question: "Can I keep transactional on SES and marketing on Loops?",
      answer:
        "You can, and it partly defeats the reason to choose Loops, which is one contact record with one subscription state. Splitting reintroduces the reconciliation problem: two suppression lists and two ideas of unsubscribed. If you do it, use separate subdomains so reputations stay independent, and decide explicitly which system owns the opt-out — an unowned opt-out is how somebody who unsubscribed last month receives a newsletter this month.",
    },
    {
      question: "What does unlimited sending actually mean in practice?",
      answer:
        "That the invoice does not move when volume does, within acceptable-use bounds any provider enforces. It is a real change in behaviour rather than a pricing gimmick: teams on unlimited plans send longer onboarding sequences and more frequent digests because nobody has to justify the marginal cost. The thing to watch is that the natural brake on volume is now your recipients' tolerance rather than your budget, and that signal arrives as a complaint rate rather than as an invoice.",
    },
    {
      question: "What replaces one shared subscription state on SES?",
      answer:
        "A table you own and a discipline you enforce. The single flag is the reason the one-tool shape is attractive, and AWS has nothing corresponding to it: the suppression list understands bounces and complaints, not preferences. The working version is a subscriptions table, a rule that transactional sends bypass it and marketing sends consult it, and a check immediately before the call rather than when the audience was assembled. The gap between those last two is where somebody who unsubscribed on Monday receives a campaign on Tuesday.",
    },
    {
      question: "Do my per-list opt-outs survive a contact export?",
      answer:
        "Not on their own. A contact export tells you whether somebody is subscribed; list membership tells you what they are subscribed to, and flattening the two loses the distinction the moment you import. Export the lists as a separate artefact and reconstruct the membership deliberately. This matters more than it sounds, because the group that opted out of one thing and not another is usually your most engaged segment, and getting it wrong is visible to exactly the people you can least afford to annoy.",
    },
    {
      question: "How do I preview an email before sending on SES?",
      answer:
        "By building the preview, because AWS supplies none. What exists is a template API with token substitution and a console that will show you the template, neither of which tells you how a message renders in a real client. Teams that do this well render the message with realistic data in a development route, keep a set of saved payloads as fixtures, and send seed copies to accounts at the major mailbox providers before anything goes out. That is a normal amount of work and it is work that used to be a button.",
    },
    {
      question:
        "Will our sending volume change if messages start costing money?",
      answer:
        "Usually yes, and it is worth deciding whether that is a feature. Unlimited sending removes the argument about whether a digest is worth it, so teams on it send more, and some of that extra sending is genuinely valuable while some of it exists because nobody had to defend it. Moving to a per-message rate reinstates the argument. Before comparing prices, count what you actually send rather than what you meant to send — that number is what meets the rate, and it is reliably higher than the estimate.",
    },
  ],
};

const BREVO_VS_RESEND: VersusPage = {
  slug: "brevo-vs-resend",
  a: "brevo",
  b: "resend",
  title: "Brevo vs Resend",
  description:
    "A French all-in-one suite built for a marketer against an API built for one developer's first hour. They overlap on exactly one endpoint and differ on everything surrounding it.",
  search: {
    primaryQuery: "marketing suite or developer email api for a startup",
    secondaryQueries: [
      "brevo transactional api developer experience",
      "resend broadcasts versus a real marketing tool",
      "eu based email platform for gdpr",
      "does resend charge for marketing contacts",
      "sending a large campaign under a two per second rate limit",
      "using react email with a marketing suite",
      "what happens to email logs after thirty days",
    ],
    rationale:
      "European startups evaluate these two together because one is the default EU answer and the other is the default developer answer. Neither vendor's material acknowledges the other's category, so the comparison a buyer needs does not exist on either site.",
  },
  intro:
    "Brevo and Resend both send transactional email over an API, and that is roughly where the similarity ends. Brevo is a suite — contacts, campaigns, SMS, a light CRM, automation — sold to a small business that needs marketing to happen. Resend is a sending API sold to a developer who wants the email part of a product finished today. The overlap is one endpoint. Choosing between them means deciding whether your email problem is fundamentally about people who write emails or about code that sends them.",
  dimensions: [
    {
      heading: "The developer experience, honestly assessed",
      a: "Brevo's API works and nobody describes it as pleasant. The documentation is organised around the suite rather than the sending, the SDKs are generated rather than crafted, and the conceptual overhead of contacts, lists and folders is present whether or not your use case has any. A developer integrating it for transactional mail spends the afternoon on it rather than the hour, and comes away without affection.",
      b: "This is the entire proposition and it delivers. A small SDK, fast domain verification, sensible defaults, error messages that say what is wrong, and React Email maintained first-party. The integration is genuinely done in an hour for a developer who has done it before, and the documentation assumes competence rather than explaining what an API key is. It is the best-in-class experience in this comparison by a distance.",
    },
    {
      heading: "Marketing capability, equally honestly",
      a: "Lists, segments, a drag-and-drop designer, scheduling, A/B testing and campaign reporting, all usable by someone who has never opened a terminal. This is a real marketing product with the depth a marketing person expects, and it is the reason Brevo exists. The thing to check is the tier: automation and A/B testing sit above the entry plan, as does removing the Brevo logo from your emails.",
      b: "Broadcasts and an audience concept, which is enough to send an announcement and not enough to run a marketing programme. There is no meaningful automation, no branching, no lifecycle engine. Resend is clear about being a sending product, so this is scope rather than weakness — but a team that needs campaigns will be adding a second vendor, and should price that at the start rather than in month four.",
    },
    {
      heading: "Where the money goes",
      a: "Send volume, not stored contacts, which is unusual and genuinely good in this category: a large dormant list does not raise the bill on its own. What raises it is the tier step, which is where the features live. Price the tier that contains what you need rather than the one on the homepage, because that is the most common way an evaluation of this product produces a wrong number.",
      b: "A plan ladder for sending, plus marketing contacts billed separately at a per-block rate. That second charge is contact-based pricing quietly attached to a send-priced product, so a growing audience raises the invoice in a month you sent nothing to it — which is exactly the model Brevo avoided. Two ladders also price the same volume differently depending which you are on, so check which one you are being quoted.",
    },
    {
      heading: "Europe, and what the requirement actually says",
      a: "A French company operating in the EU, which answers both the geography and the ownership versions of a residency question. When the requirement comes from a data protection officer rather than an architect, that distinction is frequently the whole evaluation. The consent and preference tooling is built for that regime rather than retrofitted onto it, which shows in the parts of the product concerned with who agreed to what.",
      b: "A US company with published subprocessors and documented data handling, sending through Amazon SES underneath. That is enough for most buyers and it is not a residency guarantee. There is no equivalent of choosing a region and having mail stay inside it. If your requirement is a clause rather than a preference, this dimension ends the comparison rather than informing it.",
    },
    {
      heading: "Templates and the person who changes them",
      a: "A visual editor producing templates stored in the platform, editable by a marketer on a Friday with no deploy involved. The HTML it emits is the usual output of a drag-and-drop builder — verbose, and fine. The structural cost is the familiar one: templates are not in version control, not reviewable as code, and reproducing production output locally is harder than it should be.",
      b: "React Email components in your repository, reviewed like any other code, with a preview during development. Better for correctness, versioning and developer sanity, and completely unavailable to anyone who cannot open a pull request. The thing worth knowing is that React Email is not proprietary: it renders to plain HTML that Brevo will happily send, so this benefit is partly separable from the vendor choice.",
    },
    {
      heading: "The other channels",
      a: "SMS, WhatsApp, chat and a light CRM alongside email, against one contact record. For a small business that would otherwise run three vendors and reconcile them, the integration is the value even though no individual component is best in class. The CRM in particular is lightweight and is better understood as a contact database with pipeline fields than as a replacement for a real sales tool.",
      b: "Email only, deliberately. There is no SMS, no push, no chat and no contact database beyond what audiences need. If you later need those, they come from other vendors and the joining is yours to do. For a product whose messaging is entirely email, carrying none of that machinery is a benefit rather than a gap.",
    },
    {
      heading: "Operational risk on each side",
      a: "Shared sending pools with mixed reports, the usual pattern being that a sender with good engagement is fine and a sender with a purchased list discovers the pool is shared in both directions. Dedicated options exist higher in the range. Brevo is an established company with a long operating history, so the risk here is deliverability variance rather than anything existential.",
      b: "Suspension during traffic spikes is the recurring complaint in its public reviews, following the ordinary shared-pool logic: an unfamiliar surge looks like risk to a platform protecting everyone, and pausing first is the conservative call. Resend is also a young company, which cuts both ways — more attentive support than its size suggests, and less operating history behind the reputation you inherit.",
    },
    {
      heading: "What you can still answer next quarter",
      a: "Reporting and contact-level history are retained as part of the suite, which is the natural shape when the product is built around a persistent contact record rather than around individual sends. It is a vendor window on vendor terms, but it is oriented towards the questions a marketer asks about a person over time rather than towards the questions an engineer asks about a request.",
      b: "Thirty days of logs on every plan short of Enterprise, and then the record is gone. That is enough to debug an integration and not enough for a billing dispute, a compliance request or a year-over-year report. Streaming events into your own store from day one fixes it and costs about a day, and almost nobody does it until the first question about last March.",
    },
  ],
  pickA: [
    "A marketer needs to build, schedule and measure campaigns, and the tooling for that matters more than how the API feels.",
    "A residency requirement was written by a data protection officer, and an EU-headquartered vendor answers it more cleanly than a US one with good documentation.",
    "You want email, SMS and a contact database on one invoice rather than three vendors and a reconciliation.",
    "Send-volume pricing suits you better than paying for contacts who never open anything.",
  ],
  pickB: [
    "Email is generated by your application and the integration quality is what you will live with every day.",
    "Templates belong in the repository as reviewable components rather than in a vendor's editor.",
    "You do not need campaigns, automation or SMS, and would rather not pay for a suite to use one endpoint.",
    "Time-to-first-send this week is the metric that actually matters, and a permanent free allowance covers the project for now.",
  ],
  prosA: [
    "A real marketing product with lists, segments, a designer, scheduling, A/B testing and reporting, usable by somebody who has never opened a terminal.",
    "The meter reads send volume rather than stored contacts, so a large dormant list is not itself a cost — unusual in this category and genuinely valuable to an occasional sender.",
    "An EU-headquartered company operating in the EU settles the ownership form of a residency question, not merely the geography form.",
    "SMS, chat and a light contact database sit against the same record as the email, which for a small business replaces three subscriptions and the joining between them.",
  ],
  consA: [
    "The API works and nobody enjoys it: generated SDKs, documentation organised around the suite, and the conceptual overhead of contacts, lists and folders whether or not your use case has any.",
    "The features people assume are included — automation, A/B testing, removing the vendor's logo from your mail — live above the entry plan, so the quoted price is usually the wrong one.",
    "Templates live in a visual editor outside version control, so reproducing what production actually sent is harder than opening the repository.",
    "Shared pools with mixed reports, where a sender with a purchased list learns that the pool is shared in the direction they did not want.",
  ],
  prosB: [
    "A small SDK, domain verification that finishes about as fast as DNS does, error messages that say what is wrong, and documentation that assumes competence.",
    "React Email is first-party and maintained, so templates are components under review in your repository — and because it renders to plain HTML, the library outlives the vendor choice.",
    "The product surface is small enough that nobody spends an afternoon choosing between four supported ways to send one message.",
    "A permanent free allowance means a staging environment or a weekend project does not appear on an invoice at all.",
  ],
  consB: [
    "Two API requests per second on every tier, unmoved by any upgrade, so a campaign fan-out written as a loop over a list meets a permanent ceiling immediately.",
    "Logs are purged at thirty days on every plan short of Enterprise, which is enough to debug an integration and not enough to answer a question about last quarter.",
    "Marketing contacts bill separately at a per-block rate, which is contact-based pricing quietly attached to a product everyone describes as send-priced.",
    "Suspension during a traffic spike is the recurring complaint in its public reviews, and a young company has less operating history behind the standing you inherit.",
  ],
  migrationChecklist: [
    "Price both ladders against your actual list before anything else, because the billing models invert here. One side charges for volume and treats a dormant list as free; the other charges for sends and then bills marketing contacts separately in blocks. Moving a large, rarely-mailed list from the first to the second raises the invoice in a month you sent nothing, which is precisely the outcome people choose a send-priced product to avoid.",
    "Export the blocklist by reason and work out where the third category lands. Hard bounces, spam complaints and unsubscribes are kept apart on the suite side. On the other side the bounce and complaint record is the vendor's own, and the unsubscribe concept attaches to an audience used for broadcasts rather than to transactional sending. The people who opted out of marketing therefore need a home that is checked before every broadcast, and it is not the same object as the bounce list.",
    "Adopt React Email before you commit to anything, because it is separable from the vendor. It renders components to ordinary HTML, and the suite will send that HTML perfectly happily. Doing the template work first turns an all-or-nothing migration into two independent decisions, and it means the migration itself no longer has a rendering rewrite sitting on its critical path.",
    "Set up an event destination before the cutover if you report on anything monthly. One side retains contact-level history as a property of being built around a persistent record; the other purges logs at thirty days on every plan short of the top one. A month-over-month report survives that only if the events were already going somewhere you own, and there is no retroactive fix.",
    "Count calls per second at peak rather than messages per month. A two-per-second ceiling applies on every tier and does not lift, so a campaign that loops over ten thousand addresses becomes a drip measured in hours. The batch endpoint accepting several recipients per call stretches that a long way, and the send loop has to be written for it from the start rather than refactored the week of a launch.",
    "Decide what happens to the non-email channels, because nothing replaces them. SMS, chat and the contact database have no counterpart on the sending-API side, and there is no scope decision pending that will add them. Either those workloads move to a third vendor with its own consent records, or they stop, and the second option needs saying out loud before the suite is cancelled.",
    "Re-read the residency requirement if that was ever a factor. One of these is a European company operating in Europe; the other is a US company with published subprocessors and no region selection. If the requirement is a clause rather than a preference, this is not a migration that can be made compliant by configuration, and no amount of good documentation changes that.",
    "Split the subdomains and move the traffic in the order of least regret. Transactional mail first, from its own subdomain with its own key, because it is high-engagement and the fastest way to establish standing. Campaigns last, ramped, and never in the weeks around a launch — the pattern that triggers a spike suspension is precisely a large unfamiliar send from a new sender.",
  ],
  buyingQuestions: [
    "How many contacts do we store versus how many do we mail in a typical month, and which of those two numbers is about to become the billed one?",
    "Has anybody counted our peak sends per second, or are we reasoning from a monthly total?",
    "Which plan row contains automation, testing and an unbranded template, and is that the row in our comparison?",
    "What do we report monthly, and would that report survive a thirty-day retention window?",
    "Does our residency requirement name a region or a company, and who wrote it?",
    "Who edits marketing copy today, and are they able and willing to open a pull request?",
    "If SMS and the contact database went away next month, what breaks and who owns replacing it?",
  ],
  faqs: [
    {
      question: "Can I use Resend for transactional and Brevo for marketing?",
      answer:
        "Yes, and it is the arrangement a lot of teams drift into. Use separate subdomains so DKIM keys, reputation and DMARC alignment stay independent. The real cost is not technical: you now have two suppression lists and two definitions of unsubscribed, and unless one of them is explicitly the owner, somebody who opted out of marketing will eventually receive a campaign. Decide which system holds the truth before you need it to.",
    },
    {
      question: "Does Brevo charge per contact?",
      answer:
        "No, and it is the most distinctive thing about its pricing. Brevo charges on send volume rather than stored contacts, so a large dormant list does not raise the bill by itself — the opposite of Klaviyo, Customer.io and Loops. Resend, despite being a sending product, does bill marketing contacts separately from sends. If your list is large and your sending is occasional, that single difference can outweigh everything else on this page.",
    },
    {
      question: "Is Resend usable by a non-technical person?",
      answer:
        "Partly. The dashboard shows logs, domains and audiences, and broadcasts can be composed without code. What is not available to a non-technical person is the templates, which are React components in your repository, so any change to what a message looks like requires a developer and a deploy. For a product where a founder wants to iterate on copy quickly, that round trip is the constraint to weigh.",
    },
    {
      question: "Which is better for European data residency?",
      answer:
        "Brevo, clearly, if the requirement is written as a clause. It is an EU-headquartered company operating in the EU, which answers the ownership question as well as the geography one. Resend publishes its subprocessors and documents its data handling, which satisfies a great many buyers, but there is no region selection and no equivalent guarantee. This is the one dimension on the page where the answer is not a matter of preference.",
    },
    {
      question: "Do I need to pick one?",
      answer:
        "Not necessarily, and the hybrid is common enough to be considered a default rather than a compromise. The most frequent shape is transactional mail on the developer-friendly API and campaigns on the suite, split across subdomains. What that costs you is a reconciliation nobody enjoys and a slightly more complicated answer when someone asks where an email came from. What it buys is each workload on a tool actually designed for it.",
    },
    {
      question: "Does the two-per-second limit affect campaigns?",
      answer:
        "Severely, if the send loop was written naively. Ten thousand recipients at two calls a second is well over an hour of drip, and no plan lifts the ceiling. The relief is the batch endpoint, which accepts several recipients in one call and multiplies your effective throughput by whatever that batch size is. The point is that this is a design decision rather than a purchase: write the fan-out against batches on day one, because retrofitting it during the week of a launch is the worst possible time to discover the constraint.",
    },
    {
      question: "Can I use React Email without switching vendors?",
      answer:
        "Yes, and doing so is usually the smartest first move. React Email is an open-source library that renders components to plain HTML, and any provider that accepts an HTML body will send the result — including the suite you are currently on. That means the template question and the vendor question are separable: adopt the components, get your templates into version control and under review, and then decide about sending on its own merits rather than as part of a package deal.",
    },
    {
      question: "What happens to my marketing contacts when I move?",
      answer:
        "They become a separately billed line, which is the detail that surprises people most. One of these products charges on send volume and treats stored contacts as free; the other charges for sends and then meters marketing contacts in blocks on top. A large list that was costing nothing to keep starts costing something to keep, in a month when the sending did not change. Work out that number from your real contact count before the migration, not from the plan page.",
    },
    {
      question: "Which is safer for a big launch send?",
      answer:
        "The established suite, on the narrow question of not being stopped. A young platform protecting a shared pool treats an unfamiliar surge as risk and pauses first, and that complaint recurs in its public reviews. The mitigations are the same either way and they are worth doing regardless: warm a dedicated subdomain for weeks beforehand, start with your most engaged recipients, spread the send over hours rather than minutes, and tell support what is coming before it arrives rather than after.",
    },
  ],
};

const CUSTOMER_IO_VS_RESEND: VersusPage = {
  slug: "customer-io-vs-resend",
  a: "customer-io",
  b: "resend",
  title: "Customer.io vs Resend",
  description:
    "These two barely compete. One is a behavioural workflow engine priced per profile, the other a sending API priced per message. Anyone weighing them is really deciding whether they need a messaging platform at all.",
  search: {
    primaryQuery: "do i need a messaging platform or just a send api",
    secondaryQueries: [
      "resend for onboarding sequences",
      "customer.io versus sending email from your own code",
      "when to move lifecycle email off an api",
      "cost of a messaging platform for a small saas",
      "segment on engagement older than thirty days",
      "subscription topics versus a single unsubscribe flag",
      "tagging sends so reporting can group by campaign",
    ],
    rationale:
      "Teams reach this comparison at the moment their onboarding email stops being one message, which is a specific and recurring decision point. Every article about it is published by a platform vendor, so the honest version of when you do not need one is unwritten.",
  },
  intro:
    "This comparison usually happens at a particular moment: the onboarding email that was one message is becoming five, with conditions, and somebody asks whether this belongs in the codebase. Resend is the answer if the logic stays in your application and you want the sending to be excellent and cheap. Customer.io is the answer if the logic should leave your application and belong to whoever owns growth. That is a decision about ownership and tempo, and the products are downstream of it rather than the other way round.",
  dimensions: [
    {
      heading: "What each one is actually for",
      a: "Deciding. Customer.io ingests events and attributes, holds a profile per person, evaluates segments continuously and runs workflows with branches, waits and exit conditions. The sending is a step at the end of a decision the platform made. If you removed the email and left the engine, most of the value would still be there.",
      b: "Sending. Resend takes a rendered message and an address and delivers it with unusual polish — a small SDK, quick domain verification, React Email, a clean log view. It does not decide who should receive anything. Broadcasts exist for announcements and stop well short of a lifecycle engine, which is a deliberate scope decision rather than a gap.",
    },
    {
      heading: "Where the logic lives, and who can change it",
      a: "In the platform, in a visual editor, changed by whoever owns lifecycle without a deploy. That independence is the point and it is worth real money to a team whose growth experiments are currently queued behind a release. The cost is that the behaviour is not in version control, not covered by your tests, and the reason a particular message fired is only discoverable by opening the tool.",
      b: "In your codebase, changed by an engineer through a pull request. Reviewable, testable, greppable, and slow. For transactional messages that is exactly right. For lifecycle messaging, where the value comes from iterating on timing and copy quickly, the round trip through the release process frequently means the iteration does not happen at all.",
    },
    {
      heading: "The billed unit",
      a: "Profiles, whether or not you message them, with each additional profile adding a small increment above the tier's included count. A freemium product with a wide funnel pays for everyone who ever signed up, which is why profile hygiene is a billing activity here and not just a hygiene one. The upside is that cost is decoupled from volume, so an active user receiving twenty messages a month costs the same as one receiving two.",
      b: "Sends on a plan ladder, plus marketing contacts billed separately at a per-block rate. Dormant users you never email are close to free, which suits a wide funnel well. What catches people is that second charge: a growing audience raises the bill in a month you sent nothing to it, so the product is not as purely send-priced as it looks.",
    },
    {
      heading: "What you would have to build to close the gap",
      a: "Nothing — this is what you are buying. Idempotency across restarts, per-user workflow state, timezone-aware sends, exit conditions when the user does the thing, suppression checked at send time, and a UI a non-engineer trusts. These are the parts of an in-house build that run long, and they are invisible in the platform precisely because they are handled.",
      b: "All of the above, if your sequences are non-trivial. A scheduler, per-user state that survives a deploy, exit conditions, and observability for the day it silently stops. The first version is a week. The version you would trust with a paying customer's onboarding is a quarter, and the maintenance does not end. Whether that is worth it depends mostly on how complex your sequences will actually get, which teams reliably underestimate.",
    },
    {
      heading: "Channels",
      a: "Email, push, SMS, in-app and webhooks, coordinated by one workflow with per-person preferences honoured across them. If your product genuinely needs to reach someone in more than one place, orchestrating it from one engine is a substantial simplification that is hard to assemble from parts. If you only send email, you are paying for an engine shaped for a problem you do not have.",
      b: "Email, and nothing else, permanently. That is a coherent scope and it keeps the product small and good. It also means that the day someone asks for a push notification alongside the email, Resend is not part of the answer and the coordination becomes your code's problem.",
    },
    {
      heading: "Templates",
      a: "An editor in the platform with a visual mode and a code mode, editable by a marketer, with the content living in the vendor. It is competent and it is not a designer's tool. The structural point is the same as everywhere else in this comparison: the artefact is outside your repository, so it is not reviewed, not tested and not reproducible locally without effort.",
      b: "React Email in your repository, first-party and genuinely good, going through the same review as the rest of your code. This is the best template story of the two by a distance for an engineering team, and completely unavailable to anybody without commit access. It also renders to plain HTML, so the library itself is portable even if the vendor is not.",
    },
    {
      heading: "Operational ceilings and failure modes",
      a: "The constraints are commercial rather than technical: tier thresholds, profile counts, and the fact that a workflow misconfigured in the editor will cheerfully message the wrong segment at scale without a code review standing in the way. The platform's own throughput is not something teams run into, but the blast radius of a mistake made in a UI is larger than one made in a pull request.",
      b: "Two API requests per second on every tier, including the most expensive, which no upgrade lifts. Batch endpoints accepting several recipients per call stretch that a long way, but any code that loops over a list making individual calls meets the ceiling immediately and permanently. For lifecycle sequences fanning out to a large cohort at nine in the morning, this is an architectural constraint to design for rather than a plan to upgrade.",
    },
    {
      heading: "What history you keep",
      a: "Profile-level activity history over a long window, which is the natural shape for a product built around a person rather than a request. That history is also the thing that makes segments work, so it is not really optional. It is still a vendor's store on a vendor's terms, and it does not leave with you in a form another platform can evaluate.",
      b: "Thirty days of logs on every plan short of Enterprise, then gone. Fine for debugging, useless for a billing dispute or a compliance request. Streaming events into your own store from the first day is about a day of work and is the single best thing a team on Resend can do for its future self, and almost nobody does it until somebody asks a question about March.",
    },
  ],
  pickA: [
    "Lifecycle logic should belong to growth or marketing, changeable without a deploy, because iteration speed is the whole point.",
    "The sequences need branches, waits, exit conditions and timezone-aware sends — precisely the parts of a build that overrun.",
    "You need email coordinated with push or SMS, with one set of per-person preferences across all of them.",
    "Nobody wants to own a scheduler whose worst failure mode is silently sending nothing for a week.",
  ],
  pickB: [
    "The messages are triggered by your own application and the logic is simple enough to belong in the codebase.",
    "A wide free funnel makes per-profile billing a charge for people you have already lost.",
    "Templates as reviewable React components matter more than any workflow editor would.",
    "Traffic is request-response and comfortably under two API calls a second, with no large synchronised fan-out.",
  ],
  prosA: [
    "The decision engine is the product: events in, segments evaluated continuously, workflows with branches, waits and exit conditions, and the sending is the last step of something the platform worked out.",
    "Cost is decoupled from volume, so an engaged user receiving twenty messages in a month costs precisely what one receiving two costs.",
    "Activity history is retained over a long window because the segments depend on it, which means a rule about who has not engaged in ninety days is simply computable.",
    "Push, SMS and in-app are steps in the same workflow as the email, with one set of per-person preferences honoured across all of them.",
  ],
  consA: [
    "Profiles are billed whether or not you message them, so a wide free funnel pays every month for people the product has already lost.",
    "A workflow changed in the editor reaches a large segment with no code review between the mistake and the send, which is a bigger blast radius than a bad pull request has.",
    "The branching logic does not export in any form another system will ingest, and that cost compounds with every sequence somebody adds.",
    "Sending a transactional message through the platform turns its recipient into a billed profile, so your cheapest traffic starts influencing the price of your lifecycle tooling.",
  ],
  prosB: [
    "The integration is genuinely finished in an hour: a small SDK, quick domain verification, clear errors, and a log view that shows what happened without configuration.",
    "React Email components live in the repository and go through the same review as everything else, which is the best template story available to an engineering team.",
    "Dormant users cost close to nothing, which suits a wide free funnel far better than any per-person meter does.",
    "The scope is small and stable — email, deliberately, and nothing else — so there is no engine to pay for whose shape you are not using.",
  ],
  consB: [
    "Nothing decides anything. A sequence is a scheduler, per-user state, exit conditions and a suppression check that you write, operate and keep working.",
    "Two API requests per second on every tier, permanently, so a workflow that wakes at nine and messages a cohort is a drip you designed rather than a send you made.",
    "Logs are purged at thirty days short of Enterprise, which quietly removes any engagement-based rule that needs a window longer than a month.",
    "Marketing contacts are billed separately in blocks, so some of the per-person metering you were escaping follows you across.",
  ],
  migrationChecklist: [
    "Inventory the sequences and count the branches, because that number is the migration. A linear three-message welcome with no conditions is a week of work on a send API. Anything with a branch, a wait that depends on behaviour, or an exit condition that has to fire the instant somebody converts is where the quarter goes, and the count of those is knowable today rather than after the decision.",
    "Design the fan-out against a two-per-second ceiling before writing a line of it. Lifecycle sequences are bursty by nature — a cohort becomes eligible at the same moment and everybody expects their message at nine. That pattern meets the limit immediately, no tier removes it, and the batch endpoint taking several recipients per call is the whole of the relief. A drip over twenty minutes is an acceptable answer; discovering it is the answer during a launch is not.",
    "Work out which of your segment rules need a window longer than thirty days, because those are the ones that stop being computable. A platform built around a persistent profile keeps engagement history because its own segments depend on it; a sending API purges logs at thirty days on every plan short of the top one. A re-engagement rule about ninety days of silence needs the events to already be landing in your own storage, and there is no way to reconstruct them later.",
    "Map subscription topics down to what audiences can express, and be honest that it is less. One side lets a person opt out of a topic and honours it on every subsequent send; the other attaches an unsubscribe to an audience used for broadcasts and has no equivalent for transactional mail. Somebody who wanted the product notices but not the digest is the case that breaks, and it breaks silently in the direction of sending too much.",
    "Re-key every dashboard, because the webhooks identify different things. Reporting events from a workflow engine carry the campaign and the journey the message belonged to; events from a sending API carry the message. If anything downstream aggregates by campaign, that dimension does not exist unless you attach your own tags at send time, and a dashboard fed the new events without that change produces numbers that look plausible and are not.",
    "Check whether the contact metering actually goes away. Moving lifecycle onto a send API means the recipients become audience members, and audiences are billed in blocks. The per-profile charge you were leaving is smaller on the other side rather than absent, so run the arithmetic on your real list — the saving is usually still substantial and it is rarely the whole invoice.",
    "Move the copy into the repository and name who loses access. The templates become components reviewed like code, which is better in every way except the one that matters organisationally: the person who currently edits a subject line in an editor now needs commit access or a ticket. Decide which of those it is before the migration rather than discovering it in the first week.",
    "Warm a subdomain and cut the transactional traffic first. It is high-engagement, low-complexity and the fastest way to establish standing for a new sender, and it gives you weeks of real delivery data before anything lifecycle-shaped moves. Ramping this way also means that if the sequences turn out to be a bigger build than planned, nothing has to be rolled back.",
  ],
  buyingQuestions: [
    "How many of our sequences contain a branch or a behavioural wait, and who has actually looked rather than assuming?",
    "What is the largest cohort that becomes eligible for a message at the same minute, and how long would that take at two calls a second?",
    "Which of our segment rules reach back further than thirty days, and where would the data for them live?",
    "Do any of our recipients hold topic-level preferences rather than a single opt-out, and where would those be honoured?",
    "What does our reporting aggregate by, and does that dimension survive a change of webhook payload?",
    "How many profiles have never received a message, and what share of the invoice is that?",
    "If the sequence scheduler silently stopped, how long before somebody noticed, and what would tell them?",
  ],
  faqs: [
    {
      question: "Can I run onboarding sequences on Resend?",
      answer:
        "You can run the sending on Resend; the sequence is yours to build. That means a trigger, a scheduler, per-user state that survives deploys, exit conditions so converted users stop receiving the nag, a suppression check at send time, and alerting for the day the scheduler stops. A simple three-message sequence with no branching is genuinely a week of work. Anything with conditions grows fast, and the growth is in the edge cases rather than the happy path.",
    },
    {
      question: "Is Customer.io overkill for a small SaaS?",
      answer:
        "Often, and the honest test is whether anyone other than an engineer needs to change who receives what. If the founder writes the copy and the engineer ships it and that arrangement is fine, a platform is buying you independence you are not using while charging for every dormant signup. If growth experiments are queued behind a release cycle and that is costing you experiments, the platform is buying the exact thing you lack.",
    },
    {
      question: "Do they overlap at all?",
      answer:
        "On one endpoint. Both will send a transactional message triggered by an API call, and Customer.io's version costs more because it is attached to a platform. Teams running both usually put transactional mail on Resend and lifecycle on Customer.io, split across separate subdomains. That keeps the cheap high-volume traffic out of the profile count and keeps the reputations independent, at the cost of two suppression lists to reconcile.",
    },
    {
      question: "Which is cheaper?",
      answer:
        "Resend, by a wide margin, on the sending alone — and that comparison is only meaningful if you are not using the platform. Priced honestly, Customer.io competes against Resend plus the engineering to build and maintain a workflow engine, and against the experiments that do not happen while that engineering is in progress. At a large dormant user base Resend still wins; at a small engaged base with complex sequences it frequently does not.",
    },
    {
      question: "What happens when I outgrow Resend's rate limit?",
      answer:
        "You batch, and then you queue. Sending to several recipients in one API call stretches the two-per-second ceiling considerably, and beyond that you spread the fan-out over time. No plan lifts the limit, so this is a design decision rather than a purchase. For a lifecycle sequence that wakes up at nine and messages a large cohort, decide early whether a drip over twenty minutes is acceptable, because that is the shape you will be living with.",
    },
    {
      question: "How do I build a segment like has not opened in ninety days?",
      answer:
        "Only if the events were already landing somewhere you own. A platform built around a persistent profile answers that question from its own retained history, which is why the segment is a UI action there. A sending API purges the log at thirty days short of the top plan, so the ninety-day window simply cannot be computed from what the vendor holds. The fix is cheap and has to be early: stream delivery and engagement events into your own store from the first day, because there is no retroactive version of this.",
    },
    {
      question: "Do topic-level preferences survive the move?",
      answer:
        "No, and the failure is the dangerous direction. A subscription topic lets somebody keep the product notices and drop the weekly digest, and the platform enforces that on every send without anybody remembering. A send API offers an unsubscribe attached to a broadcast audience and nothing for transactional mail. Unless you rebuild the preference as a row and a check immediately before each send, the person who opted out of one thing keeps receiving it, which is both a complaint and, depending on the mail, a compliance problem.",
    },
    {
      question: "Will my reporting dashboards still work?",
      answer:
        "Not without a change, because the two sets of webhooks identify different objects. Reporting events from a workflow engine tell you which campaign and which journey a message belonged to; events from a sending API tell you about the message. Anything aggregating by campaign loses its key. The remedy is to attach your own tags at send time so the dimension exists in the payload, and to do it before the cutover — a dashboard fed untagged events does not break, it just quietly reports on nothing.",
    },
    {
      question: "Does moving actually stop me paying per person?",
      answer:
        "It reduces it rather than ending it. The profile meter is the thing people are usually trying to escape, and the destination bills marketing contacts separately in blocks on top of the sending plan, so some per-person cost follows you across. For a wide free funnel the saving is still large, because the dormant majority stop being counted at all. Run the arithmetic against your real contact list rather than your profile count, since those two numbers are rarely as close as people expect.",
    },
  ],
};

const KLAVIYO_VS_RESEND: VersusPage = {
  slug: "klaviyo-vs-resend",
  a: "klaviyo",
  b: "resend",
  title: "Klaviyo vs Resend",
  description:
    "Klaviyo sells a merchant attributed revenue. Resend sells a developer a finished integration. The comparison only makes sense for one specific person: whoever is being asked to cut an ecommerce email bill.",
  search: {
    primaryQuery: "cut ecommerce email costs by moving to an api",
    secondaryQueries: [
      "resend for shopify transactional email",
      "klaviyo profile billing keeps increasing",
      "what you lose leaving an ecommerce marketing platform",
      "send order confirmations without a marketing tool",
      "sending order confirmations during a flash sale rate limit",
      "how long are transactional email logs kept",
      "where to store manually suppressed customers",
    ],
    rationale:
      "This search comes from a merchant looking at a Klaviyo invoice, and every available answer is from a competing marketing platform proposing a like-for-like swap. Nobody explains which half of the bill can actually move to a send API and which half cannot.",
  },
  intro:
    "Somebody looks at a Klaviyo invoice, remembers that sending email costs almost nothing, and starts reading about Resend. The arithmetic is seductive and the conclusion is usually wrong, because Klaviyo's product is not the sending — it is a customer data model with revenue attribution attached, operated by a marketer who does not write code. Resend is an excellent sending API operated by someone who does. Some of that invoice can genuinely move. The part that can move is not the part people expect.",
  dimensions: [
    {
      heading: "What the merchant is actually paying for",
      a: "A profile per shopper carrying orders, browsing behaviour, lifetime value and campaign history, synced from the store, with segments built against it in a UI and revenue attributed back to each campaign and flow. That report is the artefact a marketing budget is defended with. The email sending underneath it is ordinary, and nobody has ever chosen Klaviyo because of it.",
      b: "Delivery, done unusually well. A small SDK, fast domain verification, React Email, a clean log view and sensible webhooks. There is no customer record, no order history, no segment builder and no attribution, because none of that is what the product is. Resend will send the campaign you composed elsewhere and tell you it was delivered.",
    },
    {
      heading: "Segmentation, and what replaces it",
      a: "Built by a marketer against synced store data, with segments that update themselves — bought in the last thirty days, browsed without buying, lapsed after two orders. It requires no engineering involvement after the integration exists, which is why it gets used constantly rather than occasionally. That usage frequency is where the value actually accumulates.",
      b: "Whatever your own database can express, computed by your own code, and delivered to Resend as a list of addresses. Vastly more powerful in principle and unavailable in practice to anyone without SQL access and a deploy. Audiences exist for basic list management; they are not a segmentation engine and are not trying to be.",
    },
    {
      heading: "Flows, which are the half that earns the money",
      a: "Abandoned cart, browse abandonment, post-purchase, winback — built visually with timing, branches and exit conditions, running continuously. For most merchants these flows outperform campaigns per message by a wide margin, and they are the part of the platform most consistently forgotten when someone models a migration from the sending cost.",
      b: "Nothing equivalent. A sequence on Resend is a scheduler, per-user state, exit conditions and a suppression check that you write and maintain. For a merchant without an engineering team this is not a trade-off, it is a non-starter. For one with an engineering team it is a quarter of work to reproduce something that already exists and already works.",
    },
    {
      heading: "The billed unit, and why the invoice grows on its own",
      a: "Active profiles, counted across the account rather than only the people you mail, with the definition of active broadened in February 2025. Plans auto-upgrade as the count crosses thresholds and never auto-downgrade, so a list inflated by one good quarter keeps charging afterwards. Suppressing or deleting profiles you will never mail again is the first lever, and it is usually pulled far too late.",
      b: "Sends on a plan ladder, plus marketing contacts billed separately at a per-block rate. Dormant shoppers you never email are close to free, which is the structural advantage for a store with a long tail of one-time buyers. The contact charge is the part that catches people, because it is contact-based pricing quietly attached to a product everyone describes as send-priced.",
    },
    {
      heading: "Who operates it",
      a: "A marketer, entirely, after the store integration is connected. Campaigns, flows, segments, subject lines, send times and reports all belong to them, and engineering's involvement ends. For a merchant where marketing moves faster than the release cycle, that independence is the benefit even more than the features are.",
      b: "A developer, always. Every change to content, timing or audience is code and a deploy. That is correct for order confirmations and shipping notices, where the content is generated from data and correctness beats tempo. It is the wrong shape for promotional email, where the person with the ideas does not have commit access.",
    },
    {
      heading: "The traffic that can genuinely move",
      a: "Transactional mail — order confirmations, shipping notices, receipts — is frequently the majority of messages and a minority of the value Klaviyo provides. It is high volume, code-generated, indifferent to segmentation and needs excellent placement. Moving it off a profile-priced platform also reduces the profile count you are billed for, because transactional-only recipients no longer need to be profiles.",
      b: "This is exactly the traffic Resend is built for, and it will handle it better and far more cheaply. The two things to plan are the rate ceiling, which is two API requests per second on every tier and matters if confirmations burst during a flash sale, and the subdomain split, so the two sending reputations stay independent of each other.",
    },
    {
      heading: "Volume ceilings of different kinds",
      a: "Monthly volume is capped at roughly ten times your profile count, and sending halts past it. Most ecommerce patterns never come close. The merchants who do are the ones mailing a small devoted list frequently, and their only route past the cap is paying for more profiles than they have customers — a strange thing to discover during a peak week.",
      b: "Two API requests per second, on every tier, permanently, with batch endpoints accepting multiple recipients per call as the main relief. For steady transactional traffic this is invisible. For a flash sale that generates a thousand order confirmations in five minutes, it is an architecture decision about queueing that you want to make in advance rather than during.",
    },
    {
      heading: "Deliverability responsibility",
      a: "Klaviyo operates the sending and polices sending practices, with a commercial interest in keeping its pool healthy. Ecommerce list practices — popup capture, purchased lists, resurrecting three-year-old shoppers — are exactly what damages a pool, which is why the policing exists. For a merchant with no in-house expertise this is a real service, and it is completely invisible until the day they leave.",
      b: "Resend runs shared pools with its own operational team, and suspension during traffic spikes is the recurring complaint in its public reviews. A store moving a large promotional list onto a new sender in one evening is precisely the pattern that triggers that response. Ramp gradually, start with engaged recipients, and do not schedule the move for the month before your busiest season.",
    },
  ],
  pickA: [
    "Marketing owns the email programme and needs segmentation and attributed revenue without asking anyone for a query.",
    "Abandoned-cart, browse-abandonment and post-purchase flows are doing real work, and rebuilding them is not a project you have room for.",
    "Nobody in-house owns deliverability, and a vendor with a commercial stake in a clean pool is worth paying for.",
    "The store data integration is the thing that makes the whole programme work, and reproducing it would be the actual migration.",
  ],
  pickB: [
    "The mail in question is transactional — confirmations, shipping, receipts — and moving it off a profile-priced platform lowers the bill twice over.",
    "Your engineering team already owns the customer data model, so what you need from a vendor is delivery rather than a second database.",
    "Templates as reviewable components in the repository suit how your team works better than a visual editor does.",
    "A long tail of dormant one-time buyers is inflating a profile count for people who will never open anything again.",
  ],
  prosA: [
    "The store integration populates the profile with orders, browsing and lifetime value, so a segment like bought twice and lapsed is an afternoon's work for a marketer and no work for anybody else.",
    "Attributed revenue exists as a first-class report against a configurable window, which is the artefact a marketing budget survives review with.",
    "Flows run continuously without anyone scheduling them, and per message they routinely outperform campaigns by a margin that surprises people who only ever look at the campaign numbers.",
    "Sending practices are actively policed by a vendor with a commercial interest in the pool staying clean, which is a service a merchant with no in-house expertise only notices once it is gone.",
  ],
  consA: [
    "Active profiles are the meter, counted across the whole account rather than across the people you mail, and the plan ratchets upward through thresholds without ever stepping back.",
    "Monthly volume is capped near ten times the profile count, which is invisible to most stores and a hard stop for anyone mailing a small devoted list frequently.",
    "The transactional path exists and is not what the product is for, so the highest-volume mail in a store is being charged at marketing-platform rates.",
    "Everything valuable rests on a store integration that has to keep syncing, which makes the platform stickier than the monthly figure suggests.",
  ],
  prosB: [
    "Delivery done unusually well: a small SDK, domain verification in about the time DNS takes, sensible webhooks and a log view nobody had to configure.",
    "Dormant one-time buyers cost close to nothing, which is exactly the shape of the long tail that inflates a per-person meter.",
    "Templates are React Email components in the repository, reviewed like the rest of the code, which suits a team that already builds the storefront that way.",
    "The scope is deliberately narrow, so there is no customer database, no flow engine and no attribution report being paid for and not used.",
  ],
  consB: [
    "Two API requests per second on every tier, which is invisible for steady order flow and precisely wrong for the thousand confirmations a flash sale produces in five minutes.",
    "Thirty days of logs short of Enterprise, so a dispute about a confirmation from three months ago has no record on the vendor side at all.",
    "There is no customer record, no order history, no segment builder and no attribution, so replacing the marketing programme means rebuilding all four.",
    "Suspension during a traffic spike recurs in its public reviews, and a store moving a promotional list onto a new sender in one evening is that pattern exactly.",
  ],
  migrationChecklist: [
    "Move the confirmations and leave the programme, at least to begin with. Order confirmations, shipping notices and receipts are often the majority of the messages and a minority of what the platform is actually providing, and they run on a send API better and far more cheaply. Campaigns, flows and attribution are a customer data model, and merchants who try to move that half usually finish the sending in days and abandon the campaign tool in a quarter.",
    "Size the burst before writing the send path. Steady order flow is nowhere near two calls a second; a flash sale that produces a thousand confirmations in five minutes is far past it, and no plan lifts the ceiling. The batch endpoint plus a queue is the answer, and it is ordinary engineering that is much easier to build in a quiet week than during the sale that revealed the need for it.",
    "Decide where a three-month-old confirmation is looked up. A support agent asking whether a customer received their receipt in March is answering from a thirty-day log window on the new side, which means the answer is no longer available. Publish delivery events to your own storage from the first day of the cutover, because the gap is invisible until somebody asks and then it is permanent.",
    "Export the suppression states and find a home for the manual one. Unsubscribed shoppers, addresses judged invalid, and people somebody suppressed by hand are three distinct facts on the platform side. A send API keeps its own bounce record and attaches unsubscribes to broadcast audiences, and the hand-suppressed group — the customer who phoned and asked to be removed — has no object to live in. That becomes a table and a check, or it becomes a complaint.",
    "Verify that the profile count actually falls before counting the saving. The theory is that recipients who only ever received transactional mail stop needing to be profiles, and the theory is usually right. It is also checkable: look at how many of your profiles have received nothing but a confirmation in the last year, and confirm the plan threshold you would drop below. Plans ratchet up without stepping down, so somebody may need to trigger the reduction rather than waiting for it.",
    "Work out which flows die quietly when the store events stop. Browse abandonment, back-in-stock and post-purchase sequences all depend on a bidirectional sync that terminates when the integration does. A send API consumes none of it. Write down which of those flows is earning money before you decide they are replaceable, because that list is usually shorter than the fear and longer than the spreadsheet.",
    "Keep the hosted signup forms alive or replace them in the same change. They capture the address, create the record, timestamp consent and start the welcome sequence in one action, and a form embedded on your storefront keeps posting into whichever account it was configured for. Point them somewhere you own before the subscription ends, or you spend a month collecting addresses into an account nobody reads.",
    "Warm the new sender on its own subdomain and do not do any of this near a peak. Transactional mail is high-engagement and establishes standing quickly, which is another reason to move it first. A large promotional list arriving at a brand new sender in one evening is the exact pattern behind the spike-suspension complaints, and the weeks before your busiest season are the worst possible time to find out.",
  ],
  buyingQuestions: [
    "What proportion of our messages are confirmations and shipping notices, and what are we currently paying per one of those?",
    "What is our worst five minutes of order volume in a year, and what would that look like against a two-per-second ceiling?",
    "How far back does support need to look up a sent message, and does a thirty-day window cover it?",
    "Which flows produced measurable revenue last quarter, and which ones are running because nobody turned them off?",
    "How many of our profiles have only ever received transactional mail, and what plan threshold would removing them cross?",
    "Who would the hand-suppressed customers — the ones who phoned and asked — be tracked by after a move?",
    "Are we inside eight weeks of peak season, and is this the quarter to be warming a new sender at all?",
  ],
  faqs: [
    {
      question: "Can Resend replace Klaviyo?",
      answer:
        "Not as a like-for-like swap, and the difference matters. Klaviyo's product is a customer data model with attribution and a flow engine, operated by a marketer. Replacing it with Resend means rebuilding all of that on top of a send API, which is a large engineering project whose output a marketing team frequently refuses to use. What Resend can replace is the transactional half of the sending, which is a much smaller and much more sensible move.",
    },
    {
      question: "Which parts of my Klaviyo bill can I actually reduce?",
      answer:
        "Two things, in order. First, suppress or delete profiles you will never mail — the billing is per active profile and plans auto-upgrade without ever auto-downgrading, so an inflated count from one good quarter keeps charging. Second, move transactional mail to a cheap sender, which both removes that volume and removes transactional-only recipients from the profile count. Attack those before considering a migration of the marketing programme.",
    },
    {
      question:
        "Will splitting transactional off hurt my marketing deliverability?",
      answer:
        "It can, in both directions, and it should be planned rather than discovered. Transactional mail has high engagement and contributes positively to a domain's reputation, so removing it changes the signal the remaining sender produces. Use separate subdomains so the two reputations are genuinely independent, warm the new sender gradually starting with engaged recipients, and do not make the change in the weeks before a peak season.",
    },
    {
      question: "Does Resend's rate limit matter for order confirmations?",
      answer:
        "Usually not, and there is one scenario where it does. Steady order flow is nowhere near two API requests per second. A flash sale or a successful campaign that produces a thousand orders in five minutes is, and the limit does not lift on any plan. The fix is a queue with batch sends rather than a plan upgrade, which is ordinary engineering and much easier to build before the sale than during it.",
    },
    {
      question: "Why does my profile count keep going up?",
      answer:
        "Because profiles are created by signups, checkouts and integrations, the definition of active broadened in February 2025, and plans auto-upgrade when the count crosses a threshold while never auto-downgrading when it falls. The count is therefore a ratchet unless somebody actively manages it. Reviewing it quarterly and suppressing shoppers who have not engaged in a year is the single most effective cost control available on the platform.",
    },
    {
      question: "What would I have to rebuild to run campaigns on Resend?",
      answer:
        "A store data sync, a segment engine that evaluates against it, a campaign composer somebody in marketing will actually use, a scheduler, a suppression check at send time, and an attribution report joining sends to orders. The sending is the smallest piece by a wide margin. Merchants who attempt this usually finish the sending in days and then spend a quarter on a campaign tool that the marketing team quietly stops opening, which is the expensive way to learn that the platform was never charging for delivery.",
    },
    {
      question: "How long can support look up a sent receipt afterwards?",
      answer:
        "Thirty days on every plan short of Enterprise, which is shorter than most refund windows and much shorter than most disputes. The scenario is concrete rather than theoretical: a customer says their order confirmation never arrived, the order was in March, and it is now June. Nothing went wrong — the window simply closed. Publishing delivery events into your own storage from the day of the cutover costs about a day of work and is the difference between an answer and an apology.",
    },
    {
      question: "What happens to customers I suppressed by hand?",
      answer:
        "They need a new home, because there is no object for them on the other side. A marketing platform distinguishes people who unsubscribed, addresses that bounced and people somebody removed manually — the customer who phoned and asked never to be contacted again. A send API keeps a bounce record and attaches unsubscribes to a broadcast audience, and the third category fits neither. Export that list specifically, store it yourself, and check it immediately before every send rather than when the audience was built.",
    },
    {
      question: "Will my flows stop working if I only move transactional mail?",
      answer:
        "No, and that is the point of moving only that half. The store integration keeps syncing, the profiles keep updating, and abandoned cart and post-purchase carry on untouched. What changes is that confirmations and shipping notices leave the platform, which lowers the sending cost and can lower the profile count. Use a separate subdomain so the two reputations do not interact, and expect the remaining marketing sender's engagement numbers to shift once the high-engagement transactional mail is no longer mixed in.",
    },
    {
      question: "Is a flash sale a problem on a send API?",
      answer:
        "It is the one scenario where the rate ceiling genuinely bites. A thousand orders in five minutes generates a thousand confirmations, and two calls a second turns that into more than eight minutes of queue even before anything else is competing for the budget. The batch endpoint accepting multiple recipients per call is the main relief, and a queue in front of it is the rest. Build both before the sale; they are straightforward, and the alternative is customers wondering where their receipt went during your busiest hour.",
    },
  ],
};

const AMAZON_SES_VS_MAILERSEND: VersusPage = {
  slug: "amazon-ses-vs-mailersend",
  a: "amazon-ses",
  b: "mailersend",
  title: "Amazon SES vs MailerSend",
  description:
    "MailerSend's product is a template builder a non-engineer can open, wrapped around a competent email API. SES has no builder and never will. That single capability is most of what separates them.",
  search: {
    primaryQuery: "email api with a template editor for non developers",
    secondaryQueries: [
      "mailersend starter versus professional plan difference",
      "who edits transactional email templates",
      "aws ses template api limitations",
      "multi brand transactional email for an agency",
      "blocking an entire domain from receiving your email",
      "where to store amazon ses delivery events for search",
      "separating client sending accounts on aws",
    ],
    rationale:
      "The decision here is organisational rather than technical — whether a person without commit access needs to change an email — and it is not a decision either vendor's pricing page is organised around, so the comparison has to be written from the outside.",
  },
  intro:
    "Strip away the marketing on both sides and this comparison reduces to one question: does somebody who cannot open a pull request need to change what an email says? If the answer is no, SES is cheaper, more flexible and already inside infrastructure you run. If the answer is yes, MailerSend has built its entire product around that person, and SES has built nothing for them and has no plans to. Everything else on this page is a consequence of that one difference.",
  dimensions: [
    {
      heading: "The template builder, which is the whole argument",
      a: "SES has a template API with token substitution, and the prevailing practice is to ignore it and render HTML in your own application instead. That makes templates code — versioned, reviewable, portable, testable — and completely invisible to anyone without repository access. A preview environment for non-engineers is a thing you build, and most teams never do, so the person who wants to change a subject line files a ticket.",
      b: "A drag-and-drop builder with variables, conditional blocks and a preview, aimed squarely at a marketer or a support lead. They change the copy, they see what it will look like, they publish, and no deploy happens. For a company with twenty transactional messages that need occasional wording changes, this removes a recurring low-value interruption from the engineering queue, which is worth considerably more than it sounds.",
    },
    {
      heading: "The free tier, and what it is actually for",
      a: "There is no meaningful free tier any more. The old arrangement people remember is gone, new accounts land on a metered plan rather than the flat rate, and the plan is scoped per account and per region. SES is extremely cheap and it is not free, so a staging environment or a hobby project is a small bill rather than no bill.",
      b: "A free allowance that is small in both dimensions — a low monthly cap and a low daily one. It is enough to evaluate the product and not enough to run anything real, including most staging environments. Treat it as a trial with no clock rather than as a tier you could live on, because teams that plan around it discover the daily cap on the first busy Tuesday.",
    },
    {
      heading: "What the higher plan actually buys",
      a: "Nothing, in this sense. SES has no feature tiers: the plan you select changes the rate you pay, not the capabilities you get. Whatever is available on day one is available forever, which is either reassuring or bleak depending on what you were hoping for. There is no upgrade path because there is nothing above you.",
      b: "The step from Starter to Professional costs substantially more for the same included volume, and what it buys is seats, longer retention and team features rather than sending. That is worth naming plainly because it is the most common place an evaluation goes wrong: somebody prices Starter, then discovers the requirement list needs Professional, and the comparison against SES changes shape entirely. Price the tier with the features.",
    },
    {
      heading: "Multiple brands and multiple domains",
      a: "SES handles many verified identities in one account without difficulty, and configuration sets let each one carry its own event destinations and reputation options. What it does not provide is any notion of a workspace, a client or a permission boundary between them, so an agency running mail for twelve customers is building its own separation, its own access control and its own reporting split.",
      b: "Domains, templates and users are organised in a way that suits running several brands, with the seat and permission model that Professional adds being precisely what an agency needs. For a company sending on behalf of clients, or a group with several product brands, this organisational shape is a real product feature rather than an administrative convenience.",
    },
    {
      heading: "Inbound and the surrounding surface",
      a: "SES can receive mail in a subset of regions through receipt rule sets that store to S3, invoke a Lambda, publish to SNS or reject. It is powerful and entirely unparsed — you get raw MIME and write everything after that. Combined with the rest of AWS it is the most flexible option here by a distance, and flexibility is another word for work.",
      b: "Inbound routing exists and is more finished than SES's in the sense that fields arrive parsed, and it is a smaller part of the product than it is for a vendor built around routing. For the common case of getting replies to a webhook it is adequate and quick. For anything structurally unusual it will be the wrong shape, and the escape hatch is another vendor rather than another line of code.",
    },
    {
      heading: "Deliverability and who watches it",
      a: "Your reputation alone, in your own account, with your own metrics and nobody monitoring them on your behalf. Warming a new identity is real work, the isolation means a neighbour cannot hurt you, and the absence of anyone noticing your problem is the cost. Once the reputation is established it belongs to an account you keep, which is the durable advantage of this side.",
      b: "MailerSend's shared pools with dedicated options on the higher plans, operated by a team whose job it is. For a mid-market company with no deliverability expertise this is a genuine service. The standard exposure applies: the standing you enjoy belongs to the vendor and does not travel with you, so leaving means starting a reputation from nothing.",
    },
    {
      heading: "The shape of the bill",
      a: "Per message, no platform fee, no plan to outgrow, billed by AWS alongside everything else and cheap enough at any real volume that the comparison stops being close. The complications are AWS complications — per account, per region, and a metered plan for new accounts — rather than surprises. Cost is a straight line with a small slope.",
      b: "A plan with an included volume and an overage rate that improves as the plan grows, with the Starter-to-Professional step being about seats and retention rather than sending. Predictable and considerably more expensive per message. The fair comparison is not the raw rate: it is MailerSend against SES plus whatever you would build to give a non-engineer a template they can edit.",
    },
    {
      heading: "Control over the message itself",
      a: "Total. SES accepts raw MIME if you want it, so headers, encoding, multipart structure, attachments and list-unsubscribe behaviour are all yours to determine exactly. If you have a specific requirement about how an email is constructed, SES will honour it and most products in this category will not even expose the option.",
      b: "Whatever the builder and the API model expose, which covers ordinary transactional email comfortably and stops there. This is the usual product-versus-primitive trade and it is invisible until the day you need something specific. The failure mode is not that it is difficult — it is that it is unavailable, and the workaround is to stop using the template system you chose the product for.",
    },
  ],
  pickA: [
    "All email content is generated by code and nobody outside engineering will ever need to change it.",
    "Volume is high enough that per-message economics dominate, and you are already inside AWS with an engineer to own the plumbing.",
    "You need exact control over message construction — headers, encoding, attachments — that a product-shaped tool does not expose.",
    "Sending reputation should attach to an account you keep, so changing the tooling above it is never a migration.",
  ],
  pickB: [
    "Someone without commit access needs to edit transactional email copy, and the current arrangement has them filing tickets to do it.",
    "You run mail for several brands or clients and want domains, templates and permissions organised that way out of the box.",
    "Nobody in-house wants to own deliverability monitoring, and a managed pool with dedicated options above it is the simpler answer.",
    "Volume is modest enough that the plan price is smaller than the engineering cost of building a template experience SES will never provide.",
  ],
  prosA: [
    "Many verified identities live in one account without friction, and configuration sets give each of them its own event destinations and reputation options.",
    "The plan changes the rate rather than the capability, so there is no tier above you holding a feature hostage and no evaluation that goes wrong at the pricing page.",
    "Raw MIME is accepted in full, which means a header, an encoding, a multipart arrangement or a list-unsubscribe behaviour is yours to set exactly.",
    "Inbound receiving composes with the rest of AWS — store the raw message, invoke a function, publish to a topic, reject outright — with rules evaluated in an order you control.",
  ],
  consA: [
    "The template API offers token substitution and effectively nothing else, so the person who wanted to change a subject line is filing a ticket either way.",
    "There is no workspace, no client boundary and no seat model, so an agency running mail for a dozen customers builds its own separation, access control and reporting split.",
    "Inbound arrives as raw MIME, and every parsed field another vendor would have handed you is a parser you write and then maintain against real-world mail.",
    "Nothing stores your activity: events are published and then they are gone unless you built the destination, so the searchable history a support lead relied on has to be constructed first.",
  ],
  prosB: [
    "A drag-and-drop builder with variables, conditional blocks and a preview, aimed at a marketer or a support lead rather than at whoever last touched the codebase.",
    "Domains, templates and users are organised in a way that suits running several brands, which is an actual product feature for an agency rather than an administrative convenience.",
    "Inbound arrives with fields already parsed, so getting replies to a webhook is a short afternoon instead of a parser with a long tail of encoding bugs.",
    "It operates its own sending infrastructure rather than reselling somebody else's, which makes the deliverability difference between the two options real rather than an artefact of two accounts on one substrate.",
  ],
  consB: [
    "The step up between plans buys seats, retention and team features at the same included volume, which is where most evaluations of this product produce the wrong number.",
    "The free allowance is capped on both a monthly and a daily basis, so it evaluates the product and will not run a staging environment through a busy Tuesday.",
    "You work inside the builder's model of an email, and the failure mode is not difficulty but unavailability — the workaround is abandoning the template system you bought the product for.",
    "The standing behind your mail belongs to the vendor's pools, so leaving means starting a reputation from nothing regardless of how long you stayed.",
  ],
  migrationChecklist: [
    "Settle the org question first, because it decides the rest. If somebody without commit access edits transactional copy today, moving to SES converts that into a ticket queue unless you are also budgeting a preview and editing path. That is the migration. Everything below is mechanical by comparison, and teams that skip this step ship a technically clean move and then spend a year being asked when the editor is coming back.",
    "Export the suppression lists individually and expect two of them to have nowhere to go. A product built for this market keeps hard bounces, spam complaints and unsubscribes apart, and often a manual blocklist that accepts whole domains as well as addresses. SES has two reasons and takes addresses only. The unsubscribes become your table, and any domain-level block becomes a condition in your own code that runs before the send call.",
    "Convert every template-id send into a render. Messages here are triggered by referencing a stored template plus a personalization payload, and the conditional blocks inside that template execute on the vendor's side. Moving the body into your application makes the variable contract explicit for the first time, and the variables that were quietly optional are the ones that start rendering as empty blocks in production.",
    "Rebuild the inbound path around raw MIME. Parsed fields arriving at a webhook and a raw message landing in object storage are not the same integration with a different address on it. Anything downstream that consumed a clean from, subject and text body now sits behind a parser you own, and the messages that break it are multipart replies from real mail clients rather than anything you would write as a fixture.",
    "Stand up event publishing before you need to answer a question. Activity search and analytics are retained by plan on one side and do not exist at all on the other: SES emits delivery, bounce, complaint, open and click events to a destination you configure and stores nothing itself. If nobody wires that up on day one, the first support question about last month has no answer and no way to get one retroactively.",
    "Redesign the multi-brand separation as IAM and configuration sets. Seats, roles and a per-client view have no AWS counterpart beyond policies you write, so an agency's clean boundary between customers becomes a permissions design exercise. It is entirely doable and it is a piece of infrastructure with an owner, which is a different thing from a checkbox on a plan.",
    "Account for the genuinely different network. This is not a case of two products sitting on the same substrate, so your placement can move in either direction for reasons that have nothing to do with your list. Warm the new identity across a subdomain, start with your most engaged recipients, and hold both senders live long enough to compare rather than long enough to hope.",
    "File the production access application with the suppression work already done. The sandbox gate asks how addresses were collected and what happens to a bounce, and the export above has just made those answerable in specifics. Vague answers earn a request for more detail, and that round trip is the part of an SES rollout most likely to move a launch date.",
  ],
  buyingQuestions: [
    "How many times last quarter did somebody outside engineering ask for a wording change to a transactional email?",
    "Which plan row actually contains the seats, retention and features on our list, and is that the row we have been comparing?",
    "Do we block any sending at the domain level today, and where would that rule live if the suppression list only accepted addresses?",
    "Who would own the MIME parser once inbound stops arriving pre-parsed, and have they seen what real replies look like?",
    "Where will delivery events be stored, and who is responsible for the fact that nothing stores them by default?",
    "If we run mail for several brands or clients, what enforces the boundary between them and who audits it?",
    "Are we comparing per-message rates, or comparing one of them against the other plus the template experience we would have to build?",
  ],
  faqs: [
    {
      question: "Why not just use the SES template API?",
      answer:
        "Because it is minimal and nobody enjoys it. It offers token substitution and little else — no conditionals worth the name, no layouts, no preview, and no interface a non-engineer would open. Managing templates means API calls or CLI commands. Most teams conclude within a week that rendering in their own application is better, which is true, and which still leaves the person who wanted to change a subject line filing a ticket.",
    },
    {
      question: "Can I build a template editor on top of SES?",
      answer:
        "Yes, and it is a bigger project than it looks. A usable version needs storage and versioning, a visual or markup editor, variable substitution with a preview against realistic data, rendering that survives the major email clients, an approval step and a permission model. Teams that start this generally ship something in a quarter that engineering is proud of and the intended users avoid. Buy it or use a platform layer; building it rarely pays.",
    },
    {
      question:
        "What is the real difference between MailerSend's Starter and Professional?",
      answer:
        "Not sending volume — the included allowance is the same on both at the comparable size. Professional adds seats, longer data retention and team features, which is to say it is priced for organisational capacity rather than for throughput. That is legitimate and it is also why the plan comparison surprises people. Decide which features you need first and price the row that contains them, because the headline row probably does not.",
    },
    {
      question: "Is MailerSend built on Amazon SES?",
      answer:
        "It operates its own sending infrastructure rather than reselling SES, so a move between the two genuinely changes the network, the pools and the relationships behind your mail. That matters because it makes deliverability differences between them real rather than an artefact of two accounts on the same substrate, which is the situation with several other providers in this market.",
    },
    {
      question: "How much would I save moving to SES?",
      answer:
        "Per message, a great deal, and the honest comparison is not per message. Price SES plus the work to replace what you are using: a template experience for non-engineers, an event pipeline, somewhere to search sent mail, and someone to watch deliverability. At high volume SES still wins clearly. At moderate volume with a marketer editing templates weekly, the saving is frequently smaller than the interruption cost it creates.",
    },
    {
      question: "Where do domain-level blocks go on SES?",
      answer:
        "Into your own code, because the suppression list takes addresses and nothing larger. Products in this market commonly let you blocklist an entire domain, which teams use for competitors, for a customer who asked to be excluded wholesale, or for a disposable-address service that keeps producing complaints. None of that has a representation in AWS. The replacement is a rule evaluated immediately before the send call, which means it has to be in the path of every send site rather than configured once in a console.",
    },
    {
      question: "How do I search sent mail once I am on SES?",
      answer:
        "You build the place the search runs against. SES publishes delivery, bounce, complaint, open and click events to a destination you nominate and keeps nothing itself, so there is no activity view and no retroactive way to recover a window you did not capture. The usual shape is events onto a stream, into storage with a lifecycle policy, behind a small internal page. It is a day or two of work and it has to exist before the first question rather than after it.",
    },
    {
      question: "Can an agency keep clients separate on SES?",
      answer:
        "Yes, and it is a design exercise rather than a setting. Separate AWS accounts under an organisation gives the cleanest boundary and the most administration; one account with per-identity IAM policies and a configuration set per client is lighter and relies on your policies being right. Either way the reporting split, the access control and the per-client view are things you own. Compare that honestly against a plan whose seat and permission model already does it.",
    },
    {
      question: "Does my template HTML transfer?",
      answer:
        "The markup mostly does and the behaviour mostly does not. A builder emits ordinary table-based HTML that SES will happily send, so the visual layout survives a copy and paste. What does not survive is everything the builder was evaluating at send time: conditional blocks, repeated sections and variable defaults all execute on the vendor's side against the payload you supplied. Those become rendering logic in your application, and a conditional that silently resolved to nothing is the one that ships broken.",
    },
  ],
};

const MAILERSEND_VS_RESEND: VersusPage = {
  slug: "mailersend-vs-resend",
  a: "mailersend",
  b: "resend",
  title: "MailerSend vs Resend",
  description:
    "Two modern transactional APIs that look alike from the outside and were built for opposite people. One assumes a marketer will open the template. The other assumes nobody but an engineer ever will.",
  search: {
    primaryQuery: "mailersend or resend for transactional email",
    secondaryQueries: [
      "email api where marketing can edit the template",
      "react email versus drag and drop builder",
      "mailersend api rate limit compared to resend",
      "transactional email with sms on the same account",
    ],
    rationale:
      "Both vendors describe themselves as developer-friendly email APIs, which is why they show up in the same shortlist and why the shortlist is usually wrong — the deciding question is who is allowed to change an email without a deploy, and neither pricing page frames it that way.",
  },
  intro:
    "These two land on the same shortlist constantly, and the reason is a bad one: both are modern, both have clean APIs, both are cheaper than the incumbents. Look at what each one put at the centre of the product and they diverge immediately. MailerSend built a drag-and-drop builder and wrapped an API around it. Resend built an API and made the template a React component in your repository. Everything that follows — who files the ticket when the copy is wrong, how the two products meter you, what else they will sell you — comes out of that one decision.",
  dimensions: [
    {
      heading: "Where the template physically lives",
      a: "In MailerSend's account, edited in a visual builder, with variables an engineer wires once and copy anybody can change afterwards. There is no deploy in the loop, which is the point. The cost is that your email templates are now state in somebody else's system: they are not in version control, a bad edit has no diff, and rolling one back means remembering what it used to say.",
      b: "In your repository, as a React component, rendered by React Email at send time or build time. It diffs, it reviews, it rolls back with a revert, and it can be unit tested. The cost is symmetrical: every copy change is a pull request, and the person who wanted to soften a sentence in the welcome email now needs an engineer and a deploy window.",
    },
    {
      heading: "The rate limit you will actually meet",
      a: "MailerSend publishes per-endpoint API limits that rise with the plan, and it ships a bulk send endpoint specifically for pushing many messages in one call. A batch job is a supported shape rather than something you work around, and if you outgrow the entry limit the answer is a plan change rather than an architectural one.",
      b: "Resend caps the API at two requests per second on every tier including the most expensive, and no amount of money removes it. For login codes and receipts that is ample. For a job that wants to emit ten thousand messages before the hour is out, you build a queue and a drip, which is ordinary work but it is work, and discovering it after you have written the integration is the common way to find out.",
    },
    {
      heading: "What the free allowance is good for",
      a: "A demonstration rather than an environment. The monthly free ceiling is low enough that a staging system with any real traffic will exhaust it, so plan on either a paid plan for non-production or a separate capture tool. That is easy to arrange deliberately and annoying to discover when a seeded test run eats the month on a Tuesday.",
      b: "A small real environment, with a monthly allowance that is genuinely usable and a daily cap sitting underneath it. The daily cap is the part that surprises people: a load test or a bulk import can hit the ceiling for the day while the month still shows plenty of headroom, and the failure looks like an outage rather than a quota.",
    },
    {
      heading: "What you can still answer three months from now",
      a: "MailerSend keeps activity with a retention window that lengthens as you move up the plans, which makes retention a thing you can purchase rather than a fixed wall. Whether you should purchase it is a real question — for many teams the honest answer is that the second plan tier is being bought for history and seats rather than for sending.",
      b: "Thirty days on every plan below Enterprise, then the record is gone. The scenario is not hypothetical: someone disputes a notification in March and you are looking in June. Streaming the webhook into your own store from the first week fixes it entirely and costs almost nothing, and virtually nobody does it until the first time the window closes on them.",
    },
    {
      heading: "Receiving mail as well as sending it",
      a: "Inbound routing is part of the product. You point a domain or subdomain at MailerSend, define routes, and parsed messages arrive at your webhook, which is enough to build reply-to-ticket handling on without a second vendor. The parsing handles the tedious parts — multipart bodies, attachments, quoted history — so your handler is a function rather than a MIME project.",
      b: "Resend's centre of gravity is outbound, and inbound arrived later and stays deliberately narrower. If reply handling is load-bearing for your product rather than a nice extra, check the current shape of it against your actual requirement rather than assuming parity, because this is the axis where the two products are least comparable.",
    },
    {
      heading: "Whose sending operation is underneath",
      a: "MailerSend sits inside the same company as MailerLite and sends on infrastructure that company runs, with its own IP pools and its own abuse posture. The practical consequence is that the vendor you complain to is also the vendor that can fix it, and that the shared pool you sit in is populated by that company's other customers rather than by a hyperscaler's entire customer base.",
      b: "Resend is a layer over Amazon SES, which it has never hidden. The deliverability floor underneath is AWS's and it is a high floor. It also means the AWS account is Resend's: the reputation you build accrues to their identities, and a policy decision made by AWS about their account is a policy decision about your sending.",
    },
    {
      heading: "Channels other than email",
      a: "MailerSend sells SMS alongside email on the same account, which matters if you are about to add one-time codes over a second channel and did not want a second vendor, a second contract and a second set of compliance questions. The depth is modest next to a dedicated messaging platform, and modest is usually what a verification code needs.",
      b: "Email only, on purpose. Resend has stayed narrow and the product is better for it, but the narrowness is a real constraint the day somebody decides the checkout confirmation should also go by text. You will be adding a vendor, and the comparison you should run then is against a messaging provider rather than against MailerSend.",
    },
    {
      heading: "What the higher plan is really selling",
      a: "Seats, retention and support. The step up can cost substantially more than the entry plan for exactly the same sending volume, which reads as a mistake on the pricing page until you understand it as a per-organisation price. A solo developer should stay on the entry tier and stop reading; a team of six with a marketer and a support rota is the customer the upper plan was drawn for.",
      b: "Headroom and a different risk posture. Resend splits into two ladders and identical volume costs materially different amounts depending which one you sit on, with the higher one aimed at teams whose sending is the business rather than a feature of it. Marketing contacts are metered separately from sends, so a list that grows raises the bill in a month you sent nothing to it.",
    },
    {
      heading: "Bulk and campaign sending",
      a: "There is real campaign capability here — lists, a scheduled send, the same builder — which suits the team that wanted one tool for the product emails and the occasional announcement. It is not a lifecycle platform and does not claim to be, but it clears the bar for a monthly product update without a second subscription.",
      b: "Broadcasts exist and are deliberately simple: an audience, a React or HTML email, a send. For a changelog to people who asked for it that is the right amount of product. For segmentation on behaviour, branching journeys or anything a growth team would recognise as automation, you are buying a second tool and wiring the contacts across.",
    },
  ],
  pickA: [
    "Someone who does not write code needs to change email copy this week, and waiting for a deploy is the friction you are actually trying to remove.",
    "Reply handling matters to your product, so inbound parsing needs to be a mature part of the vendor rather than a recent addition.",
    "You are about to add SMS and would rather not run a second vendor relationship for one-time codes.",
    "Your sending has burst shapes — an overnight digest, an import notification — and a hard two-per-second ceiling would mean building a queue you had not planned.",
  ],
  pickB: [
    "Emails are part of the codebase to you: reviewed, versioned, tested, deployed with everything else.",
    "Time from empty project to first sent message is the metric you are optimising, and React Email is already how you want to author.",
    "Traffic is steady request-response mail well inside the rate ceiling, with nothing in the system that sends in batches.",
    "You already intend to stream delivery events into your own warehouse, so a thirty-day vendor window is a non-issue rather than a trap.",
  ],
  faqs: [
    {
      question: "Can I use React Email with MailerSend?",
      answer:
        "Yes. React Email renders components to an HTML string and is not coupled to any particular vendor's API, so you can render and hand the result to MailerSend's send endpoint exactly as you would to anything else. What you lose is the reason to choose MailerSend in the first place: if templates live in the repository, the builder is not doing anything for you and the comparison should be run against vendors that optimise for the code path instead.",
    },
    {
      question:
        "Is the two-requests-per-second limit really on every Resend plan?",
      answer:
        "Yes, and it is the fact most likely to invalidate an otherwise sound evaluation. It is not a soft limit you grow out of by spending more. The workaround is standard — enqueue sends and drain the queue at a safe rate, with retries on the rejections — and it is perhaps a day of work. Budget the day, or confirm your traffic genuinely never bunches, before you commit the integration.",
    },
    {
      question: "Which of these has better deliverability?",
      answer:
        "There is no honest general answer, and anybody giving you one is selling something. Resend inherits a high floor from AWS; MailerSend runs its own pools with its own abuse controls. Both are shared reputation, so your neighbours matter and you cannot audit them. What actually decides your placement is under your control anyway: authenticated domains with a DMARC policy, a separate subdomain for bulk mail, prompt suppression handling, and not sending to addresses that never asked.",
    },
    {
      question:
        "How do I let a marketer edit copy without giving up version control?",
      answer:
        "Split the template from the content. Keep the layout, the variables and the structural HTML in code where they are reviewed, and put the handful of strings that actually change into a small content store the marketer can edit — a database table, a CMS entry, a feature-flag payload. It is more work than a hosted builder and less than it sounds, and it is the arrangement teams usually land on after trying both extremes and disliking each.",
    },
    {
      question: "What does migrating between these two actually cost?",
      answer:
        "The send call is a small change. Everything around it is not. Templates have to be rebuilt in the other paradigm, which is a genuine rewrite rather than an export, and webhook consumers have to be rewritten against different event shapes. Export your suppression list and import it before the first send rather than after, or you will re-send to addresses that already bounced and damage a reputation you are still establishing. Then grep your infrastructure for the old API key rather than for the vendor name — the forgotten cron job on a box nobody logs into is what turns a one-week migration into a quarter of stragglers.",
    },
  ],
};

const RESEND_VS_SMTP2GO: VersusPage = {
  slug: "resend-vs-smtp2go",
  a: "resend",
  b: "smtp2go",
  title: "Resend vs SMTP2GO",
  description:
    "An API for code you are writing against a relay for systems you cannot change. The question is not which is more modern. It is whether the thing sending your mail is something you are allowed to rewrite.",
  search: {
    primaryQuery: "email api or smtp relay for an application i did not write",
    secondaryQueries: [
      "smtp relay for a legacy system with good reporting",
      "resend smtp support versus a dedicated relay",
      "sending email from an appliance or crm",
      "smtp2go reporting compared to an email api",
    ],
    rationale:
      "Comparisons in this category assume the reader controls the sending code, and a large share of the people searching do not — they are wiring up a NAS, an ERP, a WordPress install or a vendor appliance whose only email setting is a hostname, a port and a password.",
  },
  intro:
    "This pair gets miscast as old versus new. It is not. Resend is an HTTP API with SDKs, aimed at code you are actively writing, and a template story that assumes you have a React build. SMTP2GO is a relay built on the premise that a great deal of the world's business email is emitted by software nobody is permitted to modify, and that the vendor's job is to accept that traffic, deliver it, and tell you clearly what happened. Decide which of those describes your sender, and the rest follows without much argument.",
  dimensions: [
    {
      heading: "What is emitting the message",
      a: "Application code you own, calling an HTTP endpoint with a JSON body. Resend's SDKs, its error shapes and its documentation all assume an engineer is typing. There is an SMTP interface, and it is genuinely usable, but it is a compatibility path rather than the product's spine — the features that make Resend worth choosing live on the API side.",
      b: "Anything that speaks SMTP, which in practice means an enormous amount: backup appliances, monitoring agents, a fifteen-year-old ERP, a printer, a CMS whose mail plugin nobody dares upgrade. SMTP2GO's whole design assumes the sender cannot be rewritten, so the setup is a hostname, a port, a username and a password, and the product's intelligence is applied after the message arrives.",
    },
    {
      heading: "What the reporting is trying to tell you",
      a: "Per-message delivery state with a webhook stream behind it, oriented toward answering a question about a specific send from inside your own systems. The dashboard is clean and current. The history is finite: thirty days on every plan below Enterprise, after which the answer to what happened to that email is that nobody knows.",
      b: "Reporting is the reason people stay. Delivery and bounce breakdowns, spam-complaint tracking, blacklist monitoring on the addresses you send from, and a report that arrives in your inbox rather than waiting for you to open a dashboard. For a sender you cannot instrument — because you did not write it — vendor-side reporting is the only visibility that exists, which is why the relay invests there.",
    },
    {
      heading: "The throughput ceiling, and where each one puts it",
      a: "Two requests per second on the API, on every tier, permanently. For request-response mail that is more than enough and you will never think about it. For anything that bunches, you build a queue and drain it, and the work is neither hard nor optional.",
      b: "A relay is metered by volume rather than by request rate, and an SMTP connection can carry many messages sequentially without a per-call ceiling of that shape. The limit you meet instead is the plan's monthly allowance and, on the free and entry tiers, a daily cap that will stop a bulk run cold in the middle of a Tuesday afternoon.",
    },
    {
      heading: "Rendering the email at all",
      a: "React Email is the answer, and it is a good one: components in your repository, reviewed and versioned like the rest of your code, with a rendering step that produces HTML you can test. It presumes a JavaScript build, and a Python or Go shop gets a noticeably thinner version of the experience than the marketing implies.",
      b: "There is essentially no template layer, and that is coherent rather than missing. A relay receives a fully-formed message from a sender that already decided what it looks like — your ERP's invoice template, WordPress's password reset. Adding a rendering feature would serve nobody, because by the time SMTP2GO sees the mail, rendering already happened somewhere it does not control.",
    },
    {
      heading: "When the credential leaks",
      a: "An API key is revocable in one place, scoped, and visible in a list with a creation date next to it. Rotating it is a deploy. The exposure surface is your codebase and your secret store, which are things a security review knows how to reason about.",
      b: "SMTP credentials get typed into device configuration screens by people who then leave the company, and they end up in wiki pages, shell scripts and appliance backups. SMTP2GO's answer is per-sender users so you can issue one credential per system and revoke it without touching the others, which is the single most useful operational habit on the relay side and the one teams most often skip.",
    },
    {
      heading: "Dedicated addresses and the unlock point",
      a: "Resend sits on shared AWS reputation by default and dedicated sending is an upper-tier conversation rather than a self-serve toggle. For most senders on this platform shared is correct — the pool is enormous and well managed — but it does mean isolation is not a lever you can pull on a bad week.",
      b: "Dedicated IPs unlock at the Professional tier, alongside inbound parsing, which makes that tier a capability step rather than a volume step. Below it you are on a shared pool, and the blacklist monitoring in the reporting is partly there so you find out about a neighbour's problem the same day rather than from a customer.",
    },
    {
      heading: "Where the mail is processed",
      a: "On AWS, in the regions Resend operates, with the account boundary belonging to Resend. If your compliance answer needs to name a processor and a region, you are naming a company that is itself a customer of another company, and the questionnaire gets longer than it looks.",
      b: "SMTP2GO runs relay endpoints in multiple regions and will pin your account's processing to one, which is a shorter answer to a data-residency question than most vendors in this category can give. For an EU or APAC organisation whose lawyer asks where the message body physically goes, having a single supplier with a single answer is worth more than a feature comparison.",
    },
    {
      heading: "Receiving replies",
      a: "Inbound is the narrower half of Resend and arrived well after the outbound product. If reply handling is structural to what you are building rather than a convenience, verify the current capability against your requirement directly rather than assuming it matches the polish of the send path.",
      b: "Inbound parsing exists and unlocks with the Professional tier, forwarding structured messages to an endpoint you nominate. It is a sensible fit for the relay's audience — the appliance sends out, the replies come back somewhere a human or a ticket system can see them — and it is not a routing engine with conditional fan-out if that is what you need.",
    },
    {
      heading: "What neither of these is",
      a: "Not a marketing platform. Broadcasts exist and are deliberately minimal — an audience, an email, a send — which is right for a changelog and nowhere near a lifecycle tool. Anything involving behavioural segmentation or a branching journey is a second vendor.",
      b: "Not a developer platform. There is no idiomatic SDK, no React rendering, no lifecycle automation, and the API is a thin management surface rather than the primary way you are expected to send. Choosing it because it is cheap and then wanting the things an API product gives you is the most common way teams end up unhappy with it.",
    },
  ],
  pickA: [
    "You are writing the code that sends, and want SDKs, typed errors and templates that live in the repository.",
    "React Email is already how you want to author, and your stack has a JavaScript build to render it in.",
    "Sending is steady request-response traffic that never bunches above a couple of messages a second.",
    "You want the send path and the event stream to look like the rest of your application's infrastructure.",
  ],
  pickB: [
    "Something in your estate speaks SMTP and nothing else, and rewriting it is not on anybody's roadmap.",
    "You need vendor-side reporting good enough to debug from, because you cannot instrument the sender yourself.",
    "Several separate systems send mail and you want one revocable credential per system rather than one shared secret.",
    "A data-residency question needs a short answer naming one supplier and one region.",
  ],
  faqs: [
    {
      question: "Resend supports SMTP — why would I use a relay instead?",
      answer:
        "Because the SMTP interface and a relay product are different amounts of product. Resend's SMTP path exists so a legacy sender can be pointed at it, and it works. What it does not bring is the surrounding apparatus a relay-first vendor builds: per-sender credentials, blacklist monitoring on your sending addresses, long-lived aggregate reporting, and a support organisation whose customers are mostly people wiring up devices rather than writing integrations. If SMTP is the exception in your architecture, use Resend's. If it is the rule, buy the product built for it.",
    },
    {
      question: "Will a relay hurt my deliverability compared to an API?",
      answer:
        "The protocol has no bearing on it. What decides placement is authentication, reputation and content: SPF and DKIM aligned to the domain in the From header, a DMARC policy, a clean list, and sensible complaint handling. Both vendors sign and align correctly when configured, and both will suspend you for a bad list. The one protocol-adjacent risk is that a legacy sender is more likely to emit malformed or unauthenticated mail than code you just wrote, which is a problem with the sender rather than with SMTP.",
    },
    {
      question: "Can I use both at once?",
      answer:
        "Yes, and a fair number of organisations should. Point the application you are actively developing at the API, and point the appliances, the ERP and the wiki at the relay. Use different subdomains for the two so their reputations are independent, so a misbehaving legacy system cannot take down your password resets, and so the reporting for each is separable. The extra cost is one more vendor relationship and one more DNS record.",
    },
    {
      question:
        "What should I check before pointing a legacy system at either?",
      answer:
        "Three things, in order. Whether the system lets you set the envelope and header From independently, because misalignment there is the most common cause of DMARC failures on old software. Whether it supports STARTTLS on a port your network allows outbound, since a surprising number of corporate networks block the submission ports selectively. And whether it retries on a temporary failure or drops the message silently — if it drops, your vendor's reporting is the only place that failure will ever be visible, which is an argument for the vendor whose reporting is the product.",
    },
    {
      question: "How long does each keep a record of a sent message?",
      answer:
        "Resend purges at thirty days on every plan short of Enterprise. SMTP2GO keeps reporting history longer, with the window varying by plan, and its archive-style features are part of what its higher tiers sell. Neither gives you an archive you own. If you have a regulatory or contractual reason to prove what was sent to whom two years ago, the only answer that survives a vendor change is to write the events into your own storage as they happen, which costs very little to build and is impossible to build retroactively.",
    },
  ],
};

const MANDRILL_VS_RESEND: VersusPage = {
  slug: "mandrill-vs-resend",
  a: "mandrill",
  b: "resend",
  title: "Mailchimp Transactional (Mandrill) vs Resend",
  description:
    "Almost nobody picks between these from a blank page. You are on Mandrill, you are wondering whether to leave, and Resend is the name that keeps coming up. That is a migration question wearing a comparison's clothes.",
  search: {
    primaryQuery: "migrating transactional email from mandrill to a modern api",
    secondaryQueries: [
      "is mandrill worth keeping in 2026",
      "mandrill rejection list export before migrating",
      "replacing mailchimp transactional email",
      "mandrill merge tags versus react email",
    ],
    rationale:
      "The searcher here already has the integration in production and is estimating the cost of leaving, so the useful content is the export list and the failure modes of the cutover — which no vendor comparison written for greenfield buyers contains.",
  },
  intro:
    "This is not a purchase decision so much as an exit assessment. Mandrill arrived in your stack because somebody already paid for Mailchimp and noticed a transactional product attached, and it has probably worked without complaint for years. Resend is the name that surfaces when you start asking whether it should stay. The comparison worth having is therefore not feature against feature — it is what you currently depend on that would have to be rebuilt, and whether the thing you are unhappy about is actually fixed by moving.",
  dimensions: [
    {
      heading: "What has to exist in your account for it to work",
      a: "A paid Mailchimp plan, underneath, permanently. Mandrill is an add-on and cannot be bought alone, so the true cost of your transactional sending includes a marketing subscription that may be doing nothing else for you. If that subscription exists anyway because marketing runs campaigns in it, Mandrill is close to marginal cost. If transactional is the only reason it survives renewal, that line is part of the saving and part of the decision.",
      b: "An account and a verified domain, and nothing else. There is no prerequisite product, no bundled platform and no dependency on a purchasing decision made by a different department. Whether that matters depends entirely on whether you are the department that would have to justify the Mailchimp renewal.",
    },
    {
      heading: "How much the product is likely to change",
      a: "Slowly, and that cuts both ways. Mandrill is mature to the point of stasis: it works, it has worked for a long time, and visible investment has been modest for years. A sender that stopped changing is a sender that stopped breaking, which is a real virtue for something your receipts depend on. It is a poor bet if you are counting on the surrounding tooling to improve.",
      b: "Quickly, and that also cuts both ways. Resend ships frequently and the product surface today is meaningfully different from two years ago. You get improvements you did not ask for and occasionally changes you have to react to, and the flip side of a young platform moving fast is that its operational record is shorter than the thing you are considering leaving.",
    },
    {
      heading: "The templating you would have to rewrite",
      a: "Mailchimp's editor plus merge tags, a syntax inherited from a marketing product rather than designed for transactional mail. It is convenient if your marketing team already lives in that editor and slightly awkward if they do not, and in practice teams end up doing more of the conditional logic in application code than the feature list suggests.",
      b: "React Email components in your repository, rendered at send time. It is a genuinely better authoring model for an engineering team and it is a full rewrite rather than an export — there is no path that carries merge-tag templates across. Budget for rebuilding every template by hand, and treat that as the largest single line in the migration estimate.",
    },
    {
      heading: "Addresses your provider has quietly decided not to mail",
      a: "Mandrill keeps a rejection list of hard bounces, complaints and manual blocks, and it is stricter than people expect. An address can sit on it indefinitely, so a customer who fixed their mailbox six months ago still receives nothing, silently. Knowing the list exists and auditing it is part of operating Mandrill competently, and exporting it is the first thing you do if you leave.",
      b: "Suppression works on the same principle with better surfacing, and Resend's dashboard makes the list something you look at rather than something you remember exists. The rule on arrival is the same regardless of direction: import the old list before the first send, because mailing addresses that previously hard-bounced is the fastest available way to damage a reputation you have not built yet.",
    },
    {
      heading: "How much you can push, and how fast",
      a: "Capacity is bought in blocks covering a fixed number of messages, and the constraint you meet is the block rather than a request-rate ceiling. A batch job that emits a large burst is an ordinary thing to do here, and the arithmetic to work out your real per-message cost has to include the platform subscription underneath, which the pricing page will not do for you.",
      b: "Two requests per second, on every plan, with no upgrade that lifts it. This is the single most common way a Mandrill-to-Resend migration goes wrong: the existing integration was written without a rate ceiling in mind, the cutover happens, and the nightly digest job starts collecting rejections at two in the morning. Queue and drip before you switch, not after.",
    },
    {
      heading: "Inbound mail and reply handling",
      a: "Mandrill routes inbound mail to a webhook and has done so stably for a long time. If some part of your product parses replies — a support thread, a bounce handler you wrote yourself — that configuration is a dependency you may not have thought about recently, and it is one of the pieces most often forgotten in a migration plan.",
      b: "Inbound is the narrower part of Resend and came much later than the send path. Before you commit, check whether your specific reply-handling requirement is genuinely covered, because this is the axis on which the newer product is least likely to be at parity with the old one.",
    },
    {
      heading: "Who actually operates the sending",
      a: "Mailchimp's own infrastructure, inside a large company with its own abuse posture and its own IP pools. Your neighbours in that pool are Mailchimp's transactional customers. The account relationship is shared with the marketing side, which matters in the direction people do not expect: an account problem originating in campaigns is an account problem for your receipts.",
      b: "Amazon SES with Resend's engineering on top. The deliverability floor is AWS's and it is high. The account is Resend's, so reputation accrues to their identities rather than yours, and the dependency chain has one more link in it than the comparison suggests.",
    },
    {
      heading: "What you can look up afterwards",
      a: "Outbound activity with content and delivery state, searchable within a retention window, which is adequate and shows its age. A support person chasing one customer's missing receipt takes more steps than they should, but the information is there.",
      b: "A clean activity view and a webhook stream, with a hard thirty-day purge on every plan below Enterprise. Read that against whatever your current Mandrill window is before you move, because a migration that quietly shortens how far back your support team can look is a migration that generates complaints from a direction nobody predicted.",
    },
    {
      heading: "What the cutover actually looks like",
      a: "Leaving means exporting the rejection list, rebuilding every template, rewriting webhook consumers against different event shapes, and deciding what happens to the Mailchimp subscription. The part that bites is discovery: grep for the API key rather than the vendor name, because the integration nobody remembers was configured by hand on a server rather than committed to a repository.",
      b: "Arriving means verifying domains, importing suppression before the first production send, putting a rate limiter in front of anything that bursts, and pointing the webhook somewhere durable on day one rather than after the first thirty-day window closes. Move one traffic class at a time and keep the mail customers would notice missing on the proven path until last.",
    },
  ],
  pickA: [
    "Marketing already runs campaigns in Mailchimp, so the platform subscription exists regardless and transactional is marginal cost on it.",
    "The integration has run untouched for years, nothing is actually broken, and the migration has no funded owner.",
    "Your sending has burst shapes that a hard two-per-second ceiling would force you to re-engineer around.",
    "Inbound routing is load-bearing in your product and you would rather not re-verify that capability on a newer platform.",
  ],
  pickB: [
    "You want templates in version control as components, reviewed and deployed like the rest of the codebase.",
    "The Mailchimp subscription exists only to make transactional sending possible, and removing it is a real saving.",
    "You are building new and want SDKs, current documentation and a product that is visibly being invested in.",
    "Your traffic is steady request-response mail that will never approach the rate ceiling.",
  ],
  thirdOption:
    "Both sides of this comparison end with the same structural fact: the sending identity, the suppression list and the delivery history belong to the vendor, which is exactly why leaving Mandrill is a quarter of work rather than a config change. If the reason you are reading this is that you never want to do this migration again, the third shape is to send through SES inside your own AWS account, where the domain identities, the suppression list and the event stream are resources you own and a future vendor change is a library swap rather than a rebuild. Wraps is one way to run that with tooling on top. It is the wrong answer if you want the new integration finished this week: it needs an AWS account and SES production access, which is an approval on AWS's schedule and can be refused.",
  faqs: [
    {
      question: "Is Mandrill being discontinued?",
      answer:
        "There has been no announcement to that effect and it continues to operate, so describing it as discontinued would be wrong. What is fair is that visible investment has been modest for a long stretch, which is a legitimate input when you are deciding where to put something your product depends on. If it works today, that is not a reason to migrate this quarter. It is a reason not to build new dependencies on features you are hoping will improve.",
    },
    {
      question: "What do I have to export before I switch?",
      answer:
        "The rejection list first, because sending to previously bounced addresses on a brand-new sending identity is the fastest way to start badly. Then every template, since nothing carries across between these two paradigms. Then as much delivery history as your window still holds, because a dispute about a message sent last quarter will not wait for your migration to finish. Finally, write down every system that holds an API key — the cron job on the old box is the one that keeps sending from an account you thought you had closed.",
    },
    {
      question: "Will my deliverability improve if I move to Resend?",
      answer:
        "Possibly, and not because of the vendor. Most deliverability problems belong to the sender: a stale list, a missing DMARC policy, marketing and transactional sharing a domain, content that trips filters. Moving relocates those problems intact. What does change is your reputation history, which resets — you start as a new sender on a new pool, and the first two weeks of a migration are exactly when a bad list does the most damage. Warm up deliberately and move your highest-engagement traffic first.",
    },
    {
      question: "How do I handle the rate limit for a batch job?",
      answer:
        "Put a queue between your application and the API, and drain it at a rate safely under the ceiling with retry-with-backoff on rejections. For most teams this is a day of work using infrastructure they already run. The thing to avoid is a naive loop with a sleep in it, because it fails badly the moment two instances of the job run at once — the limit is per account, not per process, and nothing in your code will tell you that until the retries start.",
    },
    {
      question: "Can I run both during the migration?",
      answer:
        "Yes, and you should. Route by traffic class rather than by percentage: move the least critical mail first, watch bounce and complaint rates on the new identity for a couple of weeks, and keep password resets and receipts on the old path until the new one has a record. Use a distinct subdomain for the new sender so its reputation is genuinely separate, and keep both webhook consumers running until you have confirmed no straggler is still calling the old key.",
    },
  ],
};

const MAILERSEND_VS_POSTMARK: VersusPage = {
  slug: "mailersend-vs-postmark",
  a: "mailersend",
  b: "postmark",
  title: "MailerSend vs Postmark",
  description:
    "One built a template a marketer can open. The other built a mail operation and refuses to become anything else. Both are good at what they chose, and the choice is not close once you know which you need.",
  search: {
    primaryQuery: "mailersend or postmark for product email",
    secondaryQueries: [
      "email api with a builder and good deliverability",
      "postmark message streams versus a single domain",
      "do i need message streams for transactional email",
      "email vendor a non engineer can use safely",
    ],
    rationale:
      "These two are cross-shopped by teams who want one vendor for product email and the occasional announcement, and the decisive difference is architectural rather than cosmetic — whether bulk and transactional reputation are separated by the product or by everyone remembering to be careful.",
  },
  intro:
    "Both of these are mid-market transactional email vendors with clean products and reasonable prices, which is why they end up on the same list. What they optimised is almost opposite. MailerSend spent its effort on the surface a non-engineer touches, so the builder is real and the account is comfortable to hand to a marketer. Postmark spent a decade on the parts nobody sees, and the clearest expression of that is message streams, which separate bulk from transactional reputation as a product concept rather than as a policy your team has to remember.",
  dimensions: [
    {
      heading: "Whether bulk and transactional share a reputation",
      a: "They share one. MailerSend gives you verified domains on a flat account, and keeping a newsletter away from your password resets is something you arrange yourself — typically by sending campaigns from a separate subdomain and being disciplined about it. That works, and it depends on every future engineer knowing why the rule exists.",
      b: "They do not. Message streams are a first-class concept: transactional and broadcast traffic run on separate streams with separate reputations, enforced by the system. A campaign to a stale list cannot quietly degrade the delivery of a login code, because the product will not let the two share. This is the single design decision that best explains Postmark's placement record.",
    },
    {
      heading: "Who is expected to open the editor",
      a: "A marketer, comfortably and by design. The drag-and-drop builder is the centre of the product, not a checkbox on the feature list, and the variables are wired once by an engineer and left alone afterwards. For a team where one person writes code and another writes copy, that removes a standing source of friction and a standing source of small deploys.",
      b: "An engineer, mostly. Postmark ships layouts, templates with versioning inside the product and a preview before you send, all aimed at people comfortable with a templating syntax. A non-engineer can safely change copy in it and nobody would mistake it for a design tool. The boundary is deliberate rather than an omission, and it is a real cost if your marketer expected otherwise.",
    },
    {
      heading: "Chasing one message a customer says never arrived",
      a: "Activity is searchable, current and pleasant to use, with retention lengthening as you move up the plans. It answers the question, and the workflow assumes you know roughly what you are looking for. For a support team handling a handful of these a week it is entirely adequate.",
      b: "This is the feature Postmark customers name second, after deliverability. The rendered message, the full delivery path and the raw bounce text from the receiving server sit in one place, searchable without exporting anything first. The difference is between a log viewer and a support tool, and it shows up as minutes rather than hours the first time a large customer escalates.",
    },
    {
      heading: "Receiving mail as well as sending it",
      a: "Inbound routing is part of the product and forwards parsed messages to your webhook, which is enough to build reply-to-ticket handling on. It is configured alongside everything else and does not require a plan step, which makes it a reasonable default choice for a team that wants both directions from one vendor.",
      b: "Postmark parses inbound mail into structured JSON and posts it to your endpoint, and the parsing is where the value is: multipart bodies, attachments and quoted reply history arrive already separated, so your handler is application logic rather than a MIME project. Neither is a routing engine with conditional fan-out if that is what you actually need.",
    },
    {
      heading: "Isolating your sending from everyone else's",
      a: "Dedicated addresses are available, and for most customers at this size the shared pool is the right answer anyway — it is well managed and the volumes involved are too low for isolation to help. The thing to understand is that if you do develop a reputation problem, your options for buying your way out of it are limited.",
      b: "Dedicated IPs are gated behind the higher plans and carry a monthly volume minimum, which is the more honest arrangement — an IP sending too little mail warms badly and delivers worse than a shared pool. The consequence is the same in practice: a small team with a placement problem has nothing here to purchase as a remedy, and needs to fix the cause instead.",
    },
    {
      heading: "Campaigns and the occasional announcement",
      a: "There is real campaign capability alongside the API: lists, scheduling, the same builder, on one subscription. It is not a lifecycle platform and does not pretend to be, and for a team that sends a product update every few weeks it is precisely enough. This is the strongest argument for MailerSend and the clearest gap in the alternative.",
      b: "Broadcast message streams will send a newsletter to a list and stop well short of a campaign builder, segmentation or automation. Postmark's position is that you should bring a separate marketing tool and keep the transactional stream clean, which is coherent and correct on its own terms, and it does mean two vendors and two invoices.",
    },
    {
      heading: "Channels beyond email",
      a: "SMS is available on the same account, which is the answer to the day somebody decides verification codes should also go by text. The depth is modest against a dedicated messaging provider, and a one-time code does not need depth.",
      b: "Email only, permanently, and stated as a strategy rather than a gap. Postmark's argument is that being narrow is why the deliverability is good. It is a defensible argument and it means a second vendor the moment your requirements widen past the inbox.",
    },
    {
      heading: "What each vendor does when something goes wrong",
      a: "Support is responsive for a company of this size, with the usual caveat that the lowest tier waits longest. Notably, there is no widespread pattern of complaint about arbitrary account action, which counts for something in a category where sudden suspension is the dominant fear.",
      b: "The support relationship is the quiet reason long-tenured Postmark customers stay. What people report when things go wrong is a policy conversation about content, opened by a human who explains what the problem is, rather than an unexplained stop discovered from a drop in signups. That is not a feature you can see on a pricing page and it is what you are paying the premium for.",
    },
    {
      heading: "What the step up the ladder buys",
      a: "Seats, retention and support rather than sending headroom, which reads oddly until you understand it as a price per organisation rather than per message. A solo developer belongs on the entry plan and should ignore the rest; a team with a marketer, a support rota and a compliance requirement is who the upper plan was drawn for.",
      b: "Capability rather than allowance. Moving up buys dedicated addresses, longer retention and a higher grade of support, while the included volume stays the same. The curve is easy to forecast and it is the steeper of the two once you pass a few hundred thousand messages a month, which is worth modelling honestly if your sending is growing quickly.",
    },
  ],
  pickA: [
    "A non-engineer needs to change email copy without a deploy, and the builder being genuinely good is a requirement rather than a bonus.",
    "You want product email and the occasional campaign on one subscription instead of two vendors.",
    "SMS is on the roadmap and you would rather not add a second messaging relationship for it.",
    "Your team is small enough that a flat account with a few verified domains is an accurate model of how you send.",
  ],
  pickB: [
    "Inbox placement is the reason you are shopping rather than a tiebreaker at the end of the evaluation.",
    "You send both transactional and bulk mail and want the separation enforced by the product rather than remembered by people.",
    "Support answers questions about individual messages often enough that seeing the rendered email beats filtering an event log.",
    "Reply handling matters and you want the inbound payload already parsed into structured fields rather than raw MIME.",
  ],
  faqs: [
    {
      question: "Do I actually need message streams?",
      answer:
        "You need the separation; whether you need it as a product feature depends on your team. If you send only transactional mail, one stream is fine and the concept is irrelevant. If you also send announcements or a newsletter, you need bulk and transactional reputations kept apart, and your choices are a vendor that enforces it or a convention your team maintains forever. Conventions survive exactly as long as the people who understood them, which is the argument for the enforced version.",
    },
    {
      question: "Can a marketer safely edit templates without breaking sends?",
      answer:
        "Largely yes, and the failure modes are worth designing around rather than hoping about. Copy edits are safe. What breaks is someone deleting a variable placeholder, removing an unsubscribe link, or pasting styling that renders badly in Outlook. Mark the variables clearly, keep a known-good version to roll back to, and make a test send to a real inbox part of the routine. That discipline matters more than which editor you standardised on.",
    },
    {
      question: "Which one has better deliverability?",
      answer:
        "Postmark, by reputation and by the length of its record, and the message-stream separation is a genuine mechanism rather than marketing. That said, most teams' placement problems are self-inflicted — unauthenticated domains, no DMARC policy, purchased lists, campaigns sent from the domain the product depends on — and neither vendor repairs any of those. Both will also suspend you for them, so the vendor choice is the smaller half of the outcome.",
    },
    {
      question: "Is it a problem to run marketing email somewhere else?",
      answer:
        "No, it is the arrangement most teams end up with once they have some scale, and it has a real benefit: a marketing platform's reputation problem is contained to the marketing subdomain. The cost is two vendors, two suppression lists and the ongoing chore of keeping unsubscribes synchronised between them. Decide deliberately which system owns consent, write it down, and make the other one read from it rather than maintaining its own view.",
    },
    {
      question: "How much work is switching between these two?",
      answer:
        "The API call is trivial, and everything around it is the project. Templates are a full rebuild because the paradigms differ — there is no export that carries a drag-and-drop layout into a templating syntax or the reverse. Webhook consumers have to be rewritten against different event shapes. Suppression must be exported and imported before your first production send, not after. And if you are moving to streams, spend an hour modelling which traffic belongs in which one, because reorganising that after reputation has accumulated is considerably more annoying than getting it right at the start.",
    },
  ],
};

const POSTMARK_VS_SMTP2GO: VersusPage = {
  slug: "postmark-vs-smtp2go",
  a: "postmark",
  b: "smtp2go",
  title: "Postmark vs SMTP2GO",
  description:
    "Both are famous for telling you what happened to your mail, and they mean different things by it. One gives you forensics on a single message. The other gives you a standing health report on a sender you cannot instrument.",
  search: {
    primaryQuery: "best email provider for diagnosing delivery problems",
    secondaryQueries: [
      "postmark activity view versus smtp2go reporting",
      "smtp relay with blacklist monitoring",
      "which email vendor shows the raw bounce reason",
      "email provider for a support team to debug from",
    ],
    rationale:
      "Reporting is the one attribute both of these vendors are chosen for, so a page that separates per-message forensics from sender-health monitoring answers a comparison neither vendor will make, because each would rather claim the whole word.",
  },
  intro:
    "Ask users of either of these why they stay and you get the same word: visibility. That agreement hides a real split. Postmark's visibility is vertical — everything about one message, including the raw text the receiving server sent back. SMTP2GO's is horizontal — how your sending as a whole is trending, whether your addresses are on a blocklist this week, what proportion of a domain's mail is landing. Which one you need is decided almost entirely by whether you wrote the software that sends.",
  dimensions: [
    {
      heading: "How a message gets handed over",
      a: "An HTTP API is the intended path, with SMTP available and perfectly functional. The product's features — streams, templates, structured inbound — are expressed through the API, and a sender that only speaks SMTP can use Postmark but will touch a smaller share of what it is paying for.",
      b: "SMTP is the product rather than a compatibility layer. The onboarding assumes you are configuring something rather than coding something: a hostname, a port, a credential, and a device or application on the other end that was shipped years ago with an email settings page. There is an API for management, and it is not where the value is.",
    },
    {
      heading: "Two different meanings of good reporting",
      a: "Per-message forensics. Open one send and you see the rendered email, the full delivery path, the timing, and the verbatim rejection text from the receiving server. For a support person asked whether a specific customer got a specific receipt, this is the difference between a two-minute answer and an afternoon.",
      b: "Sender health over time. Delivery and bounce rates broken down by sending address and by receiving domain, complaint tracking, blocklist monitoring on the addresses you send from, and a scheduled report that arrives whether or not anybody opens the dashboard. When the sender is an appliance you cannot add logging to, the vendor's aggregate view is your only telemetry.",
    },
    {
      heading: "Keeping one kind of mail from poisoning another",
      a: "Message streams split transactional and broadcast traffic into separate reputations enforced by the product, so a newsletter to a stale list cannot degrade the delivery of a password reset. It is the design decision most responsible for Postmark's placement record, and it requires you to think about which stream each traffic type belongs in before you start.",
      b: "A relay account is one reputation by default, and separation is something you construct: distinct sending subdomains, distinct SMTP users per system, and the discipline to keep them apart. The per-user credential model helps more than it looks like it does, because it lets you see and stop one badly-behaved system without touching the others.",
    },
    {
      heading: "What is available to render an email",
      a: "A template system with layouts, in-product versioning and a preview before you send, aimed squarely at engineers and testable. A non-engineer can change copy in it. It is not a design tool and was never trying to be, and it means the rendered HTML is the vendor's concern rather than your application's.",
      b: "Nothing, correctly. The relay receives a finished message from a sender that already decided how it looks — your ERP's invoice layout, WordPress's reset email — so a template feature would have nobody to serve. If you need rendering, it happens in your application or in a library before the message reaches the relay at all.",
    },
    {
      heading: "Inbound mail, and what arrives at your endpoint",
      a: "Postmark parses incoming mail into structured JSON: headers, text and HTML parts, attachments and stripped reply text arrive already separated, so building reply-to-ticket handling is application logic rather than a MIME parsing exercise. This is one of the strongest single features in the pair.",
      b: "Inbound parsing exists and unlocks at the Professional tier alongside dedicated IPs, forwarding messages to an endpoint you nominate. It suits the relay's audience — the appliance sends, the human replies, something has to catch it — and it is a plan step rather than a default, which is worth knowing before you design around it.",
    },
    {
      heading: "Isolation, and when you are allowed to buy it",
      a: "Dedicated IPs sit behind the higher plans and carry a monthly volume floor, which is the honest arrangement rather than an upsell: an IP that sends too little warms badly and performs worse than a well-run shared pool. The consequence is that a small sender with a reputation problem has to fix the cause, because there is nothing here to buy instead.",
      b: "Dedicated IPs unlock at the Professional tier, and the blocklist monitoring that comes with the reporting exists partly because shared-pool customers need to learn about a neighbour's problem from their vendor rather than from an angry customer. For a mid-size sender that combination — shared pool plus active monitoring — is often the right economics.",
    },
    {
      heading: "Where the mail is handled, and what you can tell a regulator",
      a: "Postmark operates its own sending infrastructure with its own footprint, and the answer to a residency question is whatever answer that vendor gives, documented in its subprocessor list and its data processing agreement. That is straightforward to read and not configurable by you: there is no region selector, so if the requirement is that message bodies never traverse a particular jurisdiction, you are checking whether the published answer already satisfies it rather than arranging for it.",
      b: "SMTP2GO runs relay endpoints in several regions and will pin an account's processing to one of them, which is a shorter and more satisfying answer than most of this category can give when a lawyer asks where a message body physically goes. For an organisation with a residency requirement and a fleet of devices to point somewhere, that single fact frequently decides the evaluation.",
    },
    {
      heading: "Who each vendor's support is used to talking to",
      a: "Long-tenured Postmark customers name the support relationship as the quiet reason they stay. When something does go wrong it tends to arrive as a policy conversation about content, opened by a human who explains the problem, rather than an unexplained stop discovered from a graph.",
      b: "The support queue here is full of people configuring hardware, network appliances and CMS plugins, which is a different competence and a valuable one. Asking why your firewall is refusing the connection, or which port a particular NAS expects, gets a useful answer rather than a link to an SDK.",
    },
    {
      heading: "Where each one runs out of road",
      a: "Postmark stops deliberately short of marketing. Broadcast streams will send a newsletter and there is no campaign builder, no segmentation and no automation, on the stated view that staying narrow is why the deliverability is good. Widening your requirements past the inbox means a second vendor.",
      b: "SMTP2GO stops short of being a developer platform. There is no idiomatic SDK, no rendering, no lifecycle tooling, and the API is management rather than the primary send path. Teams who pick it for the price and then want what an API product gives them are the ones who end up unhappy.",
    },
  ],
  pickA: [
    "You are writing the sending code and want streams, templates and parsed inbound expressed through an API.",
    "Support answers questions about individual messages weekly, and the raw bounce text is what ends the conversation.",
    "You send both transactional and bulk mail and want their reputations separated by the product rather than by convention.",
    "Inbox placement for product-critical mail is the reason for the purchase rather than a tiebreaker.",
  ],
  pickB: [
    "The senders are appliances, a CMS or an ERP, and SMTP is the only interface any of them has.",
    "You need standing sender-health reporting and blocklist monitoring because you cannot add instrumentation to the sender.",
    "Many separate systems send mail and you want one revocable credential per system.",
    "A residency requirement needs a single supplier able to pin processing to a named region.",
  ],
  thirdOption:
    "The shared limitation here is that both answers to what happened to that email live inside a vendor's window and disappear when it closes or when you leave. If the reason you are comparing reporting at all is that you need to prove, next year, what was sent and what came back, the third shape is to run SES in your own AWS account and write the delivery events into your own storage, where the retention policy is yours and the history survives a vendor change. Wraps is one way to operate that with tooling over the top. It is a poor fit if the sender is a device on a shelf and you wanted a hostname to type in this afternoon: it needs an AWS account and SES production access, an approval on AWS's schedule that can be refused.",
  faqs: [
    {
      question: "Can Postmark handle mail from a legacy system over SMTP?",
      answer:
        "Yes, and it does it well. The question is not capability, it is what share of the product you end up using. Streams, templates and structured inbound are the reasons to pay Postmark's rate, and a device that only knows how to open an SMTP session touches almost none of them. If the legacy sender is one of several traffic sources and the rest is code you write, Postmark is fine for both. If the legacy sender is the entire estate, you are paying a specialist premium for a relay.",
    },
    {
      question:
        "Which one tells me sooner that I have a deliverability problem?",
      answer:
        "SMTP2GO, usually, because its reporting is designed to surface trends without anybody looking — scheduled reports and blocklist monitoring push the signal to you. Postmark's data is richer per message but more pull-shaped: you find the problem by noticing something and then investigating it. The honest arrangement, whichever vendor you pick, is to alert on your own bounce and complaint rates from the webhook stream rather than relying on a dashboard somebody remembers to open.",
    },
    {
      question: "Do I need dedicated IPs?",
      answer:
        "Probably not, and the threshold is higher than most people assume. A dedicated IP needs consistent volume to hold a warm reputation; below that it performs worse than a well-managed shared pool because receiving servers have too little signal about it. Both vendors gate them behind higher tiers partly for that reason. If you are considering one to escape a placement problem, first check whether the actual cause is authentication, list hygiene or bulk mail on a transactional domain, because an IP change will not fix any of those.",
    },
    {
      question: "How do I keep replies working if I switch relays?",
      answer:
        "Inventory the inbound path before you touch the outbound one. Find every MX record, every forwarding rule and every webhook endpoint that currently receives parsed mail, and note which plan tier each vendor requires for inbound at all. Then cut over inbound and outbound separately, with a period where both are live, because a reply that lands nowhere is invisible — nothing errors, nothing retries, the customer simply thinks you ignored them.",
    },
    {
      question: "What does it cost to run both?",
      answer:
        "One extra vendor relationship and one extra subdomain, and for a fair number of organisations it is the right architecture. Put the code you actively develop on the API product and the fleet of unmodifiable systems on the relay, each on its own sending subdomain so their reputations are independent. The genuine ongoing costs are two suppression lists to reconcile and two dashboards to check, so decide up front which system owns the authoritative view of a bad address.",
    },
  ],
};

const MAILERSEND_VS_MAILGUN: VersusPage = {
  slug: "mailersend-vs-mailgun",
  a: "mailersend",
  b: "mailgun",
  title: "MailerSend vs Mailgun",
  description:
    "A focused product with a builder at its centre against a high-volume platform whose centre is a routing engine. Both send email competently. Only one of them is trying to be infrastructure.",
  search: {
    primaryQuery: "mailersend or mailgun for a growing product",
    secondaryQueries: [
      "email api with conditional inbound routing rules",
      "mailgun subaccounts versus a flat domain list",
      "email validation built into the sending provider",
      "mailgun flex plan closed to new signups",
    ],
    rationale:
      "Mailgun's December 2025 repricing pushed a cohort of small senders into evaluating alternatives for the first time in years, and the comparisons they find are written as if Mailgun were still primarily a cheap developer API rather than a volume platform with a routing engine attached.",
  },
  intro:
    "These two are both called email APIs and the label does more harm than good. MailerSend is a product: a builder, a clean dashboard, an API around the outside, sized for a team that wants email handled. Mailgun is closer to infrastructure: routing rules with filter expressions, address validation as its own product, subaccounts for tenant isolation, and log retention you buy by the tier. You are usually choosing between wanting less to think about and wanting more control over how mail moves through your system.",
  dimensions: [
    {
      heading: "What happens to mail arriving at your domain",
      a: "Inbound routes deliver parsed messages to a webhook, which covers the common case — replies to a support address land in your application — without a plan step or much configuration. It is a forwarding feature done well, and it stops where forwarding stops.",
      b: "Routes are a rule engine. You write match expressions against recipient, sender and headers, attach actions, and order the rules by priority, so a single inbound domain can fan out to several destinations under different conditions. If you are building something that receives mail as a real part of the product rather than as a reply path, this is the largest single gap between these two.",
    },
    {
      heading: "Checking an address before you send to it",
      a: "Verification tooling is available for screening a list before an import, which is the direct answer to the most common cause of a bounce-rate incident. Screening inside the same vendor that will judge you for the bounces removes a category of self-inflicted damage, and the depth is appropriate to the size of sender this product is for.",
      b: "Validation is a product in its own right at Mailgun, with its own API, backed by the observation data of a very large sending operation and usable independently of whether you send through them. For a team that acquires addresses through forms at any real rate, the ability to reject a typo at signup rather than discover it as a hard bounce a week later is a meaningful, measurable improvement.",
    },
    {
      heading: "Sending on behalf of other people",
      a: "The model is flat: several verified domains on one account, sharing one reputation and one suppression list. For a single company with a handful of domains that is a correct and simple model. For an agency or a platform sending for many customers, the absence of real separation becomes a problem the first time one of those customers imports a purchased list.",
      b: "Subaccounts give each tenant its own sending identity, its own suppression and its own reporting under one parent relationship, so one tenant's bad list is contained. If you are a platform rather than a company, this feature frequently decides the evaluation before anything else is compared, and it is genuinely hard to replicate by convention.",
    },
    {
      heading: "Who is expected to write the email",
      a: "A marketer, in a drag-and-drop builder that is the centre of the product rather than a feature on the list. Variables get wired once by an engineer, copy changes afterwards without a deploy, and for a small team that removes a recurring interruption. The trade is that templates become state in a vendor's system, outside version control and without a diff.",
      b: "An engineer, in a handlebars-style templating syntax stored with the vendor and versioned there. It is competent and it is not a design surface, so the marketer who wants to reword a subject line is filing a ticket or learning the syntax. That is a reasonable answer for an infrastructure product and a poor one if template editing is the friction you were trying to remove.",
    },
    {
      heading: "How long the logs live",
      a: "Retention lengthens as you move up the plans, which makes history a purchasable quantity rather than a fixed wall. The practical upshot for a small team is that the upper tier is often being bought for retention and seats rather than for sending volume, and it is worth being honest with yourself about which one you need.",
      b: "Retention is explicitly a tier attribute at Mailgun and the entry plans are short. This is the detail most likely to bite after a migration: your support team's ability to answer a question about last quarter changes silently with the plan, and nobody notices until somebody asks. Check the number on the plan you are actually buying rather than the one in the comparison table.",
    },
    {
      heading: "The December 2025 repricing and who it moved",
      a: "MailerSend's structure has been stable: an entry plan, a higher plan that sells seats and retention rather than volume, and overage published per thousand. Nothing about it recently forced a cohort of customers to re-evaluate, which is worth something on its own when you are choosing where to put a five-year dependency.",
      b: "Flex closed to new signups in December 2025 and the legacy rate for existing users doubled, which is the event that put a large number of small Mailgun accounts into the market for the first time in years. Read any Mailgun comparison written before that date as describing different economics, and price the plan you can actually sign up for today.",
    },
    {
      heading: "European handling",
      a: "MailerSend is a European company, and for organisations whose requirement is really about who they are contracting with and under which regime, that is a simpler story than a region toggle inside a US platform. It is not a substitute for reading the data processing agreement, and it does shorten the conversation.",
      b: "Mailgun operates an EU region you select at domain creation, and the selection is not reversible afterwards — a domain created in the wrong region has to be recreated. The capability is real and the footgun is real, and it is exactly the kind of detail that surfaces during a compliance review six months after somebody set the account up quickly.",
    },
    {
      heading: "Dedicated addresses and the arithmetic around them",
      a: "Dedicated sending is available and, at the volumes this product is usually bought at, shared is the better answer anyway — an IP without consistent volume behind it warms badly. The thing to understand is that isolation is not a lever you can pull on a bad week if your volume does not support it.",
      b: "Dedicated IPs are included from the mid plans and additional ones are a published monthly line, which makes Mailgun one of the more straightforward vendors to price a multi-IP setup with. That matters if you genuinely send enough to warm several addresses and want to separate traffic classes across them rather than across subdomains.",
    },
    {
      heading: "Who owns the company, and what that implies",
      a: "MailerSend sits alongside MailerLite under one owner, which means the sending operation, the abuse posture and the roadmap all belong to a company whose entire business is email for small and mid-size senders. The pool you share is populated by that company's customers.",
      b: "Mailgun is part of Sinch, a large communications group, and it has been through several ownership changes. The upside is the scale of the operation behind it and a genuinely deep feature surface. The downside is what a large group does to a product: pricing changes decided elsewhere, and suspensions that recur in public reviews with the impersonality large platforms are known for.",
    },
  ],
  pickA: [
    "A non-engineer needs to edit email copy without a deploy, and the builder being good is the requirement.",
    "You are one company with a few domains, so tenant-level reputation isolation is something you do not need and should not pay for.",
    "You want product email and the occasional campaign on one subscription rather than assembling them.",
    "A simpler European contracting story is worth more to you than a region toggle you have to configure correctly.",
  ],
  pickB: [
    "Inbound mail is part of the product and you need conditional routing rather than a single forwarding destination.",
    "You send on behalf of customers and need per-tenant credentials, suppression and reporting.",
    "Address validation at the point of signup would measurably reduce your bounce rate, and you want it from the same vendor.",
    "You send enough to justify multiple dedicated addresses and want the per-IP price published rather than negotiated.",
  ],
  thirdOption:
    "Both of these price the things around sending — retention, validation, tenant isolation, dedicated addresses — as plan steps, which is why the bill on either side climbs faster than the message count does. If what you actually want is the routing and the history under your own control rather than rented by the tier, the third shape is to run SES in your own AWS account, where event streams land in your storage on your retention policy and tenant separation is a configuration set you define rather than a product feature you unlock. Wraps is one way to operate that with a platform layer on top. It is the wrong answer if you want validation and a rule engine out of the box this week: it needs an AWS account and SES production access, an application AWS can refuse.",
  faqs: [
    {
      question: "What replaced Mailgun's Flex plan?",
      answer:
        "Flex closed to new signups in December 2025, and accounts that remained on the legacy arrangement saw the per-thousand rate double. New customers choose from the named plans instead. The practical consequence for anyone reading older comparisons is that the cheap pay-as-you-go entry point people remember is not available to sign up for, so any recommendation resting on it is describing a product that no longer exists at that price.",
    },
    {
      question: "Do I need subaccounts or will separate domains do?",
      answer:
        "Separate domains give you separate reputations and nothing else. Subaccounts give you separate credentials, separate suppression lists and separate reporting, which is what you actually need when a tenant can do something bad. The test is simple: if one customer imports a purchased list, does that harm any other customer's mail and can you see which customer did it? If the answer is yes and no, domains are not enough.",
    },
    {
      question: "Is address validation worth paying for?",
      answer:
        "It depends entirely on how addresses enter your system. If they come from a form that a human types into, validation catches typos and disposable domains before they become hard bounces, and hard bounce rate is the number most likely to get your sending restricted. If your addresses come from authenticated accounts that already confirmed by email, you have validated them the only way that truly works and a validation service adds little. Nothing verifies that a valid mailbox belongs to somebody who wants your mail, which is what complaint rate actually measures.",
    },
    {
      question: "Can I move an existing domain between regions?",
      answer:
        "Not on Mailgun — the region is fixed when the domain is created, and changing it means creating a new domain in the correct region and migrating to it, including re-publishing DNS records and re-warming reputation. Treat the region choice as a decision to make with whoever owns your compliance answer, before the first send, rather than something to tidy up later. It is a small step taken at the right time and a genuinely annoying project taken at the wrong one.",
    },
    {
      question: "How do I estimate the real cost of moving between these two?",
      answer:
        "Count four things, not one. Rebuilding templates, which cross no paradigm boundary and have to be redone by hand. Rewriting webhook consumers against different event payloads. Rebuilding inbound routing, which is the piece most likely to be underestimated if you are moving away from a rule engine toward simple forwarding. And exporting and importing suppression before the first production send, never after. Then check the log retention on the plan you are landing on, because a shorter window is a support regression your team will discover the hard way.",
    },
  ],
};

const MAILGUN_VS_SMTP2GO: VersusPage = {
  slug: "mailgun-vs-smtp2go",
  a: "mailgun",
  b: "smtp2go",
  title: "Mailgun vs SMTP2GO",
  description:
    "Two vendors that both accept SMTP all day and are built for opposite customers. One wants to be the routing layer in your architecture. The other wants to be the thing your appliances point at and nobody thinks about again.",
  search: {
    primaryQuery: "reliable smtp relay for business systems",
    secondaryQueries: [
      "mailgun alternative after the flex plan closed",
      "smtp relay with dedicated ip and reporting",
      "sending mail from devices and internal applications",
      "mailgun routes versus a simple relay",
    ],
    rationale:
      "Mailgun's entry-level repricing in December 2025 sent a specific cohort looking: small businesses relaying modest volumes from software they did not write, for whom Mailgun's routing and validation surface was never the point and is now being paid for.",
  },
  intro:
    "The overlap here is real — both take SMTP, both deliver at volume, both have a dedicated IP story — and it hides two quite different products. Mailgun is a platform with a rule engine, a validation service and tenant isolation, sold to people who are building something that moves mail around. SMTP2GO is a relay sold to people who have systems that emit mail and want them to arrive, with reporting good enough to debug from when they do not. The December 2025 repricing made this comparison urgent for a cohort who had never needed to make it.",
  dimensions: [
    {
      heading: "What the vendor thinks you are building",
      a: "An application. Mailgun's surface assumes you will write code against it: routing rules with match expressions, a validation API, tagging so you can slice a cohort of messages later, subaccounts because you might be a platform with tenants. All of that is real capability and all of it presumes somebody is engineering the mail flow.",
      b: "Nothing. SMTP2GO assumes the mail is already being produced by software that exists and cannot be changed, and that your job is configuration rather than development. The product's intelligence is therefore applied after the message arrives — routing it well, reporting on it clearly, and warning you when a sending address gets blocklisted.",
    },
    {
      heading: "Two takes on what reporting is for",
      a: "Searching and slicing. Tags and custom variables let you attach your own dimensions to sends and then filter events by them, which is how you answer a question like how did the onboarding sequence perform this month. It is powerful, it assumes you set the tags at send time, and it is useless for traffic from a system that cannot set anything.",
      b: "Standing sender health. Delivery and bounce rates per sending address and per receiving domain, complaint tracking, blocklist monitoring, and reports that arrive on a schedule rather than waiting to be opened. For traffic you cannot instrument, vendor-side aggregate reporting is the only telemetry that exists.",
    },
    {
      heading: "Credentials and the systems that hold them",
      a: "API keys and SMTP credentials scoped per domain, with subaccounts available if you need harder separation. The model is coherent for an engineering team with a secret store, and it was designed with code in mind rather than with a wiki page full of device configurations.",
      b: "Per-sender SMTP users are the core operational idea: one credential per system, revocable independently, with its own reporting slice. That is precisely the right shape when credentials get typed into an appliance's settings page by somebody who later leaves, and it is the habit that makes an estate of twenty senders manageable rather than terrifying.",
    },
    {
      heading: "Entry-level pricing after December 2025",
      a: "Flex closed to new signups and the legacy rate doubled, which pushed a cohort of small senders into the market. What is available now is the named plan ladder, and the entry rung is priced for a business rather than for a side project. If your volume is modest and you are not using routes, validation or subaccounts, you are paying for a platform you do not touch.",
      b: "A free tier with a daily cap, an inexpensive entry plan, and a Professional tier where dedicated IPs and inbound parsing unlock together. The ladder is shaped around what a relay customer actually needs next, which is usually isolation or inbound rather than raw volume, and the overage rates are published rather than negotiated.",
    },
    {
      heading: "When a message does not send",
      a: "Mailgun surfaces the failure in its event stream with a reason, and suspensions recur often enough in public reviews to be a planning input rather than a rumour. Large platforms are conservative about shared reputation and act first when a pattern looks unusual. If your traffic is spiky, budget for the possibility and keep a fallback path configured.",
      b: "The failure shows up in the reporting, and the support conversation on the other end is with people who spend their days helping customers configure devices and networks. That is a different competence from an API support queue, and it is the more useful one when the real problem turns out to be a firewall rule, a TLS negotiation or an appliance that quietly drops messages instead of retrying.",
    },
    {
      heading: "Dedicated addresses and warming",
      a: "Dedicated IPs are included from the mid plans with additional ones at a published monthly rate, which makes a multi-IP setup straightforward to price. If you send enough to warm several addresses and want traffic classes separated across them, this is the more capable of the two on that axis.",
      b: "Dedicated IPs unlock at the Professional tier, bundled with inbound parsing, so that tier is a capability step rather than a volume step. Below it you are on a shared pool with blocklist monitoring watching over it, which for a mid-size sender is frequently the better economics than an IP with too little volume behind it to stay warm.",
    },
    {
      heading: "Receiving mail, and how conditional it can be",
      a: "Routes are a genuine rule engine: match expressions on recipient, sender and headers, ordered by priority, with actions attached. A single inbound domain can fan out to different destinations under different conditions. If inbound is a real part of what you are building, nothing in the relay category comes close.",
      b: "Inbound parsing forwards messages to an endpoint you nominate, from the Professional tier. It is the right amount of product for the audience — the device sends, a human replies, something catches it — and it is not conditional fan-out. Know which of those two you need before you choose, because retrofitting the difference is not a config change.",
    },
    {
      heading: "Where the mail is processed",
      a: "Mailgun offers a US or EU region selected when a domain is created, and that selection cannot be changed afterwards. The capability is genuine and the footgun is genuine: a domain created hastily in the wrong region has to be recreated and re-warmed, and that usually surfaces during a compliance review long after the fact.",
      b: "Relay endpoints in several regions with account processing pinnable to one, which is a shorter answer to a residency question than most of this category can give. For an organisation pointing a fleet of systems at one supplier and needing a single sentence for the auditor, that simplicity has real value.",
    },
    {
      heading: "What you are not getting from either",
      a: "Not a marketing platform and not a template experience for non-engineers. Mailgun has a templating syntax stored vendor-side and it is aimed at developers. Anything resembling lifecycle automation, segmentation or a campaign builder is a separate purchase, and its own deliverability tooling is packaged separately too.",
      b: "Not a developer platform. No idiomatic SDK, no rendering, no lifecycle tooling, and an API that manages the account rather than being the primary send path. Choosing it because it is inexpensive and then wanting the things a platform gives you is the most common route to being unhappy with it.",
    },
  ],
  pickA: [
    "Inbound mail is part of your product and you need conditional routing with ordered rules rather than one forwarding destination.",
    "You send on behalf of tenants and need per-tenant credentials, suppression and reporting.",
    "You want to tag sends with your own dimensions and slice the event stream by them later.",
    "Your volume supports several dedicated addresses and you want the per-IP price published.",
  ],
  pickB: [
    "The senders are business systems, appliances and plugins, and none of them will ever be rewritten.",
    "You want one revocable credential per sending system, with its own reporting slice.",
    "Blocklist monitoring and scheduled health reports are the visibility you need, because you cannot instrument the sender.",
    "Your volume is modest and you would rather not pay for a routing engine and a validation service you never call.",
  ],
  faqs: [
    {
      question: "I was on Mailgun's Flex plan — what are my options now?",
      answer:
        "Flex closed to new signups in December 2025 and the legacy rate doubled, so the question is whether the platform features justify the named plan you would move onto. Audit honestly: do you use routes, validation, subaccounts or tagging? If none of them, you are paying a platform price for relay work and a relay is the cheaper and better-fitting answer. If you use even one of them meaningfully, replacing it elsewhere is likely to cost more in engineering than the plan difference saves.",
    },
    {
      question: "Does an SMTP relay deliver worse than an API?",
      answer:
        "No. Placement is decided by authentication, reputation and content, not by the protocol the message arrived over. Both vendors sign with DKIM and align SPF correctly when configured properly, and both will restrict you for a bad list. The one indirect risk is that legacy senders are likelier than fresh code to emit unauthenticated or malformed mail, and to use an envelope sender that does not align with the visible From address — which is a problem with the sender, fixable in its configuration.",
    },
    {
      question: "How many sending credentials should I create?",
      answer:
        "One per system, always, and it costs nothing to do. The value shows up the day a credential leaks or a system starts misbehaving: you revoke exactly one thing rather than rotating a shared secret across an estate nobody has a complete inventory of. It also makes the reporting useful, because you can see which system's mail is bouncing without correlating by From address. Shared credentials are the single most common operational mistake in relay setups.",
    },
    {
      question: "What should I check on the receiving side before switching?",
      answer:
        "Your DNS, three records deep. SPF has to include the new vendor and must not exceed ten lookups, which is easy to breach when you are temporarily including both the old and new providers during a cutover. DKIM keys are per-vendor, so both need publishing while you run in parallel. And DMARC alignment needs verifying with a real test send, because a legacy sender that sets an envelope From on a different domain will fail alignment silently and land in spam while every dashboard shows delivered.",
    },
    {
      question: "Can I keep long-term records of what was sent?",
      answer:
        "Not from either vendor's own retention, which is plan-dependent on both sides and finite everywhere. If you have a contractual or regulatory reason to prove what was sent to whom two years ago, the only durable arrangement is to consume the webhook or event stream as it happens and write it into storage you control. It is inexpensive to build and impossible to build retroactively, which is why the people who need it almost always discover the requirement one quarter too late.",
    },
  ],
};

const MAILGUN_VS_MANDRILL: VersusPage = {
  slug: "mailgun-vs-mandrill",
  a: "mailgun",
  b: "mandrill",
  title: "Mailgun vs Mailchimp Transactional (Mandrill)",
  description:
    "Two transactional products that both live inside something larger — one inside a communications group, one inside a marketing platform you have to buy first. That parentage explains more about each than their feature lists do.",
  search: {
    primaryQuery:
      "transactional email that is not tied to a marketing platform",
    secondaryQueries: [
      "mandrill alternative that does inbound routing",
      "mailgun routes compared to mandrill inbound",
      "transactional email without buying mailchimp",
      "which transactional provider is still being developed",
    ],
    rationale:
      "Both are long-established transactional products with an inbound story, which puts them on the same shortlist for teams doing reply handling — and the deciding facts are a purchasing prerequisite on one side and an ongoing investment question on the other, neither of which appears on a feature comparison.",
  },
  intro:
    "Neither of these is a young product and neither is independent. Mandrill is an add-on to a marketing platform and cannot be bought without it. Mailgun is a piece of Sinch, a large communications group, and has changed hands more than once. Teams compare them because both send transactional mail at volume and both parse inbound, which is a narrower overlap than it looks. The decision usually turns on two things that are not features: what you have to purchase to get it, and how much you expect it to change.",
  dimensions: [
    {
      heading: "The prerequisite purchase",
      a: "None. Mailgun is bought on its own, priced on its own plan ladder, and depends on no decision made by another department. Whether that matters to you depends on whether anybody else in your organisation is already paying for the alternative's parent product.",
      b: "A paid Mailchimp plan, permanently, underneath. Mandrill is an add-on and cannot be purchased alone, so the true cost of transactional sending includes a marketing subscription. For a company already running campaigns there it is close to marginal cost. For everybody else it is the single fact that ends the evaluation, and it belongs at the top of your arithmetic rather than in a footnote.",
    },
    {
      heading: "How much investment each is still receiving",
      a: "Active but turbulent. Mailgun continues to ship, and it has also changed ownership and repriced — Flex closed to new signups in December 2025 and the legacy rate doubled. You are betting on a product that is being managed commercially, which cuts both ways: it improves, and the terms change under you.",
      b: "Stable to the point of stasis. Mandrill works, has worked for years, and visible investment has been modest for a long stretch. A transactional sender that stopped changing is a transactional sender that stopped breaking, which is a real virtue. It is a poor bet if your plan depends on the surrounding tooling getting better.",
    },
    {
      heading: "What each does with mail arriving at your domain",
      a: "Routes are a rule engine: match expressions against recipient, sender and headers, ordered by priority, with actions attached, so one inbound domain can fan out to different destinations under different conditions. For anything where receiving mail is part of the product rather than a reply path, this is the stronger half of the pair by a wide margin.",
      b: "Inbound routing forwards parsed messages to a webhook and has done so stably for a very long time. It covers reply handling and bounce parsing well, and it is forwarding rather than conditional fan-out. If your existing Mandrill inbound configuration is load-bearing, inventory it carefully before assuming any replacement is at parity.",
    },
    {
      heading: "Addresses your provider has stopped mailing",
      a: "Suppression lists cover bounces, complaints and unsubscribes, exposed through the API so you can audit and manage them programmatically. That programmatic access is the part that matters operationally: you can reconcile the vendor's view against your own database on a schedule rather than trusting a dashboard.",
      b: "The rejection list is stricter than people expect. An address that hard-bounced once can remain on it indefinitely, so a customer who fixed their mailbox months ago silently receives nothing. Auditing that list is part of operating Mandrill competently, and it is the first thing to export if you ever leave.",
    },
    {
      heading: "Checking an address before it becomes a bounce",
      a: "Validation is a separate Mailgun product with its own API, backed by a very large sending operation's observation data, usable at signup time rather than only on an import. For a product acquiring addresses through forms, rejecting a typo at the point of entry is measurably better than discovering it as a hard bounce a week later.",
      b: "There is no equivalent. Mandrill will tell you that an address bounced and will add it to the rejection list; it will not help you avoid sending to it in the first place. If list quality is your live problem, that is a real gap and it has to be filled with a separate service or with your own confirmation flow.",
    },
    {
      heading: "How the templates are written and by whom",
      a: "A handlebars-style templating syntax stored vendor-side and versioned there, aimed at developers. It is competent and it is not a design surface, so a marketer wanting to change a subject line is filing a ticket or learning the syntax.",
      b: "Mailchimp's editor with merge tags, a syntax inherited from a marketing product. Convenient if your marketing team already lives in that editor, awkward if they do not, and in practice teams end up doing more of the conditional logic in application code than the feature list suggests. There is no export path that carries these templates anywhere else.",
    },
    {
      heading: "Finding a cohort of messages later",
      a: "Tags and custom variables let you attach your own dimensions at send time and filter the event stream by them afterwards, which is how you answer a question about a campaign or a release rather than about one message. Log retention is a tier attribute and the entry plans are short, so check the number on the plan you are actually buying.",
      b: "Outbound activity with content and delivery state, searchable within a retention window, adequate and visibly aged. A support person chasing one customer's missing receipt takes more steps than they should, and slicing by a dimension you defined is not really what the interface is for.",
    },
    {
      heading: "How the money is counted",
      a: "A named plan ladder with included volume and published overage, plus dedicated IPs included from the mid plans and extras at a monthly rate. It is easy to forecast, and since December 2025 the cheap pay-as-you-go entry point people remember is not available to new signups.",
      b: "Blocks of messages bought at a time, plus a dedicated address as a monthly extra, plus the mandatory platform subscription underneath. Working out a true per-message cost requires arithmetic the pricing page does not do for you, and the honest number is materially higher than the block price suggests.",
    },
    {
      heading: "What happens when an account is questioned",
      a: "Suspensions recur in Mailgun's public reviews often enough to treat as a planning input. Large platforms are conservative about shared reputation and act first when a sending pattern looks unusual, which means spiky traffic deserves a warm fallback path and somebody who knows how to reach support.",
      b: "The account relationship is shared with the marketing side, and that matters in the direction people do not expect: a problem originating in campaigns is a problem for the account your receipts depend on. Separating the two is not something you can arrange within the product, because the dependency is the product.",
    },
  ],
  pickA: [
    "You need conditional inbound routing rather than a single forwarding webhook.",
    "Address validation at the point of signup would measurably improve your bounce rate.",
    "You want to buy transactional sending on its own terms, with no other subscription required to make it work.",
    "Slicing your own send dimensions out of the event stream is how your team answers questions about email.",
  ],
  pickB: [
    "Marketing already runs campaigns in Mailchimp, so the platform subscription exists regardless and transactional is marginal cost.",
    "The integration has run untouched for years, nothing is broken, and no one has funded a migration.",
    "Your marketing team owns the templates and already works in that editor every day.",
    "You would rather depend on a product that has stopped changing than on one whose terms were repriced last year.",
  ],
  faqs: [
    {
      question: "Can I buy Mandrill without a Mailchimp plan?",
      answer:
        "No. It is an add-on requiring an active paid Mailchimp plan, and that requirement ends more evaluations than any feature gap does. When you compare per-message costs, include the subscription underneath in the total. A transactional product that looks inexpensive per message can be the more expensive option overall once its prerequisite is counted, and the prerequisite does not go away at any volume.",
    },
    {
      question: "Which one is the safer long-term dependency?",
      answer:
        "They fail differently, which is why there is no single answer. Mandrill's risk is stagnation: it keeps working and stops gaining, so a feature you need in two years may never arrive. Mailgun's risk is change: it gains features and it also reprices and changes hands, as December 2025 demonstrated. Pick based on which you can absorb. A team with no appetite for migration work should fear repricing; a team building something that will need more from its email vendor should fear stagnation.",
    },
    {
      question: "What is the hardest part of moving off either one?",
      answer:
        "Inbound, if you use it, followed by templates. Outbound sending is a small code change and inbound is a re-architecture whenever you are moving between a rule engine and simple forwarding in either direction. Templates cross no paradigm boundary and must be rebuilt by hand. After that comes discovery: grep your infrastructure for the API credential rather than the vendor name, because the integration nobody remembers was configured by hand on a server rather than committed to a repository, and it will keep sending happily from an account you thought you had closed.",
    },
    {
      question:
        "Do either of these separate marketing from transactional mail?",
      answer:
        "Not as a product concept the way message streams do elsewhere. On both, keeping a newsletter's reputation away from your password resets is something you arrange: a separate sending subdomain for bulk mail, separate credentials, and the discipline to keep them apart forever. It works and it depends on every future engineer understanding why the rule exists, which is a weaker guarantee than a vendor that refuses to let the two share.",
    },
    {
      question: "What should I export before leaving either?",
      answer:
        "The suppression or rejection list first, because sending to previously bounced addresses from a brand-new identity is the fastest way to damage a reputation you have not yet built. Then templates, which nothing carries across. Then as much delivery history as the window still holds, since a dispute about last quarter will not wait for your migration. And on Mandrill specifically, decide what happens to the Mailchimp subscription — if transactional was the only reason it survived renewal, cancelling it is part of the saving and should be in the business case.",
    },
  ],
};

const KLAVIYO_VS_SENDGRID: VersusPage = {
  slug: "klaviyo-vs-sendgrid",
  a: "klaviyo",
  b: "sendgrid",
  title: "Klaviyo vs SendGrid",
  description:
    "Both will send your marketing email. Only one of them was built to know that a customer abandoned a cart worth ninety pounds on Tuesday, and that knowledge is what the price difference is for.",
  search: {
    primaryQuery: "klaviyo or sendgrid marketing campaigns for an online store",
    secondaryQueries: [
      "sendgrid marketing campaigns versus a dedicated ecommerce platform",
      "do i need klaviyo or is sendgrid enough",
      "ecommerce email attribution without klaviyo",
      "moving marketing email off sendgrid",
      "why does my klaviyo bill go up without sending",
      "who owns consent when marketing and transactional split",
      "separate subdomain for marketing and receipts",
    ],
    rationale:
      "SendGrid Marketing Campaigns is bought by a lot of stores because it is already in the account, and the comparison they need is not about sending quality — it is about whether a contact list with custom fields can substitute for a behavioural profile, which no vendor will answer honestly.",
  },
  intro:
    "This one gets decided by a question nobody phrases correctly. It is not which sends better marketing email, because both send it perfectly well. It is what your email is allowed to know. SendGrid's marketing product operates on contact lists with custom fields — a reasonable model that has served a great many businesses. Klaviyo operates on profiles assembled from a live feed of store events, so the message can react to what somebody did an hour ago. If your email does not need to react to anything, you are about to overpay dramatically.",
  dimensions: [
    {
      heading: "What the system knows about a person",
      a: "A profile assembled from a continuous feed of store activity: products viewed, carts started and abandoned, orders placed, revenue to date, time since last purchase. The data model was designed for commerce and it arrives without anybody writing an integration, which is why a segment like browsed this category twice and has not ordered in sixty days is a few clicks rather than a project.",
      b: "A contact with custom fields you define and populate yourself. It is a flexible and honest model, and it means every behavioural attribute in your emails exists because somebody built a pipeline to put it there and keeps that pipeline running. For a business whose segmentation is genuinely list-shaped — customers, trial users, newsletter subscribers — that is not a limitation.",
    },
    {
      heading: "Showing that the channel paid for itself",
      a: "Attribution is the actual product. Klaviyo ties orders back to the message that preceded them and reports revenue per campaign and per flow, which is the number a store owner uses to justify the subscription. The attribution windows are configurable and generous, so treat the headline figure as directional rather than as a controlled experiment, and the direction is usually right.",
      b: "You get opens, clicks and deliveries, and connecting those to money is your own work — export the events, join them against orders in your warehouse or analytics tool, and maintain that join. Some teams do this well and end up with a more honest number than any vendor's default attribution. Most teams do not do it at all, and therefore cannot say what the channel is worth.",
    },
    {
      heading: "What the meter counts",
      a: "Active profiles, billed whether or not you ever message them, with a volume allowance pinned at a multiple of the profile count. Two consequences follow and both surprise people: signups you never email still raise the invoice, and the plan auto-upgrades when profiles grow without ever auto-downgrading when they shrink. Pruning the list is a billing activity, not just a hygiene one.",
      b: "Sending volume, on a plan ladder. The marketing product is priced as its own plan rather than bundled with the transactional one, so the one-vendor story is two subscriptions. A dormant contact costs nothing until you mail it, which is the better shape for a business with a large, quiet list and the worse shape for one that mails a small list constantly.",
    },
    {
      heading: "Transactional mail on the same account",
      a: "Klaviyo is a marketing platform and its transactional story is thin. Order confirmations and shipping notices generally come from the store platform or a separate sending vendor, which is the normal arrangement and means Klaviyo is an addition to your stack rather than a consolidation of it.",
      b: "This is SendGrid's real advantage in the pair. The API, the SMTP relay and the marketing product live under one account with one vendor relationship, so receipts, password resets and campaigns are one procurement conversation. Keep them on separate subdomains anyway, because sharing a vendor is fine and sharing a sending reputation is not.",
    },
    {
      heading: "Building a multi-step sequence",
      a: "Flows are the half of Klaviyo that earns the money: triggered by store events, branching on profile attributes and behaviour, with waits, splits and back-in-stock or abandoned-cart templates that arrive pre-built. A merchant can assemble a working abandoned-cart sequence in an afternoon without engineering help, and that is the specific capability people are buying.",
      b: "Automations exist and are list-and-trigger shaped rather than behaviour shaped: a welcome series, a date-based sequence, a send when somebody joins a list. It covers a great deal of ordinary marketing. What it does not do easily is react to something that happened in your product ten minutes ago, unless you built the pipeline that tells it.",
    },
    {
      heading: "Where the store data comes from",
      a: "Native integrations with the major commerce platforms, Shopify most deeply, syncing catalogue, customers and orders both directions without an engineer. That depth is why the evaluation is frequently over before it starts for a Shopify merchant, and it is worth noticing that it is also what makes leaving expensive later.",
      b: "An API and a contacts import, plus whatever middleware you choose to run. Everything is possible and nothing is automatic. For a business with an engineering team and an existing data warehouse this is sometimes preferable — the pipeline is yours, the definitions are yours, and no vendor is guessing what a customer is.",
    },
    {
      heading: "Sending for several brands or clients",
      a: "Klaviyo's model is one account per store, and agencies manage a collection of accounts rather than tenants inside one. That is a coherent arrangement for merchants and an administrative cost for anybody operating at portfolio scale.",
      b: "Subusers are the strongest structural feature SendGrid has: each gets its own credentials, reputation, suppression and reporting under one parent account. If you send on behalf of customers, this alone often decides the evaluation, and there is no comparable concept on the other side of this pair.",
    },
    {
      heading: "Who is responsible when mail stops arriving",
      a: "Klaviyo watches your sending closely because ecommerce marketing is where complaint problems live, and it will restrict an account that misbehaves. The support relationship is oriented toward merchants and the guidance tends to be practical: prune the list, segment on engagement, stop mailing people who have ignored you for a year.",
      b: "Support latency and abrupt suspension are the two themes that dominate SendGrid's public reviews, consistently enough to be a planning input rather than a rumour. A campaign that spikes volume against a shared pool is exactly the pattern a large platform acts on first. Keep a fallback path warm and know how you would reach a human before you need to.",
    },
    {
      heading: "Getting people onto the list in the first place",
      a: "Sign-up forms, pop-ups and their targeting rules are part of the product, and the collected data lands directly in the profile with no glue in between. That is a genuine time saving for a store and it is also another thread tying you to the platform.",
      b: "There is no meaningful form product; you build the capture yourself or buy it elsewhere and push contacts in through the API. That is fine for a team that already has its own signup flow and an unwelcome extra project for a small store that assumed it was included.",
    },
  ],
  pickA: [
    "You run an online store and want email that reacts to browsing, carts and order history without building the pipeline yourself.",
    "Revenue per campaign is the number you need to justify the spend, and you want it calculated for you.",
    "A merchant rather than an engineer will own the flows day to day.",
    "Sign-up forms and list growth being part of the same product is worth real money to you.",
  ],
  pickB: [
    "Transactional and marketing mail on one vendor relationship is a genuine requirement rather than a preference.",
    "Your segmentation is list-shaped, so a behavioural profile would be capability you pay for and never use.",
    "You send on behalf of customers and need per-tenant credentials, suppression and reporting.",
    "You have a data warehouse and would rather own the attribution join than accept a vendor's default windows.",
  ],
  prosA: [
    "A profile assembled from live store activity, so a segment that describes behaviour is a few clicks rather than a data pipeline that somebody has to keep running afterwards.",
    "Revenue attribution is the product rather than a report, which gives a store owner the number that justifies the subscription without exporting anything into a spreadsheet first.",
    "Flows branch on store events, with abandoned-cart and back-in-stock sequences already built, and a merchant can assemble a working one in an afternoon without engineering help.",
    "Sign-up forms and their targeting rules are part of the product, and whatever they collect lands directly in the profile with no glue in between for anyone to maintain.",
  ],
  consA: [
    "The meter counts active profiles, so signups you never message raise the invoice, and the plan steps up automatically as profiles accumulate while never stepping back down on its own.",
    "Sending is capped at a multiple of the profile count, and that cap is a hard stop in the middle of a campaign rather than an overage line on a later invoice.",
    "The transactional story is thin, so order confirmations come from the store platform or another vendor — making this an addition to the stack rather than a consolidation of it.",
    "One account per store, so an agency administers a collection of separate accounts rather than tenants inside one, with no view across the portfolio.",
  ],
  prosB: [
    "Transactional and marketing mail under one account and one vendor relationship, which turns receipts, password resets and campaigns into a single procurement conversation.",
    "Subusers give per-tenant credentials, reputation, suppression and reporting, which is frequently decisive for anybody sending on behalf of clients rather than only for themselves.",
    "A dormant contact costs nothing until you mail it, which is the better economic shape for a business sitting on a large and mostly quiet list.",
    "An API and an import rather than a native sync, which a team with its own warehouse often prefers because the definition of a customer stays theirs rather than the vendor's.",
  ],
  consB: [
    "Contacts carry custom fields you populate yourself, so every behavioural attribute in an email exists because somebody built a pipeline and is still maintaining it this quarter.",
    "You get opens, clicks and deliveries, and joining those to money is your own work — which most teams never do, and therefore cannot say what the channel is actually worth.",
    "Automations are list-and-trigger shaped rather than behaviour shaped, so reacting to something that happened ten minutes ago requires the pipeline nobody built.",
    "There is no meaningful form product, so list growth becomes a project that a small store had reasonably assumed was included in the price.",
  ],
  migrationChecklist: [
    "Establish first whether this is a replacement or a split, because most stores end up with a split. Transactional mail usually stays where it is and only the campaign side moves, which means adding a vendor rather than swapping one — and the plan should say so before anybody exports a contact list.",
    "Export contacts with their consent timestamps rather than only their addresses. When somebody opted in, and to what, is the one record that cannot be reconstructed afterwards and the one a regulator asks for. Custom fields come out cleanly; the provenance behind them generally does not.",
    "Reconcile the suppression lists and name the system that is authoritative about consent. The failure here is specific and public: somebody unsubscribes from marketing in one tool and stops receiving order confirmations from the other, which is a support problem and possibly a compliance one.",
    "Connect the store integration and let it backfill before writing a single segment. Profiles are assembled from order and browse history, so a segment authored on day one evaluates against a fraction of the data it will hold on day thirty, and the figures you show a stakeholder will be wrong in an embarrassing direction.",
    "Rebuild the automations rather than porting them. A list-and-trigger automation and an event-driven flow are different models rather than different syntaxes, so every sequence is a design decision again — which is the point of moving, but it is design work with a calendar rather than an export.",
    "Split the subdomains before the first send. If campaigns are leaving the account that also sends receipts, give each its own subdomain and DKIM keys so a campaign's complaint rate cannot reach the transactional standing. This is the cheapest protective step in the whole migration and the one most often skipped.",
    "Prune before importing, because on the profile-metered side the list is the invoice. Every address that has ignored you for a year costs money the moment it arrives and drags the engagement metrics down with it, and pruning afterwards leaves you on a tier the plan will not step back down from by itself.",
    "Accept that the attribution history stays behind. Revenue per campaign does not export into any form another tool can use, so year-on-year comparisons break at the migration date. Snapshot the reports somebody will want to cite before the account closes, and warn them the series has a seam in it.",
  ],
  buyingQuestions: [
    "How many of our best-performing messages actually react to behaviour, and how many are announcements sent to a list on a schedule?",
    "What is our active profile count today, and what does it become in twelve months if nobody makes pruning somebody's job?",
    "Who owns email day to day — a merchant or an engineer — and which of these two tools matches how that person works?",
    "Once marketing and transactional live in different systems, which one holds the authoritative record of consent, and who wrote that down?",
    "Do we have a warehouse and somebody who would maintain an attribution join, or would we be accepting a vendor's default windows and calling it measurement?",
    "Do we send on behalf of other businesses, and does the option we are leaning toward give each of them isolated credentials, suppression and reporting?",
    "If we mail a small list frequently, has anybody checked the send cap against our real cadence rather than against our monthly total?",
  ],
  faqs: [
    {
      question:
        "Is SendGrid's marketing product good enough to replace Klaviyo?",
      answer:
        "For a business whose email is announcements and newsletters, comfortably yes, and the saving is large. For a store whose best-performing messages are abandoned cart, browse abandonment and post-purchase sequences, no — not because the sending is worse but because the data is not there. You can build the equivalent by piping store events into contact fields and triggering on them, and the honest estimate for that is weeks of engineering plus ongoing maintenance, which is frequently more expensive than the subscription it avoids.",
    },
    {
      question: "Why does my Klaviyo bill go up when I am not sending more?",
      answer:
        "Because the meter is profiles rather than sends, and profiles accumulate on their own. Every signup, every checkout that captured an address, every import adds to a count that the plan tracks upward automatically and does not track back down. The discipline that keeps it in check is a standing suppression policy for people who have not engaged in a year, applied on a schedule. It also improves deliverability, so it is worth doing regardless of what it does to the invoice.",
    },
    {
      question:
        "Can I keep transactional mail on SendGrid and run marketing on Klaviyo?",
      answer:
        "Yes, and it is the arrangement a large number of stores end up with. Use separate subdomains for the two so their reputations cannot affect each other, and decide explicitly which system holds the authoritative record of consent and unsubscribes. The failure mode to avoid is two systems each maintaining their own view of who has opted out, because the first time somebody unsubscribes from marketing and then stops receiving order confirmations, you have a support problem and possibly a compliance one.",
    },
    {
      question: "What does the volume cap on a Klaviyo plan actually mean?",
      answer:
        "Sending is limited to a multiple of your profile count, and past that limit sends stop rather than costing extra. That is fine for a normal cadence and it bites in exactly one situation: a small, highly engaged list that you mail frequently. If you have ten thousand profiles and a daily send, run the arithmetic before you commit, because the ceiling is a hard stop in the middle of a campaign rather than an overage line on the invoice.",
    },
    {
      question: "How hard is it to leave either one?",
      answer:
        "Contacts export cleanly from both, and that is the easy part. What does not export is the work: flows and automations have to be rebuilt by hand, templates cross no paradigm boundary, and attribution history stays behind entirely, so your year-on-year comparisons break at the migration date. On the Klaviyo side there is an extra thread — the native store integration means the platform holds catalogue and order data that has to be re-established elsewhere. Export a full contact snapshot with consent timestamps before you start, because proving when somebody opted in is the one record you cannot reconstruct.",
    },
    {
      question:
        "Should marketing and transactional mail share a sending domain?",
      answer:
        "No, and this is the one piece of advice on this page that applies whichever vendor you choose. Campaign mail attracts complaints — that is the nature of it, even when everything is done correctly — and a complaint rate earned by a promotion should not be allowed to decide whether a password reset reaches the inbox. Give each traffic type its own subdomain with its own DKIM keys, so the two reputations are separate records as far as the mailbox providers are concerned. It costs one DNS change and it is the cheapest insurance in email.",
    },
    {
      question:
        "How long does the store backfill take before segments are useful?",
      answer:
        "Long enough that the first week's numbers should not leave the room. A native commerce integration syncs historical orders and customers on connection and then builds browse and cart behaviour forward from the moment it is live, so anything describing recent activity is evaluating against a window that is still filling. A segment written on day one and shown to a stakeholder on day three will understate reality and nobody will remember why later. Give it a few weeks of live traffic before anyone treats a flow's performance as a signal.",
    },
    {
      question: "Can SendGrid subusers work for a multi-store operation?",
      answer:
        "Yes, and it is one of the few places SendGrid is structurally ahead in this pair. Each subuser carries its own credentials, its own sending reputation, its own suppression list and its own reporting beneath a parent account somebody administers, which is exactly what an operator of several storefronts or an agency needs. The counterpart is one account per store with no consolidated view, so if portfolio-level administration matters, this dimension may outweigh everything the behavioural data model offers.",
    },
    {
      question: "Does Klaviyo send order confirmations?",
      answer:
        "It can send transactional-style messages, and in practice most stores do not use it that way. Order confirmations and shipping notices generally come from the commerce platform itself or from a dedicated sending vendor, because those messages are triggered by systems that already own the order record and because keeping them off the marketing reputation is good hygiene. Treating a marketing platform as your receipts provider also means the mail you least want to lose depends on a subscription priced by profile count, which is a coupling worth avoiding.",
    },
  ],
};

const LOOPS_VS_SENDGRID: VersusPage = {
  slug: "loops-vs-sendgrid",
  a: "loops",
  b: "sendgrid",
  title: "Loops vs SendGrid",
  description:
    "A tool built for one kind of company against a platform built for everyone. The narrow one is faster and will run out of room. The broad one will do whatever you ask and make you configure it first.",
  search: {
    primaryQuery: "simple lifecycle email tool instead of sendgrid",
    secondaryQueries: [
      "loops.so versus sendgrid marketing campaigns",
      "email tool for a small saas team",
      "sendgrid replacement after the free tier ended",
      "unlimited sends priced per contact",
    ],
    rationale:
      "The cohort SendGrid's free-tier retirement pushed into the market is mostly small software teams, and the tools they are shown are enterprise platforms — the useful comparison is against a product deliberately scoped to their size, including where it stops.",
  },
  intro:
    "One of these was designed around a specific customer — a software company with subscribers, onboarding sequences and a product update to send — and everything in it assumes that shape. The other was designed to be configurable enough for anybody, and carries the accumulated compromises of twelve years of keeping many kinds of customer satisfied. Choosing is mostly a question of whether you are the customer the narrow tool was drawn for, and whether you expect to still be that customer in three years.",
  dimensions: [
    {
      heading: "Who the product was drawn around",
      a: "A software business with subscribers: onboarding sequences, feature announcements, trial nudges, a monthly update. Because the assumed customer is that specific, a great deal of configuration simply does not exist — there is one obvious way to do most things and it is usually the right one. A team outside that shape will feel the absences quickly.",
      b: "Everyone, which is a strategy rather than an accident. An enterprise with subusers, a store, an agency, an internal tool sending one alert a day: all of them are supported, and the cost of supporting all of them is a surface where nothing is opinionated and most things need configuring before they work.",
    },
    {
      heading: "What the bill is charged against",
      a: "Subscribed contacts, with sending unlimited. You stop counting messages entirely, which changes behaviour — nobody hesitates over an extra send because it does not cost anything. The trade is that a large dormant free list stays on the invoice forever whether you mail it or not, so list pruning becomes a billing decision.",
      b: "Sending volume, on a plan ladder, with the marketing product priced as its own plan rather than an add-on. A quiet list costs nothing until you mail it. The structure rewards a business with many contacts and infrequent campaigns and punishes one that sends often to a small, engaged audience.",
    },
    {
      heading: "Product email and campaigns in one place",
      a: "Transactional sends and lifecycle campaigns live in the same tool against the same contact record, which is the consolidation that makes Loops attractive to a small team. One vendor, one list, one view of a person, and an engineer triggering a password reset is using the same system the marketer schedules an announcement in.",
      b: "Both exist under one account and they are separate products with separate plans, separate interfaces and separate mental models. That is more capability and less consolidation: the procurement relationship is single and almost nothing else about the experience is.",
    },
    {
      heading: "Who opens it on a Monday morning",
      a: "Anybody on the team. The interface is modern, the concepts are few, and a founder or a marketer can build and send something without a walkthrough. That accessibility is the main reason small teams choose it, and it is a real operational saving when there is no dedicated email person.",
      b: "Somebody who has learned it. SendGrid's marketing interface is capable and carries a decade of accumulated options, and getting a campaign out involves knowing which of several similar-looking things you want. On a larger team that is fine, because the person who knows it is the person who does it.",
    },
    {
      heading: "How far a segment can go",
      a: "Audience filters on contact properties and on events you send in, which is enough for the segments a SaaS team actually uses: on a trial, signed up this month, has not completed setup, on the paid plan. It stops well short of multi-condition behavioural logic, and the moment you want a rule with three nested branches you have found the ceiling.",
      b: "Segments on contact fields and engagement, with the depth limited by what you put into the fields. It is more configurable than Loops and no more behavioural, because the underlying model is still a contact with attributes rather than a stream of events. Both stop in the same place, arriving there from different directions.",
    },
    {
      heading: "The developer surface",
      a: "A small, current API with SDKs, aimed at identifying contacts and sending events from your application so the tool can react. The surface is deliberately compact and that is appropriate for the product's scope. It is not a general-purpose sending platform and does not pretend to be.",
      b: "A large mature API, SMTP relay, webhooks with rich event metadata, tagging and custom arguments for slicing analysis later, and a decade of third-party integrations built against it by other people. At volume this is the more capable half of the pair by some distance, and the price is an interface somebody had to learn.",
    },
    {
      heading: "Systems that only speak SMTP",
      a: "Loops is an API-and-interface product. If something in your estate can only be pointed at an SMTP host — a CMS, a monitoring agent, an appliance — that traffic is not going here and needs somewhere else to go.",
      b: "SMTP is a first-class path and has been forever, which is why so much software has a SendGrid option in a dropdown. A great deal of infrastructure was configured against it years ago by people who have since left, and that inertia is a genuine reason accounts stay, independent of whether the product is the best choice today.",
    },
    {
      heading: "What happens when an account is questioned",
      a: "A smaller vendor with a smaller support queue, which usually means faster and more personal answers, and a shorter operating record to judge it by. There is no widespread pattern of complaint about arbitrary account action, which counts for something in a category where sudden suspension is the dominant fear.",
      b: "Support latency and abrupt suspension dominate SendGrid's public reviews, consistently enough to plan around. Large platforms act first when a sending pattern looks unusual against a shared pool, and a campaign is exactly that pattern. Keep a fallback configured and know in advance how you would reach a human.",
    },
    {
      heading: "Where each one stops being enough",
      a: "You outgrow Loops when your messaging needs to branch on behaviour in ways a filter cannot express, when you need per-tenant sending isolation, or when a legacy system needs an SMTP host. Those are real ceilings and they arrive at a predictable size, which is an argument for choosing it deliberately as a stage rather than as a forever decision.",
      b: "You outgrow SendGrid's marketing half when you need genuine behavioural journeys, at which point you add a lifecycle platform and keep SendGrid for sending underneath it. That is the arrangement a great many companies land on, and it is worth recognising as the likely destination when you are pricing the marketing plan today.",
    },
  ],
  pickA: [
    "You are a small software team and the emails you send are onboarding, announcements and product updates.",
    "You want product email and lifecycle campaigns against one contact record rather than two products.",
    "Not counting sends is worth more to you than not paying for dormant contacts.",
    "Nobody on the team is going to learn a platform, so the tool has to be obvious on first open.",
  ],
  pickB: [
    "Something in your estate needs an SMTP host and rewriting it is not on anybody's roadmap.",
    "You send on behalf of customers and need per-tenant credentials, suppression and reporting.",
    "Your list is large and quiet, so paying per contact for people you rarely mail would be the worse deal.",
    "Procurement prefers a vendor inside a large public company, and that preference is a constraint rather than an opinion.",
  ],
  thirdOption:
    "Notice what this comparison is not about: neither side is being chosen for how well it puts mail in an inbox, because both are adequate at that and the decision is really about the layer above. If the sending underneath is the part you would rather own — because the bill scales with it, because the retention window is short, or because you want the same infrastructure to survive changing your marketing tool twice — the third shape is to run SES in your own AWS account and point whichever lifecycle tool you pick at it. Wraps is one way to operate that with tooling on top. It does nothing for the campaign-building half of this page, and it needs an AWS account and SES production access, an approval on AWS's schedule that can be refused.",
  faqs: [
    {
      question: "Is unlimited sending really unlimited?",
      answer:
        "Within a fair-use posture, yes, and the honest framing is that the constraint moved rather than disappeared. You are no longer metered per message; you are metered on how many people are on the list. That genuinely changes behaviour for the better — teams that stop counting sends run more experiments and split more tests — and it means the wrong-shaped customer, one with an enormous list they rarely mail, pays a lot for the privilege of not counting.",
    },
    {
      question: "What happened to SendGrid's free tier?",
      answer:
        "It was retired in May 2025 and replaced by a sixty-day trial. A very large number of small projects, side businesses and internal tools had been running on that tier for years, and all of them had to make a purchasing decision inside the same window. If you are reading a comparison written before that date, its recommendations were formed under different economics and should be re-checked rather than trusted.",
    },
    {
      question: "Can I run marketing on Loops and transactional on SendGrid?",
      answer:
        "Yes, and for some teams it is the sensible split — the legacy systems keep their SMTP host, the product emails go somewhere pleasant to work in. Use separate subdomains so the reputations are independent, and decide explicitly which system owns the authoritative consent record. Two systems each keeping their own view of who unsubscribed is how somebody stops receiving order confirmations because they opted out of a newsletter.",
    },
    {
      question:
        "How do I know if my segmentation needs are too complex for Loops?",
      answer:
        "Write down the three most valuable messages you want to send and the exact condition each depends on. If the conditions are properties and simple events — is on a trial, has not finished onboarding, upgraded last week — a filter-based tool covers them. If any of them contains the word and followed by a time window and a negation, such as did X but not Y within fourteen days, you are describing a behavioural journey and you should evaluate tools built for that instead of hoping to grow into one.",
    },
    {
      question: "What does migrating between these two actually involve?",
      answer:
        "Contacts and their consent status export from both, and that is the straightforward part. Campaigns and automations have to be rebuilt by hand because nothing crosses the paradigm. Templates likewise. The piece most often underestimated is the application integration: every place your code identifies a contact or fires an event has to be rewritten against the other API, and the forgotten one is usually in a background job rather than in the main request path. Run both in parallel for a cycle with the new system receiving events but not sending, so you can confirm the data is arriving correctly before anybody's inbox depends on it.",
    },
  ],
};

const CUSTOMER_IO_VS_SENDGRID: VersusPage = {
  slug: "customer-io-vs-sendgrid",
  a: "customer-io",
  b: "sendgrid",
  title: "Customer.io vs SendGrid",
  description:
    "One is a messaging engine that happens to send email. The other is an email platform that happens to have a campaign builder. Which you need depends on whether your best messages are triggered by behaviour or scheduled by a person.",
  search: {
    primaryQuery:
      "behavioural messaging platform versus sendgrid marketing campaigns",
    secondaryQueries: [
      "customer.io instead of sendgrid for lifecycle email",
      "do i need an event based messaging tool",
      "sendgrid automations versus a real journey builder",
      "sending events to a messaging platform from my app",
    ],
    rationale:
      "Teams already holding a SendGrid account evaluate Customer.io when their automations stop being expressible, and the real question is whether they are prepared to instrument their product with events — a cost that no pricing page shows and that decides whether the upgrade works at all.",
  },
  intro:
    "The gap between these two is not features, it is what you have to feed them. SendGrid's marketing product works on contacts with fields, so you can start sending the day you import a list. Customer.io works on people described by a stream of events from your product, so it does nothing useful until your application is telling it what users are doing. That instrumentation is the real price of admission, it is not on the pricing page, and it is the single best predictor of whether a team gets value from the switch.",
  dimensions: [
    {
      heading: "What you have to build before it works",
      a: "An event stream. Customer.io expects your application to identify people and emit events as they do things, and until that exists the platform is an expensive address book. The work is usually a week or two and then ongoing, because every new message you want depends on an event somebody has to add. Teams that skip it end up paying a platform price for list-based sending.",
      b: "An import. Contacts with custom fields get you to a first campaign in an afternoon, and any behavioural attribute you want later is a field you populate yourself from your own pipeline. That is a lower floor and a lower ceiling, and it is why SendGrid remains a sensible answer for teams whose engineering time is committed elsewhere.",
    },
    {
      heading: "Authoring something with more than one step",
      a: "A visual workflow canvas with triggers, delays, branches, attribute updates and webhook actions, capable of expressing genuinely complicated logic: wait three days, check whether they finished setup, branch, send a different message, stop the whole journey if they upgraded. It is the reason the product exists and it takes real learning to use well.",
      b: "Automations that are list-and-trigger shaped: a welcome series on joining a list, a date-based sequence, a simple branch. It covers a great deal of ordinary marketing and it starts to feel like fighting the tool at about the third condition. What looks like a missing feature is actually the data model — a contact with fields cannot easily express a sequence of things that happened.",
    },
    {
      heading: "What the invoice is charged against",
      a: "Profiles, with a monthly floor that is the first filter in this comparison. You pay per person in the workspace whether or not you ever message them, so a free tier full of signups you never mail is a real line on the bill. The floor also means a company below a certain size cannot sensibly buy it, which resolves the choice for them.",
      b: "Sending volume, with the marketing product on its own plan alongside the transactional one. Dormant contacts are free until mailed. For a business with a large quiet audience that is plainly the better shape, and for one with a small, deeply instrumented user base it is the worse one.",
    },
    {
      heading: "Transactional mail, and where it ends up",
      a: "Customer.io has a transactional API and it is competent, and the usual arrangement is still to trigger transactional sends through the same platform so that one system holds the complete record of what a person received. That is a genuine benefit — support sees everything in one timeline — and it means your receipts now depend on your marketing platform being up.",
      b: "The transactional API and SMTP relay are the mature centre of the whole company, and they are what the marketing product is bolted onto. If the question is where should receipts and password resets live, SendGrid answers it more convincingly than any lifecycle platform, and it remains a common answer even for teams whose marketing has moved elsewhere.",
    },
    {
      heading: "Channels other than email",
      a: "Push, SMS, in-app messages and webhooks are part of the same workflow, so a journey can decide that this step is better delivered in the product than in an inbox. For a mobile product that is not a nice extra, it is the reason to buy: coordinating those channels from separate tools means nobody can see the whole sequence.",
      b: "Email is the product. Twilio sells SMS and the other channels next door, and they are a different console, a different plan and a different integration. One corporate relationship is genuine value at procurement time and it is not the same thing as one orchestration layer.",
    },
    {
      heading: "Testing a message without mailing real people",
      a: "Separate workspaces let you run a full non-production environment with its own people, events and campaigns, so you can exercise a whole journey end to end before it touches a customer. For a product where a mistake means thousands of wrong messages in minutes, that separation is not optional and it is one of the strongest reasons to prefer a platform built for this.",
      b: "Subusers and separate API keys give you isolation of sending identity rather than a full parallel environment, and teams typically improvise the rest with a test list and a staging sender. It works and it is more careful hand-holding than a workspace boundary, which is exactly the sort of difference that only matters on the day somebody makes a mistake.",
    },
    {
      heading: "Not telling somebody the same thing twice",
      a: "Frequency controls, global suppressions and workflow-level rules about who may enter and how often exist because a behavioural platform will happily message somebody five times in an hour if five events fire. The controls are there precisely because the engine is powerful enough to need them, and configuring them is part of setting the product up rather than an optimisation for later.",
      b: "The risks are smaller because the engine is simpler: a scheduled campaign to a list is not going to fire six times because a user clicked around. What you get instead is the ordinary discipline of suppression lists and unsubscribe groups, which is adequate for the shape of sending the product does.",
    },
    {
      heading: "Who is expected to own it",
      a: "A lifecycle or growth person, with engineering support behind them for the event schema. The division is real and it is worth naming before you buy: if nobody owns the messaging strategy, an expensive workflow canvas becomes an expensive place to store three campaigns somebody built once.",
      b: "A marketer for campaigns and a developer for the API, working largely independently in different parts of the same account. That separation suits organisations where those functions do not coordinate closely, which is a great many of them.",
    },
    {
      heading: "Deliverability, and whose reputation is in play",
      a: "You authenticate your own sending domain and Customer.io sends on infrastructure it manages, with your reputation shaped by what your journeys do. A behavioural platform can damage a reputation fast, because a badly-scoped trigger reaches a lot of people quickly, which is why the frequency controls exist.",
      b: "Shared pools by default with dedicated addresses available on the higher plans, run at very large scale. The consistent theme in reviews is that the platform acts first and explains later when a pattern looks unusual, and a marketing campaign is the pattern most likely to look unusual.",
    },
  ],
  pickA: [
    "Your best messages depend on what somebody did in your product, and you are willing to instrument it with events.",
    "Push, in-app or SMS need to be steps in the same sequence as the email rather than a separate tool.",
    "You want a real non-production workspace to test a journey end to end before it reaches customers.",
    "Somebody owns lifecycle messaging as an actual job, so a powerful canvas will be used rather than admired.",
  ],
  pickB: [
    "Transactional email and SMTP are the load-bearing requirement, and campaigns are secondary.",
    "Your segmentation is list-shaped and adding an event pipeline would be capability you pay for and never use.",
    "You send on behalf of customers and need per-tenant credentials, suppression and reporting.",
    "The monthly floor of a behavioural platform is more than your entire email budget.",
  ],
  thirdOption:
    "Both of these bundle two separable things: deciding what message to send, and putting it in an inbox. The bundling is why the invoice grows with your user count rather than with your messaging sophistication, and why a vendor change means re-establishing reputation from scratch. If the sending layer is the part you would rather own permanently, the third shape is to run SES in your own AWS account and point whichever orchestration tool you choose at it, so the domain identities, suppression list and event history survive swapping the layer above. Wraps is one way to operate that with tooling on top. It builds no journeys for you, and it needs an AWS account and SES production access, an application AWS can refuse.",
  faqs: [
    {
      question: "How much engineering work is instrumenting events?",
      answer:
        "Plan on a week or two for a first useful schema and then a permanent small tax. The initial work is identifying users and emitting the dozen events your messaging actually depends on — signed up, completed setup, invited a teammate, upgraded, cancelled. The ongoing part is what people underestimate: every new message idea tends to need an event that does not exist yet, so the marketing team's velocity becomes coupled to the engineering backlog unless somebody keeps the schema ahead of demand.",
    },
    {
      question: "Can I use both, with Customer.io sending through SendGrid?",
      answer:
        "Orchestrating in one tool and sending through another is a normal architecture, and whether these two specific products support the arrangement you want is worth verifying directly rather than assuming. The reason to do it is reputation continuity: your sending identity stops changing every time you change orchestration tools. The reason not to is that debugging spans two vendors, and when a message does not arrive you now have two dashboards and two support queues between you and the answer.",
    },
    {
      question: "What is a profile and when does it start costing me?",
      answer:
        "A person in the workspace, counted whether or not you ever message them. Every signup, every imported contact and every identify call from your application adds one, so the bill tracks your user count rather than your sending. The discipline that keeps it honest is deciding explicitly which users belong in the messaging platform at all — plenty of teams pipe every signup in reflexively and then pay for years to store people who never opened anything.",
    },
    {
      question: "Will switching improve my deliverability?",
      answer:
        "Not by itself, and a behavioural platform can make it worse if you configure it carelessly. Most placement problems are self-inflicted: unauthenticated domains, no DMARC policy, marketing sent from the domain your product depends on, and mailing people who stopped engaging a year ago. A powerful journey engine adds a new way to hurt yourself — a badly scoped trigger reaching a large audience quickly — which is why frequency caps and entry rules are setup work rather than polish.",
    },
    {
      question: "What should I decide before migrating either direction?",
      answer:
        "Which system owns consent, and write it down. Both keep their own view of who has unsubscribed, and a migration is exactly when those views diverge — somebody opts out during the cutover, the record lands in the system you are leaving, and they get mailed again from the new one. Export consent status with timestamps before you start, import it as the first action rather than the last, and keep the old system receiving unsubscribes until you have confirmed nothing still points at it.",
    },
  ],
};

const KLAVIYO_VS_LOOPS: VersusPage = {
  slug: "klaviyo-vs-loops",
  a: "klaviyo",
  b: "loops",
  title: "Klaviyo vs Loops",
  description:
    "One assumes your customer buys things. The other assumes they subscribe to something. Almost every disagreement between these two products traces back to that single assumption about how you make money.",
  search: {
    primaryQuery: "klaviyo or loops for a subscription business",
    secondaryQueries: [
      "marketing email tool for saas instead of ecommerce",
      "loops.so compared to klaviyo",
      "do i need ecommerce flows for a software product",
      "email platform priced per contact with unlimited sends",
    ],
    rationale:
      "Klaviyo dominates the search results for marketing email regardless of the searcher's business model, so software teams keep landing on an ecommerce platform whose most valuable features — cart, catalogue and order attribution — have no analogue in what they sell.",
  },
  intro:
    "Both of these price on contacts and both let a non-engineer build a sequence, which is enough surface similarity to put them on one list. Underneath, each was built around a different idea of a customer. Klaviyo's customer places orders, so the product is organised around carts, catalogues and revenue per campaign. Loops' customer subscribes, so the product is organised around signup, onboarding, activation and the monthly update. Neither adapts gracefully to the other's world, and that is the decision.",
  dimensions: [
    {
      heading: "The transaction each product assumes",
      a: "A purchase. Klaviyo's entire data model orbits the order: what was viewed, what was added to a cart, what was bought, how much it was worth, how long since the last one. Everything valuable in the product is downstream of that event stream arriving automatically from a store platform, and a business with no orders is left holding a general-purpose email tool at a specialist price.",
      b: "A subscription. Loops assumes people sign up, get onboarded, activate or do not, upgrade or churn, and receive product news along the way. The primitives are contacts with properties and events you send from your own application, which is the right shape when the meaningful moments happen inside software rather than at a checkout.",
    },
    {
      heading: "Where the data arrives from",
      a: "Native commerce integrations, Shopify most deeply, syncing catalogue, customers and orders in both directions with no engineering involved. That depth is why a merchant's evaluation is often over before it starts, and it is also the thread that makes leaving expensive later, because the platform ends up holding product data as well as contacts.",
      b: "Your application, through a compact API and SDKs: identify a contact, set properties, send events. Nothing is automatic and nothing is guessed, which means a week of integration work and then a data model that matches your product exactly rather than an ecommerce schema you are bending.",
    },
    {
      heading: "How the invoice behaves",
      a: "Billed on active profiles with a sending allowance pinned at a multiple of that count, and the plan steps up automatically as profiles grow without ever stepping back down. The second half of that sentence is the one that surprises people: pruning your list is a billing action as well as a hygiene one, and nobody does it until the invoice prompts them.",
      b: "Billed on subscribed contacts with sending unlimited. You stop counting messages entirely, which changes team behaviour — nobody debates whether an extra send is worth it. The cost is symmetric to the other side's: a large dormant free-tier list sits on the bill permanently whether or not you ever mail it.",
    },
    {
      heading: "Proving the channel did something",
      a: "Revenue attribution is the actual product. Orders are tied back to the message that preceded them, reported per campaign and per flow, and that number is what justifies the subscription to whoever signs it. The attribution windows are configurable and generous, so read the figure as directional rather than as a controlled experiment.",
      b: "Opens, clicks and the events you send back in. If you want to know whether the onboarding sequence improved activation, you define activation, send that event, and compare — which is more honest than a default attribution window and considerably more work. There is no equivalent of revenue per email here, because for most subscription businesses there is no equivalent revenue event.",
    },
    {
      heading: "How much logic a sequence can carry",
      a: "Flows branch on profile attributes and store behaviour with waits and splits, and the commerce-specific ones — abandoned cart, browse abandonment, back in stock, post-purchase — arrive as working templates. A merchant can assemble a genuinely effective sequence in an afternoon, which is the specific capability being bought.",
      b: "Loops are triggered by events and filtered on properties, with the depth a SaaS lifecycle usually needs: on a trial, has not finished setup, upgraded last week. It stops short of deeply nested behavioural branching, and the ceiling arrives at a predictable size, which is an argument for choosing it deliberately as a stage rather than as a permanent answer.",
    },
    {
      heading: "Transactional mail and where it lives",
      a: "Klaviyo is a marketing platform and its transactional story is thin. Order confirmations and shipping notices come from the store platform or a separate sending vendor, so Klaviyo adds to your stack rather than consolidating it, and your customer's message history is split across at least two systems.",
      b: "Transactional sends and lifecycle campaigns share the same tool and the same contact record, which is the consolidation that makes Loops attractive to a small team: one vendor, one list, one view of what a person has received. The flip side is that your password resets now depend on your marketing tool.",
    },
    {
      heading: "Growing the list in the first place",
      a: "Sign-up forms and pop-ups with targeting rules are part of the product, and collected data lands straight into the profile with no glue. For a store that is a real saving in both time and integration surface, and it is another thread tying you to the platform.",
      b: "Signup happens in your product, because your contacts are your users. There is no form builder and there does not need to be one — the moment somebody creates an account is the moment they become a contact, and the integration you already wrote handles it.",
    },
    {
      heading: "Who has it open day to day",
      a: "A marketer or a merchant, frequently supported by an agency. The interface assumes ecommerce fluency and rewards somebody who works in it regularly, and the depth on offer is wasted on a team that sends four campaigns a year.",
      b: "Anybody on a small team. The concepts are few, the interface is modern, and a founder can build and send something without a walkthrough. That accessibility is the main reason small software teams pick it, and it is a real saving when nobody's job title contains the word email.",
    },
    {
      heading: "What the ceiling looks like on each side",
      a: "You outgrow Klaviyo when you need messaging in channels it does not orchestrate, or when the profile-based bill outpaces the revenue the channel is attributed. The sending cap pinned to profile count is the other wall, and it is a hard stop mid-campaign rather than an overage charge.",
      b: "You outgrow Loops when your messaging needs conditions a filter cannot express, when you need per-tenant sending isolation, or when a legacy system needs somewhere to relay SMTP. Those are real ceilings arriving at a predictable size, and knowing where they are is more useful than pretending they are not there.",
    },
    {
      heading: "What a template is allowed to contain",
      a: "Catalogue-aware blocks. A Klaviyo template can pull real products into the message — the exact items left in a cart, recommendations drawn from browsing, the thing that just came back into stock — because the platform already holds the catalogue. That capability is unusual and it is most of why the commerce flows convert as well as they do.",
      b: "Copy, structure and variables from your contact record. The editor is clean and the constraint is that there is no product feed behind it, which for a subscription business is not a constraint at all: the message is usually a sentence and a link into the product, not a grid of merchandise with prices on it.",
    },
    {
      heading: "Compliance, consent and who is on the list",
      a: "Ecommerce lists grow from checkouts, pop-ups and imports, which is the environment where consent gets muddled fastest and where complaint rates do the most damage. Klaviyo watches accounts closely for that reason and will restrict one that misbehaves, and its guidance to merchants tends to be practical rather than legalistic: prune, segment on engagement, stop mailing people who have ignored you for a year.",
      b: "Contacts are your users, so consent is usually unambiguous — somebody created an account and agreed to your terms — and the harder question is the one between product notices and marketing. Keep the distinction explicit in the contact record rather than implicit in which campaign you happen to be sending, because somebody unsubscribing from a monthly update should not stop receiving a security notice.",
    },
  ],
  pickA: [
    "You sell products and the highest-value emails you send are about carts, catalogues and past orders.",
    "Revenue per campaign is the number that justifies the spend, and you want the platform to calculate it.",
    "Forms and pop-ups being part of the same tool is worth paying for.",
    "A merchant or an agency, not an engineer, will own the programme day to day.",
  ],
  pickB: [
    "You sell a subscription and the moments that matter happen inside your product rather than at a checkout.",
    "You want lifecycle campaigns and transactional sends against one contact record in one tool.",
    "Not counting sends matters more to you than not paying for contacts you never mail.",
    "The team is small and the tool has to be usable by whoever has time, without training.",
  ],
  faqs: [
    {
      question: "Can I use Klaviyo for a SaaS product?",
      answer:
        "You can, and a number of companies do, and you should understand what you are paying for. The parts of Klaviyo that justify its price — order attribution, catalogue-aware templates, abandoned cart, back in stock — have no analogue in a subscription business. What remains is a competent, expensive general marketing tool with a profile-based bill. If you are drawn to it because the integrations list is long and the brand is familiar, price the features you would actually use before committing.",
    },
    {
      question: "What happens when I hit Klaviyo's send limit?",
      answer:
        "Sending stops. The allowance is a multiple of your profile count and past it the sends halt rather than costing extra, which is a materially different failure mode from an overage line on an invoice. It rarely bites a normal monthly cadence and it bites exactly one profile: a small, highly engaged list mailed frequently. Run the arithmetic against your real cadence before you commit, because discovering the ceiling mid-campaign is not a good afternoon.",
    },
    {
      question: "Is unlimited sending on Loops genuinely unlimited?",
      answer:
        "Within a fair-use posture, yes, and the honest framing is that the constraint moved rather than vanished. You are metered on how many people are on the list instead of how many messages you send. That changes behaviour for the better — teams that stop counting run more experiments — and it makes the wrong-shaped customer, one with an enormous list they rarely mail, pay handsomely for the privilege of not counting.",
    },
    {
      question:
        "How do I measure whether lifecycle email is working without revenue attribution?",
      answer:
        "Define the outcome you care about as an event and compare cohorts who received a sequence against those who did not. For a subscription product that is usually activation, second-week retention or upgrade rate rather than an order. The discipline this forces is a genuine advantage: an attribution window that credits an email for a purchase made six days later is convenient and generous, whereas a holdout group tells you what the sequence actually caused.",
    },
    {
      question: "What does migrating between them involve?",
      answer:
        "Contacts and consent status export from both, and everything else is rebuilt by hand. Flows and campaigns cross no paradigm boundary, templates likewise, and attribution history stays behind so your year-on-year comparisons break at the migration date. Moving away from Klaviyo has an extra thread: the native store integration means it holds catalogue and order data that has to be re-established wherever you land. Export a full contact snapshot including opt-in timestamps before you start — when somebody consented is the one record you cannot reconstruct afterwards.",
    },
  ],
};

const BREVO_VS_LOOPS: VersusPage = {
  slug: "brevo-vs-loops",
  a: "brevo",
  b: "loops",
  title: "Brevo vs Loops",
  description:
    "One is a broad European suite that will also do SMS, WhatsApp and a light CRM. The other does one job for one kind of company. Breadth and focus are both defensible, and they produce very different bills.",
  search: {
    primaryQuery: "brevo or loops for a small software company",
    secondaryQueries: [
      "email platform priced on sends versus per contact",
      "brevo automation is on the higher tier",
      "eu email marketing platform for saas",
      "removing the vendor logo from marketing emails",
    ],
    rationale:
      "Brevo is recommended constantly on price without anyone mentioning that automation sits a tier above the headline plan, and Loops is recommended on simplicity without anyone mentioning that a large dormant list is billed forever — the two facts that actually decide this.",
  },
  intro:
    "These two disagree about how much a marketing tool should try to be. Brevo is a suite: email, SMS, WhatsApp, chat, a light CRM, priced on the volume you send and aimed at a small European business that would rather have one invoice. Loops is deliberately narrow: lifecycle and transactional email for a software company, priced on contacts with sending unlimited. The comparison is not really about features, it is about whether consolidation or focus is the thing currently costing you time.",
  dimensions: [
    {
      heading: "What the meter counts, and which list shape it punishes",
      a: "Send volume. A contact costs nothing until you mail them, so a large quiet audience is cheap and a small engaged list mailed constantly is not. For a business with seasonal campaigns to a big list this is plainly the better shape, and it means every send decision carries a small cost calculation.",
      b: "Subscribed contacts, with sending unlimited. You stop counting messages, which measurably changes behaviour — more experiments, more splits, less hesitation. The symmetric cost is that dormant free-tier signups sit on the invoice forever, so list pruning becomes a billing decision as much as a hygiene one.",
    },
    {
      heading: "The tier where the feature you assumed lives",
      a: "Automation and A/B testing sit on the Business tier rather than the entry one, and so does removing Brevo's own logo from the footer of your emails. The headline price is therefore not the price of the product most people are evaluating, and this is the single most common way a Brevo comparison ends up wrong.",
      b: "One product, one shape. What you can do does not change much between plan bands, because the bands are about how many contacts you hold rather than which features are unlocked. That makes the comparison honest and it also means there is no upgrade path to buy your way out of a capability gap.",
    },
    {
      heading: "Everything that is not email",
      a: "SMS, WhatsApp, a chat widget and a light CRM on one account and one invoice. For a small business that would otherwise be assembling three vendors, that consolidation is the entire pitch and it is a real one. The depth of each piece is modest next to a specialist, which is usually acceptable and occasionally not.",
      b: "Email, and nothing else, on purpose. The day somebody decides a notification should also go by text, you are adding a vendor. That narrowness is why the product is pleasant to use and it is a genuine constraint rather than a roadmap gap.",
    },
    {
      heading: "Who the product was drawn around",
      a: "A small business of almost any kind — a shop, an agency, a clinic, a local service — which is why the surface is broad and the concepts are generic. Contacts, lists, campaigns, automations: a model that fits everybody reasonably and nobody perfectly.",
      b: "A software company with subscribers. Onboarding sequences, trial nudges, feature announcements, a monthly update. Because the assumed customer is that specific, a great deal of configuration simply does not exist and the defaults are usually right. A business outside that shape feels the absences immediately.",
    },
    {
      heading: "European data handling",
      a: "Brevo is a French company operating under EU regimes, which for organisations whose real requirement is about who they contract with and under which law is a shorter conversation than a region toggle inside an American platform. It does not replace reading the data processing agreement and it does shorten the meeting.",
      b: "Loops is a smaller, newer vendor and the residency answer is whatever its documentation currently states. If you have a hard requirement rather than a preference, verify it directly and get it in the agreement, because with a young company the honest position is that the answer may still be evolving.",
    },
    {
      heading: "Transactional mail on the same account",
      a: "Brevo has a transactional API and SMTP relay alongside the marketing product, so receipts and campaigns can share a vendor. Keep them on separate subdomains regardless, because sharing a vendor is sensible and sharing a sending reputation between bulk and transactional mail is not.",
      b: "Transactional and lifecycle live in the same tool against the same contact record, which is the consolidation small teams actually want: one view of everything a person received. It also means your password resets depend on your marketing tool being available, which is a trade worth stating out loud.",
    },
    {
      heading: "The developer surface",
      a: "A large API covering the whole suite, plus SMTP, plus SDKs, with the surface area and the occasional inconsistency of a product that has grown by addition over many years. Everything is reachable; some of it takes reading.",
      b: "A small, current API aimed at identifying contacts and sending events so the tool can react. The scope is deliberately compact and appropriate to the product. It is not a general-purpose sending platform and there is no pretence otherwise.",
    },
    {
      heading: "Deliverability posture",
      a: "Shared sending pools draw mixed reports, which is the ordinary condition of a platform serving an enormous number of small senders of wildly varying quality. Authenticate properly, warm deliberately, and consider whether your volume justifies dedicated sending, because on a broad shared pool your neighbours matter and you cannot audit them.",
      b: "A smaller, younger sending operation with a shorter public record and a customer base that skews toward software companies mailing their own users, which is a comparatively clean traffic profile. There is no widespread pattern of complaint about arbitrary account action, which counts for something in a category where sudden suspension is the dominant fear.",
    },
    {
      heading: "What happens when you outgrow it",
      a: "You outgrow Brevo when you need genuine behavioural journeys rather than list-and-trigger automations, or when the breadth stops compensating for the depth. The usual next step is a specialist lifecycle platform, with Brevo sometimes retained for SMS or the CRM.",
      b: "You outgrow Loops when conditions stop being expressible as filters, when you need per-tenant isolation, or when a legacy system needs an SMTP host. The ceilings arrive at a predictable size, which is an argument for choosing it deliberately as a stage rather than pretending it is a permanent answer.",
    },
    {
      heading: "What the free tier is actually for",
      a: "Getting a small business sending. Brevo's free allowance has a daily cap under it and is a genuine starting point rather than a demonstration, which is why so many small organisations run on it for months before ever paying. The visible cost is that the vendor's logo sits in the footer until you move up two tiers, which some businesses mind and many do not.",
      b: "Proving the shape fits before you commit. The free band holds a modest number of contacts with a monthly send allowance, enough to wire the integration, build an onboarding sequence and watch it run against real signups. Because the paid plans are bands of contacts rather than unlocked features, what you build on the free tier is what you keep — there is no discovery later that the thing you designed around was a paid capability.",
    },
    {
      heading: "Reporting, and the question you ask next quarter",
      a: "Campaign-level statistics with the usual opens, clicks, bounces and unsubscribes, plus per-contact activity, and enough filtering to answer most questions somebody asks in a Monday meeting. History is retained on the vendor's terms, and because the suite spans several channels the reporting is broad rather than deep on any one of them.",
      b: "Per-contact timelines showing what a person was sent and what they did, which is the shape a SaaS team actually asks questions in: did this user get the activation nudge, and did it work. Aggregate reporting is lighter than a mature platform's, and the honest answer to a long-range analytics question is to send the events back into your own warehouse and ask them there.",
    },
  ],
  pickA: [
    "You want email, SMS and a light CRM on one invoice rather than assembling three vendors.",
    "Your list is large and quiet, so paying per contact for people you rarely mail would be the worse deal.",
    "Contracting with a European company under European law shortens a conversation you have to have anyway.",
    "Campaigns are seasonal or occasional rather than a constant cadence to a small audience.",
  ],
  pickB: [
    "You are a software company and the emails that matter are onboarding, activation and product updates.",
    "You want lifecycle and transactional sends against one contact record in one tool.",
    "Not counting sends is worth more than not paying for dormant contacts.",
    "You would rather a tool with no unlockable tiers than a headline price that is not the price of the product you need.",
  ],
  faqs: [
    {
      question: "Is Brevo's entry plan enough?",
      answer:
        "Only if you are sending campaigns and nothing else. Automation and A/B testing live on the Business tier, and so does removing Brevo's logo from your email footer. If your plan involves any sequence that triggers on its own, or you object to another company's branding on mail from your domain, the tier you are actually buying is the higher one and the comparison should be priced there. Doing this arithmetic first is the single most useful step in evaluating Brevo.",
    },
    {
      question: "Which one is cheaper?",
      answer:
        "It depends entirely on the shape of your list, and the crossover is sharper than people expect. Model it with your own numbers: contacts multiplied by nothing on one side, sends multiplied by frequency on the other. A business with fifty thousand mostly dormant contacts mailing quarterly is far cheaper on send-based pricing. A business with three thousand engaged users receiving a weekly sequence is far cheaper on contact-based pricing. Neither vendor's pricing page will run your version of this.",
    },
    {
      question: "Can a non-engineer run either of these?",
      answer:
        "Yes, with different learning curves. Loops is obvious on first open because there are few concepts and one way to do most things. Brevo is broader and more generic, so the first campaign takes longer to find your way through, and once learned it does considerably more. If nobody on the team has time to learn a platform, that difference is worth more than any feature comparison in this list.",
    },
    {
      question: "How do I handle unsubscribes if I run two tools?",
      answer:
        "Decide explicitly which system holds the authoritative consent record and make the other read from it rather than maintaining its own view. Two systems each keeping their own opinion about who opted out is how somebody unsubscribes from a newsletter and then stops receiving order confirmations, which is a support problem and possibly a compliance one. Write the decision down, because this is exactly the piece of institutional knowledge that leaves with the person who set it up.",
    },
    {
      question: "What should I export before switching either direction?",
      answer:
        "Contacts with their consent status and opt-in timestamps first, because when somebody consented is the one record you cannot reconstruct and the one a regulator asks about. Then your suppression list, imported before the first production send rather than after. Templates and automations cross no paradigm boundary and have to be rebuilt by hand, so budget that as real work rather than a migration step. Finally, list every place your application calls the old API — the background job nobody remembers is what keeps sending from an account you thought you had closed.",
    },
  ],
};

const BREVO_VS_CUSTOMER_IO: VersusPage = {
  slug: "brevo-vs-customer-io",
  a: "brevo",
  b: "customer-io",
  title: "Brevo vs Customer.io",
  description:
    "A broad European suite for a small business against a behavioural messaging engine for a product team. The price floor alone resolves this for a lot of readers, and the data model resolves it for the rest.",
  search: {
    primaryQuery: "brevo or customer.io for lifecycle messaging",
    secondaryQueries: [
      "affordable alternative to customer.io for a small team",
      "when is a behavioural messaging platform worth it",
      "eu data residency for a messaging platform",
      "brevo automation versus a real journey builder",
    ],
    rationale:
      "These two appear on the same shortlist whenever a growing company asks what comes after basic campaigns, and the honest deciding factors — a monthly floor that excludes small companies, and an event pipeline somebody has to build — are absent from both vendors' own comparisons.",
  },
  intro:
    "There is a version of this comparison where you weigh features, and it is the wrong version. Start instead with two facts. Customer.io has a monthly floor that is more than many small businesses spend on software in total, and it does nothing useful until your application is emitting events about what users do. Brevo has neither the floor nor the prerequisite, and also cannot express the messaging a behavioural engine makes routine. Most readers are resolved by the first paragraph; the rest have a genuine decision.",
  dimensions: [
    {
      heading: "The floor, and who it excludes",
      a: "Brevo starts cheap and stays proportionate, priced on send volume with a free tier underneath. A business sending a few thousand emails a month can be a real customer, which is the whole point of the product and the reason it is recommended so widely to small teams.",
      b: "Customer.io has a monthly minimum before you send anything, and profiles are billed whether or not you message them. That floor is a deliberate filter: the product is sold to companies where somebody's job is lifecycle messaging. If it exceeds your entire marketing software budget, the comparison is already decided and no feature will change that.",
    },
    {
      heading: "What you feed it before it works",
      a: "A contact import with fields you define. You are sending a campaign the same afternoon, and any behavioural attribute you want later is a field you populate from your own pipeline. Low floor, low ceiling, and no engineering dependency to get started.",
      b: "A live event stream from your product. Customer.io expects your application to identify people and emit events as they act, and until that exists it is an expensive address book. Budget a week or two for a first schema and a permanent small tax afterwards, because each new message idea tends to need an event that does not exist yet.",
    },
    {
      heading: "How much logic a sequence can express",
      a: "Automations are list-and-trigger shaped: join a list and get a welcome series, a date-based sequence, a simple condition. That covers a great deal of ordinary marketing and starts to feel like fighting the tool around the third condition. The limit is the data model rather than the builder — a contact with fields cannot easily represent a sequence of things that happened.",
      b: "A workflow canvas with triggers, delays, branches, attribute updates and webhook actions, able to express logic like wait three days, check whether setup finished, branch, send something different, and exit the whole journey if they upgraded. It is the reason the product exists and it takes real learning to use well.",
    },
    {
      heading: "Channels, and whether they are one sequence",
      a: "Email, SMS, WhatsApp and a chat widget on one account and one invoice, which is genuine consolidation for a small business assembling a stack. They are largely separate capabilities sharing a vendor rather than steps in a single orchestrated journey, and for most Brevo customers that distinction does not matter.",
      b: "Email, push, SMS, in-app messages and webhooks as steps inside the same workflow, so a journey can decide that this message belongs in the product rather than the inbox. For a mobile product that is the reason to buy: coordinating those channels from separate tools means nobody can see the whole sequence.",
    },
    {
      heading: "Where the data sits",
      a: "Brevo is a French company operating under EU regimes, which is the shortest possible answer when the requirement is about who you contract with and under which law rather than about a configurable region. It does not replace reading the processing agreement and it does end the argument faster.",
      b: "Customer.io offers a choice of data region, selected when the account or workspace is created, which is the more configurable answer and the one with a footgun attached: the selection is made early, by whoever set the account up, and is not something you casually change later. Confirm it before the first import rather than during a compliance review.",
    },
    {
      heading: "Not messaging somebody five times in an hour",
      a: "The risk is small because the engine is simple. A scheduled campaign to a list does not fire repeatedly because a user clicked around, so ordinary suppression lists and unsubscribe handling are adequate to the shape of sending the product does.",
      b: "Frequency caps, global suppressions and workflow entry rules exist because a behavioural engine will cheerfully message somebody repeatedly when several events fire together. These controls are setup work rather than polish, and skipping them is one of the fastest ways to damage a sending reputation with a tool that is otherwise working exactly as configured.",
    },
    {
      heading: "Testing before it reaches a customer",
      a: "A test send and a careful eye, which is the normal standard for campaign tools and is proportionate to the risk. A mistimed campaign is embarrassing; it is not the same category of accident as a broken journey firing at everybody.",
      b: "Separate workspaces give you a genuine non-production environment with its own people, events and campaigns, so a whole journey can be exercised end to end before it touches anybody real. For a product where a mistake means thousands of wrong messages in minutes, that boundary is not a luxury.",
    },
    {
      heading: "Who is expected to own it",
      a: "Whoever has time — an owner, an office manager, a part-time marketer who also does three other jobs. The product is designed so that no specialist is required to get a competent campaign out, and that accessibility is a large part of why it is so widely used by businesses that have no marketing function at all. The cost of designing for that person is that the tool never gets much deeper than they need.",
      b: "A lifecycle or growth specialist, with engineering support behind them for the event schema. Naming that person before you buy is the most useful thing you can do, because without an owner an expensive workflow canvas becomes an expensive place to keep three campaigns somebody built once and nobody has touched since.",
    },
    {
      heading: "Transactional mail",
      a: "There is a transactional API and an SMTP relay alongside the marketing product, so receipts and campaigns can share a vendor and an invoice. Use separate subdomains anyway: sharing a vendor is sensible, sharing a reputation between bulk and transactional mail is not.",
      b: "A competent transactional API, and the usual arrangement is to route transactional sends through the platform too so one system holds the complete record of what a person received. Support seeing everything on one timeline is a real benefit, and it does mean your receipts depend on your messaging platform.",
    },
    {
      heading: "How much of your first quarter goes into setup",
      a: "Days. Import a contact file, verify a sending domain, build a campaign, send it. The speed is not a shortcut, it is a consequence of the product asking very little of you, and it means a small business can have working marketing email before anybody has scheduled a kickoff meeting about it.",
      b: "A quarter, honestly counted, and the software is the smaller half of it. You are defining an event schema, instrumenting the application, agreeing what a profile means, building the first journeys and then rebuilding them once you see what the data actually looks like. Teams that treat this as a tool purchase rather than a project are the ones who conclude two quarters later that the platform did not work for them, when what did not work was the absence of an owner.",
    },
  ],
  pickA: [
    "Your budget for messaging software is smaller than the other option's monthly floor.",
    "Nobody is going to instrument the product with events, so a behavioural engine would sit unused.",
    "You want email, SMS and a light CRM on one invoice rather than assembling a stack.",
    "Contracting with a European company under European law is the requirement rather than a configurable region.",
  ],
  pickB: [
    "Your most valuable messages depend on what somebody did in your product, and you will instrument it.",
    "Push or in-app messages need to be steps in the same journey as the email.",
    "You want a real non-production workspace to test a journey end to end before customers see it.",
    "Somebody owns lifecycle messaging as an actual job, so a powerful canvas will be used rather than admired.",
  ],
  faqs: [
    {
      question: "How do I know when I have outgrown campaign-based tools?",
      answer:
        "Write down the three messages you most want to send and the exact condition each depends on. If they are properties and simple triggers — joined this list, signed up in March, bought last week — a campaign tool covers them. If any condition contains a time window plus a negation, such as did X but not Y within fourteen days, you are describing a behavioural journey. That single test is more reliable than any feature matrix, and it also tells you which events you would need to emit.",
    },
    {
      question: "Is the automation on Brevo's entry plan?",
      answer:
        "No. Automation and A/B testing sit on the Business tier, and so does removing Brevo's own logo from the footer of your emails. That makes the headline price not the price of the product most evaluators actually need, and it is the most common reason a Brevo comparison turns out to have been wrong. Price the tier that contains the features you are counting on before you compare it with anything.",
    },
    {
      question: "How much engineering time does Customer.io really need?",
      answer:
        "A week or two for a first useful schema, then a permanent small tax. The initial work is identifying users and emitting the dozen events your messaging depends on — signed up, finished onboarding, invited a teammate, upgraded, cancelled. The ongoing part is what gets underestimated: marketing velocity becomes coupled to the engineering backlog unless somebody keeps the event schema ahead of the ideas, which is an organisational commitment rather than a project.",
    },
    {
      question: "Can I run both?",
      answer:
        "You can, and it is usually a transitional state rather than a destination — campaigns and SMS staying on the cheaper suite while product-triggered journeys move to the behavioural platform. If you do, use separate sending subdomains so the reputations are independent, and decide explicitly which system holds the authoritative consent record. Two systems each with their own view of who unsubscribed is how somebody opts out of marketing and then stops receiving something they needed.",
    },
    {
      question: "Which one is better for deliverability?",
      answer:
        "Neither, inherently, and both give you new ways to hurt yourself. Brevo's risk is a broad shared pool full of small senders of varying quality whom you cannot audit. Customer.io's risk is that a badly scoped trigger reaches a large audience very quickly, which is exactly why its frequency controls exist. What actually decides your placement is the same on both: authenticated domains with a DMARC policy, bulk mail on a separate subdomain from the mail your product depends on, prompt suppression handling, and not mailing people who stopped engaging a year ago.",
    },
  ],
};

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
  AMAZON_SES_VS_SENDGRID,
  AMAZON_SES_VS_POSTMARK,
  AMAZON_SES_VS_MAILGUN,
  RESEND_VS_SENDGRID,
  MAILGUN_VS_RESEND,
  POSTMARK_VS_SENDGRID,
  AMAZON_SES_VS_BREVO,
  AMAZON_SES_VS_KLAVIYO,
  AMAZON_SES_VS_CUSTOMER_IO,
  AMAZON_SES_VS_LOOPS,
  BREVO_VS_RESEND,
  CUSTOMER_IO_VS_RESEND,
  KLAVIYO_VS_RESEND,
  AMAZON_SES_VS_MAILERSEND,
  MAILERSEND_VS_RESEND,
  RESEND_VS_SMTP2GO,
  MANDRILL_VS_RESEND,
  MAILERSEND_VS_POSTMARK,
  POSTMARK_VS_SMTP2GO,
  MAILERSEND_VS_MAILGUN,
  MAILGUN_VS_SMTP2GO,
  MAILGUN_VS_MANDRILL,
  KLAVIYO_VS_SENDGRID,
  LOOPS_VS_SENDGRID,
  CUSTOMER_IO_VS_SENDGRID,
  KLAVIYO_VS_LOOPS,
  BREVO_VS_LOOPS,
  BREVO_VS_CUSTOMER_IO,
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
