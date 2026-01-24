import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import { PosProviderType, PosSyncStatus, PosSyncTarget } from "@prisma/client";
import {
  IntegrationRecord,
  PosProviderAdapter,
  ProviderPaymentRequest,
  ProviderPaymentResult,
  ProviderSyncResult,
  ProviderValidationResult,
  ProviderWebhookResult,
  ProviderWebhookVerification,
  ExternalProduct,
  ExternalProductPush,
  ExternalInventoryUpdate,
  ExternalPriceUpdate,
  ExternalSale,
  ExternalSyncResult,
} from "./pos-provider.types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => isRecord(item));
  }
  if (isRecord(value)) {
    return [value];
  }
  return [];
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Unknown error";
};

@Injectable()
abstract class BasePosProviderAdapter implements PosProviderAdapter {
  abstract readonly provider: PosProviderType;
  protected readonly logger = new Logger(BasePosProviderAdapter.name);

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const hasCredentials = Boolean(config.credentials && Object.keys(config.credentials).length);
    return {
      ok: hasCredentials,
      message: hasCredentials ? "Credentials present (stubbed validation)" : "Missing credentials",
    };
  }

  async syncCatalog(config: IntegrationRecord): Promise<ProviderSyncResult> {
    this.logger.debug(`Catalog sync requested for ${config.provider}`);
    return { started: true, target: PosSyncTarget.catalog, status: PosSyncStatus.running };
  }

  async syncTenders(config: IntegrationRecord): Promise<ProviderSyncResult> {
    this.logger.debug(`Tender sync requested for ${config.provider}`);
    return { started: true, target: PosSyncTarget.tenders, status: PosSyncStatus.running };
  }

  async processPayment(
    config: IntegrationRecord,
    request: ProviderPaymentRequest,
  ): Promise<ProviderPaymentResult | null> {
    // This base implementation is a stub. Each POS provider adapter (Clover, Square, Toast, etc.)
    // should override this method to implement actual payment processing through their API.
    //
    // For example:
    // - CloverAdapter should call the Clover Payments API
    // - SquareAdapter should call the Square Payments API
    // - ToastAdapter should call the Toast Payments API
    //
    // This stub returns a failed status to prevent accidental use without proper implementation.

    this.logger.warn(
      `Payment processing not implemented for ${config.provider}. ` +
        `Provider adapters must override processPayment() to handle real payments.`,
    );

    return {
      status: "failed",
      processorIds: {
        provider: config.provider,
        idempotencyKey: request.idempotencyKey,
      },
      raw: {
        error: "Payment processing not implemented for this provider",
        note: "This is a stub implementation. Provider-specific adapters must override processPayment().",
      },
    };
  }

  verifyWebhookSignature(input: ProviderWebhookVerification): boolean {
    if (!input.secret) return true;
    const digest = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
    return digest === input.signature;
  }

  async handlePaymentWebhook(input: {
    integration: IntegrationRecord;
    body: unknown;
    headers?: Record<string, unknown>;
  }): Promise<ProviderWebhookResult> {
    this.logger.debug(`Webhook received for ${input.integration.provider}`);
    return { acknowledged: true, message: "stubbed_webhook_handler" };
  }
}

@Injectable()
export class CloverAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.clover;
}

@Injectable()
export class SquareAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.square;
}

@Injectable()
export class ToastAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.toast;
}

// ==================== 3RD PARTY POS INTEGRATIONS ====================

/**
 * Lightspeed (Series) POS Adapter
 * Supports: Retail Series (R-Series) and Restaurant (L-Series)
 * API: REST API with OAuth2
 */
@Injectable()
export class LightspeedAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.lightspeed;
  private readonly apiLogger = new Logger(LightspeedAdapter.name);

  supportsInventorySync(): boolean {
    return true;
  }

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) {
      return { ok: false, message: "Missing accessToken or accountId" };
    }

    try {
      // Validate by calling the account endpoint
      const response = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}.json`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (response.ok) {
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const accountRecord = isRecord(dataRecord.Account) ? dataRecord.Account : {};
        return {
          ok: true,
          message: "Credentials validated",
          details: { accountName: toStringValue(accountRecord.name) },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) || "Failed to validate credentials" };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) return [];

    try {
      const response = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item.json?load_relations=all`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch products: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      const dataRecord = isRecord(data) ? data : {};
      const items = toRecordArray(dataRecord.Item);

      return items.flatMap((item) => {
        const externalId = toStringValue(item.itemID);
        const name = toStringValue(item.description);
        if (!externalId || !name) return [];

        const pricesRecord = isRecord(item.Prices) ? item.Prices : {};
        const priceEntry = toRecordArray(pricesRecord.ItemPrice)[0];
        const priceAmount = priceEntry ? toNumberValue(priceEntry.amount) : undefined;
        const categoryRecord = isRecord(item.Category) ? item.Category : {};

        return [
          {
            externalId,
            externalSku: toStringValue(item.customSku) ?? toStringValue(item.systemSku) ?? null,
            name,
            priceCents: Math.round((priceAmount ?? 0) * 100),
            category: toStringValue(categoryRecord.name) ?? null,
            barcode: toStringValue(item.upc) ?? null,
            metadata: {
              itemType: toStringValue(item.itemType),
              categoryId: toStringValue(item.categoryID),
            },
          },
        ];
      });
    } catch (error) {
      this.apiLogger.error("Failed to fetch Lightspeed products", error);
      return [];
    }
  }

  async fetchSales(config: IntegrationRecord, since: Date): Promise<ExternalSale[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) return [];

    try {
      const sinceStr = since.toISOString().split("T")[0];
      const response = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Sale.json?completeTime=%3E%3D,${sinceStr}&load_relations=SaleLines`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch sales: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      const dataRecord = isRecord(data) ? data : {};
      const sales = toRecordArray(dataRecord.Sale);

      return sales.flatMap((sale) => {
        const saleId = toStringValue(sale.saleID);
        const completedAt = toStringValue(sale.completeTime);
        if (!saleId || !completedAt) return [];

        const saleLinesRecord = isRecord(sale.SaleLines) ? sale.SaleLines : {};
        const lines = toRecordArray(saleLinesRecord.SaleLine);
        const paymentRecord = isRecord(sale.SalePayments) ? sale.SalePayments : {};
        const payment = toRecordArray(paymentRecord.SalePayment)[0];
        const paymentTypeRecord =
          payment && isRecord(payment.PaymentType) ? payment.PaymentType : {};
        const saleTypeRecord = isRecord(sale.SaleType) ? sale.SaleType : {};
        const totalCents = Math.round((toNumberValue(sale.calcTotal) ?? 0) * 100);

        return [
          {
            externalTransactionId: saleId,
            saleDate: new Date(completedAt),
            items: lines.flatMap((line) => {
              const externalProductId = toStringValue(line.itemID);
              if (!externalProductId) return [];
              const qty = toNumberValue(line.unitQuantity) ?? 1;
              return [
                {
                  externalProductId,
                  externalSku: toStringValue(line.customSku) ?? null,
                  qty,
                  priceCents: Math.round((toNumberValue(line.calcTotal) ?? 0) * 100),
                  discountCents: Math.round((toNumberValue(line.discountAmount) ?? 0) * 100),
                },
              ];
            }),
            totalCents,
            paymentMethod: toStringValue(paymentTypeRecord.name) ?? null,
            metadata: { saleType: toStringValue(saleTypeRecord.name) },
          },
        ];
      });
    } catch (error) {
      this.apiLogger.error("Failed to fetch Lightspeed sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      // First get the item to find its inventory component
      const itemResponse = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item/${update.externalId}.json?load_relations=ItemShops`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!itemResponse.ok) {
        return { success: false, error: `Item fetch failed: ${itemResponse.status}` };
      }

      const itemData: unknown = await itemResponse.json();
      const itemRecord = isRecord(itemData) ? itemData : {};
      const itemInfo = isRecord(itemRecord.Item) ? itemRecord.Item : {};
      const itemShops = isRecord(itemInfo.ItemShops) ? itemInfo.ItemShops : {};
      const shopEntry = toRecordArray(itemShops.ItemShop)[0];
      const shopId =
        update.externalLocationId || (shopEntry ? toStringValue(shopEntry.shopID) : undefined);

      if (!shopId) {
        return { success: false, error: "Could not determine shop location" };
      }

      // Update inventory quantity
      const updateResponse = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item/${update.externalId}.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ItemShops: {
              ItemShop: [
                {
                  shopID: shopId,
                  qoh: update.qtyOnHand,
                },
              ],
            },
          }),
        },
      );

      if (updateResponse.ok) {
        return { success: true, externalId: update.externalId, message: "Inventory updated" };
      }

      const errorText = await updateResponse.text();
      return { success: false, error: `Update failed: ${errorText}` };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const response = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item/${update.externalId}.json`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            Prices: {
              ItemPrice: [
                {
                  amount: (update.priceCents / 100).toFixed(2),
                  useType: "Default",
                },
              ],
            },
          }),
        },
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: `Price update failed: ${errorText}` };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const accountId = toStringValue(config.credentials.accountId);
    if (!accessToken || !accountId) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const method = product.externalId ? "PUT" : "POST";
      const url = product.externalId
        ? `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item/${product.externalId}.json`
        : `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item.json`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          description: product.name,
          customSku: product.sku,
          upc: product.barcode,
          Prices: {
            ItemPrice: [
              {
                amount: (product.priceCents / 100).toFixed(2),
                useType: "Default",
              },
            ],
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          externalId: data.Item?.itemID || product.externalId,
          message: product.externalId ? "Product updated" : "Product created",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
}

/**
 * Shopify POS Adapter
 * Uses Shopify Admin API for product/inventory management
 * API: GraphQL Admin API
 */
@Injectable()
export class ShopifyPosAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.shopify;
  private readonly apiLogger = new Logger(ShopifyPosAdapter.name);

  supportsInventorySync(): boolean {
    return true;
  }

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    if (!accessToken || !shopDomain) {
      return { ok: false, message: "Missing accessToken or shopDomain" };
    }

    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const shopRecord = isRecord(dataRecord.shop) ? dataRecord.shop : {};
        return {
          ok: true,
          message: "Credentials validated",
          details: { shopName: toStringValue(shopRecord.name) },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    if (!accessToken || !shopDomain) return [];

    try {
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json?limit=250`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch products: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      const dataRecord = isRecord(data) ? data : {};
      const products: ExternalProduct[] = [];
      const productRecords = toRecordArray(dataRecord.products);

      for (const product of productRecords) {
        const variants = toRecordArray(product.variants);
        const productTitle =
          toStringValue(product.title) ?? toStringValue(product.id) ?? "Untitled product";
        const productType = toStringValue(product.product_type) ?? null;

        for (const variant of variants) {
          const variantId = toStringValue(variant.id);
          if (!variantId) continue;
          const variantTitle = toStringValue(variant.title);
          const name =
            variants.length > 1 && variantTitle
              ? `${productTitle} - ${variantTitle}`
              : productTitle;
          const priceCents = Math.round((toNumberValue(variant.price) ?? 0) * 100);

          products.push({
            externalId: variantId,
            externalSku: toStringValue(variant.sku) ?? null,
            name,
            priceCents,
            category: productType,
            barcode: toStringValue(variant.barcode) ?? null,
            metadata: {
              productId: toStringValue(product.id),
              inventoryItemId: toStringValue(variant.inventory_item_id),
            },
          });
        }
      }

      return products;
    } catch (error) {
      this.apiLogger.error("Failed to fetch Shopify products", error);
      return [];
    }
  }

  async fetchSales(config: IntegrationRecord, since: Date): Promise<ExternalSale[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    if (!accessToken || !shopDomain) return [];

    try {
      const sinceStr = since.toISOString();
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/orders.json?created_at_min=${sinceStr}&status=any`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch orders: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      const dataRecord = isRecord(data) ? data : {};
      const orders = toRecordArray(dataRecord.orders);

      return orders
        .filter((order) => toStringValue(order.source_name) === "pos")
        .flatMap((order) => {
          const orderId = toStringValue(order.id);
          const createdAt = toStringValue(order.created_at);
          if (!orderId || !createdAt) return [];

          const lineItems = toRecordArray(order.line_items);
          const paymentGateways = Array.isArray(order.payment_gateway_names)
            ? order.payment_gateway_names
            : [];
          const paymentMethod = toStringValue(paymentGateways[0]) ?? null;

          return [
            {
              externalTransactionId: orderId,
              saleDate: new Date(createdAt),
              items: lineItems.flatMap((item) => {
                const variantId = toStringValue(item.variant_id);
                const productId = toStringValue(item.product_id);
                const externalProductId = variantId ?? productId;
                if (!externalProductId) return [];
                const discountAllocations = toRecordArray(item.discount_allocations);
                const discountTotal = discountAllocations.reduce(
                  (sum, allocation) => sum + (toNumberValue(allocation.amount) ?? 0),
                  0,
                );
                return [
                  {
                    externalProductId,
                    externalSku: toStringValue(item.sku) ?? null,
                    qty: toNumberValue(item.quantity) ?? 0,
                    priceCents: Math.round((toNumberValue(item.price) ?? 0) * 100),
                    discountCents: Math.round(discountTotal * 100),
                  },
                ];
              }),
              totalCents: Math.round((toNumberValue(order.total_price) ?? 0) * 100),
              paymentMethod,
              metadata: { orderNumber: toStringValue(order.order_number) },
            },
          ];
        });
    } catch (error) {
      this.apiLogger.error("Failed to fetch Shopify sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    const locationId = toStringValue(config.credentials.locationId);
    if (!accessToken || !shopDomain) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      // First get the inventory item ID for the variant
      const variantResponse = await fetch(
        `https://${shopDomain}/admin/api/2024-01/variants/${update.externalId}.json`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            Accept: "application/json",
          },
        },
      );

      if (!variantResponse.ok) {
        return { success: false, error: `Variant fetch failed: ${variantResponse.status}` };
      }

      const variantData: unknown = await variantResponse.json();
      const variantRecord = isRecord(variantData) ? variantData : {};
      const variantDetails = isRecord(variantRecord.variant) ? variantRecord.variant : {};
      const inventoryItemId = toStringValue(variantDetails.inventory_item_id);

      if (!inventoryItemId) {
        return { success: false, error: "No inventory_item_id found" };
      }

      const targetLocationId = update.externalLocationId || locationId;
      if (!targetLocationId) {
        return { success: false, error: "No location ID specified" };
      }

      // Set inventory level
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/inventory_levels/set.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            location_id: targetLocationId,
            inventory_item_id: inventoryItemId,
            available: update.qtyOnHand,
          }),
        },
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Inventory updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    if (!accessToken || !shopDomain) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const body: { variant: { id: string; price: string; compare_at_price?: string } } = {
        variant: {
          id: update.externalId,
          price: (update.priceCents / 100).toFixed(2),
        },
      };

      // If this is a markdown, set compare_at_price
      if (update.isMarkdown && update.originalPriceCents) {
        body.variant.compare_at_price = (update.originalPriceCents / 100).toFixed(2);
      }

      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/variants/${update.externalId}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const shopDomain = toStringValue(config.credentials.shopDomain);
    if (!accessToken || !shopDomain) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      if (product.externalId) {
        // Update existing variant
        const response = await fetch(
          `https://${shopDomain}/admin/api/2024-01/variants/${product.externalId}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              variant: {
                id: product.externalId,
                sku: product.sku,
                barcode: product.barcode,
                price: (product.priceCents / 100).toFixed(2),
              },
            }),
          },
        );

        if (response.ok) {
          return { success: true, externalId: product.externalId, message: "Product updated" };
        }
        const errorText = await response.text();
        return { success: false, error: errorText };
      }

      // Create new product
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/products.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          product: {
            title: product.name,
            product_type: product.category,
            variants: [
              {
                sku: product.sku,
                barcode: product.barcode,
                price: (product.priceCents / 100).toFixed(2),
                inventory_management: "shopify",
              },
            ],
          },
        }),
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const productRecord = isRecord(dataRecord.product) ? dataRecord.product : {};
        const variants = toRecordArray(productRecord.variants);
        const variantId = variants[0] ? toStringValue(variants[0].id) : undefined;
        return {
          success: true,
          externalId: variantId?.toString() || null,
          message: "Product created",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
}

/**
 * Vend (Lightspeed X-Series) POS Adapter
 * API: REST API v2.0
 */
@Injectable()
export class VendAdapter extends BasePosProviderAdapter {
  readonly provider = PosProviderType.vend;
  private readonly apiLogger = new Logger(VendAdapter.name);

  supportsInventorySync(): boolean {
    return true;
  }

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) {
      return { ok: false, message: "Missing accessToken or domainPrefix" };
    }

    try {
      const response = await fetch(`https://${domainPrefix}.vendhq.com/api/2.0/retailers`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const dataDetails = isRecord(dataRecord.data) ? dataRecord.data : {};
        return {
          ok: true,
          message: "Credentials validated",
          details: { retailerName: toStringValue(dataDetails.name) },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error) };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) return [];

    try {
      const products: ExternalProduct[] = [];
      let version = 0;

      // Vend uses pagination with version numbers
      while (true) {
        const response = await fetch(
          `https://${domainPrefix}.vendhq.com/api/2.0/products?after=${version}&page_size=100`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) break;

        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const items = toRecordArray(dataRecord.data);

        if (items.length === 0) break;

        for (const item of items) {
          const externalId = toStringValue(item.id);
          const name = toStringValue(item.name);
          if (!externalId || !name) {
            continue;
          }
          const productType = isRecord(item.product_type) ? item.product_type : {};
          products.push({
            externalId,
            externalSku: toStringValue(item.sku) ?? null,
            name,
            priceCents: Math.round((toNumberValue(item.price_including_tax) ?? 0) * 100),
            category: toStringValue(productType.name) ?? null,
            barcode: toStringValue(item.supplier_code) ?? null,
            metadata: {
              variantParentId: toStringValue(item.variant_parent_id),
              supplierId: toStringValue(item.supplier_id),
            },
          });
        }

        const versionRecord = isRecord(dataRecord.version) ? dataRecord.version : {};
        const maxVersion = toNumberValue(versionRecord.max) ?? 0;
        version = maxVersion;
        if (!maxVersion) break;
      }

      return products;
    } catch (error) {
      this.apiLogger.error("Failed to fetch Vend products", error);
      return [];
    }
  }

  async fetchSales(config: IntegrationRecord, since: Date): Promise<ExternalSale[]> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) return [];

    try {
      const sinceStr = since.toISOString();
      const response = await fetch(
        `https://${domainPrefix}.vendhq.com/api/2.0/sales?status=CLOSED&date_from=${sinceStr}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch sales: ${response.status}`);
        return [];
      }

      const data: unknown = await response.json();
      const dataRecord = isRecord(data) ? data : {};
      const sales = toRecordArray(dataRecord.data);

      return sales.flatMap((sale) => {
        const saleId = toStringValue(sale.id);
        const saleDate = toStringValue(sale.sale_date);
        if (!saleId || !saleDate) return [];
        const lineItems = toRecordArray(sale.line_items);
        const payments = toRecordArray(sale.payments);
        const paymentMethod = payments[0] ? toStringValue(payments[0].payment_type_id) : null;

        return [
          {
            externalTransactionId: saleId,
            saleDate: new Date(saleDate),
            items: lineItems.flatMap((item) => {
              const productId = toStringValue(item.product_id);
              if (!productId) return [];
              return [
                {
                  externalProductId: productId,
                  externalSku: toStringValue(item.sku) ?? null,
                  qty: toNumberValue(item.quantity) ?? 0,
                  priceCents: Math.round((toNumberValue(item.price_total) ?? 0) * 100),
                  discountCents: Math.round((toNumberValue(item.discount_total) ?? 0) * 100),
                },
              ];
            }),
            totalCents: Math.round((toNumberValue(sale.total_price) ?? 0) * 100),
            paymentMethod,
            metadata: { invoiceNumber: toStringValue(sale.invoice_number) },
          },
        ];
      });
    } catch (error) {
      this.apiLogger.error("Failed to fetch Vend sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      // Vend requires knowing the outlet_id
      const outletId =
        update.externalLocationId || toStringValue(config.credentials.defaultOutletId);
      if (!outletId) {
        return { success: false, error: "No outlet ID specified" };
      }

      const response = await fetch(`https://${domainPrefix}.vendhq.com/api/2.0/consignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          outlet_id: outletId,
          type: "STOCKTAKE",
          status: "STOCKTAKE_COMPLETE",
          consignment_date: new Date().toISOString(),
          name: `Inventory Update - ${new Date().toISOString()}`,
          products: [
            {
              product_id: update.externalId,
              count: update.qtyOnHand,
            },
          ],
        }),
      });

      if (response.ok) {
        return {
          success: true,
          externalId: update.externalId,
          message: "Inventory updated via stocktake",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const response = await fetch(
        `https://${domainPrefix}.vendhq.com/api/2.0/products/${update.externalId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            price_including_tax: update.priceCents / 100,
          }),
        },
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush,
  ): Promise<ExternalSyncResult> {
    const accessToken = toStringValue(config.credentials.accessToken);
    const domainPrefix = toStringValue(config.credentials.domainPrefix);
    if (!accessToken || !domainPrefix) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const method = product.externalId ? "PUT" : "POST";
      const url = product.externalId
        ? `https://${domainPrefix}.vendhq.com/api/2.0/products/${product.externalId}`
        : `https://${domainPrefix}.vendhq.com/api/2.0/products`;

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: product.name,
          sku: product.sku,
          supplier_code: product.barcode,
          price_including_tax: product.priceCents / 100,
        }),
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const dataDetails = isRecord(dataRecord.data) ? dataRecord.data : {};
        return {
          success: true,
          externalId: toStringValue(dataDetails.id) ?? product.externalId,
          message: product.externalId ? "Product updated" : "Product created",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
}
