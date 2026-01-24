import type { Request } from "express";
import { Controller, Post, Get, Body, Param, Query, UseGuards, Req } from "@nestjs/common";
import { ApiTokenGuard } from "../developer-api/guards/api-token.guard";
import { ApiScopeGuard } from "../developer-api/guards/api-scope.guard";
import { ApiScopes } from "../developer-api/decorators/api-scopes.decorator";
import { PartnerApiService } from "./partner-api.service";
import { ScanProductDto } from "./dto/scan-product.dto";
import { RecordSaleDto, RecordRefundDto } from "./dto/record-sale.dto";
import { ApiPrincipal } from "../developer-api/types";

type ApiRequest = Request & { apiPrincipal: ApiPrincipal };

@Controller("partner/v1")
@UseGuards(ApiTokenGuard, ApiScopeGuard)
export class PartnerApiController {
  constructor(private readonly partnerApi: PartnerApiService) {}

  /**
   * Scan a product by SKU - returns pricing, markdown, and batch info
   * Scope: pos:read
   */
  @Post("scan")
  @ApiScopes("pos:read")
  async scanProduct(@Req() req: ApiRequest, @Body() dto: ScanProductDto) {
    const principal = req.apiPrincipal;
    return this.partnerApi.scanProduct(principal.campgroundId, dto);
  }

  /**
   * List products with optional filters
   * Scope: pos:read
   */
  @Get("products")
  @ApiScopes("pos:read")
  async listProducts(
    @Req() req: ApiRequest,
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const principal = req.apiPrincipal;
    return this.partnerApi.listProducts(principal.campgroundId, {
      categoryId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get a product by SKU with batch information
   * Scope: pos:read
   */
  @Get("products/:sku")
  @ApiScopes("pos:read")
  async getProductBySku(@Req() req: ApiRequest, @Param("sku") sku: string) {
    const principal = req.apiPrincipal;
    return this.partnerApi.getProductBySku(principal.campgroundId, sku);
  }

  /**
   * Get active batches for a product
   * Scope: inventory:read
   */
  @Get("products/:sku/batches")
  @ApiScopes("inventory:read")
  async getProductBatches(@Req() req: ApiRequest, @Param("sku") sku: string) {
    const principal = req.apiPrincipal;
    const product = await this.partnerApi.getProductBySku(principal.campgroundId, sku);
    return { batches: product.batches };
  }

  /**
   * Get expiring inventory summary
   * Scope: inventory:read
   */
  @Get("inventory/expiring")
  @ApiScopes("inventory:read")
  async getExpiringInventory(@Req() req: ApiRequest) {
    const principal = req.apiPrincipal;
    return this.partnerApi.getExpiringInventory(principal.campgroundId);
  }

  /**
   * Record a sale from external POS system
   * Scope: pos:write
   */
  @Post("sales")
  @ApiScopes("pos:write")
  async recordSale(@Req() req: ApiRequest, @Body() dto: RecordSaleDto) {
    const principal = req.apiPrincipal;
    return this.partnerApi.recordSale(principal.campgroundId, principal.apiClientId, dto);
  }

  /**
   * Record a refund for a previous sale
   * Scope: pos:write
   */
  @Post("sales/:saleId/refund")
  @ApiScopes("pos:write")
  async recordRefund(
    @Req() req: ApiRequest,
    @Param("saleId") saleId: string,
    @Body() dto: RecordRefundDto,
  ) {
    const principal = req.apiPrincipal;
    return this.partnerApi.recordRefund(principal.campgroundId, saleId, dto);
  }
}
