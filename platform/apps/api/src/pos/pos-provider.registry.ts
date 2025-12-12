import { Injectable } from "@nestjs/common";
import { PosProviderType } from "@prisma/client";
import { CloverAdapter, SquareAdapter, ToastAdapter } from "./pos-provider.adapters";
import { PosProviderAdapter } from "./pos-provider.types";

@Injectable()
export class PosProviderRegistry {
  private readonly adapters: Map<PosProviderType, PosProviderAdapter>;

  constructor(clover: CloverAdapter, square: SquareAdapter, toast: ToastAdapter) {
    this.adapters = new Map([
      [clover.provider, clover],
      [square.provider, square],
      [toast.provider, toast]
    ]);
  }

  getAdapter(provider: PosProviderType): PosProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  supportedProviders(): PosProviderType[] {
    return Array.from(this.adapters.keys());
  }
}
