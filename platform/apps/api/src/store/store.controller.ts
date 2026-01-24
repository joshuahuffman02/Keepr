import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { StoreService } from "./store.service";
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  CreateAddOnDto,
  UpdateAddOnDto,
  CreateOrderDto,
} from "./dto/store.dto";
import { JwtAuthGuard } from "../auth/guards";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { ScopeGuard } from "../permissions/scope.guard";
import { RequireScope } from "../permissions/scope.decorator";
import { UserRole, Guest, OrderStatus } from "@prisma/client";
import type { AuthUser } from "../auth/auth.types";

const hasCampgroundId = (value: Request): value is Request & { campgroundId?: string | null } =>
  Object.prototype.hasOwnProperty.call(value, "campgroundId");

// SECURITY FIX (STORE-HIGH-001): Added membership validation to prevent cross-tenant access
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Controller()
export class StoreController {
  constructor(private readonly store: StoreService) {}

  private requireCampgroundId(req: Request, fallback?: string): string {
    const headerValue = req.headers["x-campground-id"];
    const headerCampgroundId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const scopedCampgroundId = hasCampgroundId(req) ? req.campgroundId : undefined;
    const campgroundId =
      fallback ??
      (typeof scopedCampgroundId === "string" ? scopedCampgroundId : undefined) ??
      headerCampgroundId ??
      undefined;
    if (!campgroundId) {
      throw new BadRequestException("campgroundId is required");
    }
    return campgroundId;
  }

  /**
   * Verify the authenticated user has access to the specified campground.
   * Prevents cross-tenant access by ensuring users can only access campgrounds they are members of.
   */
  private assertCampgroundAccess(campgroundId: string, user: AuthUser | null | undefined): void {
    // Platform staff can access any campground
    const isPlatformStaff =
      user?.platformRole === "platform_admin" || user?.platformRole === "support_agent";
    if (isPlatformStaff) {
      return;
    }

    const userCampgroundIds = user?.memberships?.map((membership) => membership.campgroundId) ?? [];
    if (!userCampgroundIds.includes(campgroundId)) {
      throw new BadRequestException("You do not have access to this campground");
    }
  }

  // ==================== CATEGORIES ====================

  @Get("campgrounds/:campgroundId/store/categories")
  listCategories(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.listCategories(campgroundId);
  }

  @Post("campgrounds/:campgroundId/store/categories")
  createCategory(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateProductCategoryDto, "campgroundId">,
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.createCategory({ campgroundId, ...body });
  }

  @Patch("store/categories/:id")
  updateCategory(
    @Param("id") id: string,
    @Body() body: UpdateProductCategoryDto,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.updateCategory(requiredCampgroundId, id, body);
  }

  @Delete("store/categories/:id")
  deleteCategory(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.deleteCategory(requiredCampgroundId, id);
  }

  // ==================== PRODUCTS ====================

  @Get("campgrounds/:campgroundId/store/products")
  listProducts(
    @Param("campgroundId") campgroundId: string,
    @Req() req: Request,
    @Query("categoryId") categoryId?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.listProducts(campgroundId, categoryId);
  }

  @Get("store/products/:id")
  getProduct(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.getProduct(requiredCampgroundId, id);
  }

  @Post("campgrounds/:campgroundId/store/products")
  createProduct(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateProductDto, "campgroundId">,
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.createProduct({ campgroundId, ...body });
  }

  @Patch("campgrounds/:campgroundId/store/products/:id/stock")
  updateStock(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body()
    body: {
      stockQty?: number;
      delta?: number;
      channel?: "pos" | "online" | "portal" | "kiosk" | "internal";
    },
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    if (typeof body.stockQty === "number") {
      return this.store.setStock(campgroundId, id, body.stockQty, body.channel);
    }
    const delta = typeof body.delta === "number" ? body.delta : 0;
    return this.store.adjustStock(campgroundId, id, delta, body.channel);
  }

  @Patch("store/products/:id")
  updateProduct(
    @Param("id") id: string,
    @Body() body: UpdateProductDto,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.updateProduct(requiredCampgroundId, id, body);
  }

  @Delete("store/products/:id")
  deleteProduct(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.deleteProduct(requiredCampgroundId, id);
  }

  @Get("campgrounds/:campgroundId/store/products/low-stock")
  getLowStockProducts(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.getLowStockProducts(campgroundId);
  }

  // ==================== ADD-ONS ====================

  @Get("campgrounds/:campgroundId/store/addons")
  listAddOns(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.listAddOns(campgroundId);
  }

  @Post("campgrounds/:campgroundId/store/addons")
  createAddOn(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateAddOnDto, "campgroundId">,
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.createAddOn({ campgroundId, ...body });
  }

  @Patch("store/addons/:id")
  updateAddOn(
    @Param("id") id: string,
    @Body() body: UpdateAddOnDto,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.updateAddOn(requiredCampgroundId, id, body);
  }

  @Delete("store/addons/:id")
  deleteAddOn(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.deleteAddOn(requiredCampgroundId, id);
  }

  // ==================== ORDERS ====================

  @Get("campgrounds/:campgroundId/store/orders")
  listOrders(
    @Param("campgroundId") campgroundId: string,
    @Req() req: Request,
    @Query("status") status?: string,
    @Query("reservationId") reservationId?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    const statusValues: Set<string> = new Set(Object.values(OrderStatus));
    const isOrderStatus = (value: string): value is OrderStatus => statusValues.has(value);
    const statusFilter = status && isOrderStatus(status) ? status : undefined;
    return this.store.listOrders(campgroundId, { status: statusFilter, reservationId });
  }

  @Get("campgrounds/:campgroundId/store/orders/summary")
  getSummary(
    @Param("campgroundId") campgroundId: string,
    @Req() req: Request,
    @Query("start") start?: string,
    @Query("end") end?: string,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;
    return this.store.getOrderSummary(campgroundId, { start: startDate, end: endDate });
  }

  @Get("store/orders/:id")
  getOrder(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.getOrder(requiredCampgroundId, id);
  }

  @Post("campgrounds/:campgroundId/store/orders")
  createOrder(
    @Param("campgroundId") campgroundId: string,
    @Body() body: Omit<CreateOrderDto, "campgroundId">,
    @Req() req: Request,
  ) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.createOrder({ campgroundId, ...body }, req.user?.id);
  }

  // ============= Guest Portal (guest-jwt) =============
  @UseGuards(AuthGuard("guest-jwt"))
  @Get("portal/store/products")
  listProductsPortal(
    @Query("campgroundId") campgroundId: string,
    @Query("categoryId") categoryId?: string,
  ) {
    return this.store.listProducts(campgroundId, categoryId);
  }

  @UseGuards(AuthGuard("guest-jwt"))
  @Get("portal/store/addons")
  listAddOnsPortal(@Query("campgroundId") campgroundId: string) {
    return this.store.listAddOns(campgroundId);
  }

  @UseGuards(AuthGuard("guest-jwt"))
  @Post("portal/store/orders")
  async createOrderPortal(
    @Req() req: Request & { user: Guest },
    @Body() body: Omit<CreateOrderDto, "campgroundId" | "guestId">,
  ) {
    const guest = req.user;
    // Validate reservation belongs to this guest
    if (!body.reservationId) {
      throw new BadRequestException("reservationId is required");
    }
    const reservation = await this.store.findReservationForGuest(body.reservationId, guest.id);
    if (!reservation) {
      throw new NotFoundException("Reservation not found for this guest");
    }

    return this.store.createOrder({
      campgroundId: reservation.campgroundId,
      reservationId: reservation.id,
      guestId: guest.id,
      siteNumber: reservation.site?.siteNumber ?? undefined,
      paymentMethod: "charge_to_site",
      channel: "portal",
      fulfillmentType: body.fulfillmentType ?? "delivery",
      ...body,
    });
  }

  // Staff: mark order completed
  @Patch("store/orders/:id/complete")
  completeOrder(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.updateOrderStatus(
      requiredCampgroundId,
      id,
      OrderStatus.completed,
      req.user?.id,
    );
  }

  @Patch("store/orders/:id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() body: { status: OrderStatus },
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.updateOrderStatus(requiredCampgroundId, id, body.status, req.user?.id);
  }

  @Get("store/orders/:id/history")
  getOrderHistory(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.getOrderAdjustments(id, requiredCampgroundId);
  }

  @Post("store/orders/:id/refunds")
  recordRefundOrExchange(
    @Param("id") id: string,
    @Body()
    body: {
      type?: "refund" | "exchange";
      items?: Array<{ itemId?: string; qty?: number; amountCents?: number; name?: string }>;
      amountCents?: number;
      note?: string | null;
    },
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.recordRefundOrExchange(id, requiredCampgroundId, body, req.user);
  }

  // Staff notifications: list unseen/pending orders
  @Get("campgrounds/:campgroundId/store/orders/unseen")
  listUnseen(@Param("campgroundId") campgroundId: string, @Req() req: Request) {
    this.assertCampgroundAccess(campgroundId, req.user);
    return this.store.listUnseenOrders(campgroundId);
  }

  @Patch("store/orders/:id/seen")
  markSeen(
    @Param("id") id: string,
    @Req() req: Request,
    @Query("campgroundId") campgroundId?: string,
  ) {
    const requiredCampgroundId = this.requireCampgroundId(req, campgroundId);
    this.assertCampgroundAccess(requiredCampgroundId, req.user);
    return this.store.markOrderSeen(requiredCampgroundId, id);
  }
}
