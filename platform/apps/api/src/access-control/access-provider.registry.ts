import { Injectable } from "@nestjs/common";
import { AccessProviderType } from "@prisma/client";
import { BrivoAdapter, CloudKeyAdapter, KisiAdapter } from "./access-provider.adapters";
import { AccessProviderAdapter } from "./access-provider.types";

@Injectable()
export class AccessProviderRegistry {
  private readonly adapters: Map<AccessProviderType, AccessProviderAdapter>;

  constructor(
    kisi: KisiAdapter,
    brivo: BrivoAdapter,
    cloudKey: CloudKeyAdapter
  ) {
    this.adapters = new Map([
      [kisi.provider, kisi],
      [brivo.provider, brivo],
      [cloudKey.provider, cloudKey]
    ]);
  }

  getAdapter(provider: AccessProviderType): AccessProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  supported(): AccessProviderType[] {
    return Array.from(this.adapters.keys());
  }
}
