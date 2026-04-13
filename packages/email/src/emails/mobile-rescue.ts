import { getWrapsClient } from "../lib/client";

export type SendMobileRescueEmailParams = {
  to: string;
  dashboardUrl: string;
  orgName: string;
};

export async function sendMobileRescueEmail({
  to,
  dashboardUrl,
  orgName,
}: SendMobileRescueEmailParams) {
  const wraps = await getWrapsClient();

  return wraps.sendTemplate({
    from: process.env.EMAIL_FROM || "Wraps <hello@wraps.dev>",
    to,
    template: "mobile-rescue",
    templateData: {
      orgName,
      dashboardUrl,
    },
  });
}
