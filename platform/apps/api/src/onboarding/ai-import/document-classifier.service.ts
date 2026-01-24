import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";

/**
 * Document types that can be classified
 */
export type DocumentType = "csv" | "excel" | "pdf" | "image" | "unknown";

/**
 * Content types that AI can identify
 */
export type ContentType =
  | "site_list"
  | "rate_card"
  | "reservation_export"
  | "guest_list"
  | "price_sheet"
  | "policy_document"
  | "mixed"
  | "unknown";

/**
 * Target entities for import
 */
export type TargetEntity = "sites" | "guests" | "reservations" | "rates" | "policies";

/**
 * Classification result from AI
 */
export interface ClassificationResult {
  documentType: DocumentType;
  contentType: ContentType;
  confidence: number; // 0-1
  suggestedEntity: TargetEntity | null;
  detectedColumns?: string[];
  sampleData?: Record<string, string>[];
  reasoning?: string;
}

/**
 * Known column patterns for different entity types
 */
const ENTITY_COLUMN_PATTERNS: Record<TargetEntity, string[]> = {
  sites: [
    "site",
    "site_number",
    "site_num",
    "site_id",
    "spot",
    "space",
    "site_type",
    "type",
    "category",
    "class",
    "hookups",
    "water",
    "sewer",
    "electric",
    "amps",
    "max_length",
    "rig_length",
    "pull_through",
    "occupancy",
    "max_occupancy",
    "capacity",
  ],
  guests: [
    "first_name",
    "last_name",
    "name",
    "guest_name",
    "email",
    "phone",
    "mobile",
    "cell",
    "address",
    "city",
    "state",
    "zip",
    "postal",
    "rig_type",
    "vehicle",
    "plate",
  ],
  reservations: [
    "arrival",
    "check_in",
    "check-in",
    "start_date",
    "departure",
    "check_out",
    "check-out",
    "end_date",
    "confirmation",
    "booking",
    "reservation_id",
    "total",
    "amount",
    "paid",
    "balance",
    "nights",
    "duration",
    "status",
  ],
  rates: [
    "rate",
    "price",
    "nightly",
    "daily",
    "weekly",
    "monthly",
    "seasonal",
    "effective",
    "start_date",
    "end_date",
    "minimum",
    "maximum",
    "discount",
  ],
  policies: [
    "policy",
    "rule",
    "terms",
    "conditions",
    "cancellation",
    "refund",
    "deposit",
    "check_in",
    "check_out",
    "quiet_hours",
  ],
};

const ENTITY_KEYS: TargetEntity[] = ["sites", "guests", "reservations", "rates", "policies"];

@Injectable()
export class DocumentClassifierService {
  private readonly logger = new Logger(DocumentClassifierService.name);
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn("OPENAI_API_KEY not set - document classification will use heuristics only");
    }
  }

  /**
   * Detect document type from file extension and mime type
   */
  detectDocumentType(fileName: string, mimeType?: string): DocumentType {
    const ext = fileName.toLowerCase().split(".").pop();

    if (mimeType) {
      if (mimeType === "text/csv" || mimeType === "application/csv") return "csv";
      if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "excel";
      if (mimeType === "application/pdf") return "pdf";
      if (mimeType.startsWith("image/")) return "image";
    }

    switch (ext) {
      case "csv":
        return "csv";
      case "xlsx":
      case "xls":
        return "excel";
      case "pdf":
        return "pdf";
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
        return "image";
      default:
        return "unknown";
    }
  }

  /**
   * Classify content based on detected columns (for CSV/Excel)
   */
  classifyByColumns(columns: string[]): {
    suggestedEntity: TargetEntity | null;
    confidence: number;
    contentType: ContentType;
  } {
    const normalizedColumns = columns.map((c) =>
      c
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_"),
    );

    const scores: Record<TargetEntity, number> = {
      sites: 0,
      guests: 0,
      reservations: 0,
      rates: 0,
      policies: 0,
    };

    // Score each entity type based on column matches
    for (const entity of ENTITY_KEYS) {
      const patterns = ENTITY_COLUMN_PATTERNS[entity];
      for (const pattern of patterns) {
        const matchCount = normalizedColumns.filter(
          (col) => col.includes(pattern) || pattern.includes(col),
        ).length;
        scores[entity] += matchCount;
      }
    }

    // Find the best match
    let bestEntity: TargetEntity | null = null;
    let bestScore = -1;
    let secondScore = -1;
    for (const entity of ENTITY_KEYS) {
      const score = scores[entity];
      if (score > bestScore) {
        secondScore = bestScore;
        bestScore = score;
        bestEntity = entity;
      } else if (score > secondScore) {
        secondScore = score;
      }
    }

    // Calculate confidence based on margin
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    let confidence = 0;
    if (totalScore > 0 && bestEntity) {
      confidence = bestScore / totalScore;
      // Boost confidence if clear winner
      if (secondScore > -1 && bestScore > secondScore * 2) {
        confidence = Math.min(1, confidence * 1.3);
      }
    }

    // Determine content type
    let contentType: ContentType = "unknown";
    if (bestEntity && bestScore > 0) {
      switch (bestEntity) {
        case "sites":
          contentType = "site_list";
          break;
        case "guests":
          contentType = "guest_list";
          break;
        case "reservations":
          contentType = "reservation_export";
          break;
        case "rates":
          contentType = "rate_card";
          break;
        case "policies":
          contentType = "policy_document";
          break;
      }
    }

    return {
      suggestedEntity: bestEntity && bestScore > 0 ? bestEntity : null,
      confidence: Math.round(confidence * 100) / 100,
      contentType,
    };
  }

  /**
   * Use AI to classify document content (for PDFs and images)
   */
  async classifyWithAI(
    content: string | { type: "image"; base64: string; mimeType: string },
    fileName: string,
  ): Promise<{
    contentType: ContentType;
    suggestedEntity: TargetEntity | null;
    confidence: number;
    reasoning: string;
  }> {
    if (!this.openai) {
      return {
        contentType: "unknown",
        suggestedEntity: null,
        confidence: 0,
        reasoning: "AI not available - OPENAI_API_KEY not set",
      };
    }

    const systemPrompt = `You are a document classifier for a campground reservation system.
Analyze the provided content and classify it into one of these categories:
- site_list: Contains campground site/spot information (site numbers, types, hookups, amenities)
- guest_list: Contains guest/customer information (names, emails, phones, addresses)
- reservation_export: Contains reservation/booking data (dates, guest names, sites, amounts)
- rate_card: Contains pricing information (rates, seasons, discounts)
- price_sheet: Similar to rate_card but formatted as a price list
- policy_document: Contains rules, policies, terms and conditions
- mixed: Contains multiple types of data
- unknown: Cannot determine the content type

Respond with JSON only: { "contentType": "...", "suggestedEntity": "sites|guests|reservations|rates|policies|null", "confidence": 0.0-1.0, "reasoning": "brief explanation" }`;

    try {
      let messages: OpenAI.ChatCompletionMessageParam[];

      if (typeof content === "string") {
        // Text content
        messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Classify this document content from "${fileName}":\n\n${content.slice(0, 3000)}`,
          },
        ];
      } else {
        // Image content
        messages = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Classify this document image from "${fileName}":` },
              {
                type: "image_url",
                image_url: {
                  url: `data:${content.mimeType};base64,${content.base64}`,
                  detail: "low",
                },
              },
            ],
          },
        ];
      }

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        contentType: result.contentType || "unknown",
        suggestedEntity: result.suggestedEntity || null,
        confidence: result.confidence || 0,
        reasoning: result.reasoning || "",
      };
    } catch (error) {
      this.logger.error("AI classification error:", error);
      return {
        contentType: "unknown",
        suggestedEntity: null,
        confidence: 0,
        reasoning: `AI classification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Full classification pipeline
   */
  async classify(
    fileName: string,
    mimeType: string | undefined,
    content: {
      type: "csv" | "text" | "image";
      columns?: string[];
      sampleRows?: Record<string, string>[];
      text?: string;
      base64?: string;
    },
  ): Promise<ClassificationResult> {
    const documentType = this.detectDocumentType(fileName, mimeType);

    // For CSV/Excel, use column-based classification
    if ((documentType === "csv" || documentType === "excel") && content.columns) {
      const columnClassification = this.classifyByColumns(content.columns);

      return {
        documentType,
        contentType: columnClassification.contentType,
        confidence: columnClassification.confidence,
        suggestedEntity: columnClassification.suggestedEntity,
        detectedColumns: content.columns,
        sampleData: content.sampleRows,
      };
    }

    // For PDFs and images, use AI classification
    if (documentType === "pdf" || documentType === "image") {
      let aiInput: string | { type: "image"; base64: string; mimeType: string };

      if (content.type === "image" && content.base64) {
        aiInput = {
          type: "image",
          base64: content.base64,
          mimeType: mimeType || "image/png",
        };
      } else if (content.text) {
        aiInput = content.text;
      } else {
        return {
          documentType,
          contentType: "unknown",
          confidence: 0,
          suggestedEntity: null,
          reasoning: "No content provided for classification",
        };
      }

      const aiResult = await this.classifyWithAI(aiInput, fileName);

      return {
        documentType,
        contentType: aiResult.contentType,
        confidence: aiResult.confidence,
        suggestedEntity: aiResult.suggestedEntity,
        reasoning: aiResult.reasoning,
      };
    }

    // Unknown document type
    return {
      documentType,
      contentType: "unknown",
      confidence: 0,
      suggestedEntity: null,
      reasoning: `Unsupported document type: ${documentType}`,
    };
  }

  /**
   * Get token usage estimate for classification call
   */
  estimateTokens(contentLength: number, isImage: boolean): { input: number; output: number } {
    if (isImage) {
      // Vision API token estimate for low detail
      return { input: 85 + 150, output: 100 }; // ~85 base + ~150 for low-detail image
    }
    // Text content: ~4 chars per token
    const inputTokens = Math.ceil(contentLength / 4) + 100; // +100 for system prompt
    return { input: Math.min(inputTokens, 1000), output: 100 };
  }
}
