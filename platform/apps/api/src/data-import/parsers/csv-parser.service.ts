import { Injectable, Logger } from "@nestjs/common";
import { parse } from "csv-parse/sync";

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: (value: string) => unknown;
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface ParseResult {
  success: boolean;
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: string[];
}

export interface FieldSuggestion {
  sourceField: string;
  suggestedTarget: string;
  confidence: number; // 0-1
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

@Injectable()
export class CsvParserService {
  private readonly logger = new Logger(CsvParserService.name);

  /**
   * Parse CSV content and return structured data
   */
  parseCSV(content: string, fieldMappings?: FieldMapping[]): ParseResult {
    const errors: string[] = [];

    try {
      // Parse CSV
      const rawRecords = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: true,
      });
      const records = Array.isArray(rawRecords)
        ? rawRecords
            .map((record) => {
              if (!isRecord(record)) return null;
              const normalized: Record<string, string> = {};
              for (const [key, value] of Object.entries(record)) {
                normalized[key] = typeof value === "string" ? value : String(value ?? "");
              }
              return normalized;
            })
            .filter((record): record is Record<string, string> => Boolean(record))
        : [];

      if (records.length === 0) {
        return {
          success: false,
          headers: [],
          rows: [],
          totalRows: 0,
          validRows: 0,
          errorRows: 0,
          errors: ["CSV file is empty or has no data rows"],
        };
      }

      // Get headers from first record
      const headers = Object.keys(records[0]);

      // Process each row
      const rows: ParsedRow[] = records.map((record, index) => {
        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];
        let data: Record<string, unknown> = {};

        if (fieldMappings && fieldMappings.length > 0) {
          // Apply field mappings
          for (const mapping of fieldMappings) {
            const sourceValue = record[mapping.sourceField];

            if (sourceValue === undefined) {
              rowWarnings.push(`Source field "${mapping.sourceField}" not found`);
              continue;
            }

            try {
              data[mapping.targetField] = mapping.transform
                ? mapping.transform(sourceValue)
                : sourceValue;
            } catch (err) {
              rowErrors.push(`Transform error for "${mapping.sourceField}": ${err}`);
            }
          }
        } else {
          // No mappings - use raw data
          data = { ...record };
        }

        return {
          rowNumber: index + 2, // +2 because index is 0-based and header is row 1
          data,
          errors: rowErrors,
          warnings: rowWarnings,
        };
      });

      const validRows = rows.filter((r) => r.errors.length === 0).length;

      return {
        success: true,
        headers,
        rows,
        totalRows: rows.length,
        validRows,
        errorRows: rows.length - validRows,
        errors,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CSV parse error: ${message}`);
      return {
        success: false,
        headers: [],
        rows: [],
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        errors: [`Failed to parse CSV: ${message}`],
      };
    }
  }

  /**
   * Suggest field mappings based on header names
   */
  suggestFieldMappings(
    sourceHeaders: string[],
    targetFields: { name: string; aliases: string[] }[],
  ): FieldSuggestion[] {
    const suggestions: FieldSuggestion[] = [];

    for (const sourceHeader of sourceHeaders) {
      const normalized = this.normalizeFieldName(sourceHeader);
      let bestMatch: { target: string; confidence: number } | null = null;

      for (const targetField of targetFields) {
        // Check exact match
        if (this.normalizeFieldName(targetField.name) === normalized) {
          bestMatch = { target: targetField.name, confidence: 1.0 };
          break;
        }

        // Check aliases
        for (const alias of targetField.aliases) {
          if (this.normalizeFieldName(alias) === normalized) {
            bestMatch = { target: targetField.name, confidence: 0.95 };
            break;
          }
        }

        // Check partial match
        if (!bestMatch) {
          const similarity = this.calculateSimilarity(
            normalized,
            this.normalizeFieldName(targetField.name),
          );
          if (similarity > 0.6) {
            bestMatch = { target: targetField.name, confidence: similarity };
          }
        }
      }

      if (bestMatch) {
        suggestions.push({
          sourceField: sourceHeader,
          suggestedTarget: bestMatch.target,
          confidence: bestMatch.confidence,
        });
      }
    }

    return suggestions;
  }

  /**
   * Normalize a field name for comparison
   */
  private normalizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/number/g, "num")
      .replace(/telephone/g, "phone")
      .replace(/firstname/g, "fname")
      .replace(/lastname/g, "lname")
      .replace(/emailaddress/g, "email");
  }

  /**
   * Calculate similarity between two strings (Levenshtein-based)
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }

  /**
   * Common transforms for field values
   */
  static transforms = {
    toInteger: (val: string) => {
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    },
    toFloat: (val: string) => {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    },
    toCents: (val: string) => {
      const num = parseFloat(val.replace(/[$,]/g, ""));
      return isNaN(num) ? null : Math.round(num * 100);
    },
    toBoolean: (val: string) => {
      const lower = val.toLowerCase().trim();
      return ["true", "yes", "1", "y", "x"].includes(lower);
    },
    toDate: (val: string) => {
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    },
    toISODate: (val: string) => {
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date.toISOString();
    },
    trim: (val: string) => val.trim(),
    lowercase: (val: string) => val.toLowerCase().trim(),
    uppercase: (val: string) => val.toUpperCase().trim(),
    toPhone: (val: string) => val.replace(/[^0-9+]/g, ""),
    toEmail: (val: string) => val.toLowerCase().trim(),
  };
}
