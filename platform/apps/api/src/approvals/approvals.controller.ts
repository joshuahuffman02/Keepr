import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { JwtAuthGuard } from "../auth/guards";
import { UserRole } from "@prisma/client";

@UseGuards(JwtAuthGuard)
@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  async list(@Query("campgroundId") campgroundId?: string) {
    return this.approvals.list(campgroundId);
  }

  @Get("policies")
  async policies(@Query("campgroundId") campgroundId?: string) {
    return this.approvals.policiesList(campgroundId);
  }

  @Post()
  async create(
    @Body()
    body: {
      type: "refund" | "payout" | "config_change";
      amount: number;
      currency: string;
      reason: string;
      requester: string;
      metadata?: Record<string, unknown>;
      campgroundId?: string;
      requestedBy?: string;
    },
  ) {
    return this.approvals.create({
      ...body,
      requestedBy: body.requestedBy || body.requester,
    });
  }

  @Post(":id/approve")
  async approve(@Param("id") id: string, @Body() body: { approver: string }) {
    return this.approvals.approve(id, body.approver);
  }

  @Post(":id/reject")
  async reject(@Param("id") id: string, @Body() body: { approver: string; reason?: string }) {
    return this.approvals.reject(id, body.approver, body.reason);
  }

  // Policy CRUD endpoints
  @Post("policies")
  async createPolicy(
    @Body()
    body: {
      name: string;
      appliesTo: string[];
      thresholdCents?: number;
      currency?: string;
      approversNeeded?: number;
      description?: string;
      approverRoles?: UserRole[];
      campgroundId?: string;
      createdById?: string;
    },
  ) {
    return this.approvals.createPolicy(body);
  }

  @Patch("policies/:id")
  async updatePolicy(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      appliesTo?: string[];
      thresholdCents?: number | null;
      currency?: string;
      approversNeeded?: number;
      description?: string | null;
      approverRoles?: UserRole[];
      isActive?: boolean;
    },
  ) {
    return this.approvals.updatePolicy(id, body);
  }

  @Delete("policies/:id")
  async deletePolicy(@Param("id") id: string) {
    return this.approvals.deletePolicy(id);
  }
}
