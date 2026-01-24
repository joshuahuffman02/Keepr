import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TaskBundlerController } from "./task-bundler.controller";
import { TasksService } from "./tasks.service";
import { TaskBundlerService } from "./task-bundler.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [TasksController, TaskBundlerController],
  providers: [TasksService, TaskBundlerService],
  exports: [TasksService, TaskBundlerService],
})
export class TasksModule {}
