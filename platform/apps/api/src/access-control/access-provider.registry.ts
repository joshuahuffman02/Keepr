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
    this.adapters = new Map();
    if (kisi?.provider) this.adapters.set(kisi.provider, kisi);
    if (brivo?.provider) this.adapters.set(brivo.provider, brivo);
    if (cloudKey?.provider) this.adapters.set(cloudKey.provider, cloudKey);
  }

  getAdapter(provider: AccessProviderType): AccessProviderAdapter | null {
    return this.adapters.get(provider) ?? null;
  }

  supported(): AccessProviderType[] {
    return Array.from(this.adapters.keys());
  }
}
