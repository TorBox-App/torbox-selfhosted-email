import * as React from "react";
import { cn } from "@/lib/utils";

const ButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex -space-x-px rounded-md shadow-xs rtl:space-x-reverse",
      "[&>*:first-child]:rounded-s-md [&>*:first-child]:rounded-e-none",
      "[&>*:last-child]:rounded-e-md [&>*:last-child]:rounded-s-none",
      "[&>*:not(:first-child):not(:last-child)]:rounded-none",
      "[&>*]:shadow-none",
      className
    )}
    {...props}
  />
));
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
