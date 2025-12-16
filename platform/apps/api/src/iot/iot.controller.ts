import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IotSimulatorService } from './iot-simulator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('IoT')
@Controller('iot')
@UseGuards(JwtAuthGuard)
export class IotController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly simulator: IotSimulatorService,
    ) { }

    @Get('meters')
    @ApiOperation({ summary: 'List all utility meters' })
    async getMeters() {
        return this.prisma.utilityMeter.findMany({
            include: {
                reads: {
                    orderBy: { readAt: 'desc' },
                    take: 1
                }
            }
        });
    }

    @Get('locks')
    @ApiOperation({ summary: 'List all smart locks' })
    async getLocks() {
        return this.prisma.smartLock.findMany();
    }

    @Post('simulate/trigger')
    @ApiOperation({ summary: 'Trigger manual simulation' })
    async triggerSimulation() {
        await this.simulator.simulateMeterReadings();
        await this.simulator.simulateLockStatus();
        return { success: true, message: 'Simulation triggered' };
    }
}
