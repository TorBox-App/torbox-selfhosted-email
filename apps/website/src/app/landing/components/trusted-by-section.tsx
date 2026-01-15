"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "./animations";

// AWS Logo
function AWSLogo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 64 64">
      <path d="M18.4 28.4c0 .9.1 1.6.3 2.2.2.5.5 1.1.9 1.7.1.2.2.4.2.5 0 .2-.1.4-.4.6l-1.2.8c-.2.1-.4.2-.5.2-.2 0-.4-.1-.6-.3-.3-.3-.5-.6-.7-1-.2-.4-.4-.8-.6-1.3-1.5 1.8-3.4 2.7-5.7 2.7-1.6 0-2.9-.5-3.9-1.4s-1.4-2.2-1.4-3.8c0-1.7.6-3.1 1.8-4.1 1.2-1 2.8-1.5 4.9-1.5.7 0 1.4 0 2.1.1.7.1 1.5.2 2.3.4v-1.5c0-1.5-.3-2.6-.9-3.2-.6-.6-1.7-.9-3.2-.9-.7 0-1.4.1-2.1.3-.7.2-1.5.4-2.2.7-.3.1-.6.2-.7.3-.1 0-.3.1-.4.1-.3 0-.5-.2-.5-.7v-1c0-.4.1-.6.2-.8.1-.2.4-.3.8-.5.7-.4 1.6-.7 2.5-.9.9-.3 1.9-.4 3-.4 2.3 0 4 .5 5.1 1.6 1.1 1.1 1.6 2.7 1.6 4.9v6.4zm-7.9 3c.7 0 1.4-.1 2.1-.4.7-.3 1.4-.7 1.9-1.3.3-.4.6-.8.7-1.3.1-.5.2-1.1.2-1.8v-.9c-.6-.1-1.2-.2-1.8-.3-.6-.1-1.2-.1-1.8-.1-1.3 0-2.3.3-2.9.8-.6.5-.9 1.3-.9 2.3 0 .9.2 1.6.7 2.1.5.6 1.1.9 1.8.9zm15.6 2.1c-.4 0-.7-.1-.9-.2-.2-.1-.4-.4-.5-.8l-5.6-18.5c-.1-.3-.2-.5-.2-.7 0-.3.1-.5.4-.5h1.9c.4 0 .7.1.9.2.2.1.4.4.5.8l4 15.8 3.7-15.8c.1-.4.3-.7.5-.8.2-.1.5-.2.9-.2h1.6c.4 0 .7.1.9.2.2.1.4.4.5.8l3.8 16 4.1-16c.1-.4.3-.7.5-.8.2-.1.5-.2.9-.2h1.8c.3 0 .5.2.5.5 0 .1 0 .2-.1.4 0 .1-.1.3-.2.5l-5.7 18.5c-.1.4-.3.7-.5.8-.2.1-.5.2-.9.2h-1.7c-.4 0-.7-.1-.9-.2-.2-.2-.4-.4-.5-.8l-3.7-15.4-3.7 15.4c-.1.4-.3.7-.5.8-.2.2-.5.2-.9.2h-1.7zm25 .4c-1 0-2.1-.1-3.1-.4-1-.3-1.8-.6-2.3-.9-.3-.2-.5-.4-.6-.6-.1-.2-.1-.4-.1-.6v-1.1c0-.5.2-.7.5-.7.1 0 .3 0 .4.1.1.1.3.1.6.3.8.4 1.6.7 2.5.9.9.2 1.8.3 2.6.3 1.4 0 2.4-.2 3.2-.7.7-.5 1.1-1.1 1.1-2 0-.6-.2-1.1-.6-1.5-.4-.4-1.1-.8-2.2-1.1l-3.1-.9c-1.6-.5-2.8-1.2-3.5-2.1-.7-.9-1.1-1.9-1.1-3 0-.9.2-1.6.6-2.3.4-.7.9-1.3 1.6-1.8.7-.5 1.4-.8 2.3-1.1.9-.3 1.8-.4 2.8-.4.5 0 1 0 1.5.1.5.1 1 .2 1.5.3.5.1.9.3 1.4.4.4.2.8.3 1.1.5.3.2.5.4.6.6.1.2.2.5.2.8v1c0 .5-.2.7-.5.7-.2 0-.5-.1-.8-.3-1.2-.6-2.5-.8-4-.8-1.2 0-2.2.2-2.9.6-.7.4-1 1-1 1.9 0 .6.2 1.1.6 1.5.4.4 1.2.8 2.4 1.2l3 .9c1.6.5 2.7 1.1 3.4 2 .7.8 1 1.8 1 2.9 0 .9-.2 1.7-.5 2.4-.4.7-.9 1.4-1.5 1.9-.7.5-1.4 1-2.4 1.2-.9.4-2 .5-3.2.5z" />
      <path d="M52.4 44.8c-6.1 4.5-14.9 6.9-22.5 6.9-10.6 0-20.2-3.9-27.5-10.5-.6-.5-.1-1.2.6-.8 7.8 4.6 17.5 7.3 27.5 7.3 6.8 0 14.2-1.4 21-4.3 1-.5 1.9.6.9 1.4z" />
      <path d="M54.9 41.9c-.8-1-5.1-.5-7-.2-.6.1-.7-.4-.2-.8 3.5-2.4 9.1-1.7 9.8-.9.7.8-.2 6.3-3.4 8.9-.5.4-1 .2-.8-.3.8-1.9 2.4-5.7 1.6-6.7z" />
    </svg>
  );
}

// TypeScript Logo
function TypeScriptLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128">
      <path
        d="M2 63.91v62.5h125v-125H2zm100.73-5a15.56 15.56 0 017.82 4.5 20.58 20.58 0 013 4c0 .16-5.4 3.81-8.69 5.85-.12.08-.6-.44-1.13-1.23a7.09 7.09 0 00-5.87-3.53c-3.79-.26-6.23 1.73-6.21 5a4.58 4.58 0 00.54 2.34c.83 1.73 2.38 2.76 7.24 4.86 8.95 3.85 12.78 6.39 15.16 10 2.66 4 3.25 10.46 1.45 15.24-2 5.2-6.9 8.73-13.83 9.9a38.32 38.32 0 01-9.52-.1A23 23 0 0180 109.19c-1.15-1.27-3.39-4.58-3.25-4.82a9.34 9.34 0 011.15-.73l4.6-2.64 3.59-2.08.75 1.11a16.78 16.78 0 004.74 4.54c4 2.1 9.46 1.81 12.16-.62a5.43 5.43 0 00.69-6.92c-1-1.39-3-2.56-8.59-5-6.45-2.78-9.23-4.5-11.77-7.24a16.48 16.48 0 01-3.43-6.25 25 25 0 01-.22-8c1.33-6.23 6-10.58 12.82-11.87a31.66 31.66 0 019.49.26zm-29.34 5.24v5.12H57.16v46.23H45.65V69.26H29.38v-5a49.19 49.19 0 01.14-5.16c.06-.08 10-.12 22-.1h21.81z"
        fill="currentColor"
      />
    </svg>
  );
}

// Pulumi Logo
function PulumiLogo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 128 128">
      <path d="M64 0L17.8 26.6v53.3L64 106.5l46.2-26.6V26.6L64 0zm0 10.7l36.5 21v42L64 94.7l-36.5-21v-42L64 10.7z" />
      <circle cx="64" cy="42" r="8" />
      <circle cx="44" cy="53" r="8" />
      <circle cx="84" cy="53" r="8" />
      <circle cx="64" cy="74" r="8" />
      <circle cx="44" cy="85" r="8" />
      <circle cx="84" cy="85" r="8" />
    </svg>
  );
}

// Vercel Logo
function VercelLogo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 76 65">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

const techStack = [
  {
    name: "AWS",
    logo: AWSLogo,
    href: "https://aws.amazon.com",
  },
  {
    name: "TypeScript",
    logo: TypeScriptLogo,
    href: "https://www.typescriptlang.org",
  },
  {
    name: "Pulumi",
    logo: PulumiLogo,
    href: "https://www.pulumi.com",
  },
  {
    name: "Vercel",
    logo: VercelLogo,
    href: "https://vercel.com",
  },
];

function GridPattern() {
  return (
    <svg
      className="absolute inset-0 size-full opacity-[0.04] dark:opacity-[0.03]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          height="32"
          id="trusted-by-grid"
          patternUnits="userSpaceOnUse"
          width="32"
        >
          <path
            d="M0 32V0h32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect fill="url(#trusted-by-grid)" height="100%" width="100%" />
    </svg>
  );
}

function DotGrid() {
  const rows = 8;
  const cols = 12;

  return (
    <div className="absolute -right-4 -top-4">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;

          // Top-right corner: fade as we go down-left
          const distance = (row + (cols - 1 - col)) / (rows + cols - 2);
          const opacity = Math.max(0, 1 - distance * 1.2);

          if (opacity <= 0.05) return <div className="size-1" key={i} />;

          return (
            <div
              className="size-1 rounded-full bg-orange-500 dark:bg-orange-400"
              key={i}
              style={{ opacity: opacity * 0.5 }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TrustedBySection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-6 sm:pt-16 sm:pb-8">
      {/* Background Grid */}
      <GridPattern />

      {/* Top-left Dot Grid */}
      <DotGrid />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeIn className="mb-8 text-center sm:mb-10">
          <p className="mb-2 font-medium text-orange-500 text-sm">Built On</p>
          <h2 className="font-bold text-xl text-foreground sm:text-2xl">
            Battle-tested infrastructure
          </h2>
        </FadeIn>

        {/* Tech Stack Grid */}
        <StaggerContainer
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 lg:gap-16"
          staggerDelay={0.15}
        >
          {techStack.map((tech) => {
            const Logo = tech.logo;
            return (
              <StaggerItem key={tech.name}>
                <a
                  aria-label={`Learn more about ${tech.name}`}
                  className="group flex flex-col items-center gap-2 transition-opacity hover:opacity-70"
                  href={tech.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Logo className="h-10 w-auto text-muted-foreground transition-colors group-hover:text-foreground sm:h-12" />
                  <span className="font-medium text-muted-foreground text-xs">
                    {tech.name}
                  </span>
                </a>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}
