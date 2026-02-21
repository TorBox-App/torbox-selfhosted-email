# Wraps Website (apps/website)

Next.js 16 marketing site + documentation. 334 files across landing, docs, tools, blog, and product pages.

## Critical Rules

### 1. Page + Content Split Pattern

Pages handle metadata/SEO (server component), content is a separate client component:

```
docs/quickstart/email/
├── page.tsx           # export metadata + JSON-LD + <PageContent />
└── page-content.tsx   # "use client" — actual UI
```

This split exists because Next.js `metadata` exports require server components, but interactive content needs client rendering.

### 2. No MDX — Content Is TSX

All content is written as React components, not MDX. This allows full component composition, state management, and interactive elements.

### 3. Use Semantic Color Tokens

No arbitrary hex colors or raw Tailwind colors. Use theme tokens:

```tsx
// BAD
<div className="bg-gray-900 text-white" />
<div className="bg-[#1a1a2e]" />

// GOOD
<div className="bg-background text-foreground" />
<div className="bg-muted text-muted-foreground" />
```

### 4. Code Blocks Use shadcn-io Components

```tsx
import { CodeBlock, CodeBlockBody, CodeBlockContent, CodeBlockCopyButton,
         CodeBlockFilename, CodeBlockHeader } from "@/components/ui/shadcn-io/code-block";

<CodeBlock>
  <CodeBlockHeader>
    <CodeBlockFilename>email.ts</CodeBlockFilename>
  </CodeBlockHeader>
  <CodeBlockBody>
    <CodeBlockContent>{code}</CodeBlockContent>
    <CodeBlockCopyButton />
  </CodeBlockBody>
</CodeBlock>
```

For tabbed examples (multiple frameworks): use `CodeTabs` + `CodeTabItem`.

## Architecture

### Route Structure

```
src/app/
├── page.tsx                   # Landing page (sections: Hero, Pricing, FAQ, etc.)
├── landing/                   # Alternate landing page
├── docs/                      # Documentation hub
│   ├── quickstart/            # Getting started guides (email, SMS, CDN, platform)
│   ├── guides/                # Multi-page guides (domain verification, AWS setup, etc.)
│   ├── cli-reference/         # CLI command reference
│   ├── sdk-reference/         # Email SDK reference
│   ├── sms-sdk-reference/     # SMS SDK reference
│   ├── cdk-reference/         # CDK construct reference
│   ├── pulumi-reference/      # Pulumi component reference
│   └── infrastructure/        # Infrastructure guides
├── platform/                  # Hosted platform pages
├── email/ | sms/ | cli/       # Product-specific content
├── inbound/                   # Inbound email documentation
├── tools/                     # Interactive tools (SES calculator, SPF builder)
├── about/ | why-wraps/        # Marketing content
├── changelog/                 # Release notes
├── contact/                   # Contact form
├── blog/                      # Blog posts
└── privacy/ | terms/          # Legal pages
```

### Layout Hierarchy

- **Root layout** (`app/layout.tsx`): Theme provider, analytics (Vercel + PostHog), fonts
- **BaseLayout** (`components/layouts/base-layout.tsx`): Sidebar + header + footer (app pages)
- **DocsLayout** (`components/layouts/docs-layout.tsx`): Docs sidebar nav + search (doc pages)

Docs pages use DocsLayout, NOT BaseLayout.

### Landing Page Architecture

Section-based composition — each section is a standalone component:

```tsx
// app/page.tsx
<Navbar />
<HeroSection />
<CredibilitySection />
<ProductTabbedSection />
<PricingSection />
<FAQSection />        // Includes JSON-LD schema
<Footer />
```

### Navigation

1. **Landing navbar**: Logo, nav links, mega menu for products, CTA buttons
2. **Docs sidebar** (`components/docs-nav.tsx`): Recursive tree with collapsible sections
3. **Site header**: Cmd-K search, mode toggle, app/GitHub links
4. **Cmd-K search** (`components/command-search.tsx`): Client-side command palette

### Docs Sidebar Navigation Structure

```typescript
type NavItem = {
  title: string;
  href: string;
  icon?: Icon;
  disabled?: boolean;
  children?: NavItem[];
};
```

### Key Directories

| Path | Purpose |
|------|---------|
| `components/landing/` | Landing page sections (hero, pricing, FAQ, etc.) |
| `components/docs/` | Docs navigation, layout, section headings |
| `components/ui/` | shadcn/ui primitives |
| `components/ui/shadcn-io/` | Code showcase (CodeBlock, CodeTabs, Terminal, Snippet) |
| `contexts/` | Sidebar context, theme context |
| `hooks/` | useTheme, useMobile, useSidebarConfig, useSharedInView |
| `config/` | Theme tokens, customizer constants |

## SEO Patterns

### Page Metadata

Every page exports a `metadata` object:

```typescript
export const metadata: Metadata = {
  title: "Email Infrastructure",  // Becomes "Email Infrastructure | Wraps"
  description: "Deploy production-ready email...",
  openGraph: { ... },
};
```

### JSON-LD Schema

Docs/guides include breadcrumb schema. Landing page includes FAQ + Organization schema:

```tsx
<Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
```

### Sitemap & Robots

Generated at `app/sitemap.ts` and `app/robots.ts`.

## Key Dependencies

- `shiki` — Syntax highlighting for code blocks
- `next-themes` — Dark mode
- `motion` — Animations
- `recharts` — Charts/visualizations
- `cmdk` — Command palette search
- `posthog-js` — Analytics (reverse-proxied via `/ingest`)

## Commands

```bash
pnpm --filter @wraps/website dev         # Dev server
pnpm --filter @wraps/website build       # Production build
pnpm --filter @wraps/website typecheck   # Type check
```
