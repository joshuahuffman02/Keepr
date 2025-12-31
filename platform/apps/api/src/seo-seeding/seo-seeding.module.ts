import { Module } from "@nestjs/common";
import { RecreationGovService } from "./recreation-gov.service";
import { GeoAssociationService } from "./geo-association.service";
import { CampgroundSeederService } from "./campground-seeder.service";
import { SeoLocationService } from "./seo-location.service";
import { AttractionService } from "./attraction.service";
import { SeedJobService } from "./seed-job.service";
import { SeoSeedingController } from "./seo-seeding.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [SeoSeedingController],
  providers: [
    RecreationGovService,
    GeoAssociationService,
    CampgroundSeederService,
    SeoLocationService,
    AttractionService,
    SeedJobService,
  ],
  exports: [
    RecreationGovService,
    GeoAssociationService,
    CampgroundSeederService,
    SeoLocationService,
    AttractionService,
    SeedJobService,
  ],
})
export class SeoSeedingModule {}
