"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Key,
  Loader2,
  Mail,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// API base URL - use prod API
const API_URL = "https://api.wraps.dev";

type EmailCheckResult = {
  success: boolean;
  domain: string;
  checkedAt: string;
  duration: number;
  score: {
    grade: string;
    score: number;
    maxScore: number;
  };
  spf: {
    exists: boolean;
    valid: boolean;
    record: string | null;
    lookupCount: number;
    allMechanism: string | null;
  };
  dkim: {
    found: boolean;
    selectorsFound: Array<{
      selector: string;
      keyType: string;
      keyBits: number;
    }>;
    warnings: string[];
  };
  dmarc: {
    exists: boolean;
    valid: boolean;
    record: string | null;
    policy: string | null;
    subdomainPolicy: string | null;
    reportingEnabled: boolean;
    pct: number | null;
  };
  mx: {
    exists: boolean;
    records: Array<{
      exchange: string;
      priority: number;
      resolves: boolean;
    }>;
  };
  issues: Array<{
    check: string;
    reason: string;
    points: number;
    severity: "critical" | "warning" | "info";
  }>;
  error?: string;
};

function GradeDisplay({ grade, score }: { grade: string; score: number }) {
  const gradeColors: Record<string, string> = {
    "A+": "text-green-500 border-green-500",
    A: "text-green-500 border-green-500",
    "A-": "text-green-600 border-green-600",
    "B+": "text-lime-500 border-lime-500",
    B: "text-lime-500 border-lime-500",
    "B-": "text-yellow-500 border-yellow-500",
    "C+": "text-yellow-500 border-yellow-500",
    C: "text-orange-500 border-orange-500",
    "C-": "text-orange-500 border-orange-500",
    D: "text-red-500 border-red-500",
    F: "text-red-600 border-red-600",
  };

  const colorClass = gradeColors[grade] || "text-muted-foreground border-muted";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-4 font-bold text-4xl ${colorClass}`}
      >
        {grade}
      </div>
      <div className="text-muted-foreground text-sm">{score}/100 points</div>
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: "pass" | "warn" | "fail" | "none";
  label: string;
}) {
  const config = {
    pass: {
      icon: Check,
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    warn: {
      icon: AlertTriangle,
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    fail: {
      icon: X,
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    none: {
      icon: X,
      className: "bg-muted text-muted-foreground border-muted",
    },
  };

  const { icon: Icon, className } = config[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function RecordDisplay({
  label,
  record,
  status,
}: {
  label: string;
  record: string | null;
  status: "pass" | "warn" | "fail" | "none";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} label={label} />
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-4">
            {record ? (
              <code className="block overflow-x-auto whitespace-pre-wrap break-all rounded bg-background p-3 font-mono text-xs">
                {record}
              </code>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                No record found
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function ToolsPage() {
  const [domain, setDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EmailCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkDomain = async () => {
    if (!domain.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/tools/email-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: domain.trim(),
          quick: true,
          ...(dkimSelector.trim() && { dkimSelector: dkimSelector.trim() }),
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check domain"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkDomain();
    }
  };

  const getSpfStatus = (): "pass" | "warn" | "fail" | "none" => {
    if (!result?.spf.exists) return "none";
    if (!result.spf.valid) return "fail";
    if (result.spf.allMechanism === "+all") return "fail";
    if (result.spf.allMechanism === "~all") return "warn";
    return "pass";
  };

  const getDkimStatus = (): "pass" | "warn" | "fail" | "none" => {
    if (!result?.dkim.found) return "none";
    if (result.dkim.warnings.length > 0) return "warn";
    return "pass";
  };

  const getDmarcStatus = (): "pass" | "warn" | "fail" | "none" => {
    if (!result?.dmarc.exists) return "none";
    if (!result.dmarc.valid) return "fail";
    if (result.dmarc.policy === "none") return "warn";
    return "pass";
  };

  const getMxStatus = (): "pass" | "warn" | "fail" | "none" => {
    if (!result?.mx.exists) return "none";
    if (result.mx.records.some((r) => !r.resolves)) return "warn";
    return "pass";
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
          <Button asChild variant="outline">
            <a href="/">Back to Home</a>
          </Button>
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
              Email Deliverability Checker
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Check your domain's email authentication setup. We analyze SPF,
              DKIM, DMARC, and MX records to help you improve deliverability.
            </p>
          </div>

          {/* Search Box */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-12 pl-10 text-lg"
                    placeholder="Enter your domain (e.g., example.com)"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  className="h-12 px-6"
                  onClick={checkDomain}
                  disabled={isLoading || !domain.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Check Domain
                    </>
                  )}
                </Button>
              </div>

              {/* Advanced Options */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger className="mt-4 flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground">
                  <Settings2 className="h-4 w-4" />
                  Advanced Options
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 flex items-center gap-2 font-medium text-sm">
                          <Key className="h-4 w-4" />
                          DKIM Selector
                        </label>
                        <Input
                          placeholder="e.g., google, selector1, or your AWS SES selector"
                          value={dkimSelector}
                          onChange={(e) => setDkimSelector(e.target.value)}
                          disabled={isLoading}
                        />
                        <p className="mt-1.5 text-muted-foreground text-xs">
                          AWS SES uses random selectors that we can't discover automatically.
                          Find yours in the SES console under "View DNS records" for your domain.
                        </p>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Error State */}
          {error && (
            <Card className="mb-8 border-red-500/20 bg-red-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && result.success && (
            <div className="space-y-6">
              {/* Score Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
                    <div className="text-center md:text-left">
                      <h2 className="mb-2 font-bold text-2xl">{result.domain}</h2>
                      <p className="text-muted-foreground">
                        Checked in {result.duration}ms
                      </p>
                    </div>
                    <GradeDisplay
                      grade={result.score.grade}
                      score={result.score.score}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Status */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 font-semibold text-sm">SPF</div>
                    <StatusBadge
                      status={getSpfStatus()}
                      label={result.spf.exists ? "Found" : "Missing"}
                    />
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 font-semibold text-sm">DKIM</div>
                    <StatusBadge
                      status={getDkimStatus()}
                      label={result.dkim.found ? "Found" : "Missing"}
                    />
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 font-semibold text-sm">DMARC</div>
                    <StatusBadge
                      status={getDmarcStatus()}
                      label={result.dmarc.exists ? "Found" : "Missing"}
                    />
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-4 pb-4">
                    <div className="mb-2 font-semibold text-sm">MX</div>
                    <StatusBadge
                      status={getMxStatus()}
                      label={result.mx.exists ? "Found" : "Missing"}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Issues */}
              {result.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Issues Found ({result.issues.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.issues.map((issue, i) => (
                        <div
                          key={`issue-${i}`}
                          className={`rounded-lg border p-4 ${
                            issue.severity === "critical"
                              ? "border-red-500/20 bg-red-500/5"
                              : issue.severity === "warning"
                                ? "border-yellow-500/20 bg-yellow-500/5"
                                : "border-blue-500/20 bg-blue-500/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="mb-1 font-medium">
                                {issue.check}
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {issue.reason}
                              </p>
                            </div>
                            <Badge
                              variant={
                                issue.severity === "critical"
                                  ? "destructive"
                                  : issue.severity === "warning"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              -{issue.points} pts
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Records */}
              <Card>
                <CardHeader>
                  <CardTitle>DNS Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RecordDisplay
                    label="SPF"
                    record={result.spf.record}
                    status={getSpfStatus()}
                  />
                  <RecordDisplay
                    label="DMARC"
                    record={result.dmarc.record}
                    status={getDmarcStatus()}
                  />
                  {result.dkim.selectorsFound.length > 0 && (
                    <div className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between p-4">
                        <StatusBadge status={getDkimStatus()} label="DKIM" />
                        <span className="text-muted-foreground text-sm">
                          {result.dkim.selectorsFound.length} selector(s) found
                        </span>
                      </div>
                      <div className="border-t bg-muted/30 p-4">
                        <div className="space-y-2">
                          {result.dkim.selectorsFound.map((sel) => (
                            <div
                              key={sel.selector}
                              className="flex items-center justify-between rounded bg-background p-2 text-sm"
                            >
                              <code className="font-mono">{sel.selector}</code>
                              <span className="text-muted-foreground">
                                {sel.keyType} {sel.keyBits}-bit
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {result.mx.records.length > 0 && (
                    <div className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between p-4">
                        <StatusBadge status={getMxStatus()} label="MX" />
                        <span className="text-muted-foreground text-sm">
                          {result.mx.records.length} record(s)
                        </span>
                      </div>
                      <div className="border-t bg-muted/30 p-4">
                        <div className="space-y-2">
                          {result.mx.records.map((mx) => (
                            <div
                              key={mx.exchange}
                              className="flex items-center justify-between rounded bg-background p-2 text-sm"
                            >
                              <code className="font-mono">{mx.exchange}</code>
                              <span className="text-muted-foreground">
                                Priority: {mx.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* DMARC Details */}
              {result.dmarc.exists && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      DMARC Policy Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-muted-foreground text-sm">
                          Policy
                        </div>
                        <div className="font-mono text-lg">
                          p={result.dmarc.policy || "none"}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-muted-foreground text-sm">
                          Subdomain Policy
                        </div>
                        <div className="font-mono text-lg">
                          sp={result.dmarc.subdomainPolicy || "inherit"}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-muted-foreground text-sm">
                          Percentage
                        </div>
                        <div className="font-mono text-lg">
                          pct={result.dmarc.pct ?? 100}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-muted-foreground text-sm">
                          Reporting
                        </div>
                        <div className="font-mono text-lg">
                          {result.dmarc.reportingEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CTA */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
                    <div className="flex-1">
                      <h3 className="mb-2 font-bold text-xl">
                        Need to set up email infrastructure?
                      </h3>
                      <p className="text-muted-foreground">
                        Wraps deploys production-ready email infrastructure to
                        your AWS account in 30 seconds.
                      </p>
                    </div>
                    <Button asChild size="lg">
                      <a href="/docs/quickstart">
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty State */}
          {!result && !error && !isLoading && (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="flex flex-col items-center text-center">
                  <Shield className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold text-lg">
                    Check Your Email Setup
                  </h3>
                  <p className="mb-6 max-w-md text-muted-foreground">
                    Enter any domain above to analyze its email authentication
                    configuration. We'll check SPF, DKIM, DMARC, and MX records.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["gmail.com", "microsoft.com", "stripe.com"].map((d) => (
                      <Button
                        key={d}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDomain(d);
                          setIsLoading(true);
                          fetch(`${API_URL}/tools/email-check`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ domain: d, quick: true }),
                          })
                            .then((r) => r.json())
                            .then((data) => {
                              if (data.error) {
                                setError(data.error);
                              } else {
                                setResult(data);
                              }
                            })
                            .catch((err) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to check domain"
                              )
                            )
                            .finally(() => setIsLoading(false));
                        }}
                      >
                        Try {d}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Section */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What is SPF?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Sender Policy Framework (SPF) specifies which mail servers are
                authorized to send email on behalf of your domain.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What is DKIM?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                DomainKeys Identified Mail (DKIM) adds a digital signature to
                emails, allowing receivers to verify the message hasn't been
                altered.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What is DMARC?</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                Domain-based Message Authentication (DMARC) tells receivers how
                to handle emails that fail SPF or DKIM checks.
              </CardContent>
            </Card>
          </div>

          {/* Learn More */}
          <div className="mt-8 text-center">
            <p className="mb-4 text-muted-foreground">
              Want to learn more about email authentication?
            </p>
            <Button asChild variant="outline">
              <a href="/blog/dmarc-sucks">
                Read: Why DMARC Is Broken
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
