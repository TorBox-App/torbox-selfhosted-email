import { parseArgs as nodeParseArgs } from "node:util";
import { isValidDomain } from "@wraps.dev/email-check";

export type ParsedArgs = {
  command: "check" | "spf" | "help" | "version";
  domain?: string;
  invalidDomain?: string;
  flags: {
    json?: boolean;
    quick?: boolean;
    verbose?: boolean;
    help?: boolean;
    version?: boolean;
    skipBlacklists?: boolean;
    skipTls?: boolean;
    timeout?: number;
  };
};

export function parseArgs(argv: string[]): ParsedArgs {
  const { values, positionals } = nodeParseArgs({
    args: argv.slice(2),
    options: {
      json: { type: "boolean", default: false },
      quick: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      "skip-blacklists": { type: "boolean", default: false },
      "skip-tls": { type: "boolean", default: false },
      timeout: { type: "string" },
    },
    allowPositionals: true,
    strict: false,
  });

  const flags = {
    json: values.json as boolean,
    quick: values.quick as boolean,
    verbose: values.verbose as boolean,
    help: values.help as boolean,
    version: values.version as boolean,
    skipBlacklists: values["skip-blacklists"] as boolean,
    skipTls: values["skip-tls"] as boolean,
    timeout: values.timeout
      ? parseTimeout(values.timeout as string)
      : undefined,
  };

  if (flags.help) {
    return { command: "help", flags };
  }

  if (flags.version) {
    return { command: "version", flags };
  }

  const first = positionals[0];

  if (first === "spf") {
    const domain = positionals[1];
    if (!domain) {
      return { command: "spf", flags };
    }
    if (!isValidDomain(domain)) {
      return { command: "spf", flags, invalidDomain: domain };
    }
    return { command: "spf", domain, flags };
  }

  if (first && isValidDomain(first)) {
    return { command: "check", domain: first, flags };
  }

  // No valid domain provided
  return { command: "check", flags, invalidDomain: first };
}

function parseTimeout(value: string): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(
      `Invalid --timeout value: "${value}" (must be a positive number)`
    );
    process.exit(1);
  }
  return n;
}
