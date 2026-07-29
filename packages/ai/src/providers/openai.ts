import { reasoningOptions } from "../call-options";
import { DEFAULT_OPENAI_MODEL } from "../catalog";
import { fail, ok, type ProviderSpec } from "../registry";
import { resolveModelId } from "../resolve-model";
import type { AIProvider } from "../types";

/**
 * OpenAI, called directly rather than through the gateway.
 *
 * `OPENAI_BASE_URL` is honoured so this also covers OpenAI-compatible
 * endpoints — corporate proxies, LiteLLM, vLLM and similar. Azure OpenAI needs
 * its own provider and is deliberately out of scope here.
 */
export const openaiSpec: ProviderSpec<AIProvider> = {
  id: "openai",
  label: "OpenAI",
  prepare: (env) => {
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return fail({
        code: "missing_api_key",
        message:
          "The OpenAI provider requires OPENAI_API_KEY. Set it, or unset WRAPS_AI_PROVIDER to use the Vercel AI Gateway.",
        envVars: ["OPENAI_API_KEY", "WRAPS_AI_PROVIDER"],
      });
    }

    const override = env.AI_MODEL?.trim() || undefined;
    if (override) {
      const check = resolveModelId({
        providerId: "openai",
        requested: override,
        fallback: DEFAULT_OPENAI_MODEL,
      });
      if (!check.ok) {
        return fail(check.issue);
      }
    }

    const baseURL = env.OPENAI_BASE_URL?.trim() || undefined;

    return ok(async () => {
      // Dynamic so the OpenAI SDK stays out of the bundle unless selected.
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey, baseURL });

      return {
        id: "openai",
        languageModel: (request) => {
          const resolved = resolveModelId({
            providerId: "openai",
            requested: override,
            fallback: request.model ?? DEFAULT_OPENAI_MODEL,
          });
          if (!resolved.ok) {
            throw new Error(resolved.issue.message);
          }
          const { modelId, modelKey, capabilities, catalogued } =
            resolved.value;

          return {
            model: openai(modelId),
            modelId,
            modelKey,
            providerId: "openai",
            capabilities,
            catalogued,
            providerOptions: capabilities.has("reasoning")
              ? reasoningOptions("openai", request.reasoning?.effort)
              : undefined,
            cache: {
              // No breakpoint: OpenAI caches prompts over ~1024 tokens
              // automatically. promptCacheKey only steers which cache shard a
              // request lands on, and is attached by the caller in A6.
              breakpoint: undefined,
            },
          };
        },
      } satisfies AIProvider;
    });
  },
};
