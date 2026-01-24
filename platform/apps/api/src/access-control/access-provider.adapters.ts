import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { AccessGrantStatus, AccessProviderType } from "@prisma/client";
import {
  AccessIntegrationConfig,
  AccessProviderAdapter,
  GrantRequest,
  RevokeRequest,
  WebhookVerificationInput,
} from "./access-provider.types";

abstract class BaseAdapter implements AccessProviderAdapter {
  abstract readonly provider: AccessProviderType;

  protected hmacValid(
    secret: string | null | undefined,
    payload: string,
    signature?: string | null,
  ) {
    if (!secret || !signature) return false;
    const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return digest === signature;
  }

  async provisionAccess(
    _integration: AccessIntegrationConfig,
    request: GrantRequest,
  ): Promise<{ providerAccessId?: string | null; status: AccessGrantStatus }> {
    return {
      providerAccessId: `${this.provider}-${request.reservationId}`,
      status: AccessGrantStatus.active,
    };
  }

  async revokeAccess(
    _integration: AccessIntegrationConfig,
    _request: RevokeRequest,
  ): Promise<{ status: AccessGrantStatus; message?: string | null }> {
    return { status: AccessGrantStatus.revoked };
  }

  verifyWebhookSignature(input: WebhookVerificationInput): boolean {
    return this.hmacValid(input.secret, input.rawBody, input.signature);
  }
}

@Injectable()
export class KisiAdapter extends BaseAdapter {
  readonly provider = AccessProviderType.kisi;
}

@Injectable()
export class BrivoAdapter extends BaseAdapter {
  readonly provider = AccessProviderType.brivo;
}

@Injectable()
export class CloudKeyAdapter extends BaseAdapter {
  readonly provider = AccessProviderType.cloudkey;
}
