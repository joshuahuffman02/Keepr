import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { DataImportService } from "./data-import.service";
import { DataImportController } from "./data-import.controller";
import { SiteImportService } from "./site-import.service";
import { GuestImportService } from "./guest-import.service";
import { ReservationImportService } from "./reservation-import.service";
import { ReservationImportController } from "./reservation-import.controller";
import { CsvParserService } from "./parsers/csv-parser.service";
import { CampspotParserService } from "./parsers/campspot-parser.service";
import { NewbookParserService } from "./parsers/newbook-parser.service";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [DataImportController, ReservationImportController],
  providers: [
    DataImportService,
    SiteImportService,
    GuestImportService,
    ReservationImportService,
    CsvParserService,
    CampspotParserService,
    NewbookParserService,
  ],
  exports: [DataImportService, SiteImportService, GuestImportService, ReservationImportService],
})
export class DataImportModule {}
