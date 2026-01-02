import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { BullQueueService, JobData } from "../bull-queue.service";

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export const EMAIL_QUEUE = "email";

@Injectable()
export class EmailQueueProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly queueService: BullQueueService) {}

  onModuleInit() {
    this.queueService.registerProcessor<EmailJobData>(
      EMAIL_QUEUE,
      this.process.bind(this)
    );
    this.logger.log("Email processor registered");
  }

  private async process(job: JobData<EmailJobData>): Promise<{ sent: boolean; messageId?: string }> {
    const { to, subject, html, text, template, templateData } = job.data;

    this.logger.debug(`Processing email job ${job.id}: ${subject} to ${Array.isArray(to) ? to.join(", ") : to}`);

    // In production, this would integrate with EmailService
    // For now, simulate email sending with validation
    if (!to || (Array.isArray(to) && to.length === 0)) {
      throw new BadRequestException("No recipients specified");
    }

    if (!subject) {
      throw new BadRequestException("No subject specified");
    }

    if (!html && !text && !template) {
      throw new BadRequestException("No content specified (html, text, or template required)");
    }

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    // TODO: Integrate with actual EmailService
    // const result = await this.emailService.send({
    //   to,
    //   subject,
    //   html,
    //   text,
    //   template,
    //   templateData,
    // });

    this.logger.log(`Email sent: ${subject} to ${Array.isArray(to) ? to.join(", ") : to}`);

    return {
      sent: true,
      messageId: `msg-${job.id}`,
    };
  }
}
