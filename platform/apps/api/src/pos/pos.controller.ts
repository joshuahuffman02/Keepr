import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import {
  CheckoutCartDto,
  CreateCartDto,
  OfflineReplayDto,
  UpdateCartDto,
  CreateReturnDto,
} from "./pos.dto";
import { PosService } from "./pos.service";
import type { Request } from "express";

@UseGuards(JwtAuthGuard)
@Controller("pos")
export class PosController {
  constructor(private readonly service: PosService) {}

  @Post("carts")
  createCart(@Body() dto: CreateCartDto, @Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.service.createCart(dto, user);
  }

  @Patch("carts/:id")
  updateCart(@Param("id") id: string, @Body() dto: UpdateCartDto, @Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.service.updateCart(id, dto, user);
  }

  @Post("carts/:id/checkout")
  checkout(@Param("id") id: string, @Body() dto: CheckoutCartDto, @Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.service.checkout(id, dto, getHeaderValue(req.headers, "idempotency-key"), user);
  }

  @Post("offline/replay")
  replay(@Body() payload: OfflineReplayDto, @Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.service.replayOffline(
      payload,
      getHeaderValue(req.headers, "idempotency-key"),
      user,
    );
  }

  @Post("returns")
  createReturn(@Body() dto: CreateReturnDto, @Req() req: Request) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.service.createReturn(dto, getHeaderValue(req.headers, "idempotency-key"), user);
  }
}

const getHeaderValue = (headers: Request["headers"], key: string): string | undefined => {
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
};
