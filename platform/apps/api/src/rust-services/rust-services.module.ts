import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PaymentProcessorClient } from "./payment-processor.client";
import { AvailabilityClient } from "./availability.client";
import { AuthServiceClient } from "./auth-service.client";

/**
 * Module providing clients to Rust microservices.
 *
 * Services:
 * - PaymentProcessorClient: Stripe payments, fees, reconciliation
 * - AvailabilityClient: Pricing evaluation, availability checking
 * - AuthServiceClient: Password hashing, JWT, TOTP, encryption
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PaymentProcessorClient, AvailabilityClient, AuthServiceClient],
  exports: [PaymentProcessorClient, AvailabilityClient, AuthServiceClient],
})
export class RustServicesModule {}
