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
    UseGuards,
} from "@nestjs/common";
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
import { Req } from "@nestjs/common";

@UseGuards(JwtAuthGuard)
@Controller()
export class StoreController {
    constructor(private readonly store: StoreService) { }

    // ==================== CATEGORIES ====================

    @Get("campgrounds/:campgroundId/store/categories")
    listCategories(@Param("campgroundId") campgroundId: string) {
        return this.store.listCategories(campgroundId);
    }

    @Post("campgrounds/:campgroundId/store/categories")
    createCategory(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateProductCategoryDto, "campgroundId">
    ) {
        return this.store.createCategory({ campgroundId, ...body });
    }

    @Patch("store/categories/:id")
    updateCategory(
        @Param("id") id: string,
        @Body() body: UpdateProductCategoryDto
    ) {
        return this.store.updateCategory(id, body);
    }

    @Delete("store/categories/:id")
    deleteCategory(@Param("id") id: string) {
        return this.store.deleteCategory(id);
    }

    // ==================== PRODUCTS ====================

    @Get("campgrounds/:campgroundId/store/products")
    listProducts(
        @Param("campgroundId") campgroundId: string,
        @Query("categoryId") categoryId?: string
    ) {
        return this.store.listProducts(campgroundId, categoryId);
    }

    @Get("store/products/:id")
    getProduct(@Param("id") id: string) {
        return this.store.getProduct(id);
    }

    @Post("campgrounds/:campgroundId/store/products")
    createProduct(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateProductDto, "campgroundId">
    ) {
        return this.store.createProduct({ campgroundId, ...body });
    }

    @Patch("campgrounds/:campgroundId/store/products/:id/stock")
    updateStock(
        @Param("campgroundId") campgroundId: string,
        @Param("id") id: string,
        @Body() body: { stockQty?: number; delta?: number; channel?: "pos" | "online" | "portal" | "kiosk" | "internal" }
    ) {
        if (typeof body.stockQty === "number") {
            return this.store.setStock(id, body.stockQty, body.channel);
        }
        const delta = typeof body.delta === "number" ? body.delta : 0;
        return this.store.adjustStock(id, delta, body.channel);
    }

  @Patch("store/products/:id")
  updateProduct(@Param("id") id: string, @Body() body: UpdateProductDto) {
    return this.store.updateProduct(id, body);
  }

  @Delete("store/products/:id")
  deleteProduct(@Param("id") id: string) {
    return this.store.deleteProduct(id);
  }
 
    @Get("campgrounds/:campgroundId/store/products/low-stock")
    getLowStockProducts(@Param("campgroundId") campgroundId: string) {
        return this.store.getLowStockProducts(campgroundId);
    }

    // ==================== ADD-ONS ====================

    @Get("campgrounds/:campgroundId/store/addons")
    listAddOns(@Param("campgroundId") campgroundId: string) {
        return this.store.listAddOns(campgroundId);
    }

    @Post("campgrounds/:campgroundId/store/addons")
    createAddOn(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateAddOnDto, "campgroundId">
    ) {
        return this.store.createAddOn({ campgroundId, ...body });
    }

    @Patch("store/addons/:id")
    updateAddOn(@Param("id") id: string, @Body() body: UpdateAddOnDto) {
        return this.store.updateAddOn(id, body);
    }

    @Delete("store/addons/:id")
    deleteAddOn(@Param("id") id: string) {
        return this.store.deleteAddOn(id);
    }

    // ==================== ORDERS ====================

    @Get("campgrounds/:campgroundId/store/orders")
    listOrders(
        @Param("campgroundId") campgroundId: string,
        @Query("status") status?: string,
        @Query("reservationId") reservationId?: string
    ) {
        return this.store.listOrders(campgroundId, { status, reservationId });
    }

    @Get("campgrounds/:campgroundId/store/orders/summary")
    getSummary(
        @Param("campgroundId") campgroundId: string,
        @Query("start") start?: string,
        @Query("end") end?: string
    ) {
        const startDate = start ? new Date(start) : undefined;
        const endDate = end ? new Date(end) : undefined;
        return this.store.getOrderSummary(campgroundId, { start: startDate, end: endDate });
    }

    @Get("store/orders/:id")
    getOrder(@Param("id") id: string) {
        return this.store.getOrder(id);
    }

    @Post("campgrounds/:campgroundId/store/orders")
    createOrder(
        @Param("campgroundId") campgroundId: string,
        @Body() body: Omit<CreateOrderDto, "campgroundId">,
        @Req() req: any
    ) {
        return this.store.createOrder({ campgroundId, ...body }, req?.user?.id);
    }

    // ============= Guest Portal (guest-jwt) =============
    @UseGuards(AuthGuard("guest-jwt"))
    @Get("portal/store/products")
    listProductsPortal(@Query("campgroundId") campgroundId: string, @Query("categoryId") categoryId?: string) {
        return this.store.listProducts(campgroundId, categoryId);
    }

    @UseGuards(AuthGuard("guest-jwt"))
    @Get("portal/store/addons")
    listAddOnsPortal(@Query("campgroundId") campgroundId: string) {
        return this.store.listAddOns(campgroundId);
    }

    @UseGuards(AuthGuard("guest-jwt"))
    @Post("portal/store/orders")
    async createOrderPortal(@Req() req: any, @Body() body: Omit<CreateOrderDto, "campgroundId" | "guestId">) {
        const guest = req.user as any;
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
            ...body
        });
    }

    // Staff: mark order completed
    @Patch("store/orders/:id/complete")
    completeOrder(@Param("id") id: string, @Req() req: any) {
        const user = req.user as any;
    return this.store.updateOrderStatus(id, "completed", user?.id);
  }

  @Patch("store/orders/:id/status")
  updateStatus(@Param("id") id: string, @Body() body: { status: "pending" | "ready" | "delivered" | "completed" | "cancelled" | "refunded" }, @Req() req: any) {
    const user = req.user as any;
    return this.store.updateOrderStatus(id, body.status, user?.id);
    }

    @Get("store/orders/:id/history")
    getOrderHistory(@Param("id") id: string) {
        return this.store.getOrderAdjustments(id);
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
        @Req() req: any
    ) {
        const user = req.user as any;
        return this.store.recordRefundOrExchange(id, body, user);
    }

    // Staff notifications: list unseen/pending orders
    @Get("campgrounds/:campgroundId/store/orders/unseen")
    listUnseen(@Param("campgroundId") campgroundId: string) {
        return this.store.listUnseenOrders(campgroundId);
    }

    @Patch("store/orders/:id/seen")
    markSeen(@Param("id") id: string) {
        return this.store.markOrderSeen(id);
    }
}
