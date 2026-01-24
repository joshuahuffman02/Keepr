import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  findAll() {
    return this.orgs.findAll();
  }

  @Post()
  create(@Body() body: CreateOrganizationDto) {
    return this.orgs.create(body);
  }
}
