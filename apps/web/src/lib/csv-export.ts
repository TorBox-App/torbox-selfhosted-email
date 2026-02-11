import { toast } from "sonner";

export type CSVColumnDef<T> = {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
};

function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV<T>(rows: T[], columns: CSVColumnDef<T>[]): string {
  const header = columns.map((col) => escapeCSVCell(col.header)).join(",");
  const body = rows
    .map((row) =>
      columns.map((col) => escapeCSVCell(col.accessor(row))).join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTableToCSV<T>(
  rows: T[],
  columns: CSVColumnDef<T>[],
  filename: string
): void {
  if (rows.length === 0) {
    toast.info("No data to export");
    return;
  }
  const csv = toCSV(rows, columns);
  downloadCSV(csv, filename);
}
