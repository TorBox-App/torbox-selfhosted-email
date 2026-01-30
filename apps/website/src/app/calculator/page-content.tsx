"use client";

import { ArrowRight, Calculator, DollarSign, Info } from "lucide-react";
import { useState } from "react";
import { TrackedEventTooltip } from "@/components/tracked-event-tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  OVERAGE_RATES,
  PRICING_TIERS,
  TIER_LIMITS,
  type TierId,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

/**
 * AWS pricing constants (as of 2026)
 * All costs in USD (US East N. Virginia region)
 */
const AWS_PRICING = {
  SES_PER_EMAIL: 0.0001, // $0.10 per 1,000 emails
  DYNAMODB_WRITE_PER_MILLION: 1.25,
  DYNAMODB_STORAGE_PER_GB: 0.25,
  LAMBDA_REQUESTS_PER_MILLION: 0.2,
  LAMBDA_COMPUTE_PER_GB_SECOND: 0.000_016_666_7,
  SQS_REQUESTS_PER_MILLION: 0.5,
  EVENTBRIDGE_EVENTS_PER_MILLION: 1.0,
  DEDICATED_IP_PER_MONTH: 24.95,
  // WAF pricing (for HTTPS tracking CDN protection)
  WAF_WEB_ACL_PER_MONTH: 5.0, // $5.00 per Web ACL per month
  WAF_RULE_PER_MONTH: 1.0, // $1.00 per rule per month
  WAF_REQUESTS_PER_MILLION: 0.6, // $0.60 per million requests
} as const;

const FREE_TIER = {
  LAMBDA_REQUESTS: 1_000_000,
  LAMBDA_COMPUTE_GB_SECONDS: 400_000,
  DYNAMODB_STORAGE_GB: 25,
  SQS_REQUESTS: 1_000_000,
} as const;

type RetentionPeriod = "7days" | "30days" | "90days" | "1year" | "indefinite";

/**
 * Estimate steady-state storage size in GB
 * This represents storage AFTER the retention period fills up
 */
function estimateStorageSize(
  emailsPerMonth: number,
  retention: RetentionPeriod,
  numEventTypes = 8
): number {
  const avgRecordSizeKB = 2;
  const retentionMonths = {
    "7days": 0.25,
    "30days": 1,
    "90days": 3,
    "1year": 12,
    indefinite: 24,
  }[retention];

  const totalKB =
    emailsPerMonth * numEventTypes * retentionMonths * avgRecordSizeKB;
  return totalKB / 1024 / 1024; // Convert to GB
}

/**
 * Calculate storage growth over time (for visualization)
 */
function calculateStorageGrowth(
  emailsPerMonth: number,
  retention: RetentionPeriod,
  numEventTypes = 8
): Array<{ month: number; storageGB: number }> {
  const avgRecordSizeKB = 2;
  const retentionMonths = {
    "7days": 0.25,
    "30days": 1,
    "90days": 3,
    "1year": 12,
    indefinite: 24,
  }[retention];

  const monthlyDataKB = emailsPerMonth * numEventTypes * avgRecordSizeKB;
  const maxMonths = Math.ceil(retentionMonths) + 1;

  return Array.from({ length: maxMonths }, (_, i) => {
    const month = i + 1;
    // Storage grows linearly until it reaches retention limit
    const accumulatedMonths = Math.min(month, retentionMonths);
    const storageKB = monthlyDataKB * accumulatedMonths;
    return {
      month,
      storageGB: storageKB / 1024 / 1024,
    };
  });
}

export default function CostCalculatorPageContent() {
  const [emailsPerMonth, setEmailsPerMonth] = useState(50_000);
  const [eventsPerMonth, setEventsPerMonth] = useState(25_000);
  const [selectedTier, setSelectedTier] = useState<TierId>("starter");
  const [eventTrackingEnabled, setEventTrackingEnabled] = useState(true);
  const [eventBridgeEnabled, setEventBridgeEnabled] = useState(true);
  const [dynamoDBEnabled, setDynamoDBEnabled] = useState(true);
  const [retention, setRetention] = useState<RetentionPeriod>("90days");
  const [numEventTypes, setNumEventTypes] = useState(8);
  const [dedicatedIp, setDedicatedIp] = useState(false);
  const [customDomain, setCustomDomain] = useState(false);
  const [httpsTracking, setHttpsTracking] = useState(false);
  const [wafEnabled, setWafEnabled] = useState(false);

  // Calculate Wraps platform costs (based on events, not emails)
  const calculateWrapsCosts = () => {
    const tier = PRICING_TIERS.find((t) => t.id === selectedTier);
    const limits = TIER_LIMITS[selectedTier];
    const overage = OVERAGE_RATES[selectedTier];

    if (!tier) return { platformCost: 0, overageCost: 0, totalWrapsCost: 0 };

    const platformCost = tier.price;
    const includedEvents =
      typeof limits.messages === "number"
        ? limits.messages
        : Number.POSITIVE_INFINITY;
    const overageEvents = Math.max(0, eventsPerMonth - includedEvents);
    const overageCost =
      overage.perThousand > 0
        ? (overageEvents / 1000) * overage.perThousand
        : 0;

    return {
      platformCost,
      overageCost,
      totalWrapsCost: platformCost + overageCost,
      includedEvents,
      overageEvents,
      requiresUpgrade: overageEvents > 0 && overage.perThousand === 0,
    };
  };

  const wrapsCosts = calculateWrapsCosts();

  // Calculate costs
  const calculateCosts = () => {
    let total = 0;
    const breakdown: Array<{ name: string; cost: number; details?: string }> =
      [];

    // SES email sending cost
    const sesEmailCost = emailsPerMonth * AWS_PRICING.SES_PER_EMAIL;
    total += sesEmailCost;
    breakdown.push({
      name: "SES Email Sending",
      cost: sesEmailCost,
      details: `${emailsPerMonth.toLocaleString()} emails × $${AWS_PRICING.SES_PER_EMAIL.toFixed(4)}`,
    });

    if (eventTrackingEnabled) {
      const totalEvents = emailsPerMonth * numEventTypes;

      // EventBridge
      if (eventBridgeEnabled) {
        const eventCost =
          (totalEvents / 1_000_000) *
          AWS_PRICING.EVENTBRIDGE_EVENTS_PER_MILLION;
        total += eventCost;
        breakdown.push({
          name: "EventBridge Events",
          cost: eventCost,
          details: `${totalEvents.toLocaleString()} events × $${(AWS_PRICING.EVENTBRIDGE_EVENTS_PER_MILLION / 1_000_000).toFixed(6)}`,
        });
      }

      // SQS
      const sqsRequests = totalEvents * 3;
      const sqsCost =
        (Math.max(0, sqsRequests - FREE_TIER.SQS_REQUESTS) / 1_000_000) *
        AWS_PRICING.SQS_REQUESTS_PER_MILLION;
      total += sqsCost;
      breakdown.push({
        name: "SQS Queue",
        cost: sqsCost,
        details:
          sqsCost === 0
            ? "Within free tier (1M requests/month)"
            : `${sqsRequests.toLocaleString()} requests (after 1M free tier)`,
      });

      // Lambda
      const lambdaInvocations = totalEvents;
      const lambdaRequestCost =
        (Math.max(0, lambdaInvocations - FREE_TIER.LAMBDA_REQUESTS) /
          1_000_000) *
        AWS_PRICING.LAMBDA_REQUESTS_PER_MILLION;

      const memoryGB = 0.5;
      const avgDurationSeconds = 0.1;
      const computeGBSeconds =
        lambdaInvocations * memoryGB * avgDurationSeconds;
      const lambdaComputeCost =
        Math.max(0, computeGBSeconds - FREE_TIER.LAMBDA_COMPUTE_GB_SECONDS) *
        AWS_PRICING.LAMBDA_COMPUTE_PER_GB_SECOND;

      const lambdaTotalCost = lambdaRequestCost + lambdaComputeCost;
      total += lambdaTotalCost;
      breakdown.push({
        name: "Lambda Processing",
        cost: lambdaTotalCost,
        details:
          lambdaTotalCost === 0
            ? "Within free tier (1M requests + 400K GB-seconds/month)"
            : `${lambdaInvocations.toLocaleString()} invocations (512MB, 100ms avg)`,
      });

      // DynamoDB
      if (dynamoDBEnabled) {
        const writeCost =
          (totalEvents / 1_000_000) * AWS_PRICING.DYNAMODB_WRITE_PER_MILLION;

        const storageGB = estimateStorageSize(
          emailsPerMonth,
          retention,
          numEventTypes
        );
        const storageCost =
          Math.max(0, storageGB - FREE_TIER.DYNAMODB_STORAGE_GB) *
          AWS_PRICING.DYNAMODB_STORAGE_PER_GB;

        const dynamoTotalCost = writeCost + storageCost;
        total += dynamoTotalCost;
        breakdown.push({
          name: "DynamoDB Storage",
          cost: dynamoTotalCost,
          details: `${storageGB.toFixed(3)} GB at steady-state (${retention}), ${totalEvents.toLocaleString()} writes/month`,
        });
      }
    }

    // Dedicated IP
    if (dedicatedIp) {
      total += AWS_PRICING.DEDICATED_IP_PER_MONTH;
      breakdown.push({
        name: "Dedicated IP",
        cost: AWS_PRICING.DEDICATED_IP_PER_MONTH,
        details: "Recommended for 100k+ emails/day",
      });
    }

    // Custom tracking domain (no additional cost - DNS managed where user manages DNS)
    if (customDomain) {
      // No cost to add
    }

    // WAF protection for HTTPS tracking CDN
    if (httpsTracking && wafEnabled) {
      // Estimate ~2 requests per email (open tracking pixel + click tracking)
      const estimatedWafRequests = emailsPerMonth * 2;
      const wafCost =
        AWS_PRICING.WAF_WEB_ACL_PER_MONTH +
        AWS_PRICING.WAF_RULE_PER_MONTH +
        (estimatedWafRequests / 1_000_000) *
          AWS_PRICING.WAF_REQUESTS_PER_MILLION;
      total += wafCost;
      breakdown.push({
        name: "WAF Rate Limiting",
        cost: wafCost,
        details: `$${AWS_PRICING.WAF_WEB_ACL_PER_MONTH}/mo Web ACL + $${AWS_PRICING.WAF_RULE_PER_MONTH}/mo rule + requests`,
      });
    }

    return { total, breakdown };
  };

  const { total, breakdown } = calculateCosts();
  const perThousandEmails =
    emailsPerMonth > 0 ? (total / emailsPerMonth) * 1000 : 0;

  // Calculate storage growth for display
  const storageGrowth = dynamoDBEnabled
    ? calculateStorageGrowth(emailsPerMonth, retention, numEventTypes)
    : [];

  const costFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatCost = (cost: number) => {
    if (cost === 0) {
      return costFormatter.format(0);
    }
    if (cost < 0.01) {
      return `< ${costFormatter.format(0.01)}`;
    }
    return costFormatter.format(cost);
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <a className="flex items-center gap-2 font-bold text-xl" href="/">
            <Calculator aria-hidden="true" className="size-6" />
            Wraps Cost Calculator
          </a>
          <Button asChild variant="outline">
            <a href="/">Back to Home</a>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {/* Page Header */}
          <div className="mb-12 text-center">
            <Badge className="mb-4" variant="outline">
              Cost Estimator
            </Badge>
            <h1 className="mb-4 text-balance font-bold text-4xl tracking-tight">
              Calculate Your AWS Email Costs
            </h1>
            <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
              Transparent pricing calculator using real AWS rates. See exactly
              what you'll pay for your email infrastructure.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Configuration Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wraps Plan Selection */}
                <div className="space-y-3">
                  <Label>Wraps Plan</Label>
                  <fieldset className="grid grid-cols-2 gap-2 border-none p-0 m-0">
                    <legend className="sr-only">Wraps plan selection</legend>
                    {PRICING_TIERS.map((tier) => {
                      const isSelected = selectedTier === tier.id;
                      const limits = TIER_LIMITS[tier.id];
                      const overage = OVERAGE_RATES[tier.id];
                      return (
                        <button
                          aria-pressed={isSelected}
                          className={cn(
                            "rounded-lg border-2 p-3 text-left touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                          key={tier.id}
                          onClick={() => {
                            setSelectedTier(tier.id);
                            const maxEvents = limits.messages;
                            if (typeof maxEvents === "number") {
                              setEventsPerMonth(maxEvents);
                            }
                          }}
                          type="button"
                        >
                          <div className="font-semibold">{tier.name}</div>
                          <div className="tabular-nums font-bold text-lg">
                            ${tier.price}
                            <span className="font-normal text-muted-foreground text-sm">
                              /mo
                            </span>
                          </div>
                          <div className="mt-1 text-muted-foreground text-xs">
                            {limits.messagesDisplay} tracked events
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {overage.perThousand > 0
                              ? overage.display.replace(
                                  "events",
                                  "tracked events"
                                )
                              : "Upgrade if over"}
                          </div>
                        </button>
                      );
                    })}
                  </fieldset>
                </div>

                {/* Monthly Tracked Events (Wraps billing) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1" htmlFor="events">
                    Monthly{" "}
                    <TrackedEventTooltip>Tracked Events</TrackedEventTooltip>
                  </Label>
                  <Input
                    autoComplete="off"
                    id="events"
                    max={10_000_000}
                    min={0}
                    onChange={(e) =>
                      setEventsPerMonth(
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    placeholder="Enter monthly tracked events\u2026"
                    type="number"
                    value={eventsPerMonth}
                  />
                  <p className="text-muted-foreground text-sm">
                    Behavioral events you send to Wraps (user actions, workflow
                    triggers)
                  </p>
                </div>

                {/* Email Volume (AWS billing) */}
                <div className="space-y-2">
                  <Label htmlFor="emails">Monthly Emails (AWS)</Label>
                  <Input
                    autoComplete="off"
                    id="emails"
                    max={10_000_000}
                    min={0}
                    onChange={(e) =>
                      setEmailsPerMonth(
                        Number.parseInt(e.target.value, 10) || 0
                      )
                    }
                    placeholder="Enter monthly emails\u2026"
                    type="number"
                    value={emailsPerMonth}
                  />
                  <p className="text-muted-foreground text-sm">
                    Emails sent via AWS SES
                  </p>
                </div>

                {/* Email Event Tracking (SES events, not Wraps custom events) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="event-tracking">
                        Email Event Tracking
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        SES delivery events: opens, clicks, bounces (stored in
                        your AWS)
                      </p>
                    </div>
                    <Switch
                      checked={eventTrackingEnabled}
                      id="event-tracking"
                      onCheckedChange={setEventTrackingEnabled}
                    />
                  </div>

                  {eventTrackingEnabled && (
                    <div className="ml-6 space-y-4 border-l-2 pl-4">
                      {/* EventBridge */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="eventbridge">
                            Real-time EventBridge
                          </Label>
                          <p className="text-muted-foreground text-sm">
                            Process events in real-time
                          </p>
                        </div>
                        <Switch
                          checked={eventBridgeEnabled}
                          id="eventbridge"
                          onCheckedChange={setEventBridgeEnabled}
                        />
                      </div>

                      {/* DynamoDB History */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="dynamodb">Email History</Label>
                          <p className="text-muted-foreground text-sm">
                            Store events in DynamoDB
                          </p>
                        </div>
                        <Switch
                          checked={dynamoDBEnabled}
                          id="dynamodb"
                          onCheckedChange={setDynamoDBEnabled}
                        />
                      </div>

                      {/* Retention Period */}
                      {dynamoDBEnabled && (
                        <div className="space-y-2">
                          <Label htmlFor="retention">Retention Period</Label>
                          <Select
                            onValueChange={(value: RetentionPeriod) => {
                              setRetention(value);
                            }}
                            value={retention}
                          >
                            <SelectTrigger id="retention">
                              <SelectValue placeholder="Select retention" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7days">7 Days</SelectItem>
                              <SelectItem value="30days">30 Days</SelectItem>
                              <SelectItem value="90days">90 Days</SelectItem>
                              <SelectItem value="1year">1 Year</SelectItem>
                              <SelectItem value="indefinite">
                                Indefinite (2+ years)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Event Types */}
                      <div className="space-y-2">
                        <Label htmlFor="event-types">Event Types Tracked</Label>
                        <Select
                          onValueChange={(value) =>
                            setNumEventTypes(Number.parseInt(value, 10))
                          }
                          value={numEventTypes.toString()}
                        >
                          <SelectTrigger id="event-types">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">
                              2 (SEND, DELIVERY)
                            </SelectItem>
                            <SelectItem value="4">
                              4 (+ BOUNCE, COMPLAINT)
                            </SelectItem>
                            <SelectItem value="6">6 (+ OPEN, CLICK)</SelectItem>
                            <SelectItem value="8">
                              8 (+ REJECT, RENDERING_FAILURE)
                            </SelectItem>
                            <SelectItem value="10">10 (All Events)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Advanced Options */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-sm">Advanced Options</h3>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="dedicated-ip">Dedicated IP</Label>
                      <p className="text-muted-foreground text-sm">
                        $24.95/month, needs 100k+ emails/day
                      </p>
                    </div>
                    <Switch
                      checked={dedicatedIp}
                      id="dedicated-ip"
                      onCheckedChange={setDedicatedIp}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="custom-domain">
                        Custom Tracking Domain
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        No additional cost (use your DNS)
                      </p>
                    </div>
                    <Switch
                      checked={customDomain}
                      id="custom-domain"
                      onCheckedChange={setCustomDomain}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="https-tracking">
                        HTTPS Tracking (CloudFront)
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        SSL for custom tracking domain
                      </p>
                    </div>
                    <Switch
                      checked={httpsTracking}
                      id="https-tracking"
                      onCheckedChange={(checked) => {
                        setHttpsTracking(checked);
                        if (!checked) {
                          setWafEnabled(false);
                        }
                      }}
                    />
                  </div>

                  {httpsTracking && (
                    <div className="ml-6 flex items-center justify-between border-l-2 pl-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="waf-enabled">WAF Rate Limiting</Label>
                        <p className="text-muted-foreground text-sm">
                          ~$6/mo base + $0.60/M requests
                        </p>
                      </div>
                      <Switch
                        checked={wafEnabled}
                        id="waf-enabled"
                        onCheckedChange={setWafEnabled}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown Panel */}
            <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
              {/* Total Cost Card */}
              <Card className="border-2 border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign aria-hidden="true" className="size-5" />
                    Estimated Monthly Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {wrapsCosts.requiresUpgrade ? (
                    <div className="mb-6">
                      <div className="mb-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          Upgrade Required
                        </p>
                        <p className="mt-1 text-amber-600 text-sm dark:text-amber-300">
                          Your tracked events ({eventsPerMonth.toLocaleString()}
                          ) exceed the{" "}
                          {
                            PRICING_TIERS.find((t) => t.id === selectedTier)
                              ?.name
                          }{" "}
                          plan limit of{" "}
                          {wrapsCosts.includedEvents?.toLocaleString()} tracked
                          events/month.
                        </p>
                        <p className="mt-2 text-sm">
                          Consider upgrading to{" "}
                          <strong>
                            {selectedTier === "free"
                              ? "Starter"
                              : selectedTier === "starter"
                                ? "Growth"
                                : "Scale"}
                          </strong>{" "}
                          for more tracked events or overage billing.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <div className="mb-2 tabular-nums font-bold text-5xl">
                        {formatCost(wrapsCosts.totalWrapsCost + total)}
                      </div>
                      <div className="text-muted-foreground">
                        Wraps + AWS combined
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>Wraps Platform</span>
                      <span className="tabular-nums">
                        {formatCost(wrapsCosts.platformCost)}/mo
                      </span>
                    </div>
                    {wrapsCosts.overageCost > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span className="ml-4">
                          + Overage (
                          {wrapsCosts.overageEvents?.toLocaleString()} events)
                        </span>
                        <span className="tabular-nums">
                          {formatCost(wrapsCosts.overageCost)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>AWS Infrastructure</span>
                      <span className="tabular-nums">
                        {formatCost(total)}/mo
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold">
                      <span>Total Monthly Cost</span>
                      <span className="tabular-nums">
                        {wrapsCosts.requiresUpgrade
                          ? "—"
                          : formatCost(wrapsCosts.totalWrapsCost + total)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tracked Events:
                      </span>
                      <span className="tabular-nums font-medium">
                        {eventsPerMonth.toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Included in Plan:
                      </span>
                      <span className="tabular-nums font-medium">
                        {wrapsCosts.includedEvents?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Emails Sent:
                      </span>
                      <span className="tabular-nums font-medium">
                        {emailsPerMonth.toLocaleString()}/mo
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {breakdown.map((item) => (
                      <div
                        className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
                        key={item.name}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{item.name}</span>
                          {item.details && (
                            <p className="mt-1 text-muted-foreground text-xs">
                              {item.details}
                            </p>
                          )}
                        </div>
                        <span className="tabular-nums font-mono text-sm">
                          {formatCost(item.cost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Storage Growth Explanation */}
              {dynamoDBEnabled && storageGrowth.length > 0 && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Info
                        aria-hidden="true"
                        className="size-5 text-blue-600"
                      />
                      Storage Growth Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground text-sm">
                      Storage costs grow gradually as data accumulates, then
                      plateau once retention period fills. Costs shown above
                      reflect <strong>steady-state</strong> (after Month{" "}
                      {storageGrowth.length - 1}).
                    </p>

                    {/* Simple growth visualization */}
                    <div className="space-y-2">
                      {storageGrowth.slice(0, 5).map((point) => {
                        const isLastMonth =
                          point.month === storageGrowth.length - 1;
                        const storageCost =
                          Math.max(
                            0,
                            point.storageGB - FREE_TIER.DYNAMODB_STORAGE_GB
                          ) * AWS_PRICING.DYNAMODB_STORAGE_PER_GB;

                        return (
                          <div
                            className="flex items-center justify-between text-sm"
                            key={`month-${point.month}`}
                          >
                            <span className="text-muted-foreground">
                              Month {point.month}
                              {isLastMonth && "+ (steady-state)"}:
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums font-mono">
                                {point.storageGB.toFixed(3)} GB
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                ({formatCost(storageCost)} storage)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {storageGrowth.length > 5 && (
                        <div className="pt-2 text-center text-muted-foreground text-xs">
                          ... continues to Month {storageGrowth.length - 1}{" "}
                          (steady-state)
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AWS Free Tier Notice */}
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <Info
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-green-600"
                    />
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        AWS Free Tier Included
                      </p>
                      <ul className="space-y-1 text-green-800 dark:text-green-200">
                        <li>• 1M Lambda requests/month</li>
                        <li>• 400K Lambda GB-seconds/month</li>
                        <li>• 1M SQS requests/month</li>
                        <li>• 25 GB DynamoDB storage</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA */}
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full" size="lg">
                  <a
                    href={`https://app.wraps.dev/auth?mode=signup&plan=${selectedTier}`}
                  >
                    Get Started with{" "}
                    {PRICING_TIERS.find((t) => t.id === selectedTier)?.name ??
                      "Wraps"}
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </a>
                </Button>
                <Button asChild className="w-full" size="lg" variant="outline">
                  <a href="/docs">Read Documentation</a>
                </Button>
              </div>
            </div>
          </div>

          {/* Pricing Notes */}
          <Card className="mt-12">
            <CardHeader>
              <CardTitle>Pricing Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="mb-2 font-semibold">How We Calculate Costs</h4>
                <p className="text-pretty text-muted-foreground">
                  All costs are based on official AWS pricing as of January 2026
                  for US East (N. Virginia) region. Costs include AWS free tier
                  benefits where applicable. Storage costs shown represent{" "}
                  <strong>steady-state</strong> (after retention period fills
                  up) - initial months will be cheaper as storage builds
                  gradually. Your actual costs may vary based on region and
                  usage patterns.
                </p>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">What's Included</h4>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>SES email sending ($0.10 per 1,000 emails)</li>
                  <li>
                    Event processing (EventBridge, SQS, Lambda) if enabled
                  </li>
                  <li>Email history storage in DynamoDB if enabled</li>
                  <li>Optional dedicated IP address ($24.95/month)</li>
                  <li>
                    All infrastructure runs in your AWS account - you pay AWS
                    directly
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Wraps Platform Fee</h4>
                <p className="text-pretty text-muted-foreground">
                  Wraps is a platform fee for email infrastructure you own. You
                  pay us for tooling (dashboard, workflows, AI, analytics) and
                  AWS directly for sending ($0.10/1K emails). Free tier includes
                  5K tracked events/month. Paid plans unlock more volume, longer
                  history retention, and features like topics, segments, and
                  campaigns.
                </p>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">CLI & SDK</h4>
                <p className="text-pretty text-muted-foreground">
                  The Wraps CLI and TypeScript SDK work with all plans,
                  including Free. Deploy to your AWS account — no vendor
                  lock-in, no hidden fees.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
