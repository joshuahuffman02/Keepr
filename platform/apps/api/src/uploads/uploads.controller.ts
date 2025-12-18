import { Body, Controller, Post, UseGuards, BadRequestException } from "@nestjs/common";
import { UploadsService } from "./uploads.service";
import { JwtAuthGuard } from "../auth/guards";
import * as path from "path";

// Allowed file extensions for uploads
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const MAX_FILENAME_LENGTH = 255;

@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("sign")
  async sign(@Body() body: { filename: string; contentType: string }) {
    if (!body?.filename || !body?.contentType) {
      throw new BadRequestException("filename and contentType are required");
    }

    // Validate filename length
    if (body.filename.length > MAX_FILENAME_LENGTH) {
      throw new BadRequestException("Filename too long");
    }

    // Validate file extension
    const ext = path.extname(body.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(body.contentType)) {
      throw new BadRequestException(`Content type not allowed. Allowed types: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    }

    // Validate content type matches extension
    const extensionContentTypeMap: Record<string, string[]> = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.webp': ['image/webp'],
      '.pdf': ['application/pdf'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.xls': ['application/vnd.ms-excel'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    };

    const allowedTypesForExt = extensionContentTypeMap[ext] || [];
    if (!allowedTypesForExt.includes(body.contentType)) {
      throw new BadRequestException("Content type does not match file extension");
    }

    return this.uploads.signUpload(body.filename, body.contentType);
  }
}

