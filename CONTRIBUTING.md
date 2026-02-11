# Contributing to Wraps

We'd love your help! Wraps is open source and community-driven.

## Development Setup

```bash
# Clone repository
git clone https://github.com/wraps-team/wraps.git
cd wraps

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build in watch mode
pnpm dev
```

## Working on the CLI

```bash
cd packages/cli

# Build CLI
pnpm build

# Run locally
node dist/cli.js email init

# Run tests
pnpm test

# Type checking
pnpm check
```

## Project Structure

- **Monorepo** — Managed with Turborepo + pnpm workspaces
- **Language** — TypeScript (strict mode)
- **Build** — tsup (esbuild-powered)
- **IaC** — Pulumi (inline programs, local state)
- **AWS SDK** — v3 (modular imports)
- **CLI Framework** — args + @clack/prompts
- **Testing** — Vitest

## Adding a New Package

```bash
mkdir -p packages/your-package
cd packages/your-package
pnpm init

# Turborepo will automatically detect it
cd ../..
pnpm build
```

## How to Contribute

1. **Fork the repository**
2. **Create a feature branch** — `git checkout -b feature/amazing-feature`
3. **Make your changes** — Follow existing code style
4. **Write tests** — For new features
5. **Update docs** — If changing CLI behavior
6. **Commit with conventional commits** — `feat:`, `fix:`, `chore:`, etc.
7. **Push and open a PR** — We'll review and provide feedback

## Development Principles

- **Non-Destructive** — Never modify existing AWS resources
- **Namespace Everything** — All resources prefixed `wraps-email-*`
- **Fail Fast** — Validate early, deploy confidently
- **Great UX** — Beautiful output, clear errors, helpful suggestions
- **Type-Safe** — Strict TypeScript throughout
- **Tested** — Critical paths have tests

## Getting Help

- [Documentation](https://wraps.dev/docs)
- [GitHub Issues](https://github.com/wraps-team/wraps/issues)
- [GitHub Discussions](https://github.com/wraps-team/wraps/discussions)
