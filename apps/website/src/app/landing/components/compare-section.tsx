import { Check, X } from "lucide-react";
import {
  type CompareCellValue,
  HOMEPAGE_COMPARE,
  HOMEPAGE_COMPARE_COLUMNS,
} from "@/config/pricing";
import { SectionKicker } from "./section-kicker";

function Cell({ value }: { value: CompareCellValue }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-success">
        <Check aria-hidden="true" className="size-4" />
        Yes
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <X aria-hidden="true" className="size-4" />
        No
      </span>
    );
  }
  return <span>{value}</span>;
}

export function CompareSection() {
  return (
    <section className="border-border border-b py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>The math</SectionKicker>
        <h2 className="mb-8 max-w-[20ch] font-heading font-semibold text-3xl text-foreground leading-none tracking-tight md:text-4xl">
          What you pay everywhere else, versus AWS cost.
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <th className="border-border border-b" />
                {HOMEPAGE_COMPARE_COLUMNS.map((col, i) => (
                  <th
                    className={`border-b px-4 py-4 font-mono font-medium text-xs uppercase tracking-widest ${
                      i === 0
                        ? "border-brand border-l-2 border-b-brand text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                    key={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOMEPAGE_COMPARE.map((row) => (
                <tr key={row.label}>
                  <td className="border-border border-b px-4 py-4 text-sm text-muted-foreground">
                    {row.label}
                  </td>
                  <td className="border-border border-brand border-b border-l-2 bg-brand/[0.03] px-4 py-4 font-semibold text-sm text-foreground">
                    <Cell value={row.wraps} />
                    {row.wrapsNote ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({row.wrapsNote})
                      </span>
                    ) : null}
                  </td>
                  <td className="border-border border-b px-4 py-4 text-sm">
                    <Cell value={row.resend} />
                  </td>
                  <td className="border-border border-b px-4 py-4 text-sm">
                    <Cell value={row.sendgrid} />
                  </td>
                  <td className="border-border border-b px-4 py-4 text-sm">
                    <Cell value={row.postmark} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
