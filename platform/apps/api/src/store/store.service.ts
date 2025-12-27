import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
    CreateProductCategoryDto,
    UpdateProductCategoryDto,
    CreateProductDto,
    UpdateProductDto,
    CreateAddOnDto,
    UpdateAddOnDto,
    CreateOrderDto,
} from "./dto/store.dto";
import { AddOnPricingType, PaymentMethod, OrderChannel, ChannelInventoryMode, TaxRuleType } from "@prisma/client";
import { EmailService } from "../email/email.service";
import { randomUUID } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { LocationService } from "./location.service";

@Injectable()
export class StoreService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly locationService: LocationService
    ) { }

    // ==================== CATEGORIES ====================

    listCategories(campgroundId: string) {
        return this.prisma.productCategory.findMany({
            where: { campgroundId },
            orderBy: { sortOrder: "asc" },
            include: {
                _count: { select: { products: true } },
            },
        });
    }

    /**
     * Update order status with timestamp tracking
     */
    async updateOrderStatus(id: string, status: "pending" | "ready" | "delivered" | "completed" | "cancelled" | "refunded", userId?: string) {
        const data: any = { status };
        const now = new Date();
        if (status === "ready") data.readyAt = now;
        if (status === "delivered") data.deliveredAt = now;
        if (status === "completed") {
            data.completedAt = now;
            if (userId) data.completedById = userId;
        }
        return (this.prisma as any).storeOrder.update({ where: { id }, data });
    }

    createCategory(data: CreateProductCategoryDto) {
        return this.prisma.productCategory.create({ data });
    }

    updateCategory(id: string, data: UpdateProductCategoryDto) {
        return this.prisma.productCategory.update({ where: { id }, data });
    }

    deleteCategory(id: string) {
        return this.prisma.productCategory.delete({ where: { id } });
    }

    // ==================== PRODUCTS ====================

    listProducts(campgroundId: string, categoryId?: string) {
        return this.prisma.product.findMany({
            where: {
                campgroundId,
                ...(categoryId ? { categoryId } : {}),
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
                category: { select: { id: true, name: true } },
            },
        });
    }

    getProduct(id: string) {
        return this.prisma.product.findUnique({
            where: { id },
            include: { category: true },
        });
    }

    createProduct(data: CreateProductDto) {
        return this.prisma.product.create({ data });
    }

    updateProduct(id: string, data: UpdateProductDto) {
        return this.prisma.product.update({ where: { id }, data });
    }

    deleteProduct(id: string) {
        return this.prisma.product.delete({ where: { id } });
    }

    async setStock(id: string, stockQty: number, channel?: OrderChannel | null) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) throw new NotFoundException("Product not found");
        const next = Math.max(0, stockQty);
        if (channel && product.channelInventoryMode === "split") {
            if (channel === "online" || channel === "portal") {
                return this.prisma.product.update({ where: { id }, data: { onlineStockQty: next } });
            }
            return this.prisma.product.update({ where: { id }, data: { posStockQty: next } });
        }
        return this.prisma.product.update({
            where: { id },
            data: { stockQty: next },
        });
    }

    async adjustStock(id: string, adjustment: number, channel?: OrderChannel | null) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) throw new NotFoundException("Product not found");

        if (channel && product.channelInventoryMode === "split") {
            if (channel === "online" || channel === "portal") {
                const newQty = Math.max(0, (product.onlineStockQty ?? 0) + adjustment);
                return this.prisma.product.update({ where: { id }, data: { onlineStockQty: newQty } });
            }
            const newQty = Math.max(0, (product.posStockQty ?? 0) + adjustment);
            return this.prisma.product.update({ where: { id }, data: { posStockQty: newQty } });
        }

        const newQty = Math.max(0, product.stockQty + adjustment);
        return this.prisma.product.update({
            where: { id },
            data: { stockQty: newQty },
        });
    }

    async getLowStockProducts(campgroundId: string) {
        const products = await this.prisma.product.findMany({
            where: {
                campgroundId,
                trackInventory: true,
                lowStockAlert: { not: null },
            },
            include: { category: true },
        });

        return products.filter((p) => p.stockQty <= (p.lowStockAlert || 0));
    }

    // ==================== ADD-ONS ====================

    listAddOns(campgroundId: string) {
        return this.prisma.addOnService.findMany({
            where: { campgroundId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
    }

    createAddOn(data: CreateAddOnDto) {
        return this.prisma.addOnService.create({
            data: {
                ...data,
                pricingType: (data.pricingType as AddOnPricingType) || "flat",
            },
        });
    }

    updateAddOn(id: string, data: UpdateAddOnDto) {
        return this.prisma.addOnService.update({
            where: { id },
            data: {
                ...data,
                ...(data.pricingType
                    ? { pricingType: data.pricingType as AddOnPricingType }
                    : {}),
            },
        });
    }

    deleteAddOn(id: string) {
        return this.prisma.addOnService.delete({ where: { id } });
    }

    // ==================== ORDERS ====================

    async findReservationForGuest(reservationId: string, guestId: string) {
        return this.prisma.reservation.findFirst({
            where: { id: reservationId, guestId },
            select: { id: true, campgroundId: true, site: { select: { siteNumber: true } } }
        });
    }

    async listOrders(
        campgroundId: string,
        options?: { status?: string; reservationId?: string }
    ) {
        const orders = await (this.prisma as any).storeOrder.findMany({
            where: {
                campgroundId,
                ...(options?.status ? { status: options.status as any } : {}),
                ...(options?.reservationId
                    ? { reservationId: options.reservationId }
                    : {}),
            },
            orderBy: { createdAt: "desc" },
            include: {
                items: true,
                reservation: {
                    select: {
                        id: true,
                        site: { select: { siteNumber: true } },
                        guest: { select: { primaryFirstName: true, primaryLastName: true } },
                    },
                },
                guest: {
                    select: { primaryFirstName: true, primaryLastName: true },
                },
                completedBy: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                },
            },
        });

        return Promise.all(orders.map((order: any) => this.attachAdjustments(order)));
    }

    /**
     * Get unseen pending orders
     */
    async listUnseenOrders(campgroundId: string) {
        return (this.prisma as any).storeOrder.findMany({
            where: {
                campgroundId,
                status: "pending",
                seenAt: null
            },
            select: { id: true, createdAt: true, reservationId: true, siteNumber: true }
        });
    }

    /**
     * Mark an order as seen by staff
     */
    async markOrderSeen(id: string) {
        return (this.prisma as any).storeOrder.update({
            where: { id },
            data: { seenAt: new Date() }
        });
    }

    async getOrderSummary(campgroundId: string, opts?: { start?: Date; end?: Date }) {
        const where: any = { campgroundId };
        if (opts?.start || opts?.end) {
            where.createdAt = {
                ...(opts?.start ? { gte: opts.start } : {}),
                ...(opts?.end ? { lte: opts.end } : {}),
            };
        }

        const [byChannel, byFulfillment, byStatus] = await Promise.all([
            (this.prisma as any).storeOrder.groupBy({
                by: ["channel"],
                where,
                _count: { _all: true },
                _sum: { totalCents: true }
            }),
            (this.prisma as any).storeOrder.groupBy({
                by: ["fulfillmentType"],
                where,
                _count: { _all: true },
                _sum: { totalCents: true }
            }),
            (this.prisma as any).storeOrder.groupBy({
                by: ["status"],
                where,
                _count: { _all: true },
                _sum: { totalCents: true }
            })
        ]);

        const prepSamples = await (this.prisma as any).storeOrder.findMany({
            where,
            select: { createdAt: true, readyAt: true, prepTimeMinutes: true, fulfillmentType: true }
        });

        let plannedSum = 0;
        let plannedCount = 0;
        let actualSum = 0;
        let actualCount = 0;

        const perFulfillment: Record<string, { plannedSum: number; plannedCount: number; actualSum: number; actualCount: number }> = {};

        for (const o of prepSamples) {
            if (typeof o.prepTimeMinutes === "number") {
                plannedSum += o.prepTimeMinutes;
                plannedCount += 1;
                const key = o.fulfillmentType || "unknown";
                perFulfillment[key] = perFulfillment[key] || { plannedSum: 0, plannedCount: 0, actualSum: 0, actualCount: 0 };
                perFulfillment[key].plannedSum += o.prepTimeMinutes;
                perFulfillment[key].plannedCount += 1;
            }
            if (o.readyAt && o.createdAt) {
                const diffMs = new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime();
                if (diffMs > 0) {
                    actualSum += diffMs / 60000;
                    actualCount += 1;
                    const key = o.fulfillmentType || "unknown";
                    perFulfillment[key] = perFulfillment[key] || { plannedSum: 0, plannedCount: 0, actualSum: 0, actualCount: 0 };
                    perFulfillment[key].actualSum += diffMs / 60000;
                    perFulfillment[key].actualCount += 1;
                }
            }
        }

        const averagesByFulfillment = Object.entries(perFulfillment).map(([fulfillmentType, stats]) => ({
            fulfillmentType,
            prepMinutesPlanned: stats.plannedCount ? stats.plannedSum / stats.plannedCount : null,
            prepMinutesActual: stats.actualCount ? stats.actualSum / stats.actualCount : null,
        }));

        return {
            byChannel,
            byFulfillment,
            byStatus,
            averages: {
                prepMinutesPlanned: plannedCount ? plannedSum / plannedCount : null,
                prepMinutesActual: actualCount ? actualSum / actualCount : null,
            },
            averagesByFulfillment
        };
    }

    private resolveInventoryChannel(channel?: string | null): OrderChannel {
        if (!channel) return "pos";
        if (channel === "online" || channel === "portal" || channel === "kiosk" || channel === "internal") return channel;
        return "pos";
    }

    private resolveFulfillmentType(type?: string | null) {
        if (type === "curbside" || type === "delivery" || type === "table_service" || type === "pickup") return type;
        return "pickup";
    }

    private async adjustInventoryForChannel(product: any, channel: OrderChannel, delta: number) {
        const mode = (product.channelInventoryMode as ChannelInventoryMode) ?? "shared";
        if (!product.trackInventory) return;
        if (mode === "split") {
            if (channel === "online" || channel === "portal") {
                const next = Math.max(0, (product.onlineStockQty ?? 0) + delta);
                await this.prisma.product.update({ where: { id: product.id }, data: { onlineStockQty: next } });
                return;
            }
            const next = Math.max(0, (product.posStockQty ?? 0) + delta);
            await this.prisma.product.update({ where: { id: product.id }, data: { posStockQty: next } });
            return;
        }
        const next = Math.max(0, (product.stockQty ?? 0) + delta);
        await this.prisma.product.update({ where: { id: product.id }, data: { stockQty: next } });
    }

    async createOrder(data: CreateOrderDto, actorUserId?: string) {
        const campground = await (this.prisma as any).campground.findUnique({
            where: { id: data.campgroundId },
            select: { storeOpenHour: true, storeCloseHour: true, email: true, name: true }
        });
        const now = new Date();
        const openHour = campground?.storeOpenHour ?? Number(process.env.STORE_OPEN_HOUR ?? 8);
        const closeHour = campground?.storeCloseHour ?? Number(process.env.STORE_CLOSE_HOUR ?? 20);
        const isOpen = now.getHours() >= openHour && now.getHours() < closeHour;

        // Fetch products and add-ons for the items
        const productIds = data.items
            .filter((i) => i.productId)
            .map((i) => i.productId!);
        const addOnIds = data.items.filter((i) => i.addOnId).map((i) => i.addOnId!);

        const [products, addOns] = await Promise.all([
            productIds.length > 0
                ? this.prisma.product.findMany({ where: { id: { in: productIds } } })
                : [],
            addOnIds.length > 0
                ? this.prisma.addOnService.findMany({ where: { id: { in: addOnIds } } })
                : [],
        ]);

        const productMap = new Map(products.map((p) => [p.id, p]));
        const addOnMap = new Map(addOns.map((a) => [a.id, a]));

        // Calculate totals and build order items
        let subtotalCents = 0;
        let disallowedAfterHours = false;

        const channel = this.resolveInventoryChannel((data as any).channel);
        const fulfillmentType = this.resolveFulfillmentType((data as any).fulfillmentType);
        const locationId = data.locationId ?? null;

        const orderItems = data.items.map((item) => {
            let name = "";
            let unitCents = 0;
            let afterHoursAllowed = false;
            let availableQty = Infinity;

            if (item.productId) {
                const product: any = productMap.get(item.productId);
                if (product) {
                    name = product.name;
                    unitCents = product.priceCents;
                    afterHoursAllowed = !!product.afterHoursAllowed;
                    const mode = (product.channelInventoryMode as ChannelInventoryMode) ?? "shared";
                    if (mode === "split") {
                        availableQty =
                            channel === "online" || channel === "portal"
                                ? Math.max(0, (product.onlineStockQty ?? 0) - (product.onlineBufferQty ?? 0))
                                : Math.max(0, product.posStockQty ?? 0);
                    } else {
                        availableQty = Math.max(0, product.stockQty ?? 0);
                    }
                    if (product.trackInventory && availableQty < item.qty) {
                        throw new ConflictException(`Not enough ${channel === "online" ? "online" : "in-store"} allotment for ${product.name}`);
                    }
                }
            } else if (item.addOnId) {
                const addOn = addOnMap.get(item.addOnId);
                if (addOn) {
                    name = addOn.name;
                    unitCents = addOn.priceCents;
                }
            }

            const totalCents = unitCents * item.qty;
            subtotalCents += totalCents;

            if (!isOpen && !afterHoursAllowed) {
                disallowedAfterHours = true;
            }

            return {
                productId: item.productId || null,
                addOnId: item.addOnId || null,
                name,
                qty: item.qty,
                unitCents,
                totalCents,
            };
        });

        // Calculate tax based on campground tax rules
        const { taxCents } = await this.calculateStoreTax(data.campgroundId, subtotalCents);
        const totalCents = subtotalCents + taxCents;

        if (!isOpen && disallowedAfterHours) {
            throw new ConflictException("Store is closed. Only after-hours items are available.");
        }

        // Create order with items
        const order = await this.prisma.storeOrder.create({
            data: {
                campgroundId: data.campgroundId,
                reservationId: data.reservationId || null,
                guestId: data.guestId || null,
                siteNumber: data.siteNumber || null,
                channel,
                fulfillmentType,
                deliveryInstructions: (data as any).deliveryInstructions || null,
                promisedAt: (data as any).promisedAt ? new Date((data as any).promisedAt) : null,
                prepTimeMinutes: (data as any).prepTimeMinutes ?? null,
                paymentMethod: (data.paymentMethod as PaymentMethod) || "card",
                notes: data.notes || null,
                subtotalCents,
                taxCents,
                totalCents,
                status: "pending",
                createdBy: actorUserId ?? null,
                fulfillmentLocationId: locationId,
                items: {
                    create: orderItems,
                },
            },
            include: { items: true },
        });

        // Fire-and-forget notifications
        this.notifyStaffNewOrder(order, campground?.email, campground?.name, (campground as any)?.orderWebhookUrl).catch(() => { /* ignore */ });

        const perLocationItems: Array<{ productId: string; qty: number }> = [];
        const channelItems: Array<{ product: any; qty: number }> = [];

        for (const item of data.items) {
            if (!item.productId) continue;
            const product: any = productMap.get(item.productId);
            if (!product?.trackInventory || (product.afterHoursAllowed && !isOpen)) continue;

            if (product.inventoryMode === "per_location" && locationId && actorUserId) {
                perLocationItems.push({ productId: item.productId, qty: item.qty });
            } else {
                channelItems.push({ product, qty: item.qty });
            }
        }

        if (perLocationItems.length && locationId && actorUserId) {
            await this.locationService.deductInventoryForSale(
                data.campgroundId,
                perLocationItems,
                locationId,
                actorUserId,
                order.id
            );
        }

        for (const item of channelItems) {
            await this.adjustInventoryForChannel(item.product, channel, -item.qty);
        }

        // If charged to site, create a ledger entry
        if (data.paymentMethod === "charge_to_site" && data.reservationId) {
            await this.prisma.ledgerEntry.create({
                data: {
                    campgroundId: data.campgroundId,
                    reservationId: data.reservationId,
                    glCode: "STORE",
                    account: "Store Charges",
                    description: `Store order #${order.id.slice(-6)}`,
                    amountCents: totalCents,
                    direction: "debit",
                },
            });

            // Update reservation balance
            await this.prisma.reservation.update({
                where: { id: data.reservationId },
                data: {
                    balanceAmount: { increment: totalCents },
                    totalAmount: { increment: totalCents },
                },
            });
        }

        return order;
    }

    getOrder(id: string) {
        return this.prisma.storeOrder.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: { select: { imageUrl: true } },
                    },
                },
                reservation: {
                    select: {
                        id: true,
                        site: { select: { siteNumber: true, name: true } },
                        guest: { select: { primaryFirstName: true, primaryLastName: true } },
                    },
                },
            },
        }).then((order) => order ? this.attachAdjustments(order) : null);
    }

    /**
     * Get order adjustments (refunds/exchanges)
     */
    async getOrderAdjustments(orderId: string) {
        return (this.prisma as any).storeOrderAdjustment.findMany({
            where: { orderId },
            orderBy: { createdAt: "desc" },
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                }
            }
        });
    }

    /**
     * Attach adjustments to order object
     */
    private async attachAdjustments(order: any) {
        const adjustments = await this.getOrderAdjustments(order.id);
        return { ...order, adjustments };
    }

    /**
     * Record a refund or exchange for an order
     *
     * Note: For payment processor refunds, integrate with:
     * - Stripe: stripe.refunds.create({ payment_intent: order.paymentIntentId })
     * - Square: squareClient.refundsApi.refundPayment({ ... })
     */
    async recordRefundOrExchange(
        orderId: string,
        payload: {
            type?: "refund" | "exchange";
            items?: Array<{ itemId?: string; qty?: number; amountCents?: number; name?: string }>;
            amountCents?: number;
            note?: string | null;
        },
        user?: any
    ) {
        const order = await (this.prisma as any).storeOrder.findUnique({
            where: { id: orderId },
            include: { items: true, campground: { select: { name: true } } },
        });
        if (!order) {
            throw new NotFoundException("Order not found");
        }

        // Validate refund amount doesn't exceed order total
        const selectedItems =
            payload.items && payload.items.length > 0
                ? payload.items.map((item) => {
                    const match = order.items.find((i: any) => i.id === item.itemId);
                    if (item.itemId && !match) {
                        throw new Error(`Item ${item.itemId} not found in order`);
                    }
                    return {
                        itemId: item.itemId || match?.id || randomUUID(),
                        name: item.name || match?.name || "Line item",
                        qty: item.qty ?? match?.qty ?? 0,
                        amountCents: item.amountCents ?? match?.totalCents ?? 0,
                    };
                })
                : order.items.map((i: any) => ({
                    itemId: i.id,
                    name: i.name,
                    qty: i.qty,
                    amountCents: i.totalCents ?? 0,
                }));

        const amountCents =
            payload.amountCents ??
            selectedItems.reduce((sum: number, i: { amountCents?: number }) => sum + (i.amountCents ?? 0), 0);

        // Validate refund amount
        if (amountCents > order.totalCents) {
            throw new Error(`Refund amount (${amountCents}) cannot exceed order total (${order.totalCents})`);
        }

        if (amountCents <= 0) {
            throw new Error("Refund amount must be greater than zero");
        }

        const adjustmentType = payload.type === "exchange" ? "exchange" : "refund";

        // Create database record for the adjustment
        const adjustment = await (this.prisma as any).storeOrderAdjustment.create({
            data: {
                orderId,
                type: adjustmentType,
                amountCents,
                note: payload.note || null,
                items: selectedItems,
                createdById: user?.id || null,
            },
            include: {
                createdBy: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                }
            }
        });

        // Update order status
        if (adjustmentType === "refund" && order.status !== "refunded") {
            await this.updateOrderStatus(orderId, "refunded", user?.id);
        }

        // If order was charged to site, create offsetting ledger entry
        if (order.paymentMethod === "charge_to_site" && order.reservationId && adjustmentType === "refund") {
            try {
                await this.prisma.ledgerEntry.create({
                    data: {
                        campgroundId: order.campgroundId,
                        reservationId: order.reservationId,
                        glCode: "STORE",
                        account: "Store Refunds",
                        description: `Refund for store order #${order.id.slice(-6)}${adjustment.note ? `: ${adjustment.note}` : ''}`,
                        amountCents: amountCents,
                        direction: "credit", // Credit reduces the guest's balance
                    },
                });

                // Update reservation balance
                await this.prisma.reservation.update({
                    where: { id: order.reservationId },
                    data: {
                        balanceAmount: { decrement: amountCents },
                        totalAmount: { decrement: amountCents },
                    },
                });
            } catch (error: any) {
                // Log error but don't fail the refund
                console.error(`Failed to create ledger entry for refund: ${error.message}`);
            }
        }

        return adjustment;
    }

    private async notifyStaffNewOrder(order: any, email?: string | null, campgroundName?: string | null, webhookUrl?: string | null) {
        const title = `New Store Order ${order.id.slice(0, 8)}`;
        const total = `$${(order.totalCents / 100).toFixed(2)}`;
        const itemsList = order.items?.map((i: any) => `<li>${i.qty} x ${i.name} - $${(i.totalCents / 100).toFixed(2)}</li>`).join("") ?? "";
        const fulfillment = order.fulfillmentType ? String(order.fulfillmentType).replace("_", " ") : "pickup";
        const channel = order.channel ?? "pos";
        const instructions = order.deliveryInstructions ? `<p><strong>Instructions:</strong> ${order.deliveryInstructions}</p>` : "";
        const promised = order.promisedAt ? `<p><strong>Promised at:</strong> ${new Date(order.promisedAt).toLocaleString()}</p>` : "";

        if (email) {
            const html = `
              <h2>${campgroundName || "Campground"} - New Store Order</h2>
              <p><strong>Order ID:</strong> ${order.id}</p>
              <p><strong>Total:</strong> ${total}</p>
              <p><strong>Payment:</strong> ${order.paymentMethod || "charge_to_site"}</p>
              <p><strong>Channel:</strong> ${channel}</p>
              <p><strong>Fulfillment:</strong> ${fulfillment}</p>
              <p><strong>Site:</strong> ${order.siteNumber || "N/A"}</p>
              ${promised}
              ${instructions}
              <p><strong>Placed At:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
              <p><strong>Items:</strong></p>
              <ul>${itemsList}</ul>
            `;

            await this.emailService.sendEmail({
                to: email,
                subject: title,
                html
            });
        }

        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "store.order.created",
                        id: order.id,
                        campgroundName,
                        total: order.totalCents,
                        siteNumber: order.siteNumber,
                        paymentMethod: order.paymentMethod,
                        channel,
                        fulfillmentType: order.fulfillmentType,
                        deliveryInstructions: order.deliveryInstructions,
                        promisedAt: order.promisedAt,
                        createdAt: order.createdAt,
                        items: order.items?.map((i: any) => ({
                            name: i.name,
                            qty: i.qty,
                            totalCents: i.totalCents
                        }))
                    })
                });
            } catch {
                // ignore webhook errors
            }
        }
    }

    /**
     * Calculate tax for store orders based on campground tax rules
     */
    private async calculateStoreTax(campgroundId: string, subtotalCents: number): Promise<{ taxCents: number; taxBreakdown: Array<{ name: string; rate: number; amount: number }> }> {
        // Fetch active tax rules for the campground that apply to goods/services
        const taxRules = await this.prisma.taxRule.findMany({
            where: {
                campgroundId,
                isActive: true,
                category: { in: ['general', 'goods', 'services'] }
            },
            orderBy: { createdAt: 'asc' }
        });

        if (taxRules.length === 0) {
            return { taxCents: 0, taxBreakdown: [] };
        }

        let totalTaxCents = 0;
        const taxBreakdown: Array<{ name: string; rate: number; amount: number }> = [];

        for (const rule of taxRules) {
            let taxAmount = 0;

            switch (rule.type) {
                case TaxRuleType.percentage:
                    // Rate is stored as decimal (e.g., 0.0825 for 8.25%)
                    const rate = rule.rate ? Number(rule.rate) : 0;
                    taxAmount = Math.round(subtotalCents * rate);
                    if (taxAmount > 0) {
                        taxBreakdown.push({
                            name: rule.name,
                            rate: rate * 100, // Convert to percentage for display
                            amount: taxAmount
                        });
                    }
                    break;

                case TaxRuleType.flat:
                    // Rate is stored as cents for flat taxes
                    taxAmount = rule.rate ? Math.round(Number(rule.rate) * 100) : 0;
                    if (taxAmount > 0) {
                        taxBreakdown.push({
                            name: rule.name,
                            rate: 0,
                            amount: taxAmount
                        });
                    }
                    break;

                case TaxRuleType.exemption:
                    // Exemptions reduce tax - could be used for tax-exempt items
                    // For now, we skip these as they'd need item-level logic
                    break;
            }

            totalTaxCents += taxAmount;
        }

        return { taxCents: totalTaxCents, taxBreakdown };
    }
}
