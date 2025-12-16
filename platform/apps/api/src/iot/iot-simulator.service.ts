import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class IotSimulatorService {
    private readonly logger = new Logger(IotSimulatorService.name);

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_30_MINUTES)
    async simulateMeterReadings() {
        this.logger.log("Simulating utility meter readings...");

        // Find active meters with simulation config in metadata
        const meters = await this.prisma.utilityMeter.findMany({
            where: {
                active: true,
                metadata: { path: ["simulation"], not: null },
            },
        });

        for (const meter of meters) {
            try {
                const metadata = meter.metadata as any;
                const simConfig = metadata.simulation || {};

                // Default base usage or random
                const baseUsage = simConfig.baseUsage || 1.5; // e.g. kWh per 30 mins
                const jitter = simConfig.jitter || 0.5;
                const randomFactor = (Math.random() - 0.5) * jitter;
                const readingIncrement = Math.max(0, baseUsage + randomFactor);

                // Get last reading to increment from
                const lastReading = await this.prisma.utilityMeterRead.findFirst({
                    where: { meterId: meter.id },
                    orderBy: { readAt: "desc" },
                });

                const previousValue = lastReading ? parseFloat(lastReading.readingValue.toString()) : 0;
                const newValue = previousValue + readingIncrement;

                await this.prisma.utilityMeterRead.create({
                    data: {
                        meterId: meter.id,
                        readingValue: newValue,
                        readAt: new Date(),
                        source: "simulator",
                        note: "Simulated automatic reading",
                    },
                });
            } catch (error) {
                this.logger.error(`Failed to simulate reading for meter ${meter.id}`, error);
            }
        }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async simulateLockStatus() {
        this.logger.log("Simulating smart lock status/battery...");

        const locks = await this.prisma.smartLock.findMany();

        for (const lock of locks) {
            // Simulate battery drain
            const currentBattery = lock.batteryLevel ?? 100;
            // 10% chance to drop 1% battery
            const shouldDrain = Math.random() < 0.1;
            const newBattery = shouldDrain ? Math.max(0, currentBattery - 1) : currentBattery;

            if (newBattery !== currentBattery) {
                await this.prisma.smartLock.update({
                    where: { id: lock.id },
                    data: { batteryLevel: newBattery }
                });
            }
        }
    }
}
