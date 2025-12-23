import { Injectable } from "@nestjs/common";
import { PosProviderType } from "@prisma/client";
import {
  CloverAdapter,
  SquareAdapter,
  ToastAdapter,
  LightspeedAdapter,
  ShopifyPosAdapter,
  VendAdapter,
} from "./pos-provider.adapters";
import { PosProviderAdapter } from "./pos-provider.types";

@Injectable()
export class PosProviderRegistry {
  private readonly adapters: Map<PosProviderType, PosProviderAdapter>;

  constructor(
    clover: CloverAdapter,
    square: SquareAdapter,
    toast: ToastAdapter,
    lightspeed: LightspeedAdapter,
    shopify: ShopifyPosAdapter,
    vend: VendAdapter
  ) {
    this.adapters = new Map();
    if (clover?.provider) this.adapters.set(clover.provider, clover);
    if (square?.provider) this.adapters.set(square.provider, square);
    if (toast?.provider) this.adapters.set(toast.provider, toast);
    if (lightspeed?.provider) this.adapters.set(lightspeed.provider, lightspeed);
    if (shopify?.provider) this.adapters.set(shopify.provider, shopify);
    if (vend?.provider) this.adapters.set(vend.provider, vend);
  }

  getAdapter(provider: PosProviderType): PosProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  supportedProviders(): PosProviderType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get adapters that support inventory sync capabilities.
   */
  getInventorySyncAdapters(): PosProviderAdapter[] {
    return Array.from(this.adapters.values()).filter(
      (adapter) => adapter.supportsInventorySync?.()
    );
  }
}
