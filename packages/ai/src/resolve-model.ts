import { inferCapabilities, lookupCatalog, type ProviderId } from "./catalog";
import { type ConfigIssue, providerConfigError } from "./registry";
import type { AICapability } from "./types";

/** The registry domain, shared so a request-time throw is tagged like a boot one. */
export const AI_DOMAIN = "AI provider";

export type ModelResolution = {
  readonly modelId: string;
  readonly modelKey: string;
  readonly capabilities: ReadonlySet<AICapability>;
  readonly catalogued: boolean;
  /**
   * The call site's preferred model, when this provider could not serve it and
   * the provider default was used instead. Callers log it — a silent model
   * downgrade is the class of failure this package exists to eliminate.
   */
  readonly degradedFrom?: string;
};

export type Resolution =
  | { readonly ok: true; readonly value: ModelResolution }
  | { readonly ok: false; readonly issue: ConfigIssue };

function lookup(providerId: ProviderId, requested: string): Resolution {
  const entry = lookupCatalog(requested);

  if (entry) {
    const modelId = entry.ids[providerId];
    if (!modelId) {
      return {
        ok: false,
        issue: {
          code: "unsupported_model_for_provider",
          message: `Model "${requested}" has no ${providerId} equivalent. Supported providers for it: ${Object.keys(entry.ids).join(", ")}.`,
          envVars: ["AI_MODEL", "WRAPS_AI_PROVIDER"],
        },
      };
    }
    return {
      ok: true,
      value: {
        modelId,
        modelKey: requested,
        capabilities: new Set(entry.capabilities),
        catalogued: true,
      },
    };
  }

  // Native passthrough. This is the documented escape hatch for models we have
  // not catalogued yet, and for Bedrock inference profiles AWS adds without
  // notice.
  return {
    ok: true,
    value: {
      modelId: requested,
      modelKey: requested,
      capabilities: new Set(inferCapabilities(requested)),
      catalogued: false,
    },
  };
}

/**
 * Resolve the requested model to a provider-native id.
 *
 * Precedence is `AI_MODEL` > the call site's preferred model > the provider's
 * default. That order is inherited from the original `getAIModel()` and is
 * load-bearing: AI_MODEL is the deployment-wide override, so it has to beat a
 * per-route default.
 *
 * The top two tiers fail DIFFERENTLY, and that distinction is the point:
 *
 * - `requested` is what the operator put in AI_MODEL. A provider that cannot
 *   serve it is a misconfiguration, reported at boot before anyone clicks
 *   Generate.
 * - `preferred` is a route's historical model choice, made back when the
 *   gateway was the only backend. `grok-code-fast` has no Anthropic equivalent
 *   and never will, so treating that as fatal would take the template AI chat
 *   route down on every non-gateway provider. It degrades to the default and
 *   records what it dropped.
 */
export function resolveModelId(args: {
  readonly providerId: ProviderId;
  /** The AI_MODEL deployment override. Unserveable ⇒ hard fail. */
  readonly requested: string | undefined;
  /** The call site's preferred model. Unserveable ⇒ provider default. */
  readonly preferred?: string;
  /** The provider's own default, which it must always be able to serve. */
  readonly fallback: string;
}): Resolution {
  const override = args.requested?.trim();
  if (override) {
    return lookup(args.providerId, override);
  }

  const preferred = args.preferred?.trim();
  if (preferred) {
    const wanted = lookup(args.providerId, preferred);
    if (wanted.ok) {
      return wanted;
    }
    const fallback = lookup(args.providerId, args.fallback);
    return fallback.ok
      ? { ok: true, value: { ...fallback.value, degradedFrom: preferred } }
      : fallback;
  }

  return lookup(args.providerId, args.fallback);
}

/**
 * Unwrap a resolution, throwing the same tagged error the registry throws.
 *
 * `providerConfigError`, not a bare `Error`: the routes branch on
 * `isProviderConfigError` to answer 503 and to log the operator-facing message
 * naming the env var to fix. A plain Error lands in the generic 500 path and
 * that detail is lost.
 */
export function unwrapModelResolution(result: Resolution): ModelResolution {
  if (!result.ok) {
    throw providerConfigError(AI_DOMAIN, [result.issue]);
  }
  return result.value;
}
