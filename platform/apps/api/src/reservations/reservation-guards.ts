import { BadRequestException } from "@nestjs/common";

export const assertSiteLockValid = (siteLocked?: boolean | null, siteId?: string | null) => {
  if (siteLocked && !siteId) {
    throw new BadRequestException("siteLocked requires siteId.");
  }
};
