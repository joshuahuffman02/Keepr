import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards";
import { TillService } from "./till.service";
import { CloseTillDto, OpenTillDto, TillMovementDto, ListTillsDto, DailyTillReportQueryDto } from "./till.dto";

@UseGuards(JwtAuthGuard)
@Controller("pos/tills")
export class TillController {
  constructor(private readonly service: TillService) {}

  @Post("open")
  open(@Body() dto: OpenTillDto, @Req() req: Request) {
    return this.service.open(dto, req.user);
  }

  @Get()
  list(@Query() query: ListTillsDto, @Req() req: Request) {
    return this.service.list(query, req.user);
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: Request) {
    return this.service.get(id, req.user);
  }

  @Get("report/daily")
  daily(@Query() query: DailyTillReportQueryDto, @Req() req: Request) {
    return this.service.dailyReport(query, req.user);
  }

  @Get("report/daily.csv")
  async dailyCsv(@Query() query: DailyTillReportQueryDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { filename, csv } = await this.service.dailyReportCsv(query, req.user);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return csv;
  }

  @Post(":id/close")
  close(@Param("id") id: string, @Body() dto: CloseTillDto, @Req() req: Request) {
    return this.service.close(id, dto, req.user);
  }

  @Post(":id/paid-in")
  paidIn(@Param("id") id: string, @Body() dto: TillMovementDto, @Req() req: Request) {
    return this.service.paidIn(id, dto, req.user);
  }

  @Post(":id/paid-out")
  paidOut(@Param("id") id: string, @Body() dto: TillMovementDto, @Req() req: Request) {
    return this.service.paidOut(id, dto, req.user);
  }
}
