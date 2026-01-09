import { LayoutGrid, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "./types";

type LibraryViewToggleProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export function LibraryViewToggle({
  viewMode,
  onViewModeChange,
}: LibraryViewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
      <Button
        className="gap-2"
        onClick={() => onViewModeChange("grid")}
        size="sm"
        variant={viewMode === "grid" ? "secondary" : "ghost"}
      >
        <LayoutGrid className="h-4 w-4" />
        Grid
      </Button>
      <Button
        className="gap-2"
        onClick={() => onViewModeChange("table")}
        size="sm"
        variant={viewMode === "table" ? "secondary" : "ghost"}
      >
        <Table className="h-4 w-4" />
        Table
      </Button>
    </div>
  );
}
