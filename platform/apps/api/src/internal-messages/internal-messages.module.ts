import { Module } from '@nestjs/common';
import { InternalMessagesService } from './internal-messages.service';
import { InternalMessagesController } from './internal-messages.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [InternalMessagesController],
    providers: [InternalMessagesService],
})
export class InternalMessagesModule { }
