"use client";

import type { ComponentRenderProps } from "@json-render/react";
import { useData, useDataBinding, useDataValue } from "@json-render/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendChart } from "@/components/analytics/TrendChart";

type JsonRenderProps = ComponentRenderProps<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type JsonRenderDynamicValue = string | number | boolean | null | { path: string };

type ActionConfirm = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type ActionOnSuccess = { navigate: string } | { set: Record<string, unknown> } | { action: string };

type ActionOnError = { set: Record<string, unknown> } | { action: string };

type ActionPayload = {
  name: string;
  params?: Record<string, JsonRenderDynamicValue>;
  confirm?: ActionConfirm;
  onSuccess?: ActionOnSuccess;
  onError?: ActionOnError;
};

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);
const getNumber = (value: unknown) => (typeof value === "number" ? value : undefined);
const getBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const getRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => isRecord(entry));
};

const getStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
};

const normalizeChartRow = (
  row: Record<string, unknown>,
): Record<string, string | number | null> => {
  const normalized: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" || typeof value === "number" || value === null) {
      normalized[key] = value;
    } else {
      normalized[key] = null;
    }
  }
  return normalized;
};

const formatValue = (value: unknown, format?: string) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    }
    if (format === "percent") {
      const percentValue = value > 1 ? value : value * 100;
      return `${percentValue.toFixed(0)}%`;
    }
    if (format === "number") {
      return new Intl.NumberFormat("en-US").format(value);
    }
    return value.toString();
  }
  return String(value);
};

const getByPath = (data: Record<string, unknown>, path: string) => {
  if (!path || path === "/") return data;
  const segments = path.split("/").filter(Boolean);
  let current: unknown = data;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
};

const interpolateText = (template: string, data: Record<string, unknown>) =>
  template.replace(/\$\{([^}]+)\}/g, (_, path) => {
    const value = getByPath(data, String(path).trim());
    if (value === null || value === undefined) return "";
    return String(value);
  });

const isAction = (value: unknown): value is ActionPayload =>
  isRecord(value) && typeof value.name === "string";

const GAP_CLASS: Record<number, string> = {
  2: "space-y-2",
  3: "space-y-3",
  4: "space-y-4",
  5: "space-y-5",
  6: "space-y-6",
  7: "space-y-7",
  8: "space-y-8",
};

const GRID_GAP_CLASS: Record<number, string> = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  7: "gap-7",
  8: "gap-8",
};

const GRID_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

type BadgeVariant = "default" | "success" | "warning" | "error";

const BadgeToneVariant: Record<string, BadgeVariant> = {
  default: "default",
  success: "success",
  warning: "warning",
  danger: "error",
};

const Stack = ({ element, children }: JsonRenderProps) => {
  const gap = getNumber(element.props.gap) ?? 4;
  const className = GAP_CLASS[gap] ?? "space-y-4";
  return <div className={className}>{children}</div>;
};

const Grid = ({ element, children }: JsonRenderProps) => {
  const columns = getNumber(element.props.columns) ?? 2;
  const gap = getNumber(element.props.gap) ?? 4;
  const columnsClass = GRID_CLASS[columns] ?? GRID_CLASS[2];
  const gapClass = GRID_GAP_CLASS[gap] ?? GRID_GAP_CLASS[4];
  return <div className={`grid ${columnsClass} ${gapClass}`}>{children}</div>;
};

const Section = ({ element, children }: JsonRenderProps) => {
  const title = getString(element.props.title);
  const description = getString(element.props.description);
  return (
    <div className="space-y-2">
      {title && <h2 className="text-xl font-semibold text-foreground">{title}</h2>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
};

const CardBlock = ({ element, children }: JsonRenderProps) => {
  const title = getString(element.props.title);
  const description = getString(element.props.description);
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={children ? "space-y-4" : undefined}>{children}</CardContent>
    </Card>
  );
};

const Metric = ({ element }: JsonRenderProps) => {
  const label = getString(element.props.label);
  const valuePath = getString(element.props.valuePath) ?? "/";
  const format = getString(element.props.format);
  const value = useDataValue(valuePath);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {label && (
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      )}
      <div className="text-2xl font-semibold text-foreground">{formatValue(value, format)}</div>
    </div>
  );
};

const Chart = ({ element }: JsonRenderProps) => {
  const title = getString(element.props.title) ?? "Trend";
  const description = getString(element.props.description);
  const dataPath = getString(element.props.dataPath) ?? "/";
  const xKey = getString(element.props.xKey) ?? "label";
  const chartType = getString(element.props.chartType);
  const height = getNumber(element.props.height);
  const rawData = useDataValue(dataPath);
  const data = getRecordArray(rawData).map((entry) => normalizeChartRow(entry));
  const series = getRecordArray(element.props.series).map((entry) => ({
    key: getString(entry.key) ?? "value",
    color: getString(entry.color) ?? "#10b981",
    name: getString(entry.label),
  }));
  return (
    <TrendChart
      title={title}
      description={description}
      data={data}
      dataKeys={series}
      xAxisKey={xKey}
      type={chartType === "area" || chartType === "bar" ? chartType : "line"}
      height={height ?? 280}
    />
  );
};

const DataTable = ({ element }: JsonRenderProps) => {
  const title = getString(element.props.title);
  const rowsPath = getString(element.props.rowsPath) ?? "/";
  const columns = getRecordArray(element.props.columns)
    .map((entry) => ({
      key: getString(entry.key) ?? "",
      label: getString(entry.label) ?? "",
      format: getString(entry.format),
    }))
    .filter((entry) => entry.key && entry.label);
  const rows = getRecordArray(useDataValue(rowsPath));
  const emptyMessage = getString(element.props.emptyMessage) ?? "No rows available";

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableEmpty colSpan={columns.length}>{emptyMessage}</TableEmpty>}
            {rows.map((row, rowIndex) => (
              <TableRow key={`row-${rowIndex}`}>
                {columns.map((column) => (
                  <TableCell key={`${rowIndex}-${column.key}`}>
                    {formatValue(row[column.key], column.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const List = ({ element }: JsonRenderProps) => {
  const title = getString(element.props.title);
  const itemsPath = getString(element.props.itemsPath) ?? "/";
  const primaryKey = getString(element.props.primaryKey) ?? "label";
  const secondaryKey = getString(element.props.secondaryKey) ?? "detail";
  const rawItems = useDataValue(itemsPath);
  const stringItems = getStringArray(rawItems);
  const recordItems = getRecordArray(rawItems);

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-2">
        {stringItems.length > 0 &&
          stringItems.map((item, idx) => (
            <div key={`item-${idx}`} className="text-sm text-foreground">
              {item}
            </div>
          ))}
        {recordItems.length > 0 &&
          recordItems.map((item, idx) => {
            const secondaryValue = item[secondaryKey];
            const hasSecondary =
              typeof secondaryValue === "string" || typeof secondaryValue === "number";
            return (
              <div
                key={`record-${idx}`}
                className="rounded-lg border border-border bg-muted/40 p-3"
              >
                <div className="text-sm font-medium text-foreground">
                  {formatValue(item[primaryKey], "string")}
                </div>
                {hasSecondary && (
                  <div className="text-xs text-muted-foreground">
                    {formatValue(secondaryValue, "string")}
                  </div>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
};

const Text = ({ element }: JsonRenderProps) => {
  const { data } = useData();
  const raw = getString(element.props.text) ?? "";
  const tone = getString(element.props.tone);
  const text = interpolateText(raw, data);
  const className = tone === "muted" ? "text-sm text-muted-foreground" : "text-sm text-foreground";
  return <p className={className}>{text}</p>;
};

const Divider = () => <Separator />;

const BadgeTag = ({ element }: JsonRenderProps) => {
  const text = getString(element.props.text) ?? "";
  const tone = getString(element.props.tone) ?? "default";
  const variant = BadgeToneVariant[tone] ?? "default";
  return <Badge variant={variant}>{text}</Badge>;
};

const ActionButton = ({ element, onAction }: JsonRenderProps) => {
  const label = getString(element.props.label) ?? "Action";
  const action = isAction(element.props.action) ? element.props.action : undefined;
  return (
    <Button
      type="button"
      disabled={!action}
      onClick={() => {
        if (action) {
          onAction?.(action);
        }
      }}
    >
      {label}
    </Button>
  );
};

const TextInput = ({ element }: JsonRenderProps) => {
  const label = getString(element.props.label) ?? "Input";
  const valuePath = getString(element.props.valuePath) ?? "/ui/input";
  const placeholder = getString(element.props.placeholder);
  const [value, setValue] = useDataBinding(valuePath);
  const valueString = typeof value === "string" || typeof value === "number" ? String(value) : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={valueString}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
};

const TextArea = ({ element }: JsonRenderProps) => {
  const label = getString(element.props.label) ?? "Notes";
  const valuePath = getString(element.props.valuePath) ?? "/ui/notes";
  const placeholder = getString(element.props.placeholder);
  const rows = getNumber(element.props.rows) ?? 4;
  const [value, setValue] = useDataBinding(valuePath);
  const valueString = typeof value === "string" ? value : "";
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        rows={rows}
        value={valueString}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
};

const SelectField = ({ element }: JsonRenderProps) => {
  const label = getString(element.props.label) ?? "Select";
  const valuePath = getString(element.props.valuePath) ?? "/ui/select";
  const options = getRecordArray(element.props.options)
    .map((entry) => ({
      label: getString(entry.label) ?? "",
      value: getString(entry.value) ?? "",
    }))
    .filter((entry) => entry.label && entry.value);
  const [value, setValue] = useDataBinding(valuePath);
  const valueString = typeof value === "string" ? value : "";

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={valueString} onValueChange={(next) => setValue(next)}>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const CheckboxField = ({ element }: JsonRenderProps) => {
  const label = getString(element.props.label) ?? "Checkbox";
  const valuePath = getString(element.props.valuePath) ?? "/ui/checkbox";
  const [value, setValue] = useDataBinding(valuePath);
  const checked = getBoolean(value) ?? false;
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={checked} onCheckedChange={(next) => setValue(next === true)} />
      {label}
    </label>
  );
};

const Checklist = ({ element }: JsonRenderProps) => {
  const title = getString(element.props.title);
  const itemsPath = getString(element.props.itemsPath) ?? "/";
  const labelKey = getString(element.props.labelKey) ?? "label";
  const statusKey = getString(element.props.statusKey) ?? "done";
  const items = getRecordArray(useDataValue(itemsPath));

  return (
    <div className="space-y-3">
      {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
      {items.length === 0 && <div className="text-sm text-muted-foreground">No steps yet.</div>}
      {items.map((item, index) => (
        <label key={`step-${index}`} className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={Boolean(item[statusKey])} disabled />
          {formatValue(item[labelKey], "string")}
        </label>
      ))}
    </div>
  );
};

export const jsonRenderRegistry = {
  Stack,
  Grid,
  Section,
  Card: CardBlock,
  Metric,
  TrendChart: Chart,
  Table: DataTable,
  List,
  Text,
  Divider,
  Badge: BadgeTag,
  Button: ActionButton,
  TextInput,
  TextArea,
  Select: SelectField,
  Checkbox: CheckboxField,
  Checklist,
};
