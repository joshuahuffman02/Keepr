import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnboardingTokenGateService } from '../onboarding-token-gate.service';
import { DocumentClassifierService, ClassificationResult, TargetEntity } from './document-classifier.service';
import { ImportDraftStatus } from '@prisma/client';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

/**
 * Field confidence information
 */
export interface FieldConfidence {
    field: string;
    value: string | number | boolean | null;
    confidence: number; // 0-1
    source: 'extracted' | 'inferred' | 'default';
    alternatives?: { value: any; confidence: number }[];
    requiresReview: boolean;
}

/**
 * Row with confidence scores
 */
export interface RowConfidence {
    rowNumber: number;
    fields: Record<string, FieldConfidence>;
    overallConfidence: number;
    issues: string[];
    action: 'create' | 'update' | 'skip';
}

/**
 * Extraction result
 */
export interface ExtractionResult {
    success: boolean;
    documentId: string;
    targetEntity: TargetEntity;
    rows: RowConfidence[];
    summary: {
        totalRows: number;
        validRows: number;
        createCount: number;
        updateCount: number;
        skipCount: number;
        missingRequired: string[];
        warnings: string[];
    };
    aiTokensUsed: { input: number; output: number };
}

/**
 * Upload result
 */
export interface UploadResult {
    documentId: string;
    fileName: string;
    documentType: string;
    classification: ClassificationResult;
    status: ImportDraftStatus;
}

/**
 * Target field definitions for each entity type
 */
const TARGET_FIELDS: Record<TargetEntity, { name: string; required: boolean; aliases: string[] }[]> = {
    sites: [
        { name: 'siteNumber', required: true, aliases: ['site_number', 'site_num', 'site_id', 'site', 'number', 'spot', 'space', 'lot'] },
        { name: 'name', required: false, aliases: ['site_name', 'sitename', 'display_name', 'title'] },
        { name: 'siteType', required: false, aliases: ['site_type', 'type', 'category', 'site_category'] },
        { name: 'siteClassName', required: false, aliases: ['site_class', 'class', 'class_name', 'category_name'] },
        { name: 'maxOccupancy', required: false, aliases: ['max_occupancy', 'occupancy', 'max_guests', 'capacity', 'max_people'] },
        { name: 'rigMaxLength', required: false, aliases: ['max_length', 'rig_length', 'rv_length', 'length_max', 'max_rig_length'] },
        { name: 'hookupsPower', required: false, aliases: ['power', 'electric', 'electricity', 'has_power', 'power_hookup'] },
        { name: 'hookupsWater', required: false, aliases: ['water', 'has_water', 'water_hookup'] },
        { name: 'hookupsSewer', required: false, aliases: ['sewer', 'has_sewer', 'sewer_hookup', 'sewage'] },
        { name: 'powerAmps', required: false, aliases: ['amps', 'amperage', 'power_amps', 'electric_amps'] },
        { name: 'petFriendly', required: false, aliases: ['pets', 'pet_friendly', 'allows_pets', 'pets_allowed'] },
        { name: 'pullThrough', required: false, aliases: ['pull_through', 'pullthru', 'pull_thru', 'back_in'] },
        { name: 'defaultRate', required: false, aliases: ['rate', 'nightly_rate', 'price', 'nightly', 'daily_rate'] },
        { name: 'description', required: false, aliases: ['desc', 'notes', 'site_description'] },
    ],
    guests: [
        { name: 'firstName', required: true, aliases: ['first_name', 'fname', 'first', 'given_name'] },
        { name: 'lastName', required: true, aliases: ['last_name', 'lname', 'last', 'surname', 'family_name'] },
        { name: 'email', required: false, aliases: ['email_address', 'e_mail', 'emailaddress', 'contact_email'] },
        { name: 'phone', required: false, aliases: ['phone_number', 'telephone', 'mobile', 'cell', 'primary_phone'] },
        { name: 'address1', required: false, aliases: ['address', 'street_address', 'street', 'address_line_1'] },
        { name: 'city', required: false, aliases: ['town', 'municipality'] },
        { name: 'state', required: false, aliases: ['province', 'region', 'state_province'] },
        { name: 'postalCode', required: false, aliases: ['postal_code', 'zip', 'zipcode', 'zip_code', 'postcode'] },
        { name: 'country', required: false, aliases: ['nation', 'country_code'] },
        { name: 'notes', required: false, aliases: ['guest_notes', 'comments', 'remarks'] },
    ],
    reservations: [
        { name: 'arrivalDate', required: true, aliases: ['arrival', 'check_in', 'checkin', 'start_date', 'arrival_date'] },
        { name: 'departureDate', required: true, aliases: ['departure', 'check_out', 'checkout', 'end_date', 'departure_date'] },
        { name: 'firstName', required: false, aliases: ['first_name', 'fname', 'guest_first'] },
        { name: 'lastName', required: false, aliases: ['last_name', 'lname', 'guest_last', 'guest_name'] },
        { name: 'email', required: false, aliases: ['email_address', 'guest_email'] },
        { name: 'phone', required: false, aliases: ['phone_number', 'guest_phone', 'mobile'] },
        { name: 'siteNumber', required: false, aliases: ['site', 'site_number', 'spot', 'space'] },
        { name: 'siteName', required: false, aliases: ['site_name'] },
        { name: 'siteClass', required: false, aliases: ['site_class', 'class', 'type', 'category'] },
        { name: 'totalAmount', required: false, aliases: ['total', 'amount', 'total_amount', 'price', 'cost'] },
        { name: 'paidAmount', required: false, aliases: ['paid', 'paid_amount', 'payment', 'deposit'] },
        { name: 'status', required: false, aliases: ['reservation_status', 'booking_status'] },
        { name: 'confirmationNumber', required: false, aliases: ['confirmation', 'confirmation_number', 'booking_id', 'reservation_id'] },
        { name: 'notes', required: false, aliases: ['reservation_notes', 'comments', 'remarks'] },
    ],
    rates: [
        { name: 'siteClassName', required: true, aliases: ['site_class', 'class', 'type', 'category'] },
        { name: 'nightlyRate', required: true, aliases: ['rate', 'nightly', 'daily', 'price', 'nightly_rate', 'daily_rate'] },
        { name: 'weeklyRate', required: false, aliases: ['weekly', 'weekly_rate'] },
        { name: 'monthlyRate', required: false, aliases: ['monthly', 'monthly_rate'] },
        { name: 'seasonName', required: false, aliases: ['season', 'period', 'rate_period'] },
        { name: 'startDate', required: false, aliases: ['start', 'effective_date', 'from_date'] },
        { name: 'endDate', required: false, aliases: ['end', 'to_date', 'until'] },
    ],
    policies: [
        { name: 'policyType', required: true, aliases: ['type', 'policy_type', 'category'] },
        { name: 'title', required: false, aliases: ['name', 'policy_name', 'rule_name'] },
        { name: 'content', required: true, aliases: ['text', 'description', 'policy_text', 'body'] },
    ],
};

@Injectable()
export class OnboardingAiImportService {
    private readonly logger = new Logger(OnboardingAiImportService.name);
    private openai: OpenAI | null = null;
    private uploadDir: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly tokenGate: OnboardingTokenGateService,
        private readonly classifier: DocumentClassifierService,
    ) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }

        // Set up upload directory
        this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'onboarding');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Handle file upload and initial classification
     */
    async uploadDocument(
        sessionId: string,
        file: Express.Multer.File,
    ): Promise<UploadResult> {
        // Check AI access
        await this.tokenGate.requireAiAccess(sessionId);

        const documentId = uuidv4();
        const documentType = this.classifier.detectDocumentType(file.originalname, file.mimetype);

        // Save file to temp storage
        const filePath = path.join(this.uploadDir, `${sessionId}_${documentId}_${file.originalname}`);
        fs.writeFileSync(filePath, file.buffer);

        // Parse content based on type
        let columns: string[] | undefined;
        let sampleRows: Record<string, string>[] | undefined;
        let textContent: string | undefined;
        let base64Content: string | undefined;

        if (documentType === 'csv') {
            const parsed = this.parseCSV(file.buffer.toString('utf-8'));
            columns = parsed.columns;
            sampleRows = parsed.rows.slice(0, 5);
        } else if (documentType === 'excel') {
            const parsed = this.parseExcel(file.buffer);
            columns = parsed.columns;
            sampleRows = parsed.rows.slice(0, 5);
        } else if (documentType === 'image') {
            base64Content = file.buffer.toString('base64');
        } else if (documentType === 'pdf') {
            // PDF text extraction would require a library like pdf-parse
            // For now, we'll use AI vision on the first page
            textContent = '[PDF content - requires extraction]';
        }

        // Classify the document
        const classification = await this.classifier.classify(
            file.originalname,
            file.mimetype,
            {
                type: base64Content ? 'image' : columns ? 'csv' : 'text',
                columns,
                sampleRows,
                text: textContent,
                base64: base64Content,
            },
        );

        // Create draft record
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.prisma.onboardingImportDraft.create({
            data: {
                id: documentId,
                sessionId,
                documentId,
                documentType,
                targetEntity: classification.suggestedEntity || 'sites',
                originalFile: filePath,
                fileName: file.originalname,
                extractedData: {
                    columns,
                    sampleRows,
                    classification,
                },
                status: 'pending_extraction',
                expiresAt,
            },
        });

        // Track AI usage if classification used AI
        if (documentType === 'image' || documentType === 'pdf') {
            const tokens = this.classifier.estimateTokens(
                textContent?.length || 0,
                documentType === 'image',
            );
            await this.tokenGate.recordAiCall(
                sessionId,
                'classification',
                tokens.input,
                tokens.output,
                'gpt-4o-mini',
                true,
            );
        }

        return {
            documentId,
            fileName: file.originalname,
            documentType,
            classification,
            status: 'pending_extraction',
        };
    }

    /**
     * Extract data from uploaded document
     */
    async extractData(
        sessionId: string,
        documentId: string,
        targetEntity?: TargetEntity,
    ): Promise<ExtractionResult> {
        // Check AI access
        await this.tokenGate.requireAiAccess(sessionId);

        // Get the draft
        const draft = await this.prisma.onboardingImportDraft.findUnique({
            where: { documentId },
        });

        if (!draft || draft.sessionId !== sessionId) {
            throw new NotFoundException('Document not found');
        }

        const entity = targetEntity || (draft.targetEntity as TargetEntity);
        const fields = TARGET_FIELDS[entity];

        // Read the file
        const fileBuffer = fs.readFileSync(draft.originalFile);
        let rows: Record<string, string>[] = [];
        let columns: string[] = [];

        if (draft.documentType === 'csv') {
            const parsed = this.parseCSV(fileBuffer.toString('utf-8'));
            columns = parsed.columns;
            rows = parsed.rows;
        } else if (draft.documentType === 'excel') {
            const parsed = this.parseExcel(fileBuffer);
            columns = parsed.columns;
            rows = parsed.rows;
        } else if (draft.documentType === 'image' || draft.documentType === 'pdf') {
            // Use AI to extract data from image/PDF
            const extracted = await this.extractWithAI(
                fileBuffer,
                draft.documentType,
                draft.fileName || 'document',
                entity,
                fields,
            );
            rows = extracted.rows;
            columns = extracted.columns;

            // Track AI usage
            await this.tokenGate.recordAiCall(
                sessionId,
                'extraction',
                extracted.tokensUsed.input,
                extracted.tokensUsed.output,
                'gpt-4o',
                true,
            );
        }

        // Map columns to target fields
        const columnMapping = this.autoMapColumns(columns, fields);

        // Process rows with confidence scoring
        const processedRows: RowConfidence[] = [];
        const missingRequired = new Set<string>();
        const warnings: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const processedFields: Record<string, FieldConfidence> = {};
            const issues: string[] = [];
            let totalConfidence = 0;
            let fieldCount = 0;

            for (const field of fields) {
                const sourceColumn = columnMapping[field.name];
                let value: any = sourceColumn ? row[sourceColumn] : null;
                let confidence = 0;
                let source: 'extracted' | 'inferred' | 'default' = 'extracted';

                if (value !== null && value !== undefined && value !== '') {
                    // Transform value based on field type
                    value = this.transformValue(field.name, value);
                    confidence = sourceColumn ? 0.95 : 0.6;
                } else if (field.required) {
                    missingRequired.add(field.name);
                    issues.push(`Missing required field: ${field.name}`);
                    confidence = 0;
                } else {
                    // Use default value
                    value = this.getDefaultValue(field.name, entity);
                    source = 'default';
                    confidence = 0.5;
                }

                processedFields[field.name] = {
                    field: field.name,
                    value,
                    confidence,
                    source,
                    requiresReview: confidence < 0.8,
                };

                totalConfidence += confidence;
                fieldCount++;
            }

            const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;
            const hasRequiredFields = fields
                .filter(f => f.required)
                .every(f => processedFields[f.name]?.value !== null);

            processedRows.push({
                rowNumber: i + 1,
                fields: processedFields,
                overallConfidence: Math.round(overallConfidence * 100) / 100,
                issues,
                action: hasRequiredFields ? 'create' : 'skip',
            });
        }

        // Calculate summary
        const summary = {
            totalRows: rows.length,
            validRows: processedRows.filter(r => r.action !== 'skip').length,
            createCount: processedRows.filter(r => r.action === 'create').length,
            updateCount: processedRows.filter(r => r.action === 'update').length,
            skipCount: processedRows.filter(r => r.action === 'skip').length,
            missingRequired: Array.from(missingRequired),
            warnings,
        };

        // Update draft with extracted data
        await this.prisma.onboardingImportDraft.update({
            where: { documentId },
            data: {
                targetEntity: entity,
                extractedData: {
                    columns,
                    columnMapping,
                    rows: processedRows,
                    summary,
                },
                status: 'extraction_complete',
                aiCallsUsed: { increment: 1 },
            },
        });

        return {
            success: true,
            documentId,
            targetEntity: entity,
            rows: processedRows,
            summary,
            aiTokensUsed: { input: 0, output: 0 }, // Will be updated for AI extraction
        };
    }

    /**
     * Get preview of extracted data
     */
    async getPreview(
        sessionId: string,
        documentId: string,
    ): Promise<{ draft: any; rows: RowConfidence[]; summary: any }> {
        const draft = await this.prisma.onboardingImportDraft.findUnique({
            where: { documentId },
        });

        if (!draft || draft.sessionId !== sessionId) {
            throw new NotFoundException('Document not found');
        }

        const extractedData = draft.extractedData as any;

        return {
            draft: {
                documentId: draft.documentId,
                fileName: draft.fileName,
                documentType: draft.documentType,
                targetEntity: draft.targetEntity,
                status: draft.status,
                createdAt: draft.createdAt,
            },
            rows: extractedData?.rows || [],
            summary: extractedData?.summary || {},
        };
    }

    /**
     * Apply corrections and confirm import
     */
    async confirmImport(
        sessionId: string,
        documentId: string,
        corrections: Record<number, Record<string, any>>,
    ): Promise<{ success: boolean; created: number; errors: string[] }> {
        const draft = await this.prisma.onboardingImportDraft.findUnique({
            where: { documentId },
        });

        if (!draft || draft.sessionId !== sessionId) {
            throw new NotFoundException('Document not found');
        }

        // Get session to find campground
        const session = await this.prisma.onboardingSession.findUnique({
            where: { id: sessionId },
            select: { campgroundId: true },
        });

        if (!session?.campgroundId) {
            throw new BadRequestException('Campground not created yet');
        }

        const extractedData = draft.extractedData as any;
        const rows: RowConfidence[] = extractedData?.rows || [];
        const entity = draft.targetEntity as TargetEntity;

        // Apply corrections
        for (const [rowIndex, fieldCorrections] of Object.entries(corrections)) {
            const idx = parseInt(rowIndex, 10) - 1; // Convert to 0-indexed
            if (rows[idx]) {
                for (const [field, value] of Object.entries(fieldCorrections)) {
                    if (rows[idx].fields[field]) {
                        rows[idx].fields[field].value = value;
                        rows[idx].fields[field].source = 'extracted';
                        rows[idx].fields[field].confidence = 1;
                        rows[idx].fields[field].requiresReview = false;
                    }
                }
                // Recalculate if row can be imported
                const fields = TARGET_FIELDS[entity];
                const hasRequired = fields
                    .filter(f => f.required)
                    .every(f => rows[idx].fields[f.name]?.value !== null);
                rows[idx].action = hasRequired ? 'create' : 'skip';
            }
        }

        // Import the data
        const errors: string[] = [];
        let created = 0;

        try {
            await this.prisma.$transaction(async (tx) => {
                for (const row of rows) {
                    if (row.action === 'skip') continue;

                    try {
                        const data = this.buildEntityData(entity, row.fields, session.campgroundId!);

                        if (entity === 'sites') {
                            await tx.site.create({ data: data as any });
                        } else if (entity === 'guests') {
                            await tx.guest.create({ data: data as any });
                        }
                        // Add other entity types as needed

                        created++;
                    } catch (err) {
                        errors.push(`Row ${row.rowNumber}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                    }
                }
            });

            // Update draft status
            await this.prisma.onboardingImportDraft.update({
                where: { documentId },
                data: {
                    status: errors.length === 0 ? 'imported' : 'failed',
                    corrections,
                },
            });
        } catch (err) {
            errors.push(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        return { success: errors.length === 0, created, errors };
    }

    /**
     * Chat with AI about the import
     */
    async chat(
        sessionId: string,
        message: string,
        context?: { documentId?: string },
    ): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
        if (!this.openai) {
            return {
                response: 'AI chat is not available. Please check the OPENAI_API_KEY configuration.',
                tokensUsed: { input: 0, output: 0 },
            };
        }

        // Check AI access
        await this.tokenGate.requireAiAccess(sessionId);

        // Build context
        let systemContext = `You are an onboarding assistant for a campground reservation system called Keepr.
Help users understand their data import, answer questions about field mapping, and provide guidance.
Be concise and helpful. If users want to change data, explain how to use the inline editor in the review page.`;

        if (context?.documentId) {
            const draft = await this.prisma.onboardingImportDraft.findUnique({
                where: { documentId: context.documentId },
            });
            if (draft) {
                const extractedData = draft.extractedData as any;
                systemContext += `\n\nCurrent import context:
- File: ${draft.fileName}
- Type: ${draft.documentType}
- Target: ${draft.targetEntity}
- Rows: ${extractedData?.summary?.totalRows || 0}
- Valid: ${extractedData?.summary?.validRows || 0}`;
            }
        }

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemContext },
                { role: 'user', content: message },
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const tokensUsed = {
            input: response.usage?.prompt_tokens || 0,
            output: response.usage?.completion_tokens || 0,
        };

        // Record AI usage
        await this.tokenGate.recordAiCall(
            sessionId,
            'chat',
            tokensUsed.input,
            tokensUsed.output,
            'gpt-4o-mini',
            true,
        );

        return {
            response: response.choices[0].message.content || 'I could not generate a response.',
            tokensUsed,
        };
    }

    // ============================================
    // Private helper methods
    // ============================================

    private parseCSV(content: string): { columns: string[]; rows: Record<string, string>[] } {
        const lines = content.trim().split('\n');
        if (lines.length === 0) return { columns: [], rows: [] };

        const columns = this.parseCSVLine(lines[0]);
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row: Record<string, string> = {};
            columns.forEach((col, idx) => {
                row[col] = values[idx] || '';
            });
            rows.push(row);
        }

        return { columns, rows };
    }

    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));

        return result;
    }

    private parseExcel(buffer: Buffer): { columns: string[]; rows: Record<string, string>[] } {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });

        if (data.length === 0) return { columns: [], rows: [] };

        const columns = (data[0] as any[]).map(c => String(c || ''));
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < data.length; i++) {
            const row: Record<string, string> = {};
            const values = data[i] as any[];
            columns.forEach((col, idx) => {
                row[col] = String(values[idx] ?? '');
            });
            rows.push(row);
        }

        return { columns, rows };
    }

    private async extractWithAI(
        buffer: Buffer,
        documentType: string,
        fileName: string,
        entity: TargetEntity,
        fields: { name: string; required: boolean; aliases: string[] }[],
    ): Promise<{ columns: string[]; rows: Record<string, string>[]; tokensUsed: { input: number; output: number } }> {
        if (!this.openai) {
            throw new BadRequestException('AI extraction not available');
        }

        const fieldList = fields.map(f => `${f.name}${f.required ? ' (required)' : ''}`).join(', ');

        const systemPrompt = `Extract structured data from this document for a campground ${entity} import.
Target fields: ${fieldList}

Return JSON: { "columns": ["field1", "field2", ...], "rows": [{"field1": "value1", ...}, ...] }
Only include rows with actual data. Convert dates to YYYY-MM-DD format. Convert currency to numbers only.`;

        let content: OpenAI.ChatCompletionContentPart[];

        if (documentType === 'image') {
            content = [
                { type: 'text', text: systemPrompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:image/png;base64,${buffer.toString('base64')}`,
                        detail: 'high',
                    },
                },
            ];
        } else {
            // For PDF, we'd need pdf-parse or similar
            content = [{ type: 'text', text: `${systemPrompt}\n\n[PDF extraction not yet implemented]` }];
        }

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'user', content },
            ],
            temperature: 0.1,
            max_tokens: 4000,
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0].message.content || '{"columns":[],"rows":[]}');

        return {
            columns: result.columns || [],
            rows: result.rows || [],
            tokensUsed: {
                input: response.usage?.prompt_tokens || 0,
                output: response.usage?.completion_tokens || 0,
            },
        };
    }

    private autoMapColumns(
        sourceColumns: string[],
        targetFields: { name: string; required: boolean; aliases: string[] }[],
    ): Record<string, string> {
        const mapping: Record<string, string> = {};

        for (const field of targetFields) {
            const normalized = sourceColumns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_'));

            // Try exact match first
            let matchIndex = normalized.findIndex(c => c === field.name.toLowerCase());

            // Try aliases
            if (matchIndex === -1) {
                for (const alias of field.aliases) {
                    matchIndex = normalized.findIndex(c =>
                        c === alias || c.includes(alias) || alias.includes(c)
                    );
                    if (matchIndex !== -1) break;
                }
            }

            if (matchIndex !== -1) {
                mapping[field.name] = sourceColumns[matchIndex];
            }
        }

        return mapping;
    }

    private transformValue(fieldName: string, value: string): any {
        const booleanFields = ['hookupsPower', 'hookupsWater', 'hookupsSewer', 'petFriendly', 'pullThrough'];
        const numberFields = ['maxOccupancy', 'rigMaxLength', 'powerAmps', 'defaultRate', 'totalAmount', 'paidAmount', 'nightlyRate', 'weeklyRate', 'monthlyRate'];
        const dateFields = ['arrivalDate', 'departureDate', 'startDate', 'endDate'];

        if (booleanFields.includes(fieldName)) {
            const lower = String(value).toLowerCase().trim();
            return ['true', 'yes', '1', 'y', 'x'].includes(lower);
        }

        if (numberFields.includes(fieldName)) {
            const cleaned = String(value).replace(/[$,]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? null : num;
        }

        if (dateFields.includes(fieldName)) {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        }

        return String(value).trim();
    }

    private getDefaultValue(fieldName: string, entity: TargetEntity): any {
        const defaults: Record<string, any> = {
            // Sites
            siteType: 'rv',
            maxOccupancy: 6,
            hookupsPower: false,
            hookupsWater: false,
            hookupsSewer: false,
            petFriendly: true,
            pullThrough: false,
            // Guests
            country: 'US',
            // Reservations
            status: 'confirmed',
        };

        return defaults[fieldName] ?? null;
    }

    private buildEntityData(
        entity: TargetEntity,
        fields: Record<string, FieldConfidence>,
        campgroundId: string,
    ): Record<string, any> {
        const data: Record<string, any> = { campgroundId };

        for (const [key, field] of Object.entries(fields)) {
            if (field.value !== null && field.value !== undefined) {
                data[key] = field.value;
            }
        }

        // Add required fields based on entity type
        if (entity === 'sites') {
            data.id = uuidv4();
            data.status = data.status || 'available';
        } else if (entity === 'guests') {
            data.id = uuidv4();
            if (data.email) {
                data.emailNormalized = data.email.toLowerCase().trim();
            }
        }

        return data;
    }
}
