import { SetMetadata } from "@nestjs/common";

export const SCOPE_KEY = "requiredScope";

export type ScopeDescriptor = {
  resource: string;
  action: string;
};

export const RequireScope = (descriptor: ScopeDescriptor) => SetMetadata(SCOPE_KEY, descriptor);
