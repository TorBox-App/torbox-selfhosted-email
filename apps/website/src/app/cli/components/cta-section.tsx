"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CliCtaSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-6 text-2xl font-medium tracking-tight sm:text-3xl">
          Free forever.{" "}
          <span className="text-muted-foreground">You only pay AWS.</span>
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="bg-green-500 text-white hover:bg-green-600"
            size="lg"
          >
            <Link href="/docs/quickstart">
              Read the Quickstart
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/platform">Explore the Platform</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
