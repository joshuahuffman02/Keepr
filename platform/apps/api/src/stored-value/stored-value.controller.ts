import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { IssueStoredValueDto, RedeemStoredValueDto, AdjustStoredValueDto } from "./stored-value.dto";
import { StoredValueService } from "./stored-value.service";

// These routes assume Idempotency-Key header handled in the service layer.
@UseGuards(JwtAuthGuard)
@Controller("stored-value")
export class StoredValueController {
  constructor(private readonly service: StoredValueService) {}

  @Post("issue")
  issue(@Body() dto: IssueStoredValueDto, @Req() req: any) {
    return this.service.issue(dto, req.headers["idempotency-key"], req.user);
  }

  @Post("redeem")
  redeem(@Body() dto: RedeemStoredValueDto, @Req() req: any) {
    return this.service.redeem(dto, req.headers["idempotency-key"], req.user);
  }

  @Post("holds/:id/capture")
  capture(@Param("id") id: string, @Req() req: any) {
    return this.service.captureHold(id, req.headers["idempotency-key"], req.user);
  }

  @Post("holds/:id/release")
  release(@Param("id") id: string, @Req() req: any) {
    return this.service.releaseHold(id, req.headers["idempotency-key"], req.user);
  }

  @Post("adjust")
  adjust(@Body() dto: AdjustStoredValueDto, @Req() req: any) {
    return this.service.adjust(dto, req.headers["idempotency-key"], req.user);
  }

  @Get("campgrounds/:campgroundId/accounts")
  listAccounts(@Param("campgroundId") campgroundId: string) {
    return this.service.listAccounts(campgroundId);
  }

  @Get("campgrounds/:campgroundId/ledger")
  listLedger(@Param("campgroundId") campgroundId: string) {
    return this.service.listLedger(campgroundId);
  }

  @Get(":id/balance")
  balance(@Param("id") id: string) {
    return this.service.balanceByAccount(id);
  }

  @Get("code/:code/balance")
  balanceByCode(@Param("code") code: string) {
    return this.service.balanceByCode(code);
  }
}
