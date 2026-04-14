import { Button } from "@wraps/ui/components/ui/button";
import { Star, Trash2, X } from "lucide-react";

type LibraryBulkActionsProps = {
  selectedCount: number;
  onStar: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
};

export function LibraryBulkActions({
  selectedCount,
  onStar,
  onDelete,
  onClearSelection,
}: LibraryBulkActionsProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-3">
        <span className="font-medium text-sm">{selectedCount} selected</span>
        <Button
          className="gap-2 bg-transparent"
          onClick={onStar}
          size="sm"
          variant="outline"
        >
          <Star className="h-4 w-4" />
          Star
        </Button>
        <Button
          className="gap-2 bg-transparent text-destructive hover:text-destructive"
          onClick={onDelete}
          size="sm"
          variant="outline"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
      <Button
        className="gap-2"
        onClick={onClearSelection}
        size="sm"
        variant="ghost"
      >
        <X className="h-4 w-4" />
        Clear
      </Button>
    </div>
  );
}
