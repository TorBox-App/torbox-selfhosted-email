"use client";

import { useTheme } from "@wraps/ui/hooks/use-theme";
import Image from "next/image";
import type * as React from "react";
import { useEffect, useState } from "react";

interface LogoProps extends React.HTMLAttributes<HTMLImageElement> {
  size?: number;
}

export function Logo({ size = 24, className, ...props }: LogoProps) {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      setResolvedTheme(systemTheme);
    } else {
      setResolvedTheme(theme as "light" | "dark");
    }
  }, [theme]);

  const logoSrc =
    resolvedTheme === "dark" ? "/wraps-dark-logo.png" : "/wraps-light-logo.png";

  return (
    <Image
      alt="Wraps Logo"
      className={className}
      height={300}
      priority
      src={logoSrc}
      style={{ display: "block", height: "auto", width: size * 3 }}
      unoptimized
      width={980}
      {...props}
    />
  );
}
