import { Injectable, Logger } from "@nestjs/common";
import crypto from "crypto";
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

const PosProviderType = {
  clover: "clover",
  square: "square",
  toast: "toast",
  lightspeed: "lightspeed",
  shopify: "shopify",
  vend: "vend",
} as const;
type PosProviderType = (typeof PosProviderType)[keyof typeof PosProviderType];

const PosSyncStatus = {
  running: "running",
  completed: "completed",
  failed: "failed"
} as const;
type PosSyncStatus = (typeof PosSyncStatus)[keyof typeof PosSyncStatus];

const PosSyncTarget = {
  catalog: "catalog",
  tenders: "tenders",
  orders: "orders"
} as const;
type PosSyncTarget = (typeof PosSyncTarget)[keyof typeof PosSyncTarget];

@Injectable()
abstract class BasePosProviderAdapter implements PosProviderAdapter {
  abstract readonly provider: PosProviderType;
  protected readonly logger = new Logger(BasePosProviderAdapter.name);

  async validateCredentials(config: IntegrationRecord): Promise<ProviderValidationResult> {
    const hasCredentials = Boolean(config.credentials && Object.keys(config.credentials).length);
    return {
      ok: hasCredentials,
      message: hasCredentials ? "Credentials present (stubbed validation)" : "Missing credentials"
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

  async processPayment(config: IntegrationRecord, request: ProviderPaymentRequest): Promise<ProviderPaymentResult | null> {
    this.logger.log(`Routing payment via ${config.provider} (stub)`);
    return {
      status: "pending",
      processorIds: {
        provider: config.provider,
        idempotencyKey: request.idempotencyKey
      },
      raw: { note: "stubbed payment response" }
    };
  }

  verifyWebhookSignature(input: ProviderWebhookVerification): boolean {
    if (!input.secret) return true;
    const digest = crypto.createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
    return digest === input.signature;
  }

  async handlePaymentWebhook(input: { integration: IntegrationRecord; body: any; headers?: Record<string, any> }): Promise<ProviderWebhookResult> {
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
    const { accessToken, accountId } = config.credentials || {};
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
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          message: "Credentials validated",
          details: { accountName: data.Account?.name },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error: any) {
      return { ok: false, message: error.message || "Failed to validate credentials" };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const { accessToken, accountId } = config.credentials || {};
    if (!accessToken || !accountId) return [];

    try {
      const response = await fetch(
        `https://api.lightspeedapp.com/API/V3/Account/${accountId}/Item.json?load_relations=all`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch products: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const items = Array.isArray(data.Item) ? data.Item : [data.Item].filter(Boolean);

      return items.map((item: any) => ({
        externalId: item.itemID,
        externalSku: item.customSku || item.systemSku || null,
        name: item.description,
        priceCents: Math.round(parseFloat(item.Prices?.ItemPrice?.[0]?.amount || "0") * 100),
        category: item.Category?.name || null,
        barcode: item.upc || null,
        metadata: {
          itemType: item.itemType,
          categoryId: item.categoryID,
        },
      }));
    } catch (error) {
      this.apiLogger.error("Failed to fetch Lightspeed products", error);
      return [];
    }
  }

  async fetchSales(config: IntegrationRecord, since: Date): Promise<ExternalSale[]> {
    const { accessToken, accountId } = config.credentials || {};
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
        }
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch sales: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const sales = Array.isArray(data.Sale) ? data.Sale : [data.Sale].filter(Boolean);

      return sales.map((sale: any) => {
        const lines = Array.isArray(sale.SaleLines?.SaleLine)
          ? sale.SaleLines.SaleLine
          : [sale.SaleLines?.SaleLine].filter(Boolean);

        return {
          externalTransactionId: sale.saleID,
          saleDate: new Date(sale.completeTime),
          items: lines.map((line: any) => ({
            externalProductId: line.itemID,
            externalSku: line.customSku || null,
            qty: parseInt(line.unitQuantity, 10) || 1,
            priceCents: Math.round(parseFloat(line.calcTotal || "0") * 100),
            discountCents: Math.round(parseFloat(line.discountAmount || "0") * 100),
          })),
          totalCents: Math.round(parseFloat(sale.calcTotal || "0") * 100),
          paymentMethod: sale.SalePayments?.SalePayment?.[0]?.PaymentType?.name || null,
          metadata: { saleType: sale.SaleType?.name },
        };
      });
    } catch (error) {
      this.apiLogger.error("Failed to fetch Lightspeed sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, accountId } = config.credentials || {};
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
        }
      );

      if (!itemResponse.ok) {
        return { success: false, error: `Item fetch failed: ${itemResponse.status}` };
      }

      const itemData = await itemResponse.json();
      const shopId = update.externalLocationId || itemData.Item?.ItemShops?.ItemShop?.[0]?.shopID;

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
              ItemShop: [{
                shopID: shopId,
                qoh: update.qtyOnHand,
              }],
            },
          }),
        }
      );

      if (updateResponse.ok) {
        return { success: true, externalId: update.externalId, message: "Inventory updated" };
      }

      const errorText = await updateResponse.text();
      return { success: false, error: `Update failed: ${errorText}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, accountId } = config.credentials || {};
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
              ItemPrice: [{
                amount: (update.priceCents / 100).toFixed(2),
                useType: "Default",
              }],
            },
          }),
        }
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: `Price update failed: ${errorText}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush
  ): Promise<ExternalSyncResult> {
    const { accessToken, accountId } = config.credentials || {};
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
            ItemPrice: [{
              amount: (product.priceCents / 100).toFixed(2),
              useType: "Default",
            }],
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
    } catch (error: any) {
      return { success: false, error: error.message };
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
    const { accessToken, shopDomain } = config.credentials || {};
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
        const data = await response.json();
        return {
          ok: true,
          message: "Credentials validated",
          details: { shopName: data.shop?.name },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error: any) {
      return { ok: false, message: error.message };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const { accessToken, shopDomain } = config.credentials || {};
    if (!accessToken || !shopDomain) return [];

    try {
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json?limit=250`,
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch products: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const products: ExternalProduct[] = [];

      for (const product of data.products || []) {
        // Each variant becomes a product
        for (const variant of product.variants || []) {
          products.push({
            externalId: variant.id.toString(),
            externalSku: variant.sku || null,
            name: product.variants.length > 1
              ? `${product.title} - ${variant.title}`
              : product.title,
            priceCents: Math.round(parseFloat(variant.price || "0") * 100),
            category: product.product_type || null,
            barcode: variant.barcode || null,
            metadata: {
              productId: product.id,
              inventoryItemId: variant.inventory_item_id,
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
    const { accessToken, shopDomain } = config.credentials || {};
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
        }
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch orders: ${response.status}`);
        return [];
      }

      const data = await response.json();

      return (data.orders || [])
        .filter((order: any) => order.source_name === "pos")
        .map((order: any) => ({
          externalTransactionId: order.id.toString(),
          saleDate: new Date(order.created_at),
          items: (order.line_items || []).map((item: any) => ({
            externalProductId: item.variant_id?.toString() || item.product_id?.toString(),
            externalSku: item.sku || null,
            qty: item.quantity,
            priceCents: Math.round(parseFloat(item.price || "0") * 100),
            discountCents: Math.round(
              (item.discount_allocations || []).reduce(
                (sum: number, d: any) => sum + parseFloat(d.amount || "0"),
                0
              ) * 100
            ),
          })),
          totalCents: Math.round(parseFloat(order.total_price || "0") * 100),
          paymentMethod: order.payment_gateway_names?.[0] || null,
          metadata: { orderNumber: order.order_number },
        }));
    } catch (error) {
      this.apiLogger.error("Failed to fetch Shopify sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, shopDomain, locationId } = config.credentials || {};
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
        }
      );

      if (!variantResponse.ok) {
        return { success: false, error: `Variant fetch failed: ${variantResponse.status}` };
      }

      const variantData = await variantResponse.json();
      const inventoryItemId = variantData.variant?.inventory_item_id;

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
        }
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Inventory updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, shopDomain } = config.credentials || {};
    if (!accessToken || !shopDomain) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      const body: any = {
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
        }
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush
  ): Promise<ExternalSyncResult> {
    const { accessToken, shopDomain } = config.credentials || {};
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
          }
        );

        if (response.ok) {
          return { success: true, externalId: product.externalId, message: "Product updated" };
        }
        const errorText = await response.text();
        return { success: false, error: errorText };
      }

      // Create new product
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/products.json`,
        {
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
              variants: [{
                sku: product.sku,
                barcode: product.barcode,
                price: (product.priceCents / 100).toFixed(2),
                inventory_management: "shopify",
              }],
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const variantId = data.product?.variants?.[0]?.id;
        return {
          success: true,
          externalId: variantId?.toString() || null,
          message: "Product created",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
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
    const { accessToken, domainPrefix } = config.credentials || {};
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
        const data = await response.json();
        return {
          ok: true,
          message: "Credentials validated",
          details: { retailerName: data.data?.name },
        };
      }

      return { ok: false, message: `API returned ${response.status}` };
    } catch (error: any) {
      return { ok: false, message: error.message };
    }
  }

  async fetchProducts(config: IntegrationRecord): Promise<ExternalProduct[]> {
    const { accessToken, domainPrefix } = config.credentials || {};
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
          }
        );

        if (!response.ok) break;

        const data = await response.json();
        const items = data.data || [];

        if (items.length === 0) break;

        for (const item of items) {
          products.push({
            externalId: item.id,
            externalSku: item.sku || null,
            name: item.name,
            priceCents: Math.round((item.price_including_tax || 0) * 100),
            category: item.product_type?.name || null,
            barcode: item.supplier_code || null,
            metadata: {
              variantParentId: item.variant_parent_id,
              supplierId: item.supplier_id,
            },
          });
        }

        version = data.version?.max || 0;
        if (!data.version?.max) break;
      }

      return products;
    } catch (error) {
      this.apiLogger.error("Failed to fetch Vend products", error);
      return [];
    }
  }

  async fetchSales(config: IntegrationRecord, since: Date): Promise<ExternalSale[]> {
    const { accessToken, domainPrefix } = config.credentials || {};
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
        }
      );

      if (!response.ok) {
        this.apiLogger.error(`Failed to fetch sales: ${response.status}`);
        return [];
      }

      const data = await response.json();

      return (data.data || []).map((sale: any) => ({
        externalTransactionId: sale.id,
        saleDate: new Date(sale.sale_date),
        items: (sale.line_items || []).map((item: any) => ({
          externalProductId: item.product_id,
          externalSku: item.sku || null,
          qty: item.quantity,
          priceCents: Math.round((item.price_total || 0) * 100),
          discountCents: Math.round((item.discount_total || 0) * 100),
        })),
        totalCents: Math.round((sale.total_price || 0) * 100),
        paymentMethod: sale.payments?.[0]?.payment_type_id || null,
        metadata: { invoiceNumber: sale.invoice_number },
      }));
    } catch (error) {
      this.apiLogger.error("Failed to fetch Vend sales", error);
      return [];
    }
  }

  async pushInventoryUpdate(
    config: IntegrationRecord,
    update: ExternalInventoryUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, domainPrefix } = config.credentials || {};
    if (!accessToken || !domainPrefix) {
      return { success: false, error: "Missing credentials" };
    }

    try {
      // Vend requires knowing the outlet_id
      const outletId = update.externalLocationId || config.credentials.defaultOutletId;
      if (!outletId) {
        return { success: false, error: "No outlet ID specified" };
      }

      const response = await fetch(
        `https://${domainPrefix}.vendhq.com/api/2.0/consignments`,
        {
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
            products: [{
              product_id: update.externalId,
              count: update.qtyOnHand,
            }],
          }),
        }
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Inventory updated via stocktake" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushPriceUpdate(
    config: IntegrationRecord,
    update: ExternalPriceUpdate
  ): Promise<ExternalSyncResult> {
    const { accessToken, domainPrefix } = config.credentials || {};
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
        }
      );

      if (response.ok) {
        return { success: true, externalId: update.externalId, message: "Price updated" };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async pushProduct(
    config: IntegrationRecord,
    product: ExternalProductPush
  ): Promise<ExternalSyncResult> {
    const { accessToken, domainPrefix } = config.credentials || {};
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
        const data = await response.json();
        return {
          success: true,
          externalId: data.data?.id || product.externalId,
          message: product.externalId ? "Product updated" : "Product created",
        };
      }

      const errorText = await response.text();
      return { success: false, error: errorText };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
