import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type IconBadgeProps = {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "muted";
  className?: string;
};

const sizeStyles = {
  sm: { container: "h-8 w-8", icon: "h-4 w-4" },
  md: { container: "h-10 w-10", icon: "h-5 w-5" },
  lg: { container: "h-16 w-16", icon: "h-10 w-10" },
};

const variantStyles = {
  primary: { container: "bg-primary/10", icon: "text-primary" },
  muted: { container: "bg-muted", icon: "text-muted-foreground" },
};

export function IconBadge({
  icon: Icon,
  size = "md",
  variant = "primary",
  className,
}: IconBadgeProps) {
  const s = sizeStyles[size];
  const v = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg",
        s.container,
        v.container,
        className
      )}
    >
      <Icon className={cn(s.icon, v.icon)} />
    </div>
  );
}
