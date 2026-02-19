import { Cloud, Github, Lock, Package, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { CardDecorator } from "@/components/ui/card-decorator";

export const metadata: Metadata = {
  title: "About Wraps - Our Mission and Values",
  description:
    "Wraps brings SaaS-quality developer experience to AWS infrastructure. Deploy to your own account, pay AWS directly, and keep full control.",
  openGraph: {
    title: "About Wraps | Wraps",
    description:
      "Wraps brings SaaS-quality developer experience to AWS infrastructure. Deploy to your own account, pay AWS directly, and keep full control.",
    type: "website",
    url: "https://wraps.dev/about",
  },
  twitter: {
    title: "About Wraps | Wraps",
    description:
      "Wraps brings SaaS-quality developer experience to AWS infrastructure.",
  },
  alternates: {
    canonical: "https://wraps.dev/about",
  },
};

const values = [
  {
    icon: Package,
    title: "Infrastructure Wrappers",
    description:
      "We wrap AWS services in beautiful developer experiences. Same power, 10x better DX.",
  },
  {
    icon: Lock,
    title: "Zero Lock-In",
    description:
      "Infrastructure stays in your AWS account. Cancel anytime\u2014your infrastructure keeps running. Your choice, always.",
  },
  {
    icon: Cloud,
    title: "Your AWS Account",
    description:
      "Deploy to your account, pay AWS directly. You own the infrastructure and data. We just make it easy.",
  },
  {
    icon: Zap,
    title: "SaaS-Quality DX",
    description:
      "One-command deployments, beautiful dashboards, clean APIs. AWS power with delightful developer experience.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      <main className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h1 className="mb-6 font-bold text-4xl tracking-tight sm:text-5xl">
            About Wraps
          </h1>
          <p className="text-lg text-muted-foreground">
            We believe developers shouldn&apos;t have to choose between AWS
            economics and great developer experience. Wraps brings SaaS-quality
            DX to AWS infrastructure&mdash;so you can deploy to your own
            account, pay AWS directly, and keep full control.
          </p>
        </div>

        <section className="mb-16">
          <h2 className="mb-8 font-bold text-2xl tracking-tight">
            Our Mission
          </h2>
          <div className="space-y-4 text-foreground/80 text-lg leading-relaxed">
            <p>
              Cloud infrastructure is powerful but painful. Setting up email
              sending with AWS SES takes hours of IAM policies, DNS records, and
              event pipelines. SMS requires navigating registration processes
              and compliance. CDN setup means certificate management and
              distribution configuration.
            </p>
            <p>
              Wraps exists to eliminate that pain. One command deploys
              production-ready infrastructure to your AWS account. You get the
              full power and pricing of AWS with the simplicity developers
              expect from modern tools.
            </p>
            <p>
              We&apos;re not another SaaS middleman. We don&apos;t store your
              credentials, don&apos;t touch your data, and don&apos;t mark up
              AWS pricing. Your infrastructure runs in your account, and
              it&apos;ll keep running even if you stop using Wraps.
            </p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 font-bold text-2xl tracking-tight">
            What We Believe
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
            {values.map((value) => (
              <Card className="py-2 shadow-xs" key={value.title}>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center">
                    <CardDecorator>
                      <value.icon aria-hidden className="h-6 w-6" />
                    </CardDecorator>
                    <h3 className="mt-6 text-balance font-medium">
                      {value.title}
                    </h3>
                    <p className="mt-3 text-muted-foreground text-sm">
                      {value.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 font-bold text-2xl tracking-tight">
            Open Source
          </h2>
          <div className="space-y-4 text-foreground/80 text-lg leading-relaxed">
            <p>
              Wraps is open source under the AGPLv3 license. Our CLI, SDK, and
              infrastructure code are all publicly available. You can inspect
              every resource we deploy, audit our security practices, and
              contribute improvements.
            </p>
            <p>
              We believe infrastructure tooling should be transparent. When you
              run{" "}
              <code className="rounded bg-muted px-2 py-0.5 text-sm">
                wraps email init
              </code>
              , you should know exactly what gets created in your AWS account.
            </p>
          </div>
          <div className="mt-6 flex gap-4">
            <a
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-colors hover:bg-accent"
              href="https://github.com/wraps-team/wraps"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Github aria-hidden className="h-4 w-4" />
              View on GitHub
            </a>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-colors hover:bg-accent"
              href="/docs"
            >
              Read the Docs
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-8 font-bold text-2xl tracking-tight">Company</h2>
          <div className="text-foreground/80 text-lg leading-relaxed">
            <p>
              Wraps is a product of{" "}
              <strong className="text-foreground">FlatironKids LLC</strong>, a
              company registered in the State of Colorado, United States.
            </p>
          </div>
          <div className="mt-6 flex gap-4">
            <Link
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-colors hover:bg-accent"
              href="/contact"
            >
              Contact Us
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-colors hover:bg-accent"
              href="/privacy"
            >
              Privacy Policy
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
