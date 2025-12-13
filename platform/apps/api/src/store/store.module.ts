import { Module } from "@nestjs/common";
import { StoreService } from "./store.service";
import { StoreController } from "./store.controller";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

@Module({
    controllers: [StoreController],
    providers: [StoreService, EmailService],
    exports: [StoreService],
})
export class StoreModule { }
