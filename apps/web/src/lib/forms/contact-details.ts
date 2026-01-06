import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

// Schema for updating contact details
export const contactDetailsSchema = z.object({
  email: z.string().email("Invalid email address").or(z.literal("")),
  phone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string(),
  jobTitle: z.string(),
  emailStatus: z.enum(["active", "unsubscribed", "bounced", "complained"]),
  smsStatus: z.enum(["pending_consent", "opted_in", "opted_out", "invalid"]),
});

export type ContactDetailsInput = z.infer<typeof contactDetailsSchema>;

// Form options for contact details
export const contactDetailsFormOpts = formOptions({
  defaultValues: {
    email: "",
    phone: "",
    firstName: "",
    lastName: "",
    company: "",
    jobTitle: "",
    emailStatus: "active",
    smsStatus: "pending_consent",
  } satisfies ContactDetailsInput,
});
