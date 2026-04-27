"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wraps/ui/components/ui/card";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteSsoProvider,
  generateScimToken,
  requestDomainVerification,
  saveSsoProvider,
  verifyDomain,
} from "@/actions/sso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  organization: { id: string; name: string; slug: string };
  userRole: string;
  existingProvider: {
    id: string;
    providerId: string;
    domain: string;
    issuer: string;
    domainVerified: boolean;
  } | null;
  existingScimProvider: { id: string } | null;
};

export function OrganizationSettingsSso({
  organization,
  userRole,
  existingProvider,
  existingScimProvider,
}: Props) {
  const canEdit = ["owner", "admin"].includes(userRole);
  const [isPending, startTransition] = useTransition();

  // Setup form state
  const [issuer, setIssuer] = useState(existingProvider?.issuer ?? "");
  const [domain, setDomain] = useState(existingProvider?.domain ?? "");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // SCIM token state
  const [scimToken, setScimToken] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Verification token state
  const [verificationToken, setVerificationToken] = useState<string | null>(
    null
  );
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<
    string | null
  >(null);

  const scimBaseUrl = "https://app.wraps.dev/api/auth/scim/v2";

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  function handleSave() {
    startTransition(() => {
      const promise = saveSsoProvider(organization.id, {
        domain,
        issuer,
        clientId,
        clientSecret,
      }).then((result) => {
        if (!result.success) throw new Error(result.error);
        return result;
      });

      toast.promise(promise, {
        loading: "Saving SSO configuration...",
        success: "SSO provider saved",
        error: (err) => err.message,
      });
    });
  }

  function handleDelete() {
    if (!existingProvider) return;
    if (
      !confirm(
        "Remove this SSO provider? Users will no longer be able to sign in via SSO."
      )
    ) {
      return;
    }

    startTransition(() => {
      const promise = deleteSsoProvider(
        organization.id,
        existingProvider.providerId
      ).then((result) => {
        if (!result.success) throw new Error(result.error);
        return result;
      });

      toast.promise(promise, {
        loading: "Removing SSO provider...",
        success: "SSO provider removed",
        error: (err) => err.message,
      });
    });
  }

  function handleRequestVerification() {
    if (!existingProvider) return;

    startTransition(() => {
      const promise = requestDomainVerification(
        organization.id,
        existingProvider.providerId
      ).then((result) => {
        if (!result.success) throw new Error(result.error);
        setVerificationToken(result.token);
        setVerificationExpiresAt(result.expiresAt);
        return result;
      });

      toast.promise(promise, {
        loading: "Requesting domain verification...",
        success:
          "Verification token generated — add the TXT record to your DNS",
        error: (err) => err.message,
      });
    });
  }

  function handleVerify() {
    if (!existingProvider) return;

    startTransition(() => {
      const promise = verifyDomain(
        organization.id,
        existingProvider.providerId
      ).then((result) => {
        if (!result.success) throw new Error(result.error);
        return result;
      });

      toast.promise(promise, {
        loading: "Verifying domain...",
        success: "Domain verified — SSO is now active",
        error: (err) => err.message,
      });
    });
  }

  function handleGenerateScimToken() {
    if (!existingProvider) return;

    startTransition(() => {
      const promise = generateScimToken(
        organization.id,
        existingProvider.providerId
      ).then((result) => {
        if (!result.success) throw new Error(result.error);
        setScimToken(result.token);
        return result;
      });

      toast.promise(promise, {
        loading: "Generating SCIM token...",
        success: "SCIM token generated — copy it now, it won't be shown again",
        error: (err) => err.message,
      });
    });
  }

  return (
    <div className="space-y-6">
      {/* SSO Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Single Sign-On</CardTitle>
              <CardDescription>
                Configure OIDC-based SSO for your organization. Members can sign
                in via your identity provider (Okta, Azure AD, etc.).
              </CardDescription>
            </div>
            {existingProvider && (
              <div className="flex items-center gap-2 text-sm">
                {existingProvider.domainVerified ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Active</span>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 text-yellow-600" />
                    <span className="text-yellow-600">
                      Pending verification
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {existingProvider ? (
            existingProvider.domainVerified ? (
              /* Active SSO */
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium text-green-700 dark:text-green-400">
                    SSO is active for {existingProvider.domain}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Issuer: {existingProvider.issuer}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    disabled={isPending}
                    onClick={handleDelete}
                    variant="outline"
                  >
                    Remove SSO Provider
                  </Button>
                )}
              </div>
            ) : (
              /* Domain verification */
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium">Verify domain ownership</p>
                  <p className="mt-1 text-muted-foreground">
                    Add a DNS TXT record to{" "}
                    <strong>{existingProvider.domain}</strong> to prove you own
                    it before SSO is activated.
                  </p>
                </div>
                {verificationToken && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      DNS TXT record to add:
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm">
                      <span className="flex-1 break-all">
                        {verificationToken}
                      </span>
                      <Button
                        aria-label="Copy DNS TXT record"
                        onClick={() =>
                          handleCopy(verificationToken, "dns-token")
                        }
                        size="icon"
                        variant="ghost"
                      >
                        {copiedKey === "dns-token" ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {verificationExpiresAt && (
                      <p className="text-muted-foreground text-xs">
                        Expires{" "}
                        {new Date(verificationExpiresAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <Button
                      disabled={isPending}
                      onClick={handleRequestVerification}
                      variant="outline"
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {verificationToken
                        ? "Regenerate Token"
                        : "Get Verification Token"}
                    </Button>
                  )}
                  {canEdit && verificationToken && (
                    <Button disabled={isPending} onClick={handleVerify}>
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Verify Domain
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      className="text-destructive"
                      disabled={isPending}
                      onClick={handleDelete}
                      variant="ghost"
                    >
                      Remove Provider
                    </Button>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Setup form */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="sso-domain">
                    Domain
                  </label>
                  <Input
                    disabled={!canEdit || isPending}
                    id="sso-domain"
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="company.com"
                    value={domain}
                  />
                  <p className="text-muted-foreground text-xs">
                    The email domain your team uses
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="sso-issuer">
                    Issuer URL
                  </label>
                  <Input
                    disabled={!canEdit || isPending}
                    id="sso-issuer"
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="https://dev-123456.okta.com"
                    value={issuer}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="sso-client-id"
                  >
                    Client ID
                  </label>
                  <Input
                    disabled={!canEdit || isPending}
                    id="sso-client-id"
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="0oa..."
                    value={clientId}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="sso-client-secret"
                  >
                    Client Secret
                  </label>
                  <Input
                    disabled={!canEdit || isPending}
                    id="sso-client-secret"
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    value={clientSecret}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Sign-in Redirect URI</p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm">
                  <span className={`flex-1 break-all ${!domain ? "text-muted-foreground" : ""}`}>
                    {domain
                      ? `https://app.wraps.dev/api/auth/sso/callback/${domain}`
                      : "https://app.wraps.dev/api/auth/sso/callback/your-domain.com"}
                  </span>
                  {domain && (
                    <Button
                      aria-label="Copy sign-in redirect URI"
                      onClick={() =>
                        handleCopy(
                          `https://app.wraps.dev/api/auth/sso/callback/${domain}`,
                          "redirect-uri"
                        )
                      }
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      {copiedKey === "redirect-uri" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Add this as the sign-in redirect URI in your identity provider
                </p>
              </div>
              {canEdit && (
                <Button
                  disabled={
                    isPending ||
                    !domain ||
                    !issuer ||
                    !clientId ||
                    !clientSecret
                  }
                  onClick={handleSave}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save SSO Configuration"
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SCIM Provisioning — only shown when SSO is active */}
      {existingProvider?.domainVerified && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              SCIM Provisioning
            </CardTitle>
            <CardDescription>
              Automatically sync users and groups from your identity provider
              via the SCIM 2.0 protocol.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">SCIM Base URL</p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm">
                <span className="flex-1 break-all">{scimBaseUrl}</span>
                <Button
                  aria-label="Copy SCIM base URL"
                  onClick={() => handleCopy(scimBaseUrl, "scim-base-url")}
                  size="icon"
                  variant="ghost"
                >
                  {copiedKey === "scim-base-url" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {scimToken ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">SCIM Bearer Token</p>
                <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 font-mono text-sm dark:border-yellow-700 dark:bg-yellow-950">
                  <span className="flex-1 break-all">{scimToken}</span>
                  <Button
                    aria-label="Copy SCIM bearer token"
                    onClick={() => handleCopy(scimToken, "scim-token")}
                    size="icon"
                    variant="ghost"
                  >
                    {copiedKey === "scim-token" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Copy this token now. It won't be shown again.
                </p>
              </div>
            ) : (
              <div>
                {existingScimProvider && (
                  <p className="mb-3 text-muted-foreground text-sm">
                    A SCIM token has been generated previously. Generate a new
                    one to rotate credentials.
                  </p>
                )}
                {canEdit && (
                  <Button
                    disabled={isPending}
                    onClick={handleGenerateScimToken}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    {existingScimProvider
                      ? "Rotate SCIM Token"
                      : "Generate SCIM Token"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
