import { Filter, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilterOptions } from "./types";

type LibraryFiltersProps = {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableFormats: string[];
};

export function LibraryFilters({
  filters,
  onFiltersChange,
  availableFormats,
}: LibraryFiltersProps) {
  const activeFilterCount = (filters.starred ? 1 : 0) + filters.formats.length;

  return (
    <div className="flex items-center gap-2">
      {/* Starred Quick Filter */}
      <Button
        className="gap-2"
        onClick={() =>
          onFiltersChange({ ...filters, starred: !filters.starred })
        }
        size="sm"
        variant={filters.starred ? "secondary" : "outline"}
      >
        <Star className={`h-4 w-4 ${filters.starred ? "fill-current" : ""}`} />
        Starred
      </Button>

      {/* Format Filters */}
      {availableFormats.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="gap-2 bg-transparent"
              size="sm"
              variant="outline"
            >
              <Filter className="h-4 w-4" />
              Formats
              {activeFilterCount > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs" variant="secondary">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>File Format</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableFormats.map((format) => (
              <DropdownMenuCheckboxItem
                checked={filters.formats.includes(format)}
                key={format}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    formats: checked
                      ? [...filters.formats, format]
                      : filters.formats.filter((f) => f !== format),
                  });
                }}
              >
                {format.toUpperCase()}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
