import { gateway } from "@ai-sdk/gateway";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export function getAIModel(fallbackModel = DEFAULT_MODEL) {
  const modelId = process.env.AI_MODEL ?? fallbackModel;
  return { model: gateway(modelId), modelId };
}
