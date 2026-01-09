import * as React from "react";
import { cn } from "@/lib/utils";

const ButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      "-space-x-px inline-flex rounded-md shadow-xs rtl:space-x-reverse",
      "[&>*:first-child]:rounded-s-md [&>*:first-child]:rounded-e-none",
      "[&>*:last-child]:rounded-s-none [&>*:last-child]:rounded-e-md",
      "[&>*:not(:first-child):not(:last-child)]:rounded-none",
      "[&>*]:shadow-none",
      className
    )}
    ref={ref}
    {...props}
  />
));
ButtonGroup.displayName = "ButtonGroup";

export { ButtonGroup };
