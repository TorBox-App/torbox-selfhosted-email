"use client";

import { Info } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

type TrackedEventTooltipProps = {
  /** The text to display. Defaults to "tracked events" */
  children?: React.ReactNode;
  /** Additional classes for the trigger */
  className?: string;
};

/**
 * A reusable tooltip that explains what tracked events are.
 * Use this anywhere "tracked events" is mentioned on the website.
 *
 * @example
 * <TrackedEventTooltip /> // Shows "tracked events"
 * <TrackedEventTooltip>Tracked Events</TrackedEventTooltip> // Custom text
 */
export function TrackedEventTooltip({
  children = "tracked events",
  className,
}: TrackedEventTooltipProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          className={`inline cursor-help border-b border-dashed border-current bg-transparent p-0 font-inherit text-inherit hover:border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm ${className}`}
          type="button"
        >
          {children}
          <Info
            aria-hidden="true"
            className="ml-0.5 inline size-3 align-middle"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="center" className="w-80" side="top">
        <div className="space-y-3">
          <div>
            <h4 className="mb-1 font-semibold text-sm">
              What are tracked events?
            </h4>
            <p className="text-muted-foreground text-sm">
              Behavioral events you emit via our API to power automations and
              segmentation.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-green-600 text-xs dark:text-green-400">
              Counts as 1 tracked event:
            </p>
            <ul className="space-y-0.5 text-muted-foreground text-xs">
              <li>
                Custom events via API (e.g., <code>user.signed_up</code>)
              </li>
              <li>Events used to trigger workflows</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-xs">
              Does NOT count (free & unlimited):
            </p>
            <ul className="space-y-0.5 text-muted-foreground text-xs">
              <li>Emails sent (you pay AWS directly)</li>
              <li>Broadcasts and campaigns</li>
              <li>Contacts stored</li>
              <li>Opens, clicks, deliveries from SES</li>
            </ul>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
