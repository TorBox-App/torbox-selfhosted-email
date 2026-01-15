"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATE_RANGE_PRESETS,
  type DateRangePreset,
  getDateRangeFromPreset,
} from "@/lib/events";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  dateFrom?: Date;
  dateTo?: Date;
  preset?: DateRangePreset;
  onDateRangeChange: (
    dateFrom: Date | undefined,
    dateTo: Date | undefined,
    preset: DateRangePreset | undefined
  ) => void;
};

export function DateRangePicker({
  dateFrom,
  dateTo,
  preset,
  onDateRangeChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<
    DateRangePreset | undefined
  >(preset);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined
  );

  const handlePresetChange = (value: string) => {
    if (value === "all") {
      setSelectedPreset(undefined);
      setDateRange(undefined);
      onDateRangeChange(undefined, undefined, undefined);
      return;
    }

    const preset = value as DateRangePreset;
    setSelectedPreset(preset);

    if (preset === "custom") {
      // Don't change the date range, just open the calendar
      setIsOpen(true);
      return;
    }

    const range = getDateRangeFromPreset(preset);
    if (range) {
      setDateRange(range);
      onDateRangeChange(range.from, range.to, preset);
    }
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onDateRangeChange(range.from, range.to, "custom");
      setSelectedPreset("custom");
    }
  };

  const getDisplayValue = () => {
    if (!(selectedPreset || dateRange)) {
      return "All time";
    }

    if (selectedPreset && selectedPreset !== "custom") {
      const presetLabel = DATE_RANGE_PRESETS.find(
        (p) => p.value === selectedPreset
      )?.label;
      return presetLabel || "All time";
    }

    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }

    if (dateRange?.from) {
      return `From ${format(dateRange.from, "MMM d, yyyy")}`;
    }

    return "All time";
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        onValueChange={handlePresetChange}
        value={selectedPreset || "all"}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All time">{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          {DATE_RANGE_PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPreset === "custom" && (
        <Popover onOpenChange={setIsOpen} open={isOpen}>
          <PopoverTrigger asChild>
            <Button
              className={cn(
                "justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
              id="date"
              variant="outline"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              defaultMonth={dateRange?.from}
              mode="range"
              numberOfMonths={2}
              onSelect={handleDateRangeSelect}
              selected={dateRange}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
