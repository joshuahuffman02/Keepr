"use client";

import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const dateRangeOptions = [
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "all_time", label: "All Time" },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px] bg-muted border-border text-muted-foreground">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent className="bg-muted border-border">
          {dateRangeOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-muted-foreground focus:bg-muted focus:text-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
