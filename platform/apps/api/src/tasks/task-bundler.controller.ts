import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards"; // Assuming standard guard exists
import { TaskBundlerService } from "./task-bundler.service";

@UseGuards(JwtAuthGuard)
@Controller("tasks/bundles")
export class TaskBundlerController {
    constructor(private readonly bundler: TaskBundlerService) { }

    @Get()
    async getBundles(@Req() req: Request) {
        // Assuming standard user object has campgroundId or tenantId
        // In many parts of this codebase campgroundId is used.
        // Task model has 'tenantId'. We should check if campgroundId maps to tenantId.
        // Usually they are the same in single-tenant-per-campground context.
        const tenantId = req.user?.campgroundId || req.user?.tenantId;

        // Fallback if not strictly defined on user
        if (!tenantId) {
            // For development/scaffolding, might throw or return empty
            return [];
        }

        return this.bundler.getBundles(tenantId);
    }
}
