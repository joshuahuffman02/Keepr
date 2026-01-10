import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AccessCredentialType, AccessGrantStatus, AccessProviderType, IdempotencyStatus } from "@prisma/client";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { IdempotencyService } from "../payments/idempotency.service";
import { AccessProviderRegistry } from "./access-provider.registry";
import { GrantAccessDto, RevokeAccessDto } from "./dto/access-grant.dto";
import { UpsertVehicleDto } from "./dto/vehicle.dto";
import { AccessIntegrationConfig } from "./access-provider.types";
import { UpsertAccessIntegrationDto } from "./dto/access-integration.dto";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AccessControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AccessProviderRegistry,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService
  ) {}

  private grantsRepo() {
    return (this.prisma as any).accessGrant;
  }

  private credentialsRepo() {
    return (this.prisma as any).accessCredential;
  }

  private vehiclesRepo() {
    return (this.prisma as any).vehicle;
  }

  private integrationsRepo() {
    return (this.prisma as any).accessIntegration;
  }

  private toDate(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  async getAccessStatus(reservationId: string, campgroundId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, campgroundId: true }
    });
    if (!reservation || reservation.campgroundId !== campgroundId) {
      throw new NotFoundException("Reservation not found");
    }

    const [vehicle, grants] = await Promise.all([
      this.vehiclesRepo()?.findFirst?.({ where: { reservationId, campgroundId } }),
      this.grantsRepo()?.findMany?.({
        where: { reservationId, campgroundId },
        orderBy: { createdAt: "desc" }
      })
    ]);
    return { vehicle, grants: grants ?? [] };
  }

  async upsertVehicle(reservationId: string, dto: UpsertVehicleDto, campgroundId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, campgroundId: true, guestId: true }
    });
    if (!reservation || reservation.campgroundId !== campgroundId) {
      throw new NotFoundException("Reservation not found");
    }

    const repo = this.vehiclesRepo();
    const existing = await repo.findFirst({ where: { reservationId, campgroundId } });

    const vehicle = existing
      ? await repo.update({
        where: { id: existing.id },
        data: {
          plate: dto.plate ?? existing.plate,
          state: dto.state ?? existing.state,
          rigType: dto.rigType ?? existing.rigType,
          rigLength: dto.rigLength ?? existing.rigLength,
          description: dto.description ?? existing.description
        }
      })
      : await repo.create({
        data: {
          campgroundId: reservation.campgroundId,
          reservationId,
          guestId: reservation.guestId,
          plate: dto.plate,
          state: dto.state,
          rigType: dto.rigType,
          rigLength: dto.rigLength,
          description: dto.description
        }
      });

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        vehiclePlate: dto.plate ?? vehicle.plate ?? null,
        vehicleState: dto.state ?? vehicle.state ?? null,
        rigType: dto.rigType ?? vehicle.rigType ?? null,
        rigLength: dto.rigLength ?? vehicle.rigLength ?? null
      }
    });

    return vehicle;
  }

  private async getIntegration(campgroundId: string, provider: AccessProviderType): Promise<AccessIntegrationConfig> {
    const record = await this.integrationsRepo()?.findFirst?.({
      where: { campgroundId, provider }
    });
    if (!record) {
      throw new NotFoundException(`Access provider ${provider} not configured`);
    }
    return record as AccessIntegrationConfig;
  }

  private maskSecret(value?: string | null) {
    if (!value) return null;
    if (value.length <= 4) return "*".repeat(Math.max(0, value.length - 1)) + value.slice(-1);
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  }

  private hashSecret(value?: string | null) {
    if (!value) return null;
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private async ensureCredential(options: {
    campgroundId: string;
    reservationId: string;
    provider: AccessProviderType;
    integrationId?: string | null;
    vehicleId?: string | null;
    credentialType?: AccessCredentialType;
    credentialValue?: string | null;
  }) {
    const existing = await this.credentialsRepo().findFirst({
      where: {
        campgroundId: options.campgroundId,
        reservationId: options.reservationId,
        provider: options.provider
      }
    });

    if (existing) return existing;

    return this.credentialsRepo().create({
      data: {
        campgroundId: options.campgroundId,
        reservationId: options.reservationId,
        vehicleId: options.vehicleId ?? null,
        integrationId: options.integrationId ?? null,
        provider: options.provider,
        type: options.credentialType ?? AccessCredentialType.mobile,
        maskedValue: this.maskSecret(options.credentialValue),
        secretHash: this.hashSecret(options.credentialValue),
        status: AccessGrantStatus.pending
      }
    });
  }

  async grantAccess(reservationId: string, dto: GrantAccessDto, campgroundId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Guest: true, site: true }
    });
    if (!reservation || reservation.campgroundId !== campgroundId) {
      throw new NotFoundException("Reservation not found");
    }
    if (["cancelled", "checked_out"].includes(reservation.status)) {
      throw new ConflictException("Access cannot be granted for cancelled or checked out reservations");
    }

    const idempotencyKey = dto.idempotencyKey || `access-grant:${dto.provider}:${reservationId}`;
    const idemRecord = await this.idempotency.start(idempotencyKey, dto, campgroundId, {
      endpoint: "access/grant",
      requestBody: dto,
      sequence: dto.idempotencyKey ?? null
    });
    if (idemRecord?.status === IdempotencyStatus.succeeded && idemRecord.responseJson) {
      return idemRecord.responseJson;
    }

    const adapter = this.registry.getAdapter(dto.provider);
    if (!adapter) {
      await this.idempotency.fail(idempotencyKey);
      throw new BadRequestException("Access provider not supported");
    }

    const integration = await this.getIntegration(campgroundId, dto.provider);
    const vehicle = await this.vehiclesRepo().findFirst({ where: { reservationId, campgroundId } });
    const credential = await this.ensureCredential({
      campgroundId,
      reservationId,
      provider: dto.provider,
      integrationId: integration.id,
      vehicleId: vehicle?.id ?? null,
      credentialType: dto.credentialType,
      credentialValue: dto.credentialValue ?? null
    });

    const grant = await this.grantsRepo().upsert({
      where: { reservationId_provider: { reservationId, provider: dto.provider } },
      create: {
        reservationId,
        campgroundId,
        siteId: reservation.siteId ?? null,
        vehicleId: vehicle?.id ?? null,
        credentialId: credential?.id ?? null,
        integrationId: integration.id,
        provider: dto.provider,
        startsAt: this.toDate(dto.startsAt),
        endsAt: this.toDate(dto.endsAt),
        status: AccessGrantStatus.pending,
        idempotencyKey
      },
      update: {
        siteId: reservation.siteId ?? undefined,
        vehicleId: vehicle?.id ?? undefined,
        credentialId: credential?.id ?? undefined,
        startsAt: this.toDate(dto.startsAt) ?? undefined,
        endsAt: this.toDate(dto.endsAt) ?? undefined,
        idempotencyKey
      }
    });

    try {
      const result = await adapter.provisionAccess(integration, {
        reservationId,
        siteId: reservation.siteId,
        guestName: reservation.guest
          ? `${reservation.guest.primaryFirstName} ${reservation.guest.primaryLastName}`
          : undefined,
        vehiclePlate: vehicle?.plate ?? reservation.vehiclePlate ?? dto.credentialValue ?? undefined,
        rigLength: reservation.rigLength ?? undefined,
        rigType: reservation.rigType ?? undefined,
        credentialType: dto.credentialType,
        credentialValue: dto.credentialValue,
        startsAt: this.toDate(dto.startsAt),
        endsAt: this.toDate(dto.endsAt),
        idempotencyKey
      });

      const updated = await this.grantsRepo().update({
        where: { id: grant.id },
        data: {
          providerAccessId: result.providerAccessId ?? grant.providerAccessId,
          status: result.status ?? AccessGrantStatus.active,
          lastSyncAt: new Date()
        }
      });

      const response = { grant: updated };
      await this.idempotency.complete(idempotencyKey, response);
      await this.audit.record({
        campgroundId,
        actorId: (dto as any).actorId ?? null,
        action: "access.grant",
        entity: "Reservation",
        entityId: reservationId,
        before: { grantId: grant.id, status: grant.status },
        after: { grantId: updated.id, status: updated.status, provider: dto.provider }
      });
      return response;
    } catch (err) {
      await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async revokeAccess(reservationId: string, dto: RevokeAccessDto, campgroundId: string) {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.campgroundId !== campgroundId) {
      throw new NotFoundException("Reservation not found");
    }

    const idempotencyKey = dto.idempotencyKey || `access-revoke:${dto.provider}:${reservationId}`;
    const idemRecord = await this.idempotency.start(idempotencyKey, dto, campgroundId, {
      endpoint: "access/revoke",
      requestBody: dto,
      sequence: dto.idempotencyKey ?? null
    });
    if (idemRecord?.status === IdempotencyStatus.succeeded && idemRecord.responseJson) {
      return idemRecord.responseJson;
    }

    const adapter = this.registry.getAdapter(dto.provider);
    if (!adapter) {
      await this.idempotency.fail(idempotencyKey);
      throw new BadRequestException("Access provider not supported");
    }
    const integration = await this.getIntegration(campgroundId, dto.provider);
    const grant = await this.grantsRepo().findFirst({
      where: { reservationId, provider: dto.provider, campgroundId }
    });
    if (!grant) throw new NotFoundException("Access grant not found");

    try {
      const result = await adapter.revokeAccess(integration, {
        reservationId,
        providerAccessId: dto.providerAccessId ?? grant.providerAccessId ?? undefined,
        reason: dto.reason
      });
      const updated = await this.grantsRepo().update({
        where: { id: grant.id },
        data: {
          status: result.status ?? AccessGrantStatus.revoked,
          blockedReason: dto.reason ?? grant.blockedReason ?? null,
          lastSyncAt: new Date()
        }
      });
      const response = { grant: updated };
      await this.idempotency.complete(idempotencyKey, response);
      await this.audit.record({
        campgroundId,
        actorId: (dto as any).actorId ?? null,
        action: "access.revoke",
        entity: "Reservation",
        entityId: reservationId,
        before: { grantId: grant.id, status: grant.status },
        after: { grantId: updated.id, status: updated.status, provider: dto.provider, reason: dto.reason ?? null }
      });
      return response;
    } catch (err) {
      await this.idempotency.fail(idempotencyKey);
      throw err;
    }
  }

  async blockAccessForReservation(reservationId: string, reason: string, actorId?: string | null) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, campgroundId: true }
    });

    const result = await this.grantsRepo().updateMany({
      where: {
        reservationId,
        status: { in: [AccessGrantStatus.active, AccessGrantStatus.pending] }
      },
      data: {
        status: AccessGrantStatus.blocked,
        blockedReason: reason,
        lastSyncAt: new Date()
      }
    });

    if (reservation) {
      await this.audit.record({
        campgroundId: reservation.campgroundId,
        actorId: actorId ?? null,
        action: "access.block",
        entity: "Reservation",
        entityId: reservationId,
        after: { reason, updated: result.count }
      });
    }
  }

  async listIntegrations(campgroundId: string | null | undefined) {
    if (!campgroundId) throw new BadRequestException("campgroundId required");
    const records = (await this.integrationsRepo()?.findMany?.({ where: { campgroundId } })) ?? [];
    return records.map((r: any) => ({
      ...r,
      webhookSecret: this.maskSecret(r.webhookSecret)
    }));
  }

  async upsertIntegration(campgroundId: string | null | undefined, dto: UpsertAccessIntegrationDto) {
    if (!campgroundId) throw new BadRequestException("campgroundId required");
    const record = await this.integrationsRepo().upsert({
      where: { campgroundId_provider: { campgroundId, provider: dto.provider } },
      create: {
        campgroundId,
        provider: dto.provider,
        displayName: dto.displayName,
        status: dto.status ?? "enabled",
        credentials: dto.credentials,
        webhookSecret: dto.webhookSecret ?? null
      },
      update: {
        displayName: dto.displayName ?? undefined,
        status: dto.status ?? undefined,
        credentials: dto.credentials ?? {},
        webhookSecret: dto.webhookSecret ?? undefined
      }
    });
    return {
      ...record,
      webhookSecret: this.maskSecret(record.webhookSecret)
    };
  }

  async verifyWebhook(provider: AccessProviderType, signature: string | undefined, rawBody: string, campgroundId?: string | null) {
    const integration = await this.integrationsRepo()?.findFirst?.({
      where: { provider, ...(campgroundId ? { campgroundId } : {}) }
    });
    if (!integration) return false;
    const adapter = this.registry.getAdapter(provider);
    if (!adapter) return false;
    return adapter.verifyWebhookSignature({
      integration,
      signature,
      secret: integration.webhookSecret,
      rawBody
    });
  }

  async autoGrantForReservation(reservationId: string, actorId?: string | null) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { Site: true, guest: true }
    });
    if (!reservation) throw new NotFoundException("Reservation not found");
    const integrations = await this.integrationsRepo()?.findMany?.({
      where: { campgroundId: reservation.campgroundId, status: "enabled" }
    }) ?? [];
    for (const integration of integrations) {
      try {
        await this.grantAccess(reservationId, {
          provider: integration.provider as AccessProviderType,
          startsAt: reservation.arrivalDate?.toISOString?.() ?? undefined,
          endsAt: reservation.departureDate?.toISOString?.() ?? undefined,
          idempotencyKey: `auto-grant:${integration.provider}:${reservationId}`,
          actorId
        } as any, reservation.campgroundId);
      } catch (err) {
        // Continue to next provider; audit is handled in grantAccess
        continue;
      }
    }
  }

  async revokeAllForReservation(reservationId: string, reason: string, actorId?: string | null) {
    const grants = await this.grantsRepo().findMany({
      where: { reservationId, status: { in: [AccessGrantStatus.active, AccessGrantStatus.pending, AccessGrantStatus.blocked] } }
    });
    for (const grant of grants ?? []) {
      try {
        await this.revokeAccess(reservationId, {
          provider: grant.provider,
          providerAccessId: grant.providerAccessId ?? undefined,
          idempotencyKey: `auto-revoke:${grant.provider}:${reservationId}`,
          reason,
          actorId
        } as any, grant.campgroundId);
      } catch (err) {
        // swallow to keep loop going; audit handled per call
        continue;
      }
    }
  }
}
