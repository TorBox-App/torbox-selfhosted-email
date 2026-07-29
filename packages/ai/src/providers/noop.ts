import type { LanguageModel } from "ai";
import { ok, type ProviderSpec } from "../registry";
import type { AIProvider } from "../types";

/**
 * A provider that resolves without credentials and never reaches the network.
 *
 * Tests set `WRAPS_AI_PROVIDER=noop` to exercise the surrounding request
 * plumbing — auth, permissions, quota, tracking — without stubbing the AI SDK.
 * Calling the model itself throws, loudly and on purpose: a silent stub would
 * let a test claim a generation succeeded when nothing was generated.
 */
export const noopSpec: ProviderSpec<AIProvider> = {
  id: "noop",
  label: "No-op (testing)",
  prepare: () =>
    ok(() =>
      Promise.resolve({
        id: "noop",
        languageModel: (request) => ({
          model: new Proxy(
            {},
            {
              get() {
                throw new Error(
                  "The noop AI provider cannot generate. Set WRAPS_AI_PROVIDER to a real provider."
                );
              },
            }
          ) as LanguageModel,
          modelId: request.model ?? "noop",
          modelKey: request.model ?? "noop",
          providerId: "noop",
          capabilities: new Set<never>(),
          catalogued: false,
          providerOptions: undefined,
          cache: {},
        }),
      } satisfies AIProvider)
    ),
};
