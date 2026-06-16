# Wraps UI (packages/ui)

Shared shadcn/ui component library and design system for Wraps. Consumed by `apps/web` (dashboard) and `apps/website` (marketing). Components are source-distributed — no build step, `tsc --noEmit` only.

## Critical Rules

### 1. Semantic Theme Tokens Only — No Arbitrary Colors

Every color must come from the OKLch CSS custom property theme system (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, etc.). No hex values, no hardcoded Tailwind palette classes like `text-gray-500` or `bg-blue-600` in any component. This ensures light/dark mode parity and future theming work automatically.

### 2. Import `@radix-ui/*` Only Inside This Package

The root baseline bans direct `@radix-ui/*` imports in `apps/`. All Radix primitives must be wrapped here in `src/components/ui/` and exported. Apps import from `@wraps/ui/components/ui/button` etc., never from `@radix-ui/react-button` directly.

### 3. CVA Variants for All Variant Behavior

Component variants (size, color, state) use `class-variance-authority` (`cva`). Do not use conditional classname strings or manual ternaries for variant logic — keep variants in the `cva()` call so they are inspectable and composable. See `src/components/ui/button.tsx` for the established pattern.

### 4. No Build Step — Source Is the Distribution

`@wraps/ui` exports TypeScript source (`.tsx`) directly. There is no `dist/`. Do not add a build script that compiles to JS. Consumers compile it as part of their own build (Next.js handles this via `transpilePackages`).

### 5. Theme Presets Live in `src/theme-presets/`

`tweakcn-theme-presets.ts` and `shadcn-ui-theme-presets.ts` are exported for the dashboard's theme switcher. These define OKLch CSS variable sets. Keep preset data here — do not scatter theme tokens into individual components.

## Consumers

- `apps/web` — primary consumer, all dashboard UI
- `apps/website` — marketing site components

## Commands

```bash
pnpm --filter @wraps/ui build      # tsc --noEmit (type-check only)
pnpm --filter @wraps/ui typecheck  # same
```
