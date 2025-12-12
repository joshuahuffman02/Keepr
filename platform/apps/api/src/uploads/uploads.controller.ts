import { Body, Controller, Post } from "@nestjs/common";
import { UploadsService } from "./uploads.service";

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post("sign")
  async sign(@Body() body: { filename: string; contentType: string }) {
    if (!body?.filename || !body?.contentType) {
      return { error: "filename and contentType required" };
    }
    return this.uploads.signUpload(body.filename, body.contentType);
  }
}

