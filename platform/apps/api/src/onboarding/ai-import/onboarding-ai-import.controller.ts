import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    Headers,
    Query,
    BadRequestException,
    Logger,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OnboardingAiImportService, TargetEntity } from './onboarding-ai-import.service';
import { OnboardingService } from '../onboarding.service';

@Controller('onboarding/session/:sessionId/ai-import')
export class OnboardingAiImportController {
    private readonly logger = new Logger(OnboardingAiImportController.name);

    constructor(
        private readonly aiImport: OnboardingAiImportService,
        private readonly onboarding: OnboardingService,
    ) {}

    /**
     * Validate onboarding token from request
     */
    private getToken(tokenHeader?: string, tokenQuery?: string, tokenBody?: string): string {
        const token = tokenBody ?? tokenHeader ?? tokenQuery;
        if (!token) {
            throw new BadRequestException('Missing onboarding token');
        }
        return token;
    }

    /**
     * Upload a document for AI-assisted import
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    }))
    async uploadDocument(
        @Param('sessionId') sessionId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Body() body: { token?: string },
        @UploadedFile() file: Express.Multer.File,
    ) {
        const token = this.getToken(tokenHeader, undefined, body.token);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        // Validate file type
        const allowedTypes = [
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/gif',
            'image/webp',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                `Unsupported file type: ${file.mimetype}. Supported types: CSV, Excel, PDF, Images`
            );
        }

        this.logger.log(`Uploading document for session ${sessionId}: ${file.originalname}`);

        return this.aiImport.uploadDocument(sessionId, file);
    }

    /**
     * Extract data from an uploaded document
     */
    @Post('extract')
    async extractData(
        @Param('sessionId') sessionId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Body() body: {
            token?: string;
            documentId: string;
            targetEntity?: TargetEntity;
        },
    ) {
        const token = this.getToken(tokenHeader, undefined, body.token);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        if (!body.documentId) {
            throw new BadRequestException('documentId is required');
        }

        this.logger.log(`Extracting data for session ${sessionId}, document ${body.documentId}`);

        return this.aiImport.extractData(sessionId, body.documentId, body.targetEntity);
    }

    /**
     * Get preview of extracted data
     */
    @Get('preview/:documentId')
    async getPreview(
        @Param('sessionId') sessionId: string,
        @Param('documentId') documentId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Query('token') tokenQuery: string,
    ) {
        const token = this.getToken(tokenHeader, tokenQuery);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        return this.aiImport.getPreview(sessionId, documentId);
    }

    /**
     * Confirm and execute the import
     */
    @Post('confirm')
    async confirmImport(
        @Param('sessionId') sessionId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Body() body: {
            token?: string;
            documentId: string;
            corrections?: Record<number, Record<string, any>>;
        },
    ) {
        const token = this.getToken(tokenHeader, undefined, body.token);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        if (!body.documentId) {
            throw new BadRequestException('documentId is required');
        }

        this.logger.log(`Confirming import for session ${sessionId}, document ${body.documentId}`);

        return this.aiImport.confirmImport(
            sessionId,
            body.documentId,
            body.corrections || {},
        );
    }

    /**
     * Chat with AI about the import
     */
    @Post('chat')
    async chat(
        @Param('sessionId') sessionId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Body() body: {
            token?: string;
            message: string;
            documentId?: string;
        },
    ) {
        const token = this.getToken(tokenHeader, undefined, body.token);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        if (!body.message || body.message.trim().length === 0) {
            throw new BadRequestException('message is required');
        }

        return this.aiImport.chat(
            sessionId,
            body.message,
            body.documentId ? { documentId: body.documentId } : undefined,
        );
    }

    /**
     * Suggest auto-fill values for missing fields
     */
    @Post('autofill')
    async suggestAutofill(
        @Param('sessionId') sessionId: string,
        @Headers('x-onboarding-token') tokenHeader: string,
        @Body() body: {
            token?: string;
            documentId: string;
            fieldsToFill: string[];
        },
    ) {
        const token = this.getToken(tokenHeader, undefined, body.token);

        // Validate session
        await this.onboarding.getSession(sessionId, token);

        if (!body.documentId) {
            throw new BadRequestException('documentId is required');
        }

        // For now, return a stub response - full implementation would use AI
        // to suggest values based on context
        return {
            suggestions: body.fieldsToFill.map(field => ({
                field,
                suggestedValue: null,
                confidence: 0,
                reasoning: 'Auto-fill suggestions require additional context',
            })),
        };
    }
}
