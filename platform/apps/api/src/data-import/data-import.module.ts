import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DataImportService } from "./data-import.service";
import { DataImportController } from "./data-import.controller";
import { SiteImportService } from "./site-import.service";
import { GuestImportService } from "./guest-import.service";
import { CsvParserService } from "./parsers/csv-parser.service";
import { CampspotParserService } from "./parsers/campspot-parser.service";
import { NewbookParserService } from "./parsers/newbook-parser.service";

@Module({
  imports: [PrismaModule],
  controllers: [DataImportController],
  providers: [
    DataImportService,
    SiteImportService,
    GuestImportService,
    CsvParserService,
    CampspotParserService,
    NewbookParserService,
  ],
  exports: [DataImportService, SiteImportService, GuestImportService],
})
export class DataImportModule {}
