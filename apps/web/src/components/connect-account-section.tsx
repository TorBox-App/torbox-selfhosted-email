"use client";

import { ConnectAWSAccountForm } from "@/components/forms/connect-aws-account-form";

type ConnectAccountSectionProps = {
  organizationId: string;
  /**
   * True on self-hosted deployments. Threaded from a server component calling
   * `isSelfHosted()`; the license key must never reach the client bundle.
   */
  selfHosted: boolean;
};

export function ConnectAccountSection({
  organizationId,
  selfHosted,
}: ConnectAccountSectionProps) {
  return (
    <div className="px-4 lg:px-6" id="connect-account">
      <h2 className="mb-4 font-semibold text-xl">Connect New Account</h2>
      <ConnectAWSAccountForm
        onSuccess={() => {
          // Refresh the page to show the new account
          window.location.reload();
        }}
        organizationId={organizationId}
        selfHosted={selfHosted}
      />
    </div>
  );
}
