import { z } from "zod";

export const generateCodeBodySchema = z.object({
  messages: z.array(z.any()).min(1, "Messages are required"),
  templateId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  brandKitId: z.string().optional(),
  existingSource: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  imageMediaType: z.string().optional(),
});

export type GenerateCodeBody = z.infer<typeof generateCodeBodySchema>;
