import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OAuth2Controller } from "./oauth2.controller";
import { OAuth2Service } from "./oauth2.service";
import { PrismaModule } from "../../prisma/prisma.module";

/**
 * OAuth2 Module
 *
 * Provides OAuth2 authentication capabilities:
 * - Client credentials grant
 * - Authorization code grant with PKCE
 * - Token refresh
 * - Token revocation
 * - Token introspection
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") || "dev-secret-change-me",
        signOptions: { expiresIn: "1h" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OAuth2Controller],
  providers: [OAuth2Service],
  exports: [OAuth2Service],
})
export class OAuth2Module {}
