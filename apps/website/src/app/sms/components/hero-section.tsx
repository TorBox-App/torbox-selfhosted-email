import { DotPattern } from "@wraps/ui/components/dot-pattern";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SmsHeroSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background to-background/80 pt-20 pb-16 sm:pt-32">
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" fadeStyle="ellipse" size="md" />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Main Headline */}
          <h1 className="mb-6 text-pretty font-bold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
            AWS SMS, simplified.
          </h1>

          {/* Subheading */}
          <p className="mx-auto mb-10 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            Deploy self-hosted SMS infrastructure to your AWS account. Toll-free
            first, TypeScript SDK, zero vendor lock-in.
          </p>

          {/* CTA Buttons */}
          <div className="mx-auto mb-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              <Link href="/docs/quickstart/sms">
                Get Started
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs/cli-reference/sms">
                <BookOpen className="mr-1.5 size-4" />
                CLI Reference
              </Link>
            </Button>
          </div>

          {/* Code Preview */}
          <div className="mx-auto max-w-xl">
            <div className="overflow-hidden rounded-xl border-2 shadow-lg">
              {/* Code header */}
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500" />
                  <div className="size-3 rounded-full bg-yellow-500" />
                  <div className="size-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 font-medium text-muted-foreground text-xs">
                  index.ts
                </span>
              </div>
              {/* Code content */}
              <div className="bg-[#121314] p-6 text-left">
                <pre className="overflow-x-auto font-mono text-sm">
                  <code>
                    <span className="text-purple-400">import</span>
                    <span className="text-gray-300"> {"{ "}</span>
                    <span className="text-blue-400">Wraps</span>
                    <span className="text-gray-300">{" }"} </span>
                    <span className="text-purple-400">from</span>
                    <span className="text-green-400"> '@wraps.dev/sms'</span>
                    <span className="text-gray-300">;</span>
                    {"\n\n"}
                    <span className="text-purple-400">const</span>
                    <span className="text-blue-300"> wraps</span>
                    <span className="text-gray-300"> = </span>
                    <span className="text-purple-400">new</span>
                    <span className="text-yellow-300"> Wraps</span>
                    <span className="text-gray-300">();</span>
                    {"\n\n"}
                    <span className="text-purple-400">await</span>
                    <span className="text-blue-300"> wraps</span>
                    <span className="text-gray-300">.sms.</span>
                    <span className="text-yellow-300">send</span>
                    <span className="text-gray-300">({"{"}</span>
                    {"\n"}
                    <span className="text-blue-300"> to</span>
                    <span className="text-gray-300">: </span>
                    <span className="text-green-400">'+14155551234'</span>
                    <span className="text-gray-300">,</span>
                    {"\n"}
                    <span className="text-blue-300"> message</span>
                    <span className="text-gray-300">: </span>
                    <span className="text-green-400">
                      'Your code is 123456'
                    </span>
                    <span className="text-gray-300">,</span>
                    {"\n"}
                    <span className="text-gray-300">{"}"});</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
