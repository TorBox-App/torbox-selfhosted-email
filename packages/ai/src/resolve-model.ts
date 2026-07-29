import { inferCapabilities, lookupCatalog, type ProviderId } from "./catalog";
import type { ConfigIssue } from "./registry";
import type { AICapability } from "./types";

export type ModelResolution = {
  readonly modelId: string;
  readonly modelKey: string;
  readonly capabilities: ReadonlySet<AICapability>;
  readonly catalogued: boolean;
};

/**
 * Resolve the requested model to a provider-native id.
 *
 * Precedence is `AI_MODEL` > the call site's preferred model. That order is
 * inherited from the original `getAIModel()` and is load-bearing: AI_MODEL is
 * the deployment-wide override, so it has to beat a per-route default.
 */
export function resolveModelId(args: {
  readonly providerId: ProviderId;
  readonly requested: string | undefined;
  readonly fallback: string;
}):
  | { readonly ok: true; readonly value: ModelResolution }
  | {
      readonly ok: false;
      readonly issue: ConfigIssue;
    } {
  const requested = args.requested?.trim() || args.fallback;
  const entry = lookupCatalog(requested);

  if (entry) {
    const modelId = entry.ids[args.providerId];
    if (!modelId) {
      return {
        ok: false,
        issue: {
          code: "unsupported_model_for_provider",
          message: `Model "${requested}" has no ${args.providerId} equivalent. Supported providers for it: ${Object.keys(entry.ids).join(", ")}.`,
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
