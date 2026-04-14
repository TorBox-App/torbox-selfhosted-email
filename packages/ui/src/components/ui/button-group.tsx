import { cn } from "@wraps/ui/lib/utils";
import type * as React from "react";

function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-space-x-px inline-flex rounded-md shadow-xs rtl:space-x-reverse",
        "[&>*:first-child]:rounded-s-md [&>*:first-child]:rounded-e-none",
        "[&>*:last-child]:rounded-s-none [&>*:last-child]:rounded-e-md",
        "[&>*:not(:first-child):not(:last-child)]:rounded-none",
        "[&>*]:shadow-none",
        className
      )}
      data-slot="button-group"
      {...props}
    />
  );
}

export { ButtonGroup };
