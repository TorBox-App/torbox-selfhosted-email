---
name: docs-pages
description: Create and normalize documentation pages for the Wraps website. Use when adding new docs pages, editing existing docs, or normalizing docs to match the established pattern.
---

# Docs Pages Skill

You are an expert at creating and maintaining documentation pages for the Wraps website at `apps/website/src/app/docs/`.

## Architecture Overview

Every docs page consists of **two files**:

1. **`page.tsx`** — Server component handling metadata, SEO, and JSON-LD structured data
2. **`page-content.tsx`** — Client component (`"use client"`) with the visible page content

This split enables server-side metadata generation while keeping interactive components client-rendered.

## File Locations

```
apps/website/src/app/docs/          # All docs pages
apps/website/src/components/         # Shared layout components
  docs-layout.tsx                    # DocsLayout wrapper (sidebar + header)
  docs-nav.tsx                       # Sidebar navigation (NavItem/NavSection types)
apps/website/src/components/docs/    # Docs-specific components
  section-heading.tsx                # SectionHeading with "Copy for AI" button
  copy-for-ai-button.tsx             # CopyForAIButton dropdown (markdown + slash command)
apps/website/src/components/ui/      # shadcn/ui components
  shadcn-io/code-block/              # CodeBlock components
  shadcn-io/snippet/                 # Snippet (inline code with tabs)
```

## page.tsx Template (Server Component)

Every `page.tsx` MUST follow this exact structure:

```typescript
import type { Metadata } from "next";
import Script from "next/script";
import MyPageContent from "./page-content";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Docs",
      item: "https://wraps.dev/docs",
    },
    // Add intermediate breadcrumbs for nested pages
    {
      "@type": "ListItem",
      position: 2,
      name: "Page Title",
      item: "https://wraps.dev/docs/page-slug",
    },
  ],
};

export const metadata: Metadata = {
  title: "Page Title",
  description: "Descriptive summary for search engines (120-160 chars).",
  openGraph: {
    title: "Page Title | Wraps",
    description: "Same or slightly shorter description for social cards.",
    type: "website",
    url: "https://wraps.dev/docs/page-slug",
  },
  twitter: {
    title: "Page Title | Wraps",
    description: "Shorter description for Twitter cards.",
  },
  alternates: {
    canonical: "https://wraps.dev/docs/page-slug",
  },
};

export default function MyPage() {
  return (
    <>
      <Script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        id="breadcrumb-schema"
        type="application/ld+json"
      />
      {/* Server-rendered content for SEO */}
      <article aria-hidden="true" className="sr-only">
        <h1>Page Title</h1>
        <p>Brief summary matching the meta description.</p>
        <h2>Section 1 Heading</h2>
        <h2>Section 2 Heading</h2>
        <h2>Section 3 Heading</h2>
      </article>
      <MyPageContent />
    </>
  );
}
```

### page.tsx Checklist

- [ ] `breadcrumbSchema` with JSON-LD — ALWAYS include, with correct hierarchy
- [ ] `metadata` export — title, description, openGraph, twitter, alternates.canonical
- [ ] `<Script>` tag for breadcrumb JSON-LD with `id="breadcrumb-schema"`
- [ ] `<article aria-hidden="true" className="sr-only">` with h1, summary, and all h2 section headings
- [ ] Import and render the page-content component
- [ ] OpenGraph title format: `"Page Title | Wraps"`
- [ ] URLs use `https://wraps.dev/docs/...` (no trailing slash)

## page-content.tsx Template (Client Component)

```typescript
"use client";

import { ArrowRight } from "lucide-react";
import { DocsLayout } from "@/components/docs-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";

export default function MyPageContent() {
  return (
    <DocsLayout>
      {/* Page Header */}
      <div className="mb-12">
        <Badge className="mb-4" variant="outline">
          Category Label
        </Badge>
        <h1 className="mb-4 font-bold text-4xl tracking-tight">
          Page Title
        </h1>
        <p className="text-lg text-muted-foreground">
          Brief description of what this page covers.
        </p>
      </div>

      {/* Content Sections */}
      <section className="mb-12">
        <h2 className="mb-4 font-bold text-2xl">Section Title</h2>
        <p className="mb-4 text-muted-foreground">
          Section content...
        </p>
      </section>

      {/* Next Steps — ALWAYS include */}
      <section className="mb-12">
        <h2 className="mb-6 font-bold text-2xl">Next Steps</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-lg">Related Page Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground text-sm">
                Brief description of the linked page.
              </p>
              <Button asChild variant="outline">
                <a href="/docs/related-page">
                  Link Text
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Help Section — include on quickstart/getting-started pages */}
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <h3 className="mb-2 font-bold text-xl">Need Help?</h3>
          <p className="mb-4 text-muted-foreground">
            If you run into any issues, check our GitHub discussions or open an issue.
          </p>
          <Button asChild>
            <a
              href="https://github.com/wraps-team/wraps/discussions"
              rel="noopener noreferrer"
              target="_blank"
            >
              Get Help
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </DocsLayout>
  );
}
```

### page-content.tsx Checklist

- [ ] `"use client"` directive at top of file
- [ ] Wrapped in `<DocsLayout>` (NOT the docs index — it has its own layout)
- [ ] Page header: `Badge` (category) + `h1` + description paragraph
- [ ] Sections use `<section className="mb-12">` with `<h2 className="mb-4 font-bold text-2xl">`
- [ ] "Next Steps" section with 2-column card grid linking to related pages
- [ ] All internal links use `<a href="/docs/...">` (plain anchors, not Next.js `<Link>`)
- [ ] External links include `rel="noopener noreferrer" target="_blank"`

## Component Patterns

### Code Block (multi-line code with syntax highlighting)

```tsx
const exampleCode = `import { Wraps } from '@wraps.dev/email';
const wraps = new Wraps();`;

// In JSX:
<CodeBlock
  className="h-auto"
  data={[
    {
      language: "typescript",
      filename: "example.ts",
      code: exampleCode,
    },
  ]}
  defaultValue="typescript"
>
  <CodeBlockHeader>
    <CodeBlockFiles>
      {(item) => (
        <CodeBlockFilename key={item.language} value={item.language}>
          {item.filename}
        </CodeBlockFilename>
      )}
    </CodeBlockFiles>
    <CodeBlockCopyButton />
  </CodeBlockHeader>
  <CodeBlockBody>
    {(item) => (
      <CodeBlockItem key={item.language} lineNumbers={false} value={item.language}>
        <CodeBlockContent language={item.language}>
          {item.code}
        </CodeBlockContent>
      </CodeBlockItem>
    )}
  </CodeBlockBody>
</CodeBlock>
```

### CLI Command Helper (for pages with many terminal commands)

When a page has 3+ CLI commands, define a local helper to reduce boilerplate:

```tsx
function CLICommand({ command }: { command: string }) {
  return (
    <CodeBlock
      className="h-auto"
      data={[{ language: "bash", filename: "terminal.sh", code: command }]}
      defaultValue="bash"
    >
      <CodeBlockHeader>
        <CodeBlockFiles>
          {(item) => (
            <CodeBlockFilename key={item.language} value={item.language}>
              {item.filename}
            </CodeBlockFilename>
          )}
        </CodeBlockFiles>
        <CodeBlockCopyButton />
      </CodeBlockHeader>
      <CodeBlockBody>
        {(item) => (
          <CodeBlockItem key={item.language} lineNumbers={false} value={item.language}>
            <CodeBlockContent language={item.language}>
              {item.code}
            </CodeBlockContent>
          </CodeBlockItem>
        )}
      </CodeBlockBody>
    </CodeBlock>
  );
}
```

### Snippet (package manager install tabs)

```tsx
import {
  Snippet,
  SnippetCopyButton,
  SnippetHeader,
  SnippetTabsContent,
  SnippetTabsList,
  SnippetTabsTrigger,
} from "@/components/ui/shadcn-io/snippet";

const installCommands = {
  npm: "npm install @wraps.dev/email",
  pnpm: "pnpm add @wraps.dev/email",
  yarn: "yarn add @wraps.dev/email",
  bun: "bun add @wraps.dev/email",
};

<Snippet defaultValue="npm">
  <SnippetHeader>
    <SnippetTabsList>
      <SnippetTabsTrigger value="npm">npm</SnippetTabsTrigger>
      <SnippetTabsTrigger value="pnpm">pnpm</SnippetTabsTrigger>
      <SnippetTabsTrigger value="yarn">yarn</SnippetTabsTrigger>
      <SnippetTabsTrigger value="bun">bun</SnippetTabsTrigger>
    </SnippetTabsList>
    <SnippetCopyButton value={installCommands.npm} />
  </SnippetHeader>
  {Object.entries(installCommands).map(([key, command]) => (
    <SnippetTabsContent key={key} value={key}>
      {command}
    </SnippetTabsContent>
  ))}
</Snippet>
```

### SectionHeading (with "Copy for AI" button)

Use on reference pages (SDK, CLI) for each major section:

```tsx
import { SectionHeading } from "@/components/docs/section-heading";

<SectionHeading
  id="section-id"
  title="Section Title"
  markdown={`# Section Title\n\nMarkdown content for AI copy...`}
  level={2}
  className="mb-4"
/>
```

### CopyForAIButton (page-level copy dropdown)

Use as a `headerActions` prop on `DocsLayout` for reference pages:

```tsx
import { CopyForAIButton } from "@/components/docs/copy-for-ai-button";

<DocsLayout
  headerActions={
    <CopyForAIButton
      markdown={fullPageMarkdown}
      slashCommand={`wraps-${topic}`}
    />
  }
>
```

### Callout / Note Box

**Info callout** (blue/primary):
```tsx
<div className="rounded-lg border-primary border-l-4 bg-primary/10 p-4">
  <p className="font-medium text-sm">Note Title</p>
  <p className="mt-2 text-muted-foreground text-sm">
    Note content explaining something important.
  </p>
</div>
```

**Warning callout** (yellow):
```tsx
<div className="rounded-lg border-yellow-500 border-l-4 bg-yellow-500/10 p-4">
  <p className="font-medium text-sm">Warning Title</p>
  <p className="mt-2 text-muted-foreground text-sm">
    Warning content about potential issues.
  </p>
</div>
```

### Numbered Steps

Use for sequential guides (quickstart, setup instructions):

```tsx
<h2 className="mb-4 flex items-center gap-2 font-bold text-2xl">
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
    1
  </div>
  Step Title
</h2>
```

### Prerequisites Card

```tsx
import { CheckCircle2 } from "lucide-react";

<Card className="mb-8">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <CheckCircle2 className="h-5 w-5 text-primary" />
      Prerequisites
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    <p className="text-muted-foreground">Before you begin, make sure you have:</p>
    <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
      <li>Prerequisite 1</li>
      <li>Prerequisite 2</li>
    </ul>
  </CardContent>
</Card>
```

### Data Table

```tsx
<Card>
  <CardContent className="p-6">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="pb-2 text-left">Column 1</th>
          <th className="pb-2 text-left">Column 2</th>
        </tr>
      </thead>
      <tbody className="text-muted-foreground">
        <tr className="border-b">
          <td className="py-2 font-medium text-foreground">Row label</td>
          <td className="py-2">Row value</td>
        </tr>
      </tbody>
    </table>
  </CardContent>
</Card>
```

### Inline Code

```tsx
<code className="rounded bg-muted px-1.5 py-0.5">inline-code</code>
```

## Typography Classes

| Element | Classes |
|---------|---------|
| h1 | `font-bold text-4xl tracking-tight` |
| h2 | `font-bold text-2xl` |
| h3 | `font-medium text-lg` |
| Body text | `text-muted-foreground` |
| Small text | `text-muted-foreground text-sm` |
| Inline code | `rounded bg-muted px-1.5 py-0.5` |
| Section | `mb-12` |
| Section heading | `mb-4` (after h2), `mb-6` (before card grids) |

## Navigation

When adding a new page, you MUST also add it to the sidebar navigation in `apps/website/src/components/docs-nav.tsx`.

The navigation uses this type structure:

```typescript
type NavItem = {
  title: string;       // Display text
  href: string;        // Route path
  icon?: LucideIcon;   // Only for top-level items
  disabled?: boolean;  // Shows "(Soon)" badge
  children?: NavItem[]; // Nested items (no icon)
};

type NavSection = {
  title: string;       // Section header (uppercase)
  items: NavItem[];
};
```

Add new pages to the appropriate section in the `navItems` array. Use an icon from `lucide-react` for top-level items. Child items do not get icons.

## Normalization Rules

When normalizing existing docs pages, ensure each page has ALL of the following:

### page.tsx

1. **Breadcrumb JSON-LD** — Every page must have the `breadcrumbSchema` const and `<Script>` tag
2. **Full metadata** — title, description, openGraph (title, description, type, url), twitter (title, description), alternates.canonical
3. **SEO article** — `<article aria-hidden="true" className="sr-only">` with h1 + p + all h2 headings from the content
4. **Consistent naming** — Component name matches `{PageName}Page`, content import matches `{PageName}PageContent`

### page-content.tsx

1. **`"use client"`** directive
2. **`<DocsLayout>`** wrapper (except docs index which has its own layout)
3. **Page header** — Badge + h1 + description (in a `<div className="mb-12">`)
4. **Sections** — Each wrapped in `<section className="mb-12">`
5. **Next Steps** — 2-column card grid at the bottom linking to 2 related pages
6. **Consistent spacing** — h2 uses `mb-4`, cards use `mb-4` or `mb-8`

### Common Issues to Fix When Normalizing

- Missing breadcrumb JSON-LD schema (several pages are missing this)
- Missing `<Script>` tag for breadcrumbs
- Inconsistent SEO article structure (some use `<nav>` instead of `<article>`)
- Missing or shallow SEO article (should list ALL h2 sections from content)
- Duplicate `CLICommand` helper (should be extracted to shared component if used across 3+ pages)
- Using generic Badge text instead of meaningful category labels

## Page Categories (Badge Labels)

Use these standardized Badge labels:

| Category | Badge Text | Used For |
|----------|-----------|----------|
| Getting Started | `Quickstart` | Quickstart pages |
| CLI | `CLI Reference` | CLI reference pages |
| SDK | `SDK Reference` | SDK reference pages |
| Guide | `Guide` | How-to guides |
| Infrastructure | `Infrastructure` | CDK, Pulumi pages |
| Privacy | `Privacy` | Telemetry, data pages |
| Overview | `Documentation` | Index/landing pages |

## Icons

Import icons from `lucide-react`. Common ones used in docs:

- `ArrowRight` — Button links, "Next Steps" cards
- `CheckCircle2` — Prerequisites, checklists
- `Terminal` — CLI-related content
- `Mail` — Email-related content
- `MessageSquare` — SMS-related content
- `Shield` — Security/privacy content
- `Clock` — Time estimates, "X min read"
- `AlertTriangle` — Warnings
- `Zap` — Automatic/fast features
- `Code2` — Code/SDK content
