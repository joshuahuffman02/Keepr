import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import { AiProviderService } from "./ai-provider.service";
import { AiFeatureGateService } from "./ai-feature-gate.service";
import { PromptSanitizerService } from "./prompt-sanitizer.service";
import { AiFeatureType } from "@prisma/client";

type UiBuilderType = "dashboard" | "report" | "workflow";

type UiElement = {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  parentKey?: string | null;
  visible?: unknown;
};

type UiTree = {
  root: string;
  elements: Record<string, UiElement>;
};

type UiBuilderResult = {
  tree: UiTree;
  warnings: string[];
};

const UiBuilderTypeSchema = z.enum(["dashboard", "report", "workflow"]);

const GapSchema = z.number().int().min(2).max(8).optional();
const ColumnsSchema = z.number().int().min(1).max(4).optional();
const ValueFormatSchema = z.enum(["currency", "percent", "number", "string"]).optional();
const ChartTypeSchema = z.enum(["line", "area", "bar"]).optional();
const TextToneSchema = z.enum(["default", "muted"]).optional();
const BadgeToneSchema = z.enum(["default", "success", "warning", "danger"]).optional();

const StackPropsSchema = z.object({
  gap: GapSchema,
});

const GridPropsSchema = z.object({
  columns: ColumnsSchema,
  gap: GapSchema,
});

const SectionPropsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

const CardPropsSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const MetricPropsSchema = z.object({
  label: z.string().optional(),
  valuePath: z.string(),
  format: ValueFormatSchema,
});

const TrendChartPropsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  dataPath: z.string(),
  xKey: z.string(),
  series: z.array(
    z.object({
      key: z.string(),
      color: z.string(),
      label: z.string().optional(),
    }),
  ),
  chartType: ChartTypeSchema,
  height: z.number().int().min(160).max(480).optional(),
});

const TableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: ValueFormatSchema,
});

const TablePropsSchema = z.object({
  title: z.string().optional(),
  rowsPath: z.string(),
  columns: z.array(TableColumnSchema),
  emptyMessage: z.string().optional(),
});

const ListPropsSchema = z.object({
  title: z.string().optional(),
  itemsPath: z.string(),
  primaryKey: z.string().optional(),
  secondaryKey: z.string().optional(),
});

const TextPropsSchema = z.object({
  text: z.string(),
  tone: TextToneSchema,
});

const DividerPropsSchema = z.object({});

const BadgePropsSchema = z.object({
  text: z.string(),
  tone: BadgeToneSchema,
});

const ActionSchema = z.object({
  name: z.string(),
  params: z.record(z.unknown()).optional(),
  confirm: z
    .object({
      title: z.string(),
      message: z.string(),
      confirmLabel: z.string().optional(),
      cancelLabel: z.string().optional(),
      variant: z.enum(["default", "danger"]).optional(),
    })
    .optional(),
  onSuccess: z
    .union([
      z.object({ navigate: z.string() }),
      z.object({ set: z.record(z.string(), z.unknown()) }),
      z.object({ action: z.string() }),
    ])
    .optional(),
  onError: z
    .union([z.object({ set: z.record(z.string(), z.unknown()) }), z.object({ action: z.string() })])
    .optional(),
});

const ButtonPropsSchema = z.object({
  label: z.string(),
  action: ActionSchema.optional(),
});

const TextInputPropsSchema = z.object({
  label: z.string(),
  valuePath: z.string(),
  placeholder: z.string().optional(),
});

const TextAreaPropsSchema = z.object({
  label: z.string(),
  valuePath: z.string(),
  placeholder: z.string().optional(),
  rows: z.number().int().min(2).max(10).optional(),
});

const SelectPropsSchema = z.object({
  label: z.string(),
  valuePath: z.string(),
  options: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

const CheckboxPropsSchema = z.object({
  label: z.string(),
  valuePath: z.string(),
});

const ChecklistPropsSchema = z.object({
  title: z.string().optional(),
  itemsPath: z.string(),
  labelKey: z.string().optional(),
  statusKey: z.string().optional(),
});

const BaseElementSchema = z.object({
  key: z.string(),
  children: z.array(z.string()).optional(),
  parentKey: z.string().nullable().optional(),
  visible: z.unknown().optional(),
});

const ElementSchema = z.discriminatedUnion("type", [
  BaseElementSchema.extend({ type: z.literal("Stack"), props: StackPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Grid"), props: GridPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Section"), props: SectionPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Card"), props: CardPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Metric"), props: MetricPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("TrendChart"), props: TrendChartPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Table"), props: TablePropsSchema }),
  BaseElementSchema.extend({ type: z.literal("List"), props: ListPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Text"), props: TextPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Divider"), props: DividerPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Badge"), props: BadgePropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Button"), props: ButtonPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("TextInput"), props: TextInputPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("TextArea"), props: TextAreaPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Select"), props: SelectPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Checkbox"), props: CheckboxPropsSchema }),
  BaseElementSchema.extend({ type: z.literal("Checklist"), props: ChecklistPropsSchema }),
]);

const UiTreeSchema = z.object({
  root: z.string(),
  elements: z.record(ElementSchema),
});

const UiBuilderRequestSchema = z.object({
  prompt: z.string().min(1).max(1200),
  builder: UiBuilderTypeSchema,
});

const ALLOWED_ACTIONS: Record<UiBuilderType, string[]> = {
  dashboard: ["refresh_data", "export_report", "open_report"],
  report: ["run_report", "export_report", "save_report"],
  workflow: ["save_workflow", "assign_task", "mark_complete"],
};

const BUILDER_DATA_PATHS: Record<UiBuilderType, string[]> = {
  dashboard: [
    "/metrics/occupancyRate",
    "/metrics/adr",
    "/metrics/revpar",
    "/metrics/bookingsToday",
    "/metrics/cancellationRate",
    "/metrics/revenueMTD",
    "/trends/occupancy",
    "/trends/revenue",
    "/tables/topSites",
  ],
  report: [
    "/filters/dateRange",
    "/filters/channel",
    "/filters/siteClass",
    "/report/summary/totalRevenue",
    "/report/summary/totalNights",
    "/report/summary/avgStayLength",
    "/report/rows",
  ],
  workflow: [
    "/workflow/title",
    "/workflow/assignedTeam",
    "/workflow/notes",
    "/workflow/steps",
    "/guest/name",
  ],
};

const BUILDER_GUIDANCE: Record<UiBuilderType, string> = {
  dashboard: "Create a KPI-driven dashboard with a metrics grid and at least one trend chart.",
  report: "Include filter controls, a summary metrics row, and a detailed results table.",
  workflow: "Show a checklist with steps, input fields for notes, and a primary action button.",
};

const COMPONENT_CATALOG = [
  "Stack: { gap?: number }",
  "Grid: { columns?: number, gap?: number }",
  "Section: { title: string, description?: string }",
  "Card: { title?: string, description?: string }",
  "Metric: { label?: string, valuePath: string, format?: currency|percent|number|string }",
  "TrendChart: { title: string, description?: string, dataPath: string, xKey: string, series: [{ key, color, label? }], chartType?: line|area|bar, height?: number }",
  "Table: { title?: string, rowsPath: string, columns: [{ key, label, format? }], emptyMessage?: string }",
  "List: { title?: string, itemsPath: string, primaryKey?: string, secondaryKey?: string }",
  "Text: { text: string, tone?: default|muted }",
  "Divider: {}",
  "Badge: { text: string, tone?: default|success|warning|danger }",
  "Button: { label: string, action?: { name, params?, confirm?, onSuccess?, onError? } }",
  "TextInput: { label: string, valuePath: string, placeholder?: string }",
  "TextArea: { label: string, valuePath: string, placeholder?: string, rows?: number }",
  "Select: { label: string, valuePath: string, options: [{ label, value }] }",
  "Checkbox: { label: string, valuePath: string }",
  "Checklist: { title?: string, itemsPath: string, labelKey?: string, statusKey?: string }",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

@Injectable()
export class AiUiBuilderService {
  private readonly logger = new Logger(AiUiBuilderService.name);

  constructor(
    private readonly provider: AiProviderService,
    private readonly gate: AiFeatureGateService,
    private readonly promptSanitizer: PromptSanitizerService,
  ) {}

  async generateTree(
    campgroundId: string,
    builder: UiBuilderType,
    prompt: string,
    userId?: string,
  ): Promise<UiBuilderResult> {
    await this.gate.assertFeatureEnabled(campgroundId, AiFeatureType.analytics);

    const { sanitized, blocked, warnings } = this.promptSanitizer.sanitize(prompt);
    if (blocked) {
      throw new BadRequestException("Prompt contained unsafe content.");
    }

    const systemPrompt = this.buildSystemPrompt(builder);
    const userPrompt = this.buildUserPrompt(builder, sanitized);

    try {
      const response = await this.provider.getCompletion({
        campgroundId,
        featureType: AiFeatureType.analytics,
        systemPrompt,
        userPrompt,
        userId,
        maxTokens: 1200,
        temperature: 0.2,
      });

      const tree = this.parseTree(response.content, builder);
      return { tree, warnings };
    } catch (error) {
      this.logger.warn(
        `AI UI builder failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return { tree: this.buildFallbackTree(builder), warnings };
    }
  }

  parseRequest(input: unknown): { builder: UiBuilderType; prompt: string } {
    const parsed = UiBuilderRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException("Invalid request payload.");
    }
    return parsed.data;
  }

  private buildSystemPrompt(builder: UiBuilderType): string {
    const dataPaths = BUILDER_DATA_PATHS[builder].map((path) => `- ${path}`).join("\n");
    const actions = ALLOWED_ACTIONS[builder].map((name) => `- ${name}`).join("\n");
    const componentLines = COMPONENT_CATALOG.map((line) => `- ${line}`).join("\n");

    return [
      "You are a UI generator for Keepr's staff dashboard.",
      "Return only JSON (no markdown, no commentary).",
      "Output must match this schema:",
      "{ root: string, elements: Record<string, { key, type, props, children?, parentKey?, visible? }> }",
      "",
      "Available components:",
      componentLines,
      "",
      "Allowed actions:",
      actions,
      "",
      "Available data paths:",
      dataPaths,
      "",
      `Builder goal: ${BUILDER_GUIDANCE[builder]}`,
      "Rules:",
      "- Use unique element keys.",
      "- Only use listed components and actions.",
      "- Keep the tree shallow and readable.",
      "- Use provided data paths for Metric/Table/Chart bindings.",
    ].join("\n");
  }

  private buildUserPrompt(builder: UiBuilderType, prompt: string): string {
    return [`Builder: ${builder}`, "User request:", prompt].join("\n");
  }

  private parseTree(content: string, builder: UiBuilderType): UiTree {
    const extracted = this.extractJson(content);
    if (!extracted) {
      this.logger.warn("AI response did not include JSON.");
      return this.buildFallbackTree(builder);
    }

    const parsed = UiTreeSchema.safeParse(extracted);
    if (!parsed.success) {
      this.logger.warn(`AI response failed schema validation: ${parsed.error.message}`);
      return this.buildFallbackTree(builder);
    }

    const tree = parsed.data;
    if (!tree.elements[tree.root]) {
      this.logger.warn("AI response missing root element.");
      return this.buildFallbackTree(builder);
    }

    return this.enforceActionWhitelist(tree, ALLOWED_ACTIONS[builder]);
  }

  private extractJson(content: string): unknown | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) {
      return null;
    }

    const slice = content.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch (error) {
      this.logger.warn(
        `Failed to parse JSON from AI response: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return null;
    }
  }

  private enforceActionWhitelist(tree: UiTree, allowed: string[]): UiTree {
    const nextElements: Record<string, UiElement> = {};
    for (const [key, element] of Object.entries(tree.elements)) {
      if (element.type !== "Button") {
        nextElements[key] = element;
        continue;
      }

      const props = element.props;
      const action = isRecord(props.action) ? props.action : undefined;
      const actionName = action && typeof action.name === "string" ? action.name : undefined;

      if (!actionName || !allowed.includes(actionName)) {
        const nextProps = { ...props };
        delete nextProps.action;
        nextElements[key] = { ...element, props: nextProps };
      } else {
        nextElements[key] = element;
      }
    }

    return { ...tree, elements: nextElements };
  }

  private buildFallbackTree(builder: UiBuilderType): UiTree {
    switch (builder) {
      case "report":
        return this.buildReportFallback();
      case "workflow":
        return this.buildWorkflowFallback();
      case "dashboard":
      default:
        return this.buildDashboardFallback();
    }
  }

  private buildDashboardFallback(): UiTree {
    return {
      root: "page",
      elements: {
        page: {
          key: "page",
          type: "Stack",
          props: { gap: 6 },
          children: ["header", "metric-grid", "trend-card", "table-card"],
        },
        header: {
          key: "header",
          type: "Section",
          props: {
            title: "Analytics Dashboard",
            description: "KPI snapshot with occupancy and revenue trends.",
          },
        },
        "metric-grid": {
          key: "metric-grid",
          type: "Grid",
          props: { columns: 4, gap: 4 },
          children: ["metric-1", "metric-2", "metric-3", "metric-4"],
        },
        "metric-1": {
          key: "metric-1",
          type: "Metric",
          props: {
            label: "Occupancy",
            valuePath: "/metrics/occupancyRate",
            format: "percent",
          },
        },
        "metric-2": {
          key: "metric-2",
          type: "Metric",
          props: {
            label: "ADR",
            valuePath: "/metrics/adr",
            format: "currency",
          },
        },
        "metric-3": {
          key: "metric-3",
          type: "Metric",
          props: {
            label: "RevPAR",
            valuePath: "/metrics/revpar",
            format: "currency",
          },
        },
        "metric-4": {
          key: "metric-4",
          type: "Metric",
          props: {
            label: "Bookings Today",
            valuePath: "/metrics/bookingsToday",
            format: "number",
          },
        },
        "trend-card": {
          key: "trend-card",
          type: "TrendChart",
          props: {
            title: "Occupancy Trend",
            description: "Last 7 days",
            dataPath: "/trends/occupancy",
            xKey: "label",
            series: [{ key: "value", color: "#10b981", label: "Occupancy" }],
            chartType: "line",
            height: 260,
          },
        },
        "table-card": {
          key: "table-card",
          type: "Table",
          props: {
            title: "Top Site Classes",
            rowsPath: "/tables/topSites",
            columns: [
              { key: "siteClass", label: "Site Class" },
              { key: "occupancyRate", label: "Occupancy", format: "percent" },
              { key: "adr", label: "ADR", format: "currency" },
            ],
            emptyMessage: "No site class data yet.",
          },
        },
      },
    };
  }

  private buildReportFallback(): UiTree {
    return {
      root: "page",
      elements: {
        page: {
          key: "page",
          type: "Stack",
          props: { gap: 6 },
          children: ["header", "filters-card", "summary-grid", "report-table"],
        },
        header: {
          key: "header",
          type: "Section",
          props: {
            title: "Report Composer",
            description: "Filter results, review summary metrics, and export.",
          },
        },
        "filters-card": {
          key: "filters-card",
          type: "Card",
          props: { title: "Filters", description: "Adjust the report scope." },
          children: ["filters-grid", "filters-actions"],
        },
        "filters-grid": {
          key: "filters-grid",
          type: "Grid",
          props: { columns: 3, gap: 3 },
          children: ["filter-date", "filter-channel", "filter-class"],
        },
        "filter-date": {
          key: "filter-date",
          type: "TextInput",
          props: {
            label: "Date Range",
            valuePath: "/filters/dateRange",
            placeholder: "Last 30 days",
          },
        },
        "filter-channel": {
          key: "filter-channel",
          type: "Select",
          props: {
            label: "Channel",
            valuePath: "/filters/channel",
            options: [
              { label: "All Channels", value: "all" },
              { label: "Direct", value: "direct" },
              { label: "OTA", value: "ota" },
            ],
          },
        },
        "filter-class": {
          key: "filter-class",
          type: "Select",
          props: {
            label: "Site Class",
            valuePath: "/filters/siteClass",
            options: [
              { label: "All Classes", value: "all" },
              { label: "Premium RV", value: "premium-rv" },
              { label: "Tent", value: "tent" },
            ],
          },
        },
        "filters-actions": {
          key: "filters-actions",
          type: "Stack",
          props: { gap: 2 },
          children: ["run-report"],
        },
        "run-report": {
          key: "run-report",
          type: "Button",
          props: {
            label: "Run Report",
            action: { name: "run_report" },
          },
        },
        "summary-grid": {
          key: "summary-grid",
          type: "Grid",
          props: { columns: 3, gap: 4 },
          children: ["summary-1", "summary-2", "summary-3"],
        },
        "summary-1": {
          key: "summary-1",
          type: "Metric",
          props: {
            label: "Total Revenue",
            valuePath: "/report/summary/totalRevenue",
            format: "currency",
          },
        },
        "summary-2": {
          key: "summary-2",
          type: "Metric",
          props: {
            label: "Total Nights",
            valuePath: "/report/summary/totalNights",
            format: "number",
          },
        },
        "summary-3": {
          key: "summary-3",
          type: "Metric",
          props: {
            label: "Avg Stay",
            valuePath: "/report/summary/avgStayLength",
            format: "number",
          },
        },
        "report-table": {
          key: "report-table",
          type: "Table",
          props: {
            title: "Report Results",
            rowsPath: "/report/rows",
            columns: [
              { key: "date", label: "Date" },
              { key: "bookings", label: "Bookings", format: "number" },
              { key: "revenue", label: "Revenue", format: "currency" },
              { key: "occupancyRate", label: "Occupancy", format: "percent" },
            ],
            emptyMessage: "Run a report to populate rows.",
          },
        },
      },
    };
  }

  private buildWorkflowFallback(): UiTree {
    return {
      root: "page",
      elements: {
        page: {
          key: "page",
          type: "Stack",
          props: { gap: 6 },
          children: ["header", "workflow-card", "notes-card"],
        },
        header: {
          key: "header",
          type: "Section",
          props: {
            title: "Workflow Builder",
            description: "Organize staff steps and capture notes.",
          },
        },
        "workflow-card": {
          key: "workflow-card",
          type: "Card",
          props: { title: "Check-in Checklist", description: "Steps for today's arrivals." },
          children: ["workflow-meta", "workflow-list", "workflow-action"],
        },
        "workflow-meta": {
          key: "workflow-meta",
          type: "Text",
          props: {
            text: "Assigned team: ${/workflow/assignedTeam}",
            tone: "muted",
          },
        },
        "workflow-list": {
          key: "workflow-list",
          type: "Checklist",
          props: {
            itemsPath: "/workflow/steps",
            labelKey: "label",
            statusKey: "done",
          },
        },
        "workflow-action": {
          key: "workflow-action",
          type: "Button",
          props: {
            label: "Assign Task",
            action: { name: "assign_task" },
          },
        },
        "notes-card": {
          key: "notes-card",
          type: "Card",
          props: { title: "Notes" },
          children: ["notes-field", "save-action"],
        },
        "notes-field": {
          key: "notes-field",
          type: "TextArea",
          props: {
            label: "Add notes for ${/guest/name}",
            valuePath: "/workflow/notes",
            placeholder: "Capture key details for the team",
            rows: 4,
          },
        },
        "save-action": {
          key: "save-action",
          type: "Button",
          props: {
            label: "Save Workflow",
            action: { name: "save_workflow" },
          },
        },
      },
    };
  }
}
