import { Controller, Get, Headers, Param, UseGuards } from "@nestjs/common";
import { FeatureFlagService } from "../admin/feature-flag.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";

const resolveHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

@Controller("flags")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  async list(@Headers("x-campground-id") campgroundHeader?: string | string[]) {
    const campgroundId = resolveHeaderValue(campgroundHeader);
    const flags = await this.flags.listEvaluated(campgroundId);
    return {
      campgroundId: campgroundId ?? null,
      flags,
    };
  }

  @Get(":key")
  async get(
    @Param("key") key: string,
    @Headers("x-campground-id") campgroundHeader?: string | string[],
  ) {
    const campgroundId = resolveHeaderValue(campgroundHeader);
    const enabled = await this.flags.isEnabled(key, campgroundId);
    return { key, enabled, campgroundId: campgroundId ?? null };
  }
}
