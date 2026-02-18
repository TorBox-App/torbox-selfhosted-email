import { cn } from "@/lib/utils";

type SectionDividerProps = {
  className?: string;
};

export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="h-px w-full bg-border" />
    </div>
  );
}
