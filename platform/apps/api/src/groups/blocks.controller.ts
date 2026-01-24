import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BlocksService } from "./blocks.service";
import { JwtAuthGuard } from "../auth/guards";

@UseGuards(JwtAuthGuard)
@Controller("blocks")
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post()
  create(
    @Body()
    createBlockDto: {
      tenantId: string;
      sites: string[];
      windowStart: string;
      windowEnd: string;
      reason: string;
      lockId: string;
      createdBy: string;
    },
  ) {
    return this.blocksService.create(createBlockDto);
  }

  @Get()
  findAll(@Query("tenantId") tenantId: string, @Query("state") state?: string) {
    return this.blocksService.findAll(tenantId, state);
  }

  @Get(":blockId")
  findOne(@Param("blockId") blockId: string) {
    return this.blocksService.findOne(blockId);
  }

  @Patch(":blockId")
  update(
    @Param("blockId") blockId: string,
    @Body()
    updateBlockDto: {
      state?: "active" | "released";
      windowStart?: string;
      windowEnd?: string;
      reason?: string;
    },
  ) {
    return this.blocksService.update(blockId, updateBlockDto);
  }

  @Patch(":blockId/release")
  release(@Param("blockId") blockId: string) {
    return this.blocksService.release(blockId);
  }

  @Delete(":blockId")
  remove(@Param("blockId") blockId: string) {
    return this.blocksService.remove(blockId);
  }
}
