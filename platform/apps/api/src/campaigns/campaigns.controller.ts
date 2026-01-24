import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { JwtAuthGuard } from "../auth/guards";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { AudienceFiltersDto } from "./dto/audience.dto";
import { SendCampaignDto } from "./dto/send-campaign.dto";

@UseGuards(JwtAuthGuard)
@Controller()
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get("campaigns")
  list(@Query("campgroundId") campgroundId?: string) {
    return this.campaigns.list(campgroundId);
  }

  @Post("campaigns")
  create(@Body() body: CreateCampaignDto) {
    return this.campaigns.create(body);
  }

  @Patch("campaigns/:id")
  update(@Param("id") id: string, @Body() body: UpdateCampaignDto) {
    return this.campaigns.update(id, body);
  }

  @Post("campaigns/:id/send")
  send(@Param("id") id: string, @Body() body: SendCampaignDto) {
    return this.campaigns.sendNow(id, body);
  }

  @Post("campaigns/:id/test")
  testSend(@Param("id") id: string, @Body() body: { email?: string; phone?: string }) {
    return this.campaigns.testSend(id, body);
  }

  @Post("campaign-templates")
  createTemplate(@Body() body: CreateTemplateDto) {
    return this.campaigns.createTemplate(body);
  }

  @Get("campaign-templates")
  listTemplates(@Query("campgroundId") campgroundId: string) {
    return this.campaigns.listTemplates(campgroundId);
  }

  @Patch("campaign-templates/:id")
  updateTemplate(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      channel: string;
      category: string;
      subject: string | null;
      html: string | null;
      textBody: string | null;
    }>,
  ) {
    return this.campaigns.updateTemplate(id, body);
  }

  @Delete("campaign-templates/:id")
  deleteTemplate(@Param("id") id: string) {
    return this.campaigns.deleteTemplate(id);
  }

  @Post("campaigns/audience/preview")
  audiencePreview(@Body() body: AudienceFiltersDto) {
    return this.campaigns.audiencePreview(body);
  }

  @Get("campaigns/suggestions")
  suggestions(@Query("campgroundId") campgroundId: string) {
    return this.campaigns.suggestions(campgroundId);
  }
}
