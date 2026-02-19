import { History } from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";
import { Badge } from "@/components/ui/badge";

export function ChangelogHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
            <Badge
              className="border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-600 dark:text-blue-400"
              variant="outline"
            >
              <History className="mr-2 size-4" />
              Changelog
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            What's new
            <br />
            <span className="text-blue-500">in Wraps.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Stay up to date with the latest features, improvements, and fixes
            across the Wraps CLI, SDK, and Dashboard.
          </p>
        </div>
      </div>
    </section>
  );
}
