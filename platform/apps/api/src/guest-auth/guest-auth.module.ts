import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { GuestAuthController } from "./guest-auth.controller";
import { GuestAuthService } from "./guest-auth.service";
import { PrismaModule } from "../prisma/prisma.module";
import { GuestJwtStrategy } from "./strategies/guest-jwt.strategy";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secret",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [GuestAuthController],
  providers: [GuestAuthService, GuestJwtStrategy],
  exports: [GuestAuthService],
})
export class GuestAuthModule {}
