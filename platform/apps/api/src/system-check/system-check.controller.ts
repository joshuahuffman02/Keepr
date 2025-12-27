import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SystemCheckService } from './system-check.service';
import { JwtAuthGuard } from '../auth/guards';

@UseGuards(JwtAuthGuard)
@Controller('campgrounds/:campgroundId/system-check')
export class SystemCheckController {
    constructor(private readonly systemCheckService: SystemCheckService) { }

    @Get()
    runCheck(@Param('campgroundId') campgroundId: string) {
        return this.systemCheckService.runCheck(campgroundId);
    }
}
