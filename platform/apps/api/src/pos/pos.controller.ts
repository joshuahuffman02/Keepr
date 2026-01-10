import { Body, Controller, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { CheckoutCartDto, CreateCartDto, OfflineReplayDto, UpdateCartDto, CreateReturnDto } from "./pos.dto";
import { PosService } from "./pos.service";

@UseGuards(JwtAuthGuard)
@Controller("pos")
export class PosController {
  constructor(private readonly service: PosService) {}

  @Post("carts")
  createCart(@Body() dto: CreateCartDto, @Req() req: Request) {
    return this.service.createCart(dto, req.user);
  }

  @Patch("carts/:id")
  updateCart(@Param("id") id: string, @Body() dto: UpdateCartDto, @Req() req: Request) {
    return this.service.updateCart(id, dto, req.user);
  }

  @Post("carts/:id/checkout")
  checkout(@Param("id") id: string, @Body() dto: CheckoutCartDto, @Req() req: Request) {
    return this.service.checkout(id, dto, req.headers["idempotency-key"], req.user);
  }

  @Post("offline/replay")
  replay(@Body() payload: OfflineReplayDto, @Req() req: Request) {
    return this.service.replayOffline(payload, req.headers["idempotency-key"], req.user);
  }

  @Post("returns")
  createReturn(@Body() dto: CreateReturnDto, @Req() req: Request) {
    return this.service.createReturn(dto, req.headers["idempotency-key"], req.user);
  }
}
