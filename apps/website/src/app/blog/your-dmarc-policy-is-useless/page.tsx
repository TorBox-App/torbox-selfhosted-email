"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building,
  CheckCircle,
  ChevronDown,
  Lock,
  Server,
  Shield,
  ShieldAlert,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Animated email headers scrolling in hero section only
const EmailHeaderScroller = () => {
  const headers = [
    {
      from: "ceo@yourcompany.com",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "support@bigbank.com",
      auth: "dmarc=pass",
      status: "delivered",
      type: "legit",
    },
    {
      from: "hr@targetcorp.com",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "billing@saas-vendor.io",
      auth: "spf=softfail dkim=none",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "noreply@healthcare.nz",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "security@company.com",
      auth: "dmarc=pass",
      status: "delivered",
      type: "legit",
    },
    {
      from: "invoices@supplier.com",
      auth: "dmarc=fail (p=quarantine)",
      status: "quarantined",
      type: "blocked",
    },
    {
      from: "wire-transfer@bank.com",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "admin@gov-agency.gov",
      auth: "dmarc=pass",
      status: "delivered",
      type: "legit",
    },
    {
      from: "payroll@enterprise.com",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
    {
      from: "alerts@monitoring.io",
      auth: "dmarc=fail (p=reject)",
      status: "rejected",
      type: "blocked",
    },
    {
      from: "cfo@fortune500.com",
      auth: "dmarc=fail (p=none)",
      status: "delivered",
      type: "spoof",
    },
  ];

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % (headers.length * 60));
    }, 50);
    return () => clearInterval(interval);
  }, [headers.length]);

  return (
    <div className="pointer-events-none absolute inset-0 mx-auto w-2xl opacity-[0.60] dark:opacity-[0.55]">
      <div
        className="whitespace-nowrap text-left font-mono text-foreground text-xs"
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {[...Array(30)].map((_, i) => (
          <div className="py-1" key={i}>
            {headers.map((h, j) => (
              <div className="py-0.5" key={`${i}-${j}`}>
                <span className="text-muted-foreground">
                  {new Date(
                    Date.now() - (i * headers.length + j) * 1000
                  ).toISOString()}
                </span>{" "}
                <span
                  className={
                    h.type === "spoof"
                      ? "text-red-500"
                      : h.type === "blocked"
                        ? "text-yellow-500"
                        : "text-green-500"
                  }
                >
                  {h.status.toUpperCase()}
                </span>{" "}
                <span className="text-blue-500">From:</span> {h.from}{" "}
                <span className="text-purple-500">{h.auth}</span>
                {h.type === "spoof" && (
                  <span className="ml-2 text-red-600">SPOOFED</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// DMARC Policy Simulator
const DMARCSimulator = () => {
  const [policy, setPolicy] = useState("none");
  const [incomingEmails, setIncomingEmails] = useState<
    {
      from: string;
      legit: boolean;
      passes: boolean;
      label?: string;
      outcome: string;
      timestamp: string;
      id: number;
    }[]
  >([]);
  const [stats, setStats] = useState({
    delivered: 0,
    quarantined: 0,
    rejected: 0,
    spoofed: 0,
  });

  const emailTypes = [
    { from: "newsletter@yourcompany.com", legit: true, passes: true },
    {
      from: "ceo@yourcompany.com",
      legit: false,
      passes: false,
      label: "SPOOFED by attacker",
    },
    { from: "support@yourcompany.com", legit: true, passes: true },
    {
      from: "hr@yourcompany.com",
      legit: false,
      passes: false,
      label: "BEC attack",
    },
    { from: "billing@yourcompany.com", legit: true, passes: true },
    {
      from: "wire-transfer@yourcompany.com",
      legit: false,
      passes: false,
      label: "$4.7M fraud attempt",
    },
  ];

  useEffect(() => {
    const simulateEmail = () => {
      const email = emailTypes[Math.floor(Math.random() * emailTypes.length)];
      let outcome: string;

      if (email.passes) {
        outcome = "delivered";
      } else if (policy === "none") outcome = "delivered";
      else if (policy === "quarantine") outcome = "quarantined";
      else outcome = "rejected";

      const newEmail = {
        ...email,
        outcome,
        timestamp: new Date().toLocaleTimeString(),
        id: Date.now(),
      };

      setIncomingEmails((prev) => [newEmail, ...prev].slice(0, 8));
      setStats((prev) => ({
        ...prev,
        [outcome]: prev[outcome as keyof typeof prev] + 1,
        spoofed:
          prev.spoofed + (email.legit ? 0 : outcome === "delivered" ? 1 : 0),
      }));
    };

    const interval = setInterval(simulateEmail, 1500);
    return () => clearInterval(interval);
  }, [policy]);

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-lg">
          DMARC Policy Simulator
        </h3>
        <div className="flex gap-2">
          {(["none", "quarantine", "reject"] as const).map((p) => (
            <button
              className={`rounded px-3 py-1 font-mono text-sm transition-all ${
                policy === p
                  ? p === "none"
                    ? "bg-red-600 text-white"
                    : p === "quarantine"
                      ? "bg-yellow-600 text-white"
                      : "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              key={p}
              onClick={() => {
                setPolicy(p);
                setStats({
                  delivered: 0,
                  quarantined: 0,
                  rejected: 0,
                  spoofed: 0,
                });
                setIncomingEmails([]);
              }}
            >
              p={p}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="font-bold text-2xl text-green-500">
            {stats.delivered}
          </div>
          <div className="text-muted-foreground text-xs">Delivered</div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="font-bold text-2xl text-yellow-500">
            {stats.quarantined}
          </div>
          <div className="text-muted-foreground text-xs">Quarantined</div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="font-bold text-2xl text-blue-500">
            {stats.rejected}
          </div>
          <div className="text-muted-foreground text-xs">Rejected</div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="font-bold text-2xl text-red-500">{stats.spoofed}</div>
          <div className="text-muted-foreground text-xs">
            Spoofed & Delivered
          </div>
        </div>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {incomingEmails.map((email) => (
          <div
            className={`flex items-center justify-between rounded-lg p-3 font-mono text-sm ${
              email.outcome === "delivered" && !email.legit
                ? "border border-red-500/50 bg-red-500/10"
                : email.outcome === "quarantined"
                  ? "border border-yellow-500/50 bg-yellow-500/10"
                  : "border bg-muted"
            }`}
            key={email.id}
          >
            <div className="flex items-center gap-3">
              {email.legit ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <ShieldOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-foreground">{email.from}</span>
              {email.label && (
                <span className="text-red-500 text-xs">({email.label})</span>
              )}
            </div>
            <div
              className={`rounded px-2 py-0.5 text-xs ${
                email.outcome === "delivered" && !email.legit
                  ? "bg-red-600 text-white"
                  : email.outcome === "delivered"
                    ? "bg-green-600 text-white"
                    : email.outcome === "quarantined"
                      ? "bg-yellow-600 text-black"
                      : "bg-muted-foreground text-background"
              }`}
            >
              {email.outcome}
            </div>
          </div>
        ))}
      </div>

      {policy === "none" && stats.spoofed > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
          <p className="text-red-600 text-sm dark:text-red-400">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            <strong>{stats.spoofed} spoofed emails delivered.</strong> Your
            p=none policy tells receivers not to enforce authentication failures.
            While some providers may still filter, your domain is easier to spoof.
          </p>
        </div>
      )}

      {policy === "reject" && (
        <div className="mt-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
          <p className="text-green-600 text-sm dark:text-green-400">
            <Shield className="mr-2 inline h-4 w-4" />
            <strong>Full protection requested.</strong> Major email providers
            will reject spoofed emails.
          </p>
        </div>
      )}
    </Card>
  );
};


// Email Authentication Explainer
const AuthExplainer = () => {
  const [activeTab, setActiveTab] = useState<"spf" | "dkim" | "dmarc">("spf");

  const content = {
    spf: {
      title: "SPF (Sender Policy Framework)",
      icon: <Server className="h-5 w-5" />,
      description:
        "Specifies which mail servers are authorized to send email for your domain.",
      record: "v=spf1 include:_spf.google.com include:amazonses.com ~all",
      problem:
        "Only checks envelope sender (Return-Path), not the From: header users see. Breaks with forwarding.",
      color: "blue",
    },
    dkim: {
      title: "DKIM (DomainKeys Identified Mail)",
      icon: <Lock className="h-5 w-5" />,
      description:
        "Cryptographically signs emails to prove they haven't been tampered with.",
      record: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4...",
      problem:
        "Doesn't specify what to do when verification fails. Emails can still be delivered.",
      color: "purple",
    },
    dmarc: {
      title: "DMARC (Domain-based Message Authentication)",
      icon: <Shield className="h-5 w-5" />,
      description:
        "Tells receivers what to do when SPF/DKIM fail, and where to send reports.",
      record: "v=DMARC1; p=reject; rua=mailto:dmarc@company.com",
      problem:
        "Most domains set p=none (monitoring only), telling receivers not to enforce failures.",
      color: "green",
    },
  };

  const c = content[activeTab];
  const colors: Record<string, string> = {
    blue: "border-l-blue-500 bg-blue-500/10",
    purple: "border-l-purple-500 bg-purple-500/10",
    green: "border-l-green-500 bg-green-500/10",
  };

  return (
    <Card className="p-6">
      <div className="mb-6 flex gap-2">
        {(Object.keys(content) as Array<keyof typeof content>).map((key) => (
          <button
            className={`rounded-lg px-4 py-2 font-medium transition-all ${
              activeTab === key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
            key={key}
            onClick={() => setActiveTab(key)}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={`rounded-r-lg border-l-4 p-4 ${colors[c.color]}`}>
        <div className="mb-2 flex items-center gap-2">
          {c.icon}
          <h4 className="font-semibold text-foreground">{c.title}</h4>
        </div>
        <p className="mb-4 text-foreground/80">{c.description}</p>

        <div className="mb-4 overflow-x-auto rounded bg-muted p-3 font-mono text-muted-foreground text-sm">
          {c.record}
        </div>

        <div className="flex items-start gap-2 text-sm text-yellow-600 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <strong>The problem:</strong> {c.problem}
          </span>
        </div>
      </div>
    </Card>
  );
};

// Real Breach Timeline
const BreachTimeline = () => {
  const breaches = [
    {
      year: "2013-2015",
      company: "Google & Facebook",
      loss: "$122M",
      method: 'Spoofed invoices from fake hardware vendor "Quanta Computer"',
      dmarcIssue: "No sender verification on vendor emails",
      details:
        "Lithuanian scammer Evaldas Rimasauskas created fake company mimicking real vendor. Sentenced to 5 years, ordered to forfeit $49.7M.",
      source:
        "https://www.justice.gov/usao-sdny/pr/lithuanian-man-sentenced-5-years-prison-theft-over-120-million-fraudulent-business",
      sourceLabel: "DOJ Press Release",
      icon: Building,
      color: "red",
    },
    {
      year: "2015",
      company: "Ubiquiti Networks",
      loss: "$46.7M",
      method:
        "Email spoofing + employee impersonation targeting finance department",
      dmarcIssue: "No DMARC policy",
      details:
        "Attackers impersonated executives and redirected wire transfers to overseas accounts. Only $14.9M recovered. CAO resigned.",
      source:
        "https://blog.knowbe4.com/tech-firm-ubiquity-suffers-46m-cyberheist",
      sourceLabel: "KnowBe4",
      icon: Building,
      color: "red",
    },
    {
      year: "2019",
      company: "Toyota Boshoku",
      loss: "$37M",
      method:
        "Business partner impersonation with fraudulent payment instructions",
      dmarcIssue: "Third-party domain spoofing, p=none policy",
      details:
        'European subsidiary received spoofed emails from "business partner" requesting payment account changes. Company forced to amend earnings forecasts.',
      source:
        "https://www.bleepingcomputer.com/news/security/over-37-million-lost-by-toyota-boshoku-subsidiary-in-bec-scam/",
      sourceLabel: "Bleeping Computer",
      icon: Building,
      color: "orange",
    },
    {
      year: "2024",
      company: "Kimsuky APT Campaigns",
      loss: "Intelligence theft",
      method: "Spoofed journalists, academics, and think tank experts",
      dmarcIssue: "Systematically targeted orgs with p=none policies",
      details:
        "FBI/NSA/State Dept joint advisory. North Korean state hackers specifically scan for weak DMARC to enable spearphishing against US policy experts.",
      source:
        "https://www.bleepingcomputer.com/news/security/nsa-warns-of-north-korean-hackers-exploiting-weak-dmarc-email-policies/",
      sourceLabel: "NSA/FBI Advisory",
      icon: ShieldAlert,
      color: "purple",
    },
  ];

  const [expanded, setExpanded] = useState<number | null>(null);

  const getColorClasses = (color: string) => {
    switch (color) {
      case "purple":
        return {
          bg: "bg-purple-500",
          bgLight: "bg-purple-500/10",
          text: "text-purple-600 dark:text-purple-400",
        };
      case "orange":
        return {
          bg: "bg-orange-500",
          bgLight: "bg-orange-500/10",
          text: "text-orange-600 dark:text-orange-400",
        };
      default:
        return {
          bg: "bg-red-500",
          bgLight: "bg-red-500/10",
          text: "text-red-600 dark:text-red-400",
        };
    }
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute top-0 bottom-0 left-[39px] w-0.5 bg-gradient-to-b from-red-500 via-orange-500 to-red-500 md:left-[119px]" />

      <div className="space-y-6">
        {breaches.map((breach, i) => {
          const colors = getColorClasses(breach.color);
          const isExpanded = expanded === i;

          return (
            <div className="relative flex gap-4 md:gap-6" key={i}>
              {/* Year - hidden on mobile, shown on md+ */}
              <div className="hidden w-24 shrink-0 pt-3 text-right md:block">
                <span className="font-mono text-muted-foreground">
                  {breach.year}
                </span>
              </div>

              {/* Timeline node */}
              <div className="relative z-10 shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg} shadow-lg ring-4 ring-background`}
                >
                  <breach.icon className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Content card */}
              <div className="flex-1 pb-2">
                <button
                  className={`group w-full rounded-xl border text-left transition-all ${
                    isExpanded
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
                  }`}
                  onClick={() => setExpanded(isExpanded ? null : i)}
                >
                  <div className="p-4">
                    {/* Mobile year */}
                    <div className="mb-2 font-mono text-muted-foreground text-xs md:hidden">
                      {breach.year}
                    </div>

                    {/* Header row */}
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground text-lg">
                          {breach.company}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-sm ${colors.bgLight} ${colors.text}`}
                        >
                          {breach.loss}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>

                    {/* Method */}
                    <p className="mb-2 text-foreground/80">{breach.method}</p>

                    {/* DMARC issue tag */}
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                      <span className="text-sm text-yellow-600 dark:text-yellow-400">
                        {breach.dmarcIssue}
                      </span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 p-4">
                      <p className="mb-3 text-foreground/80">
                        {breach.details}
                      </p>
                      <a
                        className="inline-flex items-center gap-1.5 font-medium text-primary text-sm hover:underline"
                        href={breach.source}
                        onClick={(e) => e.stopPropagation()}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Read full report: {breach.sourceLabel}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <p className="mt-6 text-center text-muted-foreground text-sm">
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className="h-4 w-4" />
          Click any incident to expand details
        </span>
      </p>
    </div>
  );
};

// Real Domain Checker using Wraps API
const API_URL = "https://api.wraps.dev";

type EmailCheckResult = {
  success: boolean;
  domain: string;
  score: {
    grade: string;
    score: number;
    maxScore: number;
    breakdown?: {
      spf: { max: number; score: number };
      dkim: { max: number; score: number };
      dmarc: { max: number; score: number };
      mx: { max: number; score: number };
      blacklist: { max: number; score: number };
      bonus: { earned: number; possible: number };
    };
  };
  spf: {
    exists: boolean;
    valid: boolean;
    record: string | null;
    allMechanism: string | null;
    lookupCount?: number;
  };
  dkim: {
    found: boolean;
    selectorsFound: Array<{
      selector: string;
      keyType: string;
      keyBits: number;
    }>;
    warnings?: string[];
  };
  dmarc: {
    exists: boolean;
    valid: boolean;
    record: string | null;
    policy: string | null;
    reportingEnabled: boolean;
    subdomainPolicy?: string | null;
  };
  domainAge?: {
    ageInDays: number | null;
    createdAt: string | null;
  };
  issues: Array<{
    check: string;
    reason: string;
    severity: "critical" | "warning" | "info";
  }>;
  bonuses?: Array<{
    check: string;
    reason: string;
    points: number;
  }>;
  error?: string;
};

const DomainChecker = () => {
  const [domain, setDomain] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<EmailCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkDomain = async () => {
    if (!domain.trim()) return;
    setChecking(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/tools/email-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), quick: true }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check domain");
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      checkDomain();
    }
  };

  const getSpfStatus = (): "pass" | "warn" | "fail" => {
    if (!result?.spf.exists) return "fail";
    if (!result.spf.valid) return "fail";
    if (result.spf.allMechanism === "+all") return "fail";
    if (result.spf.allMechanism === "~all") return "warn";
    return "pass";
  };

  const getDkimStatus = (): "pass" | "warn" | "fail" => {
    if (!result?.dkim.found) return "fail";
    // Check for weak keys
    const hasWeakKey = result.dkim.selectorsFound.some((s) => s.keyBits < 2048);
    if (hasWeakKey) return "warn";
    return "pass";
  };

  const getDmarcStatus = (): "pass" | "warn" | "fail" => {
    if (!result?.dmarc.exists) return "fail";
    if (!result.dmarc.valid) return "fail";
    if (result.dmarc.policy === "none") return "warn";
    if (result.dmarc.policy === "quarantine") return "warn";
    return "pass";
  };

  const gradeColors: Record<string, string> = {
    "A+": "text-green-600 bg-green-500/20 dark:text-green-400",
    A: "text-green-600 bg-green-500/20 dark:text-green-400",
    "A-": "text-green-600 bg-green-500/20 dark:text-green-400",
    "B+": "text-lime-600 bg-lime-500/20 dark:text-lime-400",
    B: "text-lime-600 bg-lime-500/20 dark:text-lime-400",
    "B-": "text-yellow-600 bg-yellow-500/20 dark:text-yellow-400",
    "C+": "text-yellow-600 bg-yellow-500/20 dark:text-yellow-400",
    C: "text-orange-600 bg-orange-500/20 dark:text-orange-400",
    "C-": "text-orange-600 bg-orange-500/20 dark:text-orange-400",
    D: "text-red-600 bg-red-500/20 dark:text-red-400",
    F: "text-red-600 bg-red-500/20 dark:text-red-400",
  };

  const getStatusIcon = (status: "pass" | "warn" | "fail") => {
    if (status === "pass")
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === "warn")
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getMessage = () => {
    if (!result) return "";
    const dmarcPolicy = result.dmarc.policy;
    if (!result.dmarc.exists) {
      return "CRITICAL: No DMARC record found. Your domain is vulnerable to spoofing.";
    }
    if (dmarcPolicy === "none") {
      return "WARNING: p=none tells receivers not to enforce authentication failures. Your domain is easier to spoof.";
    }
    if (dmarcPolicy === "quarantine") {
      return "Partial protection. Spoofed emails go to spam, but may still be seen.";
    }
    if (dmarcPolicy === "reject") {
      return "Full protection requested. Major email providers will reject spoofed emails.";
    }
    return "Check your email authentication configuration.";
  };

  const getMessageStyle = () => {
    if (!result) return "";
    const policy = result.dmarc.policy;
    if (!result.dmarc.exists || policy === "none") {
      return "border border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400";
    }
    if (policy === "quarantine") {
      return "border border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    }
    return "border border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400";
  };

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-semibold text-foreground text-lg">
        Check Your Domain
      </h3>

      <div className="mb-6 flex gap-2">
        <input
          className="flex-1 rounded-lg border bg-background px-4 py-2 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="yourcompany.com"
          type="text"
          value={domain}
        />
        <Button disabled={checking} onClick={checkDomain}>
          {checking ? "Checking..." : "Check"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-red-600 text-sm dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Security Grade</span>
              <div className="font-mono text-muted-foreground text-sm">
                {result.score.score}/{result.score.maxScore} points
              </div>
            </div>
            <span
              className={`rounded px-4 py-1 font-bold text-4xl ${gradeColors[result.score.grade] || gradeColors.F}`}
            >
              {result.score.grade}
            </span>
          </div>

          {/* Score Breakdown Bars */}
          {result.score.breakdown && (
            <div className="space-y-2">
              {[
                { key: "spf", label: "SPF", data: result.score.breakdown.spf },
                { key: "dkim", label: "DKIM", data: result.score.breakdown.dkim },
                { key: "dmarc", label: "DMARC", data: result.score.breakdown.dmarc },
              ].map(({ key, label, data }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-14 text-muted-foreground text-xs">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${
                        data.score === data.max
                          ? "bg-green-500"
                          : data.score >= data.max * 0.5
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${(data.score / data.max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-muted-foreground text-xs">
                    {data.score}/{data.max}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(getSpfStatus())}
                <span className="font-medium text-foreground uppercase">
                  SPF
                </span>
              </div>
              <span className="font-mono text-muted-foreground text-sm">
                {result.spf.exists
                  ? result.spf.allMechanism || "configured"
                  : "missing"}
                {result.spf.lookupCount ? ` (${result.spf.lookupCount}/10 lookups)` : ""}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(getDkimStatus())}
                <span className="font-medium text-foreground uppercase">
                  DKIM
                </span>
              </div>
              <span className="font-mono text-muted-foreground text-sm">
                {result.dkim.found
                  ? result.dkim.selectorsFound.length > 0
                    ? `${result.dkim.selectorsFound[0].keyBits}-bit`
                    : "found"
                  : "not found"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(getDmarcStatus())}
                <span className="font-medium text-foreground uppercase">
                  DMARC
                </span>
              </div>
              <span className="font-mono text-muted-foreground text-sm">
                {result.dmarc.exists
                  ? `p=${result.dmarc.policy}${result.dmarc.subdomainPolicy ? ` sp=${result.dmarc.subdomainPolicy}` : ""}`
                  : "missing"}
              </span>
            </div>
          </div>

          <div className={`rounded-lg p-4 ${getMessageStyle()}`}>
            <p className="text-sm">{getMessage()}</p>
          </div>

          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-muted-foreground text-sm">
                Issues Found:
              </h4>
              {result.issues.slice(0, 3).map((issue, i) => (
                <div
                  className={`rounded p-2 text-sm ${
                    issue.severity === "critical"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : issue.severity === "warning"
                        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                  key={i}
                >
                  {issue.reason}
                </div>
              ))}
              {result.issues.length > 3 && (
                <a
                  href="/tools"
                  className="block text-center text-primary text-sm hover:underline"
                >
                  +{result.issues.length - 3} more issues - View full report
                </a>
              )}
            </div>
          )}

          {/* Domain Age */}
          {result.domainAge?.ageInDays !== null && result.domainAge?.ageInDays !== undefined && (
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Domain Age</span>
              <span className="font-mono text-foreground">
                {result.domainAge.ageInDays > 365
                  ? `${Math.floor(result.domainAge.ageInDays / 365)} years`
                  : `${result.domainAge.ageInDays} days`}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-muted-foreground text-xs">
        Real-time DNS analysis powered by{" "}
        <a className="text-primary hover:underline" href="/tools">
          Wraps Email Tools
        </a>
        .
      </p>
    </Card>
  );
};

// The Fix Section
const TheFix = () => {
  const steps = [
    {
      num: 1,
      title: "Start with monitoring",
      code: "v=DMARC1; p=none; rua=mailto:dmarc@yourcompany.com",
      desc: "Deploy p=none to receive reports without affecting delivery. See who's sending as your domain.",
    },
    {
      num: 2,
      title: "Fix legitimate senders",
      code: "v=spf1 include:_spf.google.com include:amazonses.com -all",
      desc: "Add all legitimate services to SPF. Configure DKIM for each sender. This typically takes 2-4 weeks.",
    },
    {
      num: 3,
      title: "Move to quarantine",
      code: "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourcompany.com",
      desc: "Start quarantining failures at 25%, then 50%, then 100%. Monitor for legitimate mail going to spam.",
    },
    {
      num: 4,
      title: "Enforce with reject",
      code: "v=DMARC1; p=reject; rua=mailto:dmarc@yourcompany.com; fo=1",
      desc: "Full protection. Spoofed emails are rejected before reaching any inbox. You're now in the 5.2%.",
    },
  ];

  return (
    <Card className="p-6">
      <h3 className="mb-6 font-semibold text-foreground text-lg">
        The Path to p=reject
      </h3>

      <div className="space-y-6">
        {steps.map((step) => (
          <div className="flex gap-4" key={step.num}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {step.num}
            </div>
            <div className="flex-1">
              <h4 className="mb-1 font-semibold text-foreground">
                {step.title}
              </h4>
              <div className="mb-2 overflow-x-auto rounded bg-muted p-2 font-mono text-green-600 text-sm dark:text-green-400">
                {step.code}
              </div>
              <p className="text-muted-foreground text-sm">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Main Component
export default function DMARCSucks() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      {/* Hero with background animation */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
        <EmailHeaderScroller />
        <div className="relative z-10 mx-4 max-w-3xl rounded-2xl border bg-background/80 p-8 shadow-2xl backdrop-blur-sm md:p-12">
          <h1 className="mb-4 font-bold text-4xl md:text-6xl">
            Your DMARC policy is <span className="text-red-500">useless</span>.
          </h1>
          <p className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            82% of domains have no DMARC. Of those that do, most set{" "}
            <code className="rounded bg-red-500/20 px-2 py-0.5 text-red-600 dark:text-red-400">
              p=none
            </code>
            &mdash;which tells receivers not to enforce.
          </p>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ChevronDown className="h-5 w-5 animate-bounce" />
            <span className="text-sm">Scroll to see why this matters</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-4xl space-y-24 px-4 pt-24 pb-24">
        {/* The Problem */}
        <section>
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              Right now, someone could send an email that looks exactly like
              it's from{" "}
              <span className="font-semibold text-foreground">
                ceo@yourcompany.com
              </span>
              . It would pass through spam filters. Land in your employee's
              inbox. Ask them to wire $50,000 to a "new vendor."
            </p>
            <p className="text-foreground/80 text-xl leading-relaxed">
              This isn't hypothetical.{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                $2.77 billion
              </span>{" "}
              was stolen through BEC attacks in 2024 alone. Google and Facebook
              lost $122 million to a single spoofed vendor. Toyota lost $37
              million. Ubiquiti lost $46.7 million. In every case, the attack
              relied on domain impersonation that proper DMARC enforcement would
              have prevented.
            </p>
          </div>
        </section>

        {/* The Scale of the Problem */}
        <section>
          <h2 className="mb-6 font-bold text-3xl">The scale of the problem</h2>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              These cases aren't outliers. They're the norm.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              In 2024, Business Email Compromise (BEC) attacks cost
              organizations{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                $2.77 billion
              </span>{" "}
              in reported losses, according to the{" "}
              <a
                className="text-primary hover:underline"
                href="https://www.ic3.gov/Media/News/2024/240502.pdf"
                rel="noopener noreferrer"
                target="_blank"
              >
                FBI's Internet Crime Report
              </a>
              . Approximately{" "}
              <span className="font-semibold text-foreground">
                60% of these attacks involve domain impersonation
              </span>
              —exactly the kind of spoofing that DMARC enforcement prevents.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              Yet a February 2025 analysis of{" "}
              <span className="font-semibold text-foreground">
                73.1 million domains
              </span>{" "}
              by{" "}
              <a
                className="text-primary hover:underline"
                href="https://redsift.com/guides/red-sifts-guide-to-global-dmarc-adoption"
                rel="noopener noreferrer"
                target="_blank"
              >
                Red Sift
              </a>{" "}
              found that only{" "}
              <span className="font-semibold text-green-600 dark:text-green-400">
                5.2% have p=reject
              </span>
              —the only policy that actually stops spoofed emails. The rest?
            </p>
          </div>

          {/* Visual: DMARC adoption breakdown */}
          <div className="my-8 space-y-3">
            {[
              {
                label: "No DMARC at all",
                value: 82,
                color: "bg-red-500",
                annotation: "completely unprotected",
              },
              {
                label: "p=none",
                value: 9.7,
                color: "bg-yellow-500",
                annotation: "monitoring only",
              },
              {
                label: "p=quarantine",
                value: 3.1,
                color: "bg-orange-500",
                annotation: "partial protection",
              },
              {
                label: "p=reject",
                value: 5.2,
                color: "bg-green-500",
                annotation: "actual protection",
              },
            ].map((item, i) => (
              <div className="flex items-center gap-4" key={i}>
                <div className="w-28 shrink-0 text-right">
                  <span className="font-mono text-foreground">
                    {item.value}%
                  </span>
                </div>
                <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={`h-full rounded ${item.color}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <div className="w-48 shrink-0">
                  <span className="text-foreground text-sm">{item.label}</span>
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    — {item.annotation}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              Even among sophisticated organizations, the gaps are alarming.{" "}
              <span className="font-semibold text-foreground">88%</span> of
              Fortune 500 companies have DMARC records—but only 73.6% actually
              enforce them. In financial services, the most-targeted industry,
              just <span className="font-semibold text-foreground">43%</span>{" "}
              enforce their policies. Among SEC-regulated firms, only 24.4% have
              full enforcement.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              And it's not just missing policies. Research shows{" "}
              <span className="font-semibold text-foreground">
                7.64% of DMARC records have syntax errors
              </span>{" "}
              that break protection entirely. 60% of US government domains have
              SPF configuration errors. Having a DMARC record isn't the same as
              having protection—and most organizations don't know the
              difference.
            </p>
          </div>
        </section>

        {/* Regulatory Pressure */}
        <section>
          <h2 className="mb-6 font-bold text-3xl">
            Regulators are finally forcing the issue
          </h2>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              The gap between "having DMARC" and "enforcing DMARC" has persisted
              for years because there was no penalty for inaction. That's
              changing.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              <span className="font-semibold text-foreground">PCI DSS 4.0</span>
              , which took effect March 31, 2025, makes DMARC mandatory for
              anyone processing payment cards. Requirement 5.4.1 specifically
              mandates "automated mechanisms to detect and protect against
              phishing"—and non-compliance fines run{" "}
              <span className="font-semibold text-foreground">
                $5,000 to $100,000 per month
              </span>
              .
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              Google and Yahoo now require SPF, DKIM, and DMARC for bulk senders
              (5,000+ daily emails). Non-compliant emails already face temporary
              errors; starting November 2025, they'll be permanently rejected.
              This single requirement drove{" "}
              <span className="font-semibold text-foreground">
                500,000+ new DMARC records
              </span>{" "}
              in early 2024 and reduced unauthenticated Gmail traffic by 65%.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              Government agencies are even further ahead.{" "}
              <a
                className="text-primary hover:underline"
                href="https://www.cisa.gov/news-events/directives/bod-18-01-enhance-email-and-web-security"
                rel="noopener noreferrer"
                target="_blank"
              >
                CISA's BOD 18-01
              </a>{" "}
              requires all US federal agencies to implement{" "}
              <code className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                p=reject
              </code>
              . The UK, Australia, Canada, Denmark, and New Zealand have similar
              mandates. And the results are stark: in countries with mandatory
              DMARC, phishing success rates dropped from{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                69% to 14%
              </span>
              . Meanwhile, the Netherlands—without mandates—saw vulnerability
              increase to 97%.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              The market is moving. The question is whether you'll be ahead of
              the compliance deadline or scrambling to catch up.
            </p>
          </div>
        </section>

        {/* Simulator */}
        <section>
          <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
            <h2 className="mb-4 font-bold text-3xl">
              See what happens when a spoofed email arrives
            </h2>
            <p className="text-foreground/80 text-xl leading-relaxed">
              Theory is one thing. Watching it happen is another. Toggle between
              DMARC policies below and see exactly which emails get blocked,
              quarantined, or delivered straight to your inbox.
            </p>
          </div>
          <DMARCSimulator />
        </section>

        {/* How it works */}
        <section>
          <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
            <h2 className="mb-4 font-bold text-3xl">
              How email authentication actually works
            </h2>
            <p className="text-foreground/80 text-xl leading-relaxed">
              SPF, DKIM, and DMARC are three separate protocols that work
              together—but each has limitations, and they only matter when you
              actually enforce the result. Here's how the chain works:
            </p>
          </div>
          <AuthExplainer />
        </section>

        {/* Real breaches */}
        <section>
          <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
            <h2 className="mb-4 font-bold text-3xl">
              Real-world email security incidents
            </h2>
            <p className="text-foreground/80 text-xl leading-relaxed">
              These aren't hypothetical scenarios. Each involved BEC attacks
              where weak or missing DMARC enabled domain spoofing—and proper
              enforcement would have prevented them. Click each incident for
              details.
            </p>
          </div>
          <BreachTimeline />
        </section>

        {/* How attackers exploit p=none */}
        <section>
          <h2 className="mb-6 font-bold text-3xl">
            State-sponsored attackers actively hunt for p=none
          </h2>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              In May 2024, the FBI, NSA, and State Department issued a{" "}
              <a
                className="text-primary hover:underline"
                href="https://www.bleepingcomputer.com/news/security/nsa-warns-of-north-korean-hackers-exploiting-weak-dmarc-email-policies/"
                rel="noopener noreferrer"
                target="_blank"
              >
                joint advisory
              </a>{" "}
              about North Korea's Kimsuky APT group. Their finding:{" "}
              <span className="font-semibold text-foreground">
                Kimsuky systematically scans for domains with weak DMARC
                policies
              </span>
              , then uses them to conduct spearphishing campaigns against US
              government officials, think tanks, academics, and journalists.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              The attack is straightforward. They query DNS for your DMARC
              record. If it returns{" "}
              <code className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                p=none
              </code>
              , they know the domain owner won't request enforcement of
              authentication failures—increasing their chances of successful
              delivery. The advisory included actual email headers from these
              attacks:
            </p>
          </div>

          {/* Attack flow visualization */}
          <div className="my-8 overflow-hidden rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 font-mono text-muted-foreground text-xs">
                Email header from Kimsuky attack (FBI advisory)
              </span>
            </div>
            <div className="p-4 font-mono text-sm">
              <div className="text-muted-foreground">
                Authentication-Results: spf=fail; dkim=fail;
              </div>
              <div className="text-red-600 dark:text-red-400">
                {"  "}dmarc=fail (p=none sp=none dis=none)
              </div>
              <div className="mt-2 text-muted-foreground">
                From: trusted.journalist@legitimate-news.org{" "}
                <span className="text-yellow-600 dark:text-yellow-400">
                  (spoofed)
                </span>
              </div>
              <div className="text-muted-foreground">
                To: policy.analyst@thinktank.org
              </div>
              <div className="mt-2 border-muted border-t pt-2 text-green-600 dark:text-green-400">
                Status: Delivered to inbox ✓
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              The email failed every authentication check—SPF, DKIM, and
              DMARC—but was delivered anyway because the policy was set to{" "}
              <code className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                p=none
              </code>
              . The advisory explicitly states that upgrading to{" "}
              <code className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                p=reject
              </code>{" "}
              would have prevented these attacks entirely.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              The US Treasury sanctioned Kimsuky in November 2023, but technical
              exploitation continues because organizations still haven't
              enforced their policies. Your{" "}
              <code className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                p=none
              </code>{" "}
              isn't just a configuration choice—it's an invitation.
            </p>
          </div>
        </section>

        {/* Domain Checker */}
        <section>
          <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
            <h2 className="mb-4 font-bold text-3xl">
              Check your domain right now
            </h2>
            <p className="text-foreground/80 text-xl leading-relaxed">
              Enter any domain below and see what policy it's running. You might
              be surprised—many organizations think they have protection when
              they're actually running{" "}
              <code className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                p=none
              </code>{" "}
              or have no DMARC record at all.
            </p>
          </div>
          <DomainChecker />
        </section>

        {/* Common Misconfigurations */}
        <section>
          <h2 className="mb-6 font-bold text-3xl">
            The technical debt that breaks protection
          </h2>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              Beyond the{" "}
              <code className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                p=none
              </code>{" "}
              problem, dozens of technical misconfigurations silently break
              email authentication—even for organizations that think they're
              protected.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              <span className="font-semibold text-foreground">
                SPF's 10-lookup limit
              </span>{" "}
              is the most common killer. Every{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                include:
              </code>{" "}
              statement in your SPF record triggers a DNS lookup. Exceed 10, and
              SPF returns a PermError—authentication fails completely. Add
              enough third-party services (Google Workspace, Salesforce,
              HubSpot, Zendesk) and you'll hit it without realizing.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              <span className="font-semibold text-foreground">
                Subdomain gaps
              </span>{" "}
              are equally dangerous. If you protect{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                yourcompany.com
              </code>{" "}
              but don't set a subdomain policy, attackers simply spoof{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                hr.yourcompany.com
              </code>{" "}
              or{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                billing.yourcompany.com
              </code>{" "}
              instead. The March 2022 SEC domain spoofing case demonstrated a
              related problem: attackers couldn't spoof sec.gov directly (it has{" "}
              <code className="rounded bg-green-500/20 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                p=reject
              </code>
              ), so they spoofed an unprotected government email delivery
              service domain instead—impersonating the SEC through the
              third-party intermediary.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              <span className="font-semibold text-foreground">
                Weak DKIM keys
              </span>{" "}
              (1024-bit or less) are vulnerable to cryptographic attacks.
              ManageMyHealth was running 1024-bit keys when they were breached.
              The minimum should be 2048-bit—which AWS SES and most modern
              providers use by default.
            </p>

            <p className="text-foreground/80 text-xl leading-relaxed">
              And{" "}
              <span className="font-semibold text-foreground">
                missing reporting tags
              </span>{" "}
              mean you have no visibility into failures. Without{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                rua=
              </code>{" "}
              in your DMARC record, you'll never know how many authentication
              failures are happening—or whether legitimate emails are being
              blocked.
            </p>
          </div>

          {/* Compact reference table */}
          <div className="my-8 overflow-hidden rounded-lg border">
            <div className="border-b bg-muted/50 px-4 py-2">
              <span className="font-mono text-muted-foreground text-xs">
                Common misconfigurations at a glance
              </span>
            </div>
            <div className="divide-y text-sm">
              {[
                {
                  issue: "SPF exceeds 10 DNS lookups",
                  result: "PermError → auth fails",
                },
                {
                  issue: "Multiple SPF records",
                  result: "Invalidates SPF entirely",
                },
                {
                  issue: "DKIM key ≤1024 bits",
                  result: "Cryptographically weak",
                },
                {
                  issue: "No sp= subdomain policy",
                  result: "Subdomains unprotected",
                },
                {
                  issue: "SPF uses ~all vs -all",
                  result: "Soft fail allows spoofs",
                },
                {
                  issue: "Missing rua= tag",
                  result: "No failure visibility",
                },
              ].map((row, i) => (
                <div
                  className="flex items-center justify-between px-4 py-2"
                  key={i}
                >
                  <code className="text-foreground">{row.issue}</code>
                  <span className="text-muted-foreground">{row.result}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Fix */}
        <section>
          <h2 className="mb-6 font-bold text-3xl">
            The path from p=none to p=reject
          </h2>

          <div className="prose prose-neutral dark:prose-invert mb-6 max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              Moving to enforcement isn't instant—but it's not the months-long
              project people assume. The process is bounded: identify your
              legitimate email senders, verify they're properly authenticated,
              then ramp up enforcement. Most organizations can complete this in
              2-4 weeks.
            </p>
          </div>
          <TheFix />

          <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
            <p className="text-foreground/80 text-xl leading-relaxed">
              The ROI is clear. Average data breach costs hit{" "}
              <span className="font-semibold text-foreground">
                $4.88 million
              </span>{" "}
              in 2024. DMARC implementation costs as little as $8-50/month.
              Forrester estimates large enterprises save{" "}
              <span className="font-semibold text-green-600 dark:text-green-400">
                $2.4 million annually
              </span>{" "}
              with proper enforcement. The ManageMyHealth case shows what
              happens when you don't act: a data breach becomes an ongoing
              phishing campaign against your own users.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-purple-500/10 p-8 md:p-12">
            <div className="prose prose-neutral dark:prose-invert mx-auto max-w-2xl text-center">
              <h2 className="mb-4 font-bold text-3xl">
                Stop being part of the 82%
              </h2>
              <p className="text-foreground/80 text-lg">
                Wraps deploys email infrastructure to your AWS account with
                proper SPF, DKIM, and DMARC enforcement from day one. No stored
                credentials, transparent AWS pricing, and you own everything.
              </p>
            </div>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <a href="https://wraps.dev">Get Started with Wraps</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="https://github.com/wraps-team/wraps">View on GitHub</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="space-y-4 text-center text-sm">
          <Card className="p-6">
            <h4 className="mb-3 font-medium text-muted-foreground">
              Sources & Further Reading
            </h4>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
              <a
                className="text-primary hover:underline"
                href="https://www.ic3.gov/Media/News/2024/240502.pdf"
                rel="noopener noreferrer"
                target="_blank"
              >
                FBI IC3 2024 Report
              </a>
              <a
                className="text-primary hover:underline"
                href="https://redsift.com/guides/red-sifts-guide-to-global-dmarc-adoption"
                rel="noopener noreferrer"
                target="_blank"
              >
                Red Sift DMARC Report 2025
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.bleepingcomputer.com/news/security/nsa-warns-of-north-korean-hackers-exploiting-weak-dmarc-email-policies/"
                rel="noopener noreferrer"
                target="_blank"
              >
                NSA/CISA Kimsuky Advisory
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.justice.gov/usao-sdny/pr/lithuanian-man-sentenced-5-years-prison-theft-over-120-million-fraudulent-business"
                rel="noopener noreferrer"
                target="_blank"
              >
                DOJ Google/Facebook Case
              </a>
              <a
                className="text-primary hover:underline"
                href="https://www.cisa.gov/news-events/directives/bod-18-01-enhance-email-and-web-security"
                rel="noopener noreferrer"
                target="_blank"
              >
                CISA BOD 18-01
              </a>
            </div>
          </Card>
          <p className="text-muted-foreground">
            Built by{" "}
            <a
              className="text-foreground hover:text-primary"
              href="https://wraps.dev"
            >
              Wraps
            </a>{" "}
            &mdash; Email infrastructure for developers who own their data.
          </p>
        </footer>
      </div>

      <LandingFooter />
    </div>
  );
}
