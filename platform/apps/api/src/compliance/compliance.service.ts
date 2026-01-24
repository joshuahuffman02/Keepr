import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies if the organization's data region matches the valid region for this instance.
   * In a real multi-region deployment, THIS_REGION would be an environment variable.
   */
  async verifyDataResidency(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { dataRegion: true },
    });

    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const currentRegion = process.env.AWS_REGION || "us-east-1";
    return org.dataRegion === currentRegion;
  }
}
