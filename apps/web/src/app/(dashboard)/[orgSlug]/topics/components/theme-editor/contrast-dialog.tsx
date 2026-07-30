"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wraps/ui/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wraps/ui/components/ui/table";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CONTRAST_PAIRS,
  contrastRatio,
  resolveThemeTokens,
  wcagLevel,
} from "@/lib/preference-theme/contrast";
import type { ThemeDraft } from "./use-theme-draft";

type ContrastDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: ThemeDraft;
  previewMode: "light" | "dark";
};

type Row = {
  label: string;
  ratio: number | null;
  aa: boolean;
  aaa: boolean;
  fgValue: string | null;
  bgValue: string | null;
};

export function ContrastDialog({
  open,
  onOpenChange,
  theme,
  previewMode,
}: ContrastDialogProps) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const resolved = resolveThemeTokens(theme, previewMode);
    const host = document.body;
    const nextRows: Row[] = CONTRAST_PAIRS.map((pair) => {
      const fgValue = resolved[pair.fg] ?? null;
      const bgValue = resolved[pair.bg] ?? null;
      const ratio =
        fgValue && bgValue ? contrastRatio(fgValue, bgValue, host) : null;
      const { aa, aaa } = ratio ? wcagLevel(ratio) : { aa: false, aaa: false };
      return { label: pair.label, ratio, aa, aaa, fgValue, bgValue };
    });
    setRows(nextRows);
  }, [open, theme, previewMode]);

  const failingCount = rows.filter((r) => r.ratio !== null && !r.aa).length;
  const measuredCount = rows.filter((r) => r.ratio !== null).length;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Color contrast check</DialogTitle>
          <DialogDescription>
            WCAG 2.x contrast ratios for{" "}
            {previewMode === "light" ? "Light" : "Dark"} mode.{" "}
            {failingCount > 0 ? (
              <span className="text-destructive">
                {failingCount} {failingCount === 1 ? "pair" : "pairs"} fail AA.
              </span>
            ) : measuredCount > 0 ? (
              <span className="text-success">All pairs pass AA.</span>
            ) : (
              <span className="text-muted-foreground">
                Contrast couldn't be measured in this browser.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead>Colors</TableHead>
              <TableHead>Ratio</TableHead>
              <TableHead>AA</TableHead>
              <TableHead>AAA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={
                        row.fgValue
                          ? { backgroundColor: row.fgValue }
                          : undefined
                      }
                    />
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={
                        row.bgValue
                          ? { backgroundColor: row.bgValue }
                          : undefined
                      }
                    />
                  </div>
                </TableCell>
                <TableCell>
                  {row.ratio ? `${row.ratio.toFixed(1)}:1` : "—"}
                </TableCell>
                <TableCell>
                  {row.ratio === null ? (
                    "—"
                  ) : row.aa ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
                <TableCell>
                  {row.ratio === null ? (
                    "—"
                  ) : row.aaa ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-muted-foreground text-xs">
          AA requires 4.5:1 for normal text, 3:1 for large text. AAA requires
          7:1 for normal text.
        </p>
      </DialogContent>
    </Dialog>
  );
}
