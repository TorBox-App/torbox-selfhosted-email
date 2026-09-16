import { Lightbulb } from "lucide-react";
import Image from "next/image";
import { releases, TAG_LABELS } from "../releases";

/**
 * Entries carry ISO dates so they sort and can serve as a sitemap lastmod.
 * The page shows month and year, which is the precision the 63 migrated
 * entries actually have. Switching to day precision later is a change to this
 * one formatter.
 */
const RELEASE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const formatReleaseDate = (iso: string): string =>
  RELEASE_DATE.format(new Date(`${iso}T00:00:00Z`));

export function ChangelogReleasesSection() {
  const ordered = [...releases].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="py-12 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Releases with timeline */}
          <div className="relative">
            {/* Timeline line - contained to releases section */}
            <div className="absolute top-0 bottom-0 left-[24px] w-[1.5px] bg-border" />

            <div className="space-y-12">
              {ordered.map((release, index) => {
                const Icon = release.icon;
                return (
                  <div className="relative pl-16" key={release.slug}>
                    {/* Timeline dot - outer circle */}
                    <div className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-background">
                      {/* Inner node — orange only marks the latest release */}
                      <div
                        className={
                          index === 0
                            ? "flex size-10 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand"
                            : "flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                        }
                      >
                        <Icon className="size-5" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      {/* Header */}
                      <div className="border-border border-b bg-muted/30 px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {release.tags.map((tag) => (
                            <span
                              className="rounded-full border border-border px-2 py-0.5 font-mono text-3xs text-muted-foreground uppercase tracking-eyebrow"
                              key={tag}
                            >
                              {TAG_LABELS[tag]}
                            </span>
                          ))}
                          <span className="text-muted-foreground text-sm">
                            {formatReleaseDate(release.date)}
                          </span>
                          {index === 0 && (
                            <span className="rounded-full border border-brand/40 px-2 py-0.5 font-mono text-3xs text-brand uppercase tracking-eyebrow">
                              Latest
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 font-heading font-semibold text-lg tracking-tight">
                          {release.title}
                        </h3>
                        {release.summary ? (
                          <p className="mt-1 text-muted-foreground text-sm">
                            {release.summary}
                          </p>
                        ) : null}
                      </div>

                      {/* Figure, when the release has one */}
                      {release.media ? (
                        <Image
                          alt={release.media.alt}
                          className="block w-full border-border border-b"
                          height={release.media.height}
                          /* An animated GIF goes through the optimizer as a
                             single still frame. Nothing else here needs it. */
                          src={release.media.src}
                          unoptimized={release.media.src.endsWith(".gif")}
                          width={release.media.width}
                        />
                      ) : null}

                      {/* Items */}
                      <div className="p-6">
                        <ul className="space-y-2">
                          {release.items.map((item, itemIndex) => (
                            <li
                              className="flex items-start gap-3 text-sm"
                              key={itemIndex}
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                        {release.alsoFixed && release.alsoFixed.length > 0 ? (
                          <details className="mt-4 border-border border-t pt-4">
                            <summary className="cursor-pointer text-muted-foreground text-sm">
                              Also fixed ({release.alsoFixed.length})
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {release.alsoFixed.map((fix) => (
                                <li
                                  className="text-muted-foreground text-sm"
                                  key={fix}
                                >
                                  {fix}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                        {release.versions && release.versions.length > 0 ? (
                          <p className="mt-4 font-mono text-2xs text-muted-foreground">
                            {release.versions.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Origin card - where it all began */}
          <div className="relative mt-12 pl-16">
            {/* Line connecting from releases to lightbulb center */}
            <div className="-top-12 absolute left-[24px] h-[72px] w-[1.5px] bg-border" />

            {/* Timeline terminator dot - covers end of line */}
            <div className="absolute left-0 flex size-12 items-center justify-center rounded-full bg-background">
              <div className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <Lightbulb className="size-5" />
              </div>
            </div>

            {/* Content */}
            <div className="overflow-hidden rounded-xl border border-border border-dashed bg-muted/20">
              <div className="px-6 py-5">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-sm">
                    October 30th, 2025
                  </span>
                </div>
                <h3 className="mt-2 font-heading font-semibold text-lg tracking-tight">
                  The Idea
                </h3>
                <p className="mt-2 text-muted-foreground text-sm">
                  What if deploying email infrastructure to AWS was as simple as
                  one command? No vendor lock-in, no markup on AWS pricing, just
                  great developer experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
