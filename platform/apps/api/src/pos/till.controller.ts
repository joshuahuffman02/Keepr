import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { TillService } from "./till.service";
import {
  CloseTillDto,
  OpenTillDto,
  TillMovementDto,
  ListTillsDto,
  DailyTillReportQueryDto,
} from "./till.dto";
import type { Request } from "express";

@UseGuards(JwtAuthGuard)
@Controller("pos/tills")
export class TillController {
  constructor(private readonly service: TillService) {}

  @Post("open")
  open(@Body() dto: OpenTillDto, @Req() req: Request) {
    return this.service.open(dto, requireActor(req));
  }

  @Get()
  list(@Query() query: ListTillsDto, @Req() req: Request) {
    return this.service.list(query, requireActor(req));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) {
    return this.service.get(id, requireActor(req));
  }

  @Get("report/daily")
  daily(@Query() query: DailyTillReportQueryDto, @Req() req: Request) {
    return this.service.dailyReport(query, requireActor(req));
  }

  @Get("report/daily.csv")
  async dailyCsv(
    @Query() query: DailyTillReportQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, csv } = await this.service.dailyReportCsv(query, requireActor(req));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return csv;
  }

  @Post(":id/close")
  close(@Param("id") id: string, @Body() dto: CloseTillDto, @Req() req: Request) {
    return this.service.close(id, dto, requireActor(req));
  }

  @Post(":id/paid-in")
  paidIn(@Param("id") id: string, @Body() dto: TillMovementDto, @Req() req: Request) {
    return this.service.paidIn(id, dto, requireActor(req));
  }

  @Post(":id/paid-out")
  paidOut(@Param("id") id: string, @Body() dto: TillMovementDto, @Req() req: Request) {
    return this.service.paidOut(id, dto, requireActor(req));
  }
}

const requireActor = (req: Request) => {
  const user = req.user;
  if (!user) {
    throw new UnauthorizedException();
  }
  return user;
};
