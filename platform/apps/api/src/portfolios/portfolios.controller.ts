import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { PortfoliosService } from "./portfolios.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("portfolios")
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  @Get()
  list() {
    return this.portfolios.list();
  }

  @Get(":id/report")
  report(@Param("id") id: string) {
    return this.portfolios.report(id);
  }

  @Post("select")
  select(
    @Body() body: { portfolioId: string; parkId?: string },
    @Headers("x-portfolio-id") portfolioHeader?: string,
    @Headers("x-park-id") parkHeader?: string,
  ) {
    const portfolioId = body?.portfolioId || portfolioHeader;
    const parkId = body?.parkId || parkHeader;
    if (!portfolioId) {
      return this.portfolios.list();
    }
    return this.portfolios.select(portfolioId, parkId);
  }

  @Get(":id/routes")
  routes(@Param("id") id: string) {
    return this.portfolios.report(id).routing;
  }
}
