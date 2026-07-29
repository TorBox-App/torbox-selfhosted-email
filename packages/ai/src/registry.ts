/**
 * Generic provider-selection idiom: validate env purely, instantiate lazily.
 *
 * `prepare` returns a thunk rather than a provider. That split is the whole
 * point — `validate()` can run at boot, in CI and in tests with no side effects
 * and no network, while the heavy SDK import stays behind `resolve()` and only
 * runs for the provider actually selected.
 *
 * This lives here rather than in a shared package because `@wraps/ai` is its
 * only consumer today. Lift it out when a second domain genuinely needs it.
 */

export type ProviderEnv = Readonly<Record<string, string | undefined>>;

export type ConfigIssue = {
  /** Machine-readable, safe to log and to switch on. */
  readonly code: string;
  /** Operator-facing. Never contains secret values. */
  readonly message: string;
  /** The env var(s) the operator should fix. */
  readonly envVars: readonly string[];
};

export type ConfigResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

export const ok = <T>(value: T): ConfigResult<T> => ({ ok: true, value });

export const fail = <T>(...issues: ConfigIssue[]): ConfigResult<T> => ({
  ok: false,
  issues,
});

export type ProviderSpec<TProvider> = {
  readonly id: string;
  readonly label: string;
  readonly prepare: (
    env: ProviderEnv
  ) => ConfigResult<() => Promise<TProvider>>;
};

export type ProviderConfigError = Error & {
  readonly kind: "provider-config";
  readonly domain: string;
  readonly issues: readonly ConfigIssue[];
};

export function providerConfigError(
  domain: string,
  issues: readonly ConfigIssue[]
): ProviderConfigError {
  const error = new Error(
    `${domain}: ${issues.map((issue) => issue.message).join("; ")}`
  );
  return Object.assign(error, {
    kind: "provider-config" as const,
    domain,
    issues,
  });
}

export function isProviderConfigError(
  value: unknown
): value is ProviderConfigError {
  return (
    value instanceof Error &&
    (value as Partial<ProviderConfigError>).kind === "provider-config"
  );
}

export type Registry<TProvider> = {
  readonly ids: readonly string[];
  /** Pure. Safe at boot, in tests, in CI. Never throws, never instantiates. */
  readonly validate: (env: ProviderEnv) => readonly ConfigIssue[];
  /** Instantiates. Throws ProviderConfigError when the config is invalid. */
  readonly resolve: (env: ProviderEnv) => Promise<TProvider>;
};

export function createRegistry<TProvider>(opts: {
  readonly domain: string;
  readonly selectorEnvVar: string;
  readonly defaultId: string;
  readonly specs: readonly ProviderSpec<TProvider>[];
  /** Deployment-level gate, applied before the spec's own validation. */
  readonly gate?: (id: string, env: ProviderEnv) => ConfigIssue | undefined;
}): Registry<TProvider> {
  const byId = new Map(opts.specs.map((spec) => [spec.id, spec]));

  const prepare = (
    env: ProviderEnv
  ): ConfigResult<() => Promise<TProvider>> => {
    const id = env[opts.selectorEnvVar]?.trim().toLowerCase() || opts.defaultId;
    const spec = byId.get(id);
    if (!spec) {
      return fail({
        code: "unknown_provider",
        message: `Unknown ${opts.domain} provider "${id}". Valid options: ${[...byId.keys()].join(", ")}.`,
        envVars: [opts.selectorEnvVar],
      });
    }
    const gated = opts.gate?.(id, env);
    if (gated) {
      return fail(gated);
    }
    return spec.prepare(env);
  };

  return {
    ids: [...byId.keys()],
    validate: (env) => {
      const result = prepare(env);
      return result.ok ? [] : result.issues;
    },
    resolve: async (env) => {
      const result = prepare(env);
      if (!result.ok) {
        throw providerConfigError(opts.domain, result.issues);
      }
      return await result.value();
    },
  };
}

/**
 * Resolve once per process. A rejected attempt clears the cache so a transient
 * failure stays retryable instead of poisoning the process.
 */
export function memoizeAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;
  return () => {
    inFlight ??= fn().catch((error: unknown) => {
      inFlight = undefined;
      throw error;
    });
    return inFlight;
  };
}
