import { INestApplication, Injectable, Logger, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL || process.env.PLATFORM_DATABASE_URL;
    if (!connectionString) {
      throw new InternalServerErrorException('DATABASE_URL or PLATFORM_DATABASE_URL must be set');
    }

    // Connection pool configuration
    const poolSize = parseInt(process.env.DATABASE_POOL_SIZE || '10', 10);
    const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT || '30', 10);

    const adapter = new PrismaPg({
      connectionString,
      max: poolSize,
      idleTimeout: poolTimeout,
      connectionTimeout: 10,
    });
    // @ts-ignore Prisma 7 adapter signature
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}

