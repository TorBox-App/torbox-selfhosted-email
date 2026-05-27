import { Badge } from "@wraps/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Code2,
  Database,
  FileCheck,
  Inbox,
  KeyRound,
  Mail,
  Network,
  Send,
  Server,
  Shield,
  User,
  Zap,
} from "lucide-react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  author: string;
  featured?: boolean;
  icon?: React.ReactNode;
  image?: string;
};

const posts: BlogPost[] = [
  {
    slug: "scale-plan-enterprise-features",
    title: "SSO, Behavioral Segments, and What's Next: Inside the Scale Plan",
    description:
      "Every Scale-exclusive feature explained — SSO + SCIM, behavioral segments, unlimited AWS accounts, 1-year history — plus a look at audit trail and custom retention coming next.",
    category: "Product",
    date: "May 2026",
    readTime: "7 min read",
    author: "Wraps Team",
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    slug: "vibe-coding-email",
    title: "Sending Email from AI-Built Apps (Lovable, Bolt, Base44, Replit)",
    description:
      "Built your app with AI? Here's how to add email without putting AWS credentials in your code. One CLI command, one API key, any platform.",
    category: "Guide",
    date: "May 2026",
    readTime: "5 min read",
    author: "Wraps Team",
    icon: <Send className="h-6 w-6" />,
  },
  {
    slug: "lovable-send-email",
    title: "How to Send Email from Your Lovable App",
    description:
      "Deploy one CLI command, add two env vars to Lovable via Supabase, and send email with plain fetch. AWS credentials never touch your app.",
    category: "Guide",
    date: "May 2026",
    readTime: "8 min read",
    author: "Wraps Team",
    icon: <Mail className="h-6 w-6" />,
  },
  {
    slug: "bolt-send-email",
    title: "How to Send Email from Your Bolt.new App",
    description:
      "Deploy one CLI command, add two server env vars to Bolt, and send email from a server route. AWS credentials stay on your machine.",
    category: "Guide",
    date: "May 2026",
    readTime: "8 min read",
    author: "Wraps Team",
    icon: <Mail className="h-6 w-6" />,
  },
  {
    slug: "base44-send-email",
    title: "How to Send Email from Your Base44 App",
    description:
      "Deploy one CLI command, add two server secrets to Base44, and send email from a backend function. AWS credentials never reach browser code.",
    category: "Guide",
    date: "May 2026",
    readTime: "8 min read",
    author: "Wraps Team",
    icon: <Mail className="h-6 w-6" />,
  },
  {
    slug: "replit-send-email",
    title: "How to Send Email from Your Replit App",
    description:
      "Deploy one CLI command, add two Replit Secrets, and send email from a server route. AWS credentials stay on your local machine.",
    category: "Guide",
    date: "May 2026",
    readTime: "8 min read",
    author: "Wraps Team",
    icon: <Mail className="h-6 w-6" />,
  },
  {
    slug: "signed-reply-threading",
    title: "Signed Reply-To for Agents",
    description:
      "Cryptographic conversation correlation for email agents. HMAC-signed reply-to addresses verified in a Lambda running in your AWS account — the signing secret never leaves your cloud.",
    category: "Engineering",
    date: "April 2026",
    readTime: "6 min read",
    author: "Wraps Team",
    featured: true,
    icon: <KeyRound className="h-6 w-6" />,
  },
  {
    slug: "yc-w26-email-security-audit",
    title:
      "We Graded 200 YC W26 Companies on Email Security. Only 23% Got an A.",
    description:
      "We scanned every YC W26 company for SPF, DKIM, and DMARC using public DNS records. 70% don't enforce DMARC. Full data and methodology.",
    category: "Research",
    date: "March 2026",
    readTime: "5 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Shield className="h-6 w-6" />,
    image: "/blog/yc-w26-email-security-audit.webp",
  },
  {
    slug: "supabase-email-guide",
    title: "4 Email Flows Your Supabase App Needs Before Going Live",
    description:
      "Supabase handles auth and database. Email beyond magic links? That's on you. The 4 flows every production Supabase app needs — auth, transactional, broadcasts, automations — and how to set each one up.",
    category: "Guide",
    date: "March 2026",
    readTime: "12 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Database className="h-6 w-6" />,
    image: "/blog/supabase-email-guide.webp",
  },
  {
    slug: "how-email-works",
    title: "How Email Actually Works",
    description:
      "You click Send. What happens in the next 3 seconds? An interactive journey through SMTP handshakes, DNS lookups, relay hops, and authentication — with a terminal you can type in.",
    category: "Engineering",
    date: "March 2026",
    readTime: "20 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Mail className="h-6 w-6" />,
    image: "/blog/how-email-works.webp",
  },
  {
    slug: "email-templates-react-workflows-typescript",
    title: "Email Templates as React, Workflows as TypeScript",
    description:
      "Write email templates as React components and automation workflows as TypeScript. Version-controlled, type-safe, code-reviewable email infrastructure.",
    category: "Developer Experience",
    date: "February 2026",
    readTime: "10 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Code2 className="h-6 w-6" />,
    image: "/blog/wraps-templates-and-workflows-as-code.webp",
  },
  {
    slug: "inbound-email-guide",
    title: "Receive Emails in Your AWS Account with Wraps",
    description:
      "Build support inboxes, automate order processing, and create email-to-ticket workflows. All in your AWS account with EventBridge webhooks.",
    category: "Engineering",
    date: "February 2026",
    readTime: "8 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Inbox className="h-6 w-6" />,
    image: "/blog/wraps-inbound.webp",
  },
  {
    slug: "your-dmarc-policy-is-useless",
    title: "Your DMARC policy is useless",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none—which tells receivers not to enforce. An interactive deep-dive into email authentication.",
    category: "Security",
    date: "January 2026",
    readTime: "12 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Shield className="h-6 w-6" />,
    image: "/blog/DMARC_EXPLOITED.webp",
  },
  {
    slug: "spf-guide",
    title: "The SPF 10-Lookup Limit: Why Your Email Might Be Failing",
    description:
      "SPF looks simple until you hit the 10-lookup limit. Learn how lookups are counted, which providers cost the most, and how to stay under the limit.",
    category: "Guide",
    date: "January 2026",
    readTime: "10 min read",
    author: "Wraps Team",
    icon: <Server className="h-6 w-6" />,
  },
  {
    slug: "ses-sandbox-guide",
    title: "How to Get Out of Amazon SES Sandbox",
    description:
      "The complete guide to SES production access approval. Interactive checklists, request templates, and everything you need to escape the sandbox on your first try.",
    category: "Guide",
    date: "January 2026",
    readTime: "15 min read",
    author: "Wraps Team",
    icon: <FileCheck className="h-6 w-6" />,
    image: "/blog/get-out-of-sandbox.webp",
  },
  {
    slug: "ses-production-architecture",
    title: "AWS SES Production Architecture Guide",
    description:
      "Everything you need to deploy SES at scale: dedicated IPs, bounce handling, rate limiting, configuration sets, and the patterns that protect your sender reputation.",
    category: "Architecture",
    date: "January 2026",
    readTime: "15 min read",
    author: "Wraps Team",
    icon: <Network className="h-6 w-6" />,
  },
  {
    slug: "aws-ses-simplified",
    title: "AWS SES Setup Simplified: From Hours to Minutes",
    description:
      "What should be a simple 'send email from my app' turns into a multi-day odyssey. See how one command deploys production-ready SES infrastructure.",
    category: "Engineering",
    date: "January 2026",
    readTime: "10 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Zap className="h-6 w-6" />,
    image: "/blog/aws-ses-simplified.webp",
  },
  {
    slug: "nextjs-vercel-ses-guide",
    title: "Next.js + Vercel + AWS SES: The Complete Email Guide",
    description:
      "Deploy production-ready email infrastructure to your AWS account in minutes. No stored credentials, zero access keys.",
    category: "Guide",
    date: "January 2026",
    readTime: "12 min read",
    author: "Wraps Team",
    featured: true,
    icon: <Server className="h-6 w-6" />,
    image: "/blog/nextjs-vercel-ses-guide.webp",
  },
];

export default function BlogContent() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      <main className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Interactive Articles
          </Badge>
          <h1 className="mb-4 font-bold text-4xl tracking-tight sm:text-5xl">
            The Wraps Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Deep dives into email infrastructure, security, and developer
            experience. Interactive content that makes complex topics tangible.
          </p>
        </div>

        {/* Featured Post */}
        {posts.filter((p) => p.featured).length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              Featured
            </h2>
            <div className="space-y-6">
              {posts
                .filter((p) => p.featured)
                .map((post, index) => (
                  <a
                    className="group block"
                    href={`/blog/${post.slug}`}
                    key={post.slug}
                  >
                    <Card className="flex flex-col overflow-hidden py-0 transition-all hover:border-primary/50 hover:shadow-lg md:h-72 md:flex-row">
                      {post.image && (
                        <div
                          className={`md:h-full md:shrink-0 ${index % 2 !== 0 ? "md:order-2" : ""}`}
                        >
                          <img
                            alt={post.title}
                            className={`aspect-video w-full object-cover ${
                              index % 2 !== 0
                                ? "rounded-t-xl md:rounded-r-xl md:rounded-tl-none md:h-full md:w-auto"
                                : "rounded-t-xl md:rounded-l-xl md:rounded-tr-none md:h-full md:w-auto"
                            }`}
                            height={630}
                            src={post.image}
                            width={1200}
                          />
                        </div>
                      )}
                      <div
                        className={`flex flex-1 flex-col ${post.image && index % 2 !== 0 ? "md:order-1" : ""}`}
                      >
                        <CardHeader className="pt-4">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge className="text-xs" variant="secondary">
                              {post.category}
                            </Badge>
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              <User className="h-3 w-3" />
                              {post.author}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Calendar className="h-3 w-3" />
                              {post.date}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              <Clock className="h-3 w-3" />
                              {post.readTime}
                            </span>
                          </div>
                          <CardTitle className="text-lg transition-colors group-hover:text-primary">
                            {post.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-3 max-w-prose text-pretty text-md">
                            {post.description}
                          </CardDescription>
                        </CardHeader>
                        <div className="px-6 pt-2.5 pb-4">
                          <span className="inline-flex items-center gap-2 font-medium text-primary text-sm">
                            Read article{" "}
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* All Posts */}
        {posts.filter((p) => !p.featured).length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              All Articles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts
                .filter((p) => !p.featured)
                .map((post) => (
                  <a
                    className="group block"
                    href={`/blog/${post.slug}`}
                    key={post.slug}
                  >
                    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                          <Badge variant="secondary">{post.category}</Badge>
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <User className="h-3 w-3" />
                            {post.author}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {post.readTime}
                          </span>
                        </div>
                        <CardTitle className="transition-colors group-hover:text-primary">
                          {post.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="mb-4">
                          {post.description}
                        </CardDescription>
                        <span className="inline-flex items-center gap-2 font-medium text-primary text-sm">
                          Read more{" "}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      </CardContent>
                    </Card>
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* Coming Soon */}
        <section className="mt-24 text-center">
          <div className="mx-auto max-w-xl rounded-xl border border-dashed bg-muted/30 p-8">
            <h3 className="mb-2 font-semibold text-lg">More coming soon</h3>
            <p className="text-muted-foreground text-sm">
              We're working on more interactive deep-dives into email
              infrastructure, DNS, and developer tooling. Stay tuned.
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
