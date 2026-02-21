# Wraps TUI (packages/tui)

Terminal UI built with @opentui/react (React 19 for terminals). Provides an interactive dashboard for managing email infrastructure from the terminal.

## Critical Rules

### 1. This Is NOT Browser React

@opentui/react renders to the terminal, not the DOM. JSX elements are `<box>`, `<text>`, `<input>` — not `<div>`, `<span>`, `<input type="text">`.

```tsx
// Terminal JSX
<box flexDirection="column" gap={1} padding={1}>
  <text fg="#00AAFF"><b>Email Overview</b></text>
  <text fg="#888888">3 domains configured</text>
</box>
```

### 2. Always Guard Keyboard Handlers

Global shortcuts (`q` to quit, `escape` to go back) must check `inputActive` first, or they'll fire while the user is typing.

```typescript
useKeyboard((key) => {
  if (inputActive) return;  // ALWAYS check this first
  if (key.name === "q") renderer.destroy();
  if (key.name === "escape") back();
});
```

### 3. FocusContext Controls Input State

When a component has a text `<input>`, it must set `inputActive` via FocusContext. This suppresses global keyboard shortcuts.

```typescript
const { setInputActive } = useFocus();

useEffect(() => {
  setInputActive(phase === "input");
  return () => setInputActive(false);  // Cleanup
}, [phase]);
```

### 4. Runtime Is Bun, Not Node

The TUI runs on Bun. Use Bun APIs where needed (e.g., `Bun.spawn` for subprocesses in deploy).

## Architecture

### Routing (State-Based, Not URL)

No URL routing — routes are React state with a history stack:

```typescript
const { route, navigate, back } = useRouter({ view: "dashboard" });

// Navigate
navigate({ view: "email", sub: "domains.add" });

// Route union type
type Route =
  | { view: "dashboard" }
  | { view: "email"; sub: "overview" | "domains.add" | "domains.verify" | "init" | ... }
  | { view: "monitoring" }
  | { view: "templates" }   // Coming soon
  | { view: "workflows" }   // Coming soon
```

### Context Providers

Two contexts wrap the entire app:

| Context | Purpose | API |
|---------|---------|-----|
| `FocusProvider` | Track when text input is active | `{ inputActive, setInputActive }` |
| `ShortcutsProvider` | Override footer shortcuts per screen | `{ overrides, setShortcuts, clearShortcuts }` |

### Key Files

```
src/
├── index.tsx              # Entry (createCliRenderer + React root)
├── app.tsx                # App (contexts + global keyboard + routing)
├── types.ts               # Route types, AccountData, config types
├── contexts/
│   ├── focus.tsx           # Input focus tracking
│   └── shortcuts.tsx       # Footer shortcut overrides
├── hooks/
│   ├── use-router.ts       # State-based routing with history
│   ├── use-account.ts      # AWS data loading (SES, DynamoDB, CloudWatch)
│   ├── use-deploy.ts       # Subprocess deployment (Bun.spawn)
│   ├── use-init-wizard.ts  # Linear wizard state machine
│   └── use-log-stream.ts   # CloudWatch live tail streaming
├── components/
│   ├── layout/             # Shell (header + content + footer)
│   ├── dashboard/          # Overview screen
│   ├── email/
│   │   ├── overview.tsx    # Domain list with keyboard nav
│   │   ├── init/           # 5-step wizard (welcome → config → features → review → deploy)
│   │   └── domains-*.tsx   # Add, verify, remove domains
│   ├── monitoring/         # CloudWatch log viewer
│   └── shared/             # Wizard frame, StatusBadge, BarChart
└── lib/
    ├── aws.ts              # AWS SDK wrappers (SES, STS, DynamoDB)
    ├── deploy.ts           # Subprocess spawning
    ├── cloudwatch.ts       # CloudWatch Logs SDK
    ├── metadata.ts         # ~/.wraps/connections/ metadata
    └── keys.ts             # isEnter(), isTab() helpers
```

### Keyboard Conventions

| Key | Action | Context |
|-----|--------|---------|
| `q` | Quit | Global |
| `escape` | Go back | Global |
| `r` | Refresh | Global |
| `j` / `k` | Navigate list | Email overview |
| `a` | Add domain | Email overview |
| `v` | Verify domain | Email overview |
| `i` | Init wizard | Email overview |
| `s` | Start/stop stream | Monitoring |
| `tab` | Next field | Wizards |
| `1`/`2`/`3` | Time range | Dashboard |

### Phase-Based UI Pattern

Interactive components use local `phase` state:

```typescript
const [phase, setPhase] = useState<"input" | "creating" | "success" | "error">("input");

// Render different UI per phase
if (phase === "input") return <input ... />;
if (phase === "creating") return <text>Creating...</text>;
if (phase === "success") return <text fg="#98C379">Done!</text>;
```

### Color Palette

| Color | Usage |
|-------|-------|
| `#00AAFF` | Headings, focus highlight |
| `#FFFFFF` | Normal text, selected items |
| `#888888` | Labels, help text |
| `#666666` | Separators, muted |
| `#FFFF00` | Warnings |
| `#FF4444` | Errors |
| `#98C379` | Success, JSON strings |

## Commands

```bash
pnpm --filter @wraps/tui dev    # Dev mode (Bun)
pnpm --filter @wraps/tui build  # Build
```
