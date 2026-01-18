"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Info,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Custom include with resolved lookup count
type CustomInclude = {
  domain: string;
  lookups: number | null; // null = loading/unknown
  loading?: boolean;
  error?: string;
};

// Fetch SPF record via Cloudflare DNS-over-HTTPS
async function fetchSpfRecord(domain: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
      { headers: { Accept: "application/dns-json" } }
    );
    const data = await res.json();
    if (!data.Answer) return null;

    // Find the SPF record among TXT records
    for (const answer of data.Answer) {
      const txt = answer.data?.replace(/"/g, "") || "";
      if (txt.startsWith("v=spf1")) {
        return txt;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Count DNS lookups in an SPF record (recursive)
async function countSpfLookups(
  domain: string,
  visited: Set<string> = new Set()
): Promise<number> {
  // Prevent infinite loops
  if (visited.has(domain)) return 0;
  visited.add(domain);

  const record = await fetchSpfRecord(domain);
  if (!record) return 1; // Count the failed lookup attempt

  let count = 0;
  const parts = record.split(/\s+/);

  for (const part of parts) {
    const mechanism = part.replace(/^[+\-~?]/, ""); // Remove qualifier

    if (mechanism.startsWith("include:")) {
      const includeDomain = mechanism.replace("include:", "");
      count += 1; // The include itself is 1 lookup
      count += await countSpfLookups(includeDomain, visited); // Plus nested lookups
    } else if (mechanism.startsWith("redirect=")) {
      const redirectDomain = mechanism.replace("redirect=", "");
      count += 1;
      count += await countSpfLookups(redirectDomain, visited);
    } else if (
      mechanism.startsWith("a:") ||
      mechanism.startsWith("a/") ||
      mechanism === "a"
    ) {
      count += 1;
    } else if (
      mechanism.startsWith("mx:") ||
      mechanism.startsWith("mx/") ||
      mechanism === "mx"
    ) {
      count += 1;
    } else if (mechanism.startsWith("ptr") || mechanism === "ptr") {
      count += 1;
    } else if (mechanism.startsWith("exists:")) {
      count += 1;
    }
    // ip4:, ip6:, all don't count as lookups
  }

  return count;
}

// Provider data with verified SPF mechanisms and lookup counts
// All mechanisms verified via DNS lookup on 2026-01-16
const PROVIDERS: Record<
  string,
  { name: string; mechanism: string; lookups: number; logo: string }
> = {
  // Email providers - verified
  google: {
    name: "Google Workspace",
    mechanism: "include:_spf.google.com",
    lookups: 1, // Only contains IP ranges
    logo: "google.png",
  },
  microsoft: {
    name: "Microsoft 365",
    mechanism: "include:spf.protection.outlook.com",
    lookups: 1, // Only contains IP ranges
    logo: "microsoft.png",
  },
  // Transactional - verified
  ses: {
    name: "AWS SES",
    mechanism: "include:amazonses.com",
    lookups: 1, // Only contains IP ranges
    logo: "aws.png",
  },
  sendgrid: {
    name: "SendGrid",
    mechanism: "include:sendgrid.net",
    lookups: 2, // Includes ab.sendgrid.net
    logo: "sendgrid.png",
  },
  postmark: {
    name: "Postmark",
    mechanism: "include:spf.mtasv.net",
    lookups: 1, // Only contains IP ranges
    logo: "postmark.png",
  },
  mailgun: {
    name: "Mailgun",
    mechanism: "include:mailgun.org",
    lookups: 5, // Complex: includes _spf.mailgun.org, _spf.eu.mailgun.org, then _spf1/_spf2
    logo: "mailgun.png",
  },
  // Marketing/CRM - verified
  activecampaign: {
    name: "ActiveCampaign",
    mechanism: "include:emsd1.com",
    lookups: 1, // Only contains IP ranges
    logo: "activecampaign.png",
  },
  constantcontact: {
    name: "Constant Contact",
    mechanism: "include:spf.constantcontact.com",
    lookups: 1, // Only contains IP ranges
    logo: "constantcontact.png",
  },
  convertkit: {
    name: "ConvertKit",
    mechanism: "include:convertkit.com",
    lookups: 3, // Includes _spf.google.com + hubspotemail.net
    logo: "convertkit.png",
  },
  customerio: {
    name: "Customer.io",
    mechanism: "include:customeriomail.com",
    lookups: 3, // Includes sendgrid.net
    logo: "customerio.png",
  },
  klaviyo: {
    name: "Klaviyo",
    mechanism: "include:send.klaviyo.com",
    lookups: 3, // CNAMEs to sendgrid.net
    logo: "klaviyo.png",
  },
  // Business tools - verified
  salesforce: {
    name: "Salesforce",
    mechanism: "include:_spf.salesforce.com",
    lookups: 2, // Uses exists: mechanism
    logo: "salesforce.png",
  },
  zendesk: {
    name: "Zendesk",
    mechanism: "include:mail.zendesk.com",
    lookups: 1, // Only contains IP ranges
    logo: "zendesk.png",
  },
  freshdesk: {
    name: "Freshdesk",
    mechanism: "include:email.freshdesk.com",
    lookups: 7, // Includes sendgrid.net (2) + 4 freshemail.io subdomains
    logo: "freshdesk.png",
  },
  zoho: {
    name: "Zoho",
    mechanism: "include:zoho.com",
    lookups: 4, // Includes spf.zoho.com + zcsend.net + spf.zohomail.com (all IPs)
    logo: "zoho.png",
  },
  stripe: {
    name: "Stripe",
    mechanism: "include:spf1.stripe.com",
    lookups: 4, // Includes _spf.google.com, amazonses.com, mail.zendesk.com
    logo: "stripe.png",
  },
};

// Qualifier options
const QUALIFIERS: Record<
  string,
  { label: string; description: string; recommended?: boolean }
> = {
  "-all": {
    label: "Hard Fail (-all)",
    description: "Reject unauthorized mail — recommended for production",
    recommended: true,
  },
  "~all": {
    label: "Soft Fail (~all)",
    description: "Accept but mark suspicious — good for initial testing",
  },
  "?all": {
    label: "Neutral (?all)",
    description: "No assertion — testing only, not recommended",
  },
};

export default function SPFBuilderPageContent() {
  const [selectedProviders, setSelectedProviders] = useState<string[]>(["ses"]);
  const [customIPs, setCustomIPs] = useState<string[]>([]);
  const [customIncludes, setCustomIncludes] = useState<CustomInclude[]>([]);
  const [newIP, setNewIP] = useState("");
  const [newInclude, setNewInclude] = useState("");
  const [newIncludeLoading, setNewIncludeLoading] = useState(false);
  const [qualifier, setQualifier] = useState("-all");
  const [copied, setCopied] = useState(false);

  // Calculate total lookups using real counts from custom includes
  const lookupCount = useMemo(() => {
    const providerLookups = selectedProviders.reduce(
      (sum, p) => sum + (PROVIDERS[p]?.lookups || 0),
      0
    );
    // Use real lookup counts, default to 2 if still loading
    const customLookups = customIncludes.reduce(
      (sum, inc) => sum + (inc.lookups ?? 2),
      0
    );
    return providerLookups + customLookups;
  }, [selectedProviders, customIncludes]);

  // Generate the SPF record
  const spfRecord = useMemo(() => {
    const parts = ["v=spf1"];

    // Add custom IPs first (they don't count toward lookups)
    for (const ip of customIPs) {
      parts.push(ip.includes(":") ? `ip6:${ip}` : `ip4:${ip}`);
    }

    // Add provider includes
    for (const p of selectedProviders) {
      if (PROVIDERS[p]) {
        parts.push(PROVIDERS[p].mechanism);
      }
    }

    // Add custom includes
    for (const inc of customIncludes) {
      parts.push(`include:${inc.domain}`);
    }

    // Add qualifier
    parts.push(qualifier);

    return parts.join(" ");
  }, [selectedProviders, customIPs, customIncludes, qualifier]);

  const toggleProvider = (key: string) => {
    setSelectedProviders((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const addIP = () => {
    const trimmed = newIP.trim();
    if (trimmed && !customIPs.includes(trimmed)) {
      // Basic validation for IPv4 or IPv6
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
      const ipv6Regex = /^[a-fA-F0-9:]+$/;
      if (ipv4Regex.test(trimmed) || ipv6Regex.test(trimmed)) {
        setCustomIPs((prev) => [...prev, trimmed]);
        setNewIP("");
      }
    }
  };

  const removeIP = (ip: string) => {
    setCustomIPs((prev) => prev.filter((i) => i !== ip));
  };

  const addInclude = useCallback(async () => {
    let trimmed = newInclude.trim();
    // Remove include: prefix if user added it
    if (trimmed.startsWith("include:")) {
      trimmed = trimmed.replace("include:", "");
    }
    if (!trimmed || customIncludes.some((inc) => inc.domain === trimmed)) {
      return;
    }

    setNewInclude("");
    setNewIncludeLoading(true);

    // Add with loading state
    const newInc: CustomInclude = {
      domain: trimmed,
      lookups: null,
      loading: true,
    };
    setCustomIncludes((prev) => [...prev, newInc]);

    // Resolve the actual lookup count
    try {
      const lookups = await countSpfLookups(trimmed);
      setCustomIncludes((prev) =>
        prev.map((inc) =>
          inc.domain === trimmed ? { ...inc, lookups, loading: false } : inc
        )
      );
    } catch {
      setCustomIncludes((prev) =>
        prev.map((inc) =>
          inc.domain === trimmed
            ? { ...inc, lookups: 2, loading: false, error: "Failed to resolve" }
            : inc
        )
      );
    }

    setNewIncludeLoading(false);
  }, [newInclude, customIncludes]);

  const removeInclude = (domain: string) => {
    setCustomIncludes((prev) => prev.filter((i) => i.domain !== domain));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(spfRecord);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = () => {
    if (lookupCount > 10) return "text-red-500";
    if (lookupCount > 7) return "text-yellow-500";
    return "text-green-500";
  };

  const getProgressColor = () => {
    if (lookupCount > 10) return "bg-red-500";
    if (lookupCount > 7) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <a className="flex items-center gap-2 font-bold text-xl" href="/">
            <Shield className="size-6" />
            Wraps Email Tools
          </a>
          <div className="flex items-center gap-3">
            <Button asChild size="sm" variant="ghost">
              <a href="/tools">Email Checker</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/">Back to Home</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <Badge className="mb-4" variant="outline">
              Free Tool
            </Badge>
            <h1 className="mb-4 font-bold text-4xl tracking-tight">
              SPF Record Builder
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Build valid SPF records while tracking the 10-lookup limit. Select
              your email providers and we'll generate the correct syntax.
            </p>
          </div>

          <div className="space-y-6">
            {/* Lookup Counter */}
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium text-muted-foreground text-sm">
                    DNS Lookups Used
                  </span>
                  <span className={`font-bold text-2xl ${getStatusColor()}`}>
                    {lookupCount} / 10
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${getProgressColor()}`}
                    style={{
                      width: `${Math.min((lookupCount / 10) * 100, 100)}%`,
                    }}
                  />
                </div>
                {lookupCount > 10 && (
                  <div className="mt-3 flex items-start gap-2 text-red-500 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Exceeds 10-lookup limit! SPF will return PermError and
                      DMARC will fail. Consider using IP addresses or SPF
                      flattening.
                    </span>
                  </div>
                )}
                {lookupCount > 7 && lookupCount <= 10 && (
                  <div className="mt-3 flex items-start gap-2 text-yellow-500 text-sm">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      Approaching limit. Consider using ip4/ip6 mechanisms
                      (which don't count) or SPF flattening.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Provider Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Email Service Providers</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Select all the services that send email on behalf of your
                  domain
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(PROVIDERS).map(([key, provider]) => (
                    <button
                      aria-label={`${provider.name}, ${provider.lookups} lookup${provider.lookups > 1 ? "s" : ""}`}
                      aria-pressed={selectedProviders.includes(key)}
                      className={`flex items-stretch gap-3 rounded-lg border text-left transition-all ${
                        selectedProviders.includes(key)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:border-muted-foreground/50"
                      }`}
                      key={key}
                      onClick={() => toggleProvider(key)}
                      type="button"
                    >
                      <div className="flex w-12 shrink-0 items-center justify-center rounded-l-lg bg-muted/50 p-2">
                        <img
                          alt={provider.name}
                          className="h-8 w-8 object-contain grayscale"
                          src={`/logos/${provider.logo}`}
                        />
                      </div>
                      <div className="flex flex-col justify-center py-2 pr-3">
                        <span className="font-medium text-sm leading-tight">
                          {provider.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          +{provider.lookups} lookup
                          {provider.lookups > 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom include input */}
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 font-medium text-sm">Other Provider</p>
                  <div className="flex gap-2">
                    <Input
                      aria-label="Custom SPF include domain"
                      className="flex-1 font-mono text-sm"
                      disabled={newIncludeLoading}
                      onChange={(e) => setNewInclude(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addInclude()}
                      placeholder="_spf.example.com"
                      value={newInclude}
                    />
                    <Button
                      aria-label="Add include"
                      disabled={newIncludeLoading || !newInclude.trim()}
                      onClick={addInclude}
                      variant="secondary"
                    >
                      {newIncludeLoading ? (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Plus aria-hidden="true" className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-muted-foreground text-xs">
                    Add any SPF include mechanism. We'll resolve the actual
                    lookup count.
                  </p>
                  {customIncludes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customIncludes.map((inc) => (
                        <span
                          className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm"
                          key={inc.domain}
                        >
                          <span className="font-mono">
                            include:{inc.domain}
                          </span>
                          <span className="text-muted-foreground">
                            {inc.loading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              `+${inc.lookups}`
                            )}
                          </span>
                          <button
                            aria-label={`Remove ${inc.domain}`}
                            className="text-muted-foreground hover:text-red-500"
                            onClick={() => removeInclude(inc.domain)}
                            type="button"
                          >
                            <Trash2
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Custom IPs */}
            <Card>
              <CardHeader>
                <CardTitle>Custom IP Addresses</CardTitle>
                <p className="text-muted-foreground text-sm">
                  IP mechanisms don't count toward the 10-lookup limit. Add
                  dedicated sending IPs here.
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-2">
                  <Input
                    aria-label="Custom IP address"
                    className="flex-1"
                    onChange={(e) => setNewIP(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addIP()}
                    placeholder="Enter IPv4 or IPv6 address (e.g., 192.0.2.1 or 2001:db8::1)"
                    value={newIP}
                  />
                  <Button
                    aria-label="Add IP address"
                    onClick={addIP}
                    variant="secondary"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
                {customIPs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customIPs.map((ip) => (
                      <span
                        className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 font-mono text-sm"
                        key={ip}
                      >
                        {ip.includes(":") ? "ip6:" : "ip4:"}
                        {ip}
                        <button
                          aria-label={`Remove IP ${ip}`}
                          className="text-muted-foreground hover:text-red-500"
                          onClick={() => removeIP(ip)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Qualifier Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Catch-all Qualifier</CardTitle>
                <p className="text-muted-foreground text-sm">
                  What should happen to mail from unauthorized sources?
                </p>
              </CardHeader>
              <CardContent>
                <div
                  aria-label="SPF qualifier"
                  className="space-y-2"
                  role="radiogroup"
                >
                  {Object.entries(QUALIFIERS).map(([key, q]) => (
                    <button
                      aria-checked={qualifier === key}
                      className={`w-full rounded-lg border p-3 text-left transition-all ${
                        qualifier === key
                          ? "border-primary bg-primary/10"
                          : "border-border bg-muted/30 hover:border-muted-foreground/50"
                      }`}
                      key={key}
                      onClick={() => setQualifier(key)}
                      role="radio"
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">
                          {q.label}
                          {q.recommended && (
                            <Badge className="ml-2" variant="secondary">
                              Recommended
                            </Badge>
                          )}
                        </span>
                        {qualifier === key && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {q.description}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Generated Record */}
            <Card className="border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated SPF Record</CardTitle>
                  <Button
                    onClick={copyToClipboard}
                    size="sm"
                    variant="secondary"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-sm">
                  <span className="text-purple-500 dark:text-purple-400">
                    v=spf1
                  </span>
                  {customIPs.map((ip) => (
                    <span className="text-cyan-600 dark:text-cyan-400" key={ip}>
                      {" "}
                      {ip.includes(":") ? "ip6:" : "ip4:"}
                      {ip}
                    </span>
                  ))}
                  {selectedProviders.map((p) => (
                    <span
                      className="text-green-600 dark:text-green-400"
                      key={p}
                    >
                      {" "}
                      {PROVIDERS[p]?.mechanism}
                    </span>
                  ))}
                  {customIncludes.map((inc) => (
                    <span
                      className="text-blue-600 dark:text-blue-400"
                      key={inc.domain}
                    >
                      {" "}
                      include:{inc.domain}
                    </span>
                  ))}
                  <span
                    className={
                      qualifier === "-all"
                        ? "text-green-600 dark:text-green-400"
                        : qualifier === "~all"
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-muted-foreground"
                    }
                  >
                    {" "}
                    {qualifier}
                  </span>
                </div>
                <p className="mt-3 text-muted-foreground text-xs">
                  Add this as a TXT record at your domain's root (@). If you
                  already have an SPF record, you'll need to merge them — you
                  can only have one SPF record per domain.
                </p>
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    What counts as a lookup?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  <code className="text-foreground">include:</code>,{" "}
                  <code className="text-foreground">a</code>,{" "}
                  <code className="text-foreground">mx</code>,{" "}
                  <code className="text-foreground">ptr</code>, and{" "}
                  <code className="text-foreground">exists</code> mechanisms all
                  require DNS lookups.{" "}
                  <code className="text-foreground">ip4:</code> and{" "}
                  <code className="text-foreground">ip6:</code> do not.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Why the 10-lookup limit?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  RFC 7208 limits SPF to 10 DNS lookups to prevent denial of
                  service attacks. Exceeding this causes a PermError, which
                  fails DMARC alignment.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    What is SPF flattening?
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  SPF flattening resolves includes to their IP addresses,
                  eliminating lookups. But IPs can change, requiring regular
                  updates or a service like Valimail.
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
                  <div className="flex-1">
                    <h3 className="mb-2 font-bold text-xl">
                      Check your full email setup
                    </h3>
                    <p className="text-muted-foreground">
                      Use our Email Deliverability Checker to verify SPF, DKIM,
                      DMARC, and more.
                    </p>
                  </div>
                  <Button asChild size="lg">
                    <a href="/tools">
                      Check Your Domain
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Learn More */}
            <div className="text-center">
              <p className="mb-4 text-muted-foreground">
                Want to learn more about SPF and the 10-lookup problem?
              </p>
              <Button asChild variant="outline">
                <a href="/blog/spf-guide">
                  Read: The SPF 10-Lookup Limit Explained
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
