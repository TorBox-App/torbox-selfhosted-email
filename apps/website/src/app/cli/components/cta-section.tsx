import { Button } from "@wraps/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CliCtaSection() {
  return (
    <section className="border-border border-t py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <p className="mb-6 font-heading font-semibold text-2xl tracking-tight sm:text-3xl">
          Free forever.{" "}
          <span className="text-muted-foreground">You only pay AWS.</span>
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="bg-orange-500 text-white hover:bg-orange-600"
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
