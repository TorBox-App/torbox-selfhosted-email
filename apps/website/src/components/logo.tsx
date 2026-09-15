import type * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export function Logo({ size = 40, className, style, ...props }: LogoProps) {
  // Use Next.js Image for optimized loading if possible, or standard img for simplicity in this component structure
  // Since this is a shared component potentially used in different contexts, let's check if we can use Next.js Image.
  // The file imports React but not Next.js Image. Let's stick to a simple img tag or import Image if it's a Next.js app (it is).

  return (
    <div
      className={cn("relative w-(--logo-w) h-(--logo-h)", className)}
      style={
        {
          "--logo-w": `${size * 3}px`,
          "--logo-h": `${size}px`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <img
        alt="Wraps Logo"
        className="h-full w-full object-contain dark:hidden"
        src="/wraps-light-logo.png"
      />
      <img
        alt="Wraps Logo"
        className="hidden h-full w-full object-contain dark:block"
        src="/wraps-dark-logo.png"
      />
    </div>
  );
}
