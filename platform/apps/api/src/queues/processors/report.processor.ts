import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BullQueueService, JobData } from "../bull-queue.service";

export interface ReportJobData {
  reportType: string;
  campgroundId: string;
  userId: string;
  parameters: Record<string, unknown>;
  format: "pdf" | "csv" | "xlsx";
  deliveryMethod: "download" | "email";
  recipientEmail?: string;
}

export interface ReportResult {
  reportId: string;
  url?: string;
  size?: number;
  generatedAt: Date;
}

export const REPORT_QUEUE = "report";

@Injectable()
export class ReportQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(ReportQueueProcessor.name);

  constructor(private readonly queueService: BullQueueService) {}

  onModuleInit() {
    this.queueService.registerProcessor<ReportJobData>(
      REPORT_QUEUE,
      this.process.bind(this)
    );
    this.logger.log("Report processor registered");
  }

  private async process(job: JobData<ReportJobData>): Promise<ReportResult> {
    const { reportType, campgroundId, parameters, format, deliveryMethod, recipientEmail } = job.data;

    this.logger.debug(`Generating ${reportType} report for campground ${campgroundId}`);

    // Simulate report generation
    // In production, this would:
    // 1. Fetch data based on reportType and parameters
    // 2. Generate the report in the requested format
    // 3. Upload to S3 or similar
    // 4. Send email if deliveryMethod is 'email'

    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing

    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Integrate with actual report generation
    // const data = await this.reportService.fetchData(reportType, campgroundId, parameters);
    // const file = await this.reportService.generate(data, format);
    // const url = await this.storageService.upload(file);

    const result: ReportResult = {
      reportId,
      url: `/api/reports/${reportId}/download`,
      size: Math.floor(Math.random() * 1000000), // Placeholder
      generatedAt: new Date(),
    };

    if (deliveryMethod === "email" && recipientEmail) {
      // Queue email delivery
      await this.queueService.addJob("email", "report-ready", {
        to: recipientEmail,
        subject: `Your ${reportType} report is ready`,
        template: "report-ready",
        templateData: {
          reportType,
          downloadUrl: result.url,
          expiresIn: "7 days",
        },
      });
    }

    this.logger.log(`Report generated: ${reportId} (${format})`);

    return result;
  }
}
