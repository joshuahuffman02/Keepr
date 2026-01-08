import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatToolsService } from './chat-tools.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { GuestAuthModule } from '../guest-auth/guest-auth.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AiModule),
    forwardRef(() => AuthModule),
    GuestAuthModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, ChatGateway],
  exports: [ChatService, ChatToolsService, ChatGateway],
})
export class ChatModule {}
