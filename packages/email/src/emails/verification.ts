import { getWrapsClient } from "../lib/client";

export type SendVerificationEmailParams = {
  to: string;
  url: string;
  name?: string;
};

export async function sendVerificationEmail({
  to,
  url,
  name,
}: SendVerificationEmailParams) {
  const wraps = await getWrapsClient();

  return wraps.sendTemplate({
    from: process.env.EMAIL_FROM || "Wraps <hello@wraps.dev>",
    to,
    template: "email-verification",
    templateData: {
      name: name || "",
      verificationUrl: url,
    },
  });
}
