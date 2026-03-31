import { z } from "zod";

export const DeployFlowSchema = z.object({
	domain: z.string().default("acme.dev"),
	region: z.string().default("us-east-1"),
	regionLabel: z.string().default("US East (N. Virginia)"),
});
