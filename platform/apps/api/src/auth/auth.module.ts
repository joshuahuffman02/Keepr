import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TwoFactorController } from "./two-factor.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { PrismaModule } from "../prisma/prisma.module";
import { ScopeGuard } from "./guards/scope.guard";
import { RolesGuard } from "./guards/roles.guard";
import { OAuth2Module } from "./oauth2/oauth2.module";
import { RustAuthClientService } from "./rust-auth-client.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") || "dev-secret-change-me",
        signOptions: { expiresIn: "7d" },
      }),
      inject: [ConfigService],
    }),
    OAuth2Module,
  ],
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, JwtStrategy, ScopeGuard, RolesGuard, RustAuthClientService],
  exports: [AuthService, JwtModule, ScopeGuard, RolesGuard, OAuth2Module, RustAuthClientService],
})
export class AuthModule {}
