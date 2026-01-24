import { Module } from "@nestjs/common";
import { SemanticSearchController } from "./semantic-search.controller";
import { SemanticSearchService } from "./semantic-search.service";
import { OpenAIModule } from "../openai/openai.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [OpenAIModule, PrismaModule],
  controllers: [SemanticSearchController],
  providers: [SemanticSearchService],
  exports: [SemanticSearchService],
})
export class SemanticSearchModule {}
