import Image from "next/image";
import Link from "next/link";
import { assetUrl } from "@/lib/utils";

export function VisualSection() {
  return (
    <section className="py-24 border-y bg-muted/30" id="visual">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-12 text-center animate-fade-in-up">
          <h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
            Or don't write a single line of code.
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Drag-and-drop template builder. Visual workflow canvas. AI that
            generates both from a prompt. Use code when you want precision. Use
            the dashboard when you want speed.
          </p>
        </div>

        {/* Three capabilities */}
        <div className="grid gap-10 md:grid-cols-3 animate-fade-in-up animation-delay-100">
          {/* Template Editor */}
          <Link className="space-y-4 group" href="/platform#templates">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow group-hover:shadow-md">
              {/* Light mode image */}
              <Image
                alt="Template editor with AI chat panel"
                className="block w-full object-cover dark:hidden"
                height={400}
                src={assetUrl("template-editor-full-light.webp")}
                width={600}
              />
              {/* Dark mode image */}
              <Image
                alt="Template editor with AI chat panel"
                className="hidden w-full object-cover dark:block"
                height={400}
                src={assetUrl("template-editor-full-dark.webp")}
                width={600}
              />
            </div>
            <h3 className="font-semibold text-lg group-hover:text-orange-500 transition-colors">Template Editor</h3>
            <p className="text-sm text-muted-foreground">
              20+ drag-and-drop blocks. Brand kits. AI chat that knows your
              colors, fonts, and variables. Edit a subject line without opening
              your IDE.
            </p>
          </Link>

          {/* Workflow Builder */}
          <Link className="space-y-4 group" href="/platform#automations">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow group-hover:shadow-md">
              {/* Light mode image */}
              <Image
                alt="Workflow builder canvas with branching"
                className="block w-full object-cover dark:hidden"
                height={400}
                src="/automations-builder-light.avif"
                width={600}
              />
              {/* Dark mode image */}
              <Image
                alt="Workflow builder canvas with branching"
                className="hidden w-full object-cover dark:block"
                height={400}
                src="/automations-builder-dark.avif"
                width={600}
              />
            </div>
            <h3 className="font-semibold text-lg group-hover:text-orange-500 transition-colors">Workflow Builder</h3>
            <p className="text-sm text-muted-foreground">
              React Flow canvas. Drag nodes, draw connections, configure
              triggers. Or type "create a welcome series with a 1-day delay"
              and let AI build it.
            </p>
          </Link>

          {/* Broadcasts */}
          <Link className="space-y-4 group" href="/platform#broadcasts">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow group-hover:shadow-md">
              {/* Light mode image */}
              <Image
                alt="Broadcast compose view with segments"
                className="block w-full object-cover dark:hidden"
                height={400}
                src={assetUrl("broadcasts-compose-light.webp")}
                width={600}
              />
              {/* Dark mode image */}
              <Image
                alt="Broadcast compose view with segments"
                className="hidden w-full object-cover dark:block"
                height={400}
                src={assetUrl("broadcasts-compose-dark.webp")}
                width={600}
              />
            </div>
            <h3 className="font-semibold text-lg group-hover:text-orange-500 transition-colors">Broadcasts</h3>
            <p className="text-sm text-muted-foreground">
              Newsletters, announcements, campaigns. Target with segments.
              Schedule sends. No code required.
            </p>
          </Link>
        </div>

        {/* Section closer */}
        <p className="mt-12 text-center text-lg text-muted-foreground animate-fade-in-up animation-delay-200">
          Code and visual. Not code or visual. Your team picks the right tool
          for each job.
        </p>
      </div>
    </section>
  );
}
