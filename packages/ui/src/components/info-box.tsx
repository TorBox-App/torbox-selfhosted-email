import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type InfoBoxProps = {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function InfoBox({
  title,
  icon: Icon,
  children,
  className,
}: InfoBoxProps) {
  return (
    <div className={cn("space-y-2 rounded-lg bg-muted/50 p-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="text-muted-foreground text-sm">{children}</div>
    </div>
  );
}

export function InfoBoxList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
      {children}
    </ul>
  );
}
