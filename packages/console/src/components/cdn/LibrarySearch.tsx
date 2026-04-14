import { Input } from "@wraps/ui/components/ui/input";
import { Search } from "lucide-react";

type LibrarySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LibrarySearch({ value, onChange }: LibrarySearchProps) {
  return (
    <div className="relative">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
      <Input
        className="pl-9"
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search files by name..."
        type="search"
        value={value}
      />
    </div>
  );
}
