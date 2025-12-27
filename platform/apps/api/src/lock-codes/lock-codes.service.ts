import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LockCodeType, LockCodeRotationSchedule } from '@prisma/client';

@Injectable()
export class LockCodesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: {
        campgroundId: string;
        name: string;
        code: string;
        type: LockCodeType;
        rotationSchedule?: LockCodeRotationSchedule;
        showOnConfirmation?: boolean;
        showAtCheckin?: boolean;
        appliesTo?: string[];
        notes?: string;
    }) {
        return this.prisma.lockCode.create({
            data: {
                campgroundId: data.campgroundId,
                name: data.name,
                code: data.code,
                type: data.type,
                rotationSchedule: data.rotationSchedule ?? 'none',
                showOnConfirmation: data.showOnConfirmation ?? true,
                showAtCheckin: data.showAtCheckin ?? true,
                appliesTo: data.appliesTo ?? [],
                notes: data.notes,
            },
        });
    }

    async findAllByCampground(campgroundId: string) {
        return this.prisma.lockCode.findMany({
            where: { campgroundId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        const lockCode = await this.prisma.lockCode.findUnique({ where: { id } });
        if (!lockCode) throw new NotFoundException('Lock code not found');
        return lockCode;
    }

    async update(id: string, data: Partial<{
        name: string;
        code: string;
        type: LockCodeType;
        rotationSchedule: LockCodeRotationSchedule;
        showOnConfirmation: boolean;
        showAtCheckin: boolean;
        appliesTo: string[];
        isActive: boolean;
        notes: string;
    }>) {
        return this.prisma.lockCode.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        return this.prisma.lockCode.delete({ where: { id } });
    }

    async rotate(id: string) {
        // Generate a new random 4-digit code
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();

        return this.prisma.lockCode.update({
            where: { id },
            data: {
                code: newCode,
                lastRotatedAt: new Date(),
            },
        });
    }

    // Get lock codes that should be shown to guests (for check-in/confirmation)
    async getGuestVisibleCodes(campgroundId: string, context: 'confirmation' | 'checkin') {
        const where = {
            campgroundId,
            isActive: true,
            type: { not: 'master' as LockCodeType }, // Never show master codes to guests
        };

        if (context === 'confirmation') {
            return this.prisma.lockCode.findMany({
                where: { ...where, showOnConfirmation: true },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    type: true,
                },
            });
        }

        return this.prisma.lockCode.findMany({
            where: { ...where, showAtCheckin: true },
            select: {
                id: true,
                name: true,
                code: true,
                type: true,
            },
        });
    }
}
