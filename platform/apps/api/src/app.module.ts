import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { CampgroundsModule } from "./campgrounds/campgrounds.module";
import { SitesModule } from "./sites/sites.module";
import { GuestsModule } from "./guests/guests.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { RedisModule } from "./redis/redis.module";
import { SiteClassesModule } from "./site-classes/site-classes.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { PricingModule } from "./pricing/pricing.module";
import { LedgerModule } from "./ledger/ledger.module";
import { PaymentsModule } from "./payments/payments.module";
import { StoreModule } from "./store/store.module";
import { GuestAuthModule } from './guest-auth/guest-auth.module';
import { BlackoutsModule } from './blackouts/blackouts.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PublicReservationsModule } from './public-reservations/public-reservations.module';
import { MessagesModule } from './messages/messages.module';
import { EventsModule } from './events/events.module';
import { EmailModule } from './email/email.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { InternalMessagesModule } from './internal-messages/internal-messages.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { TaxRulesModule } from './tax-rules/tax-rules.module';
import { SeasonalRatesModule } from './seasonal-rates/seasonal-rates.module';
import { GuestEquipmentModule } from './guest-equipment/guest-equipment.module';
import { RepeatChargesModule } from './repeat-charges/repeat-charges.module';
import { ActivitiesModule } from './activities/activities.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OperationsModule } from './operations/operations.module';
import { IncidentsModule } from './incidents/incidents.module';
import { InternalConversationsModule } from './internal-conversations/internal-conversations.module';
import { HoldsModule } from './holds/holds.module';
import { AuditModule } from './audit/audit.module';
import { CommunicationsModule } from './communications/communications.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { OtaModule } from './ota/ota.module';
import { SiteMapModule } from './site-map/site-map.module';
import { SupportModule } from './support/support.module';
import { NpsModule } from './nps/nps.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FormsModule } from './forms/forms.module';
import { SocialPlannerModule } from './social-planner/social-planner.module';
import { AnalyticsModule } from "./analytics/analytics.module";
import { AiModule } from "./ai/ai.module";
import { GamificationModule } from "./gamification/gamification.module";
import { PushSubscriptionsModule } from "./push-subscriptions/push-subscriptions.module";
import { PerfModule } from "./perf/perf.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { ObservabilityModule } from "./observability/observability.module";
import { DeveloperApiModule } from "./developer-api/developer-api.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PortfoliosModule } from "./portfolios/portfolios.module";
import { LocalizationModule } from "./localization/localization.module";
import { CurrencyTaxModule } from "./currency-tax/currency-tax.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { AbandonedCartModule } from "./abandoned-cart/abandoned-cart.module";
import { GiftCardsModule } from "./gift-cards/gift-cards.module";
import { BackupModule } from "./backup/backup.module";
import { PricingV2Module } from "./pricing-v2/pricing-v2.module";
import { DepositPoliciesModule } from "./deposit-policies/deposit-policies.module";
import { UpsellsModule } from "./upsells/upsells.module";
import { AutoCollectModule } from "./auto-collect/auto-collect.module";
import { TasksModule } from "./tasks/tasks.module";
import { SelfCheckinModule } from "./self-checkin/self-checkin.module";
import { GroupsModule } from "./groups/groups.module";
import { HousekeepingModule } from "./housekeeping/housekeeping.module";
import { FlexCheckModule } from "./flex-check/flex-check.module";
import { RoomMovesModule } from "./room-moves/room-moves.module";
import { GroupBookingsModule } from "./group-bookings/group-bookings.module";
// Phase 4 imports
import { NotificationTriggersModule } from "./notification-triggers/notification-triggers.module";
import { StoredValueModule } from "./stored-value/stored-value.module";
import { GuestWalletModule } from "./guest-wallet/guest-wallet.module";
import { PosModule } from "./pos/pos.module";
// Phase 3 imports
import { DynamicPricingModule } from "./dynamic-pricing/dynamic-pricing.module";
import { WorkflowsModule } from "./workflows/workflows.module";
import { PoliciesModule } from "./policies/policies.module";
import { StaffModule } from "./staff/staff.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { UploadsModule } from "./uploads/uploads.module";
import { WaiversModule } from "./waivers/waivers.module";
import { HealthModule } from "./health/health.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { AccessControlModule } from "./access-control/access-control.module";
import { BillingModule } from "./billing/billing.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { SignaturesModule } from "./signatures/signatures.module";
import { TicketsModule } from "./tickets/tickets.module";
import { AdminModule } from "./admin/admin.module";
import { AnomaliesModule } from "./anomalies/anomalies.module";
import { IotModule } from "./iot/iot.module";
import { CharityModule } from "./charity/charity.module";
import { EarlyAccessModule } from "./early-access/early-access.module";
import { OrgBillingModule } from "./org-billing/org-billing.module";
import { DataImportModule } from "./data-import/data-import.module";
import { OrgReferralsModule } from "./org-referrals/org-referrals.module";
import { SetupServicesModule } from "./setup-services/setup-services.module";
import { InventoryModule } from "./inventory/inventory.module";
import { PartnerApiModule } from "./partner-api/partner-api.module";
import { MenuConfigModule } from "./menu-config/menu-config.module";
import { FeatureProgressModule } from "./feature-progress/feature-progress.module";
import { KioskModule } from "./kiosk/kiosk.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { SecurityModule } from "./security/security.module";
import { ValueStackModule } from "./value-stack/value-stack.module";
import { OpTasksModule } from "./op-tasks/op-tasks.module";
import { SeasonalsModule } from "./seasonals/seasonals.module";
import { LockCodesModule } from "./lock-codes/lock-codes.module";
import { StayRulesModule } from "./stay-rules/stay-rules.module";
import { SystemCheckModule } from "./system-check/system-check.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SecurityModule, // Must be before AuthModule
    PrismaModule,
    AuthModule,
    GuestAuthModule,
    RedisModule,
    OrganizationsModule,
    CampgroundsModule,
    SitesModule,
    GuestsModule,
    ReservationsModule,
    SiteClassesModule,
    SiteMapModule,
    DashboardModule,
    MaintenanceModule,
    PricingModule,
    PricingV2Module,
    MembershipsModule,
    LedgerModule,
    PaymentsModule,
    DepositPoliciesModule,
    UpsellsModule,
    GiftCardsModule,
    StoreModule,
    InventoryModule,
    BlackoutsModule,
    PromotionsModule,
    PublicReservationsModule,
    MessagesModule,
    EventsModule,
    EmailModule,
    WaitlistModule,
    InternalMessagesModule,
    LoyaltyModule,
    TaxRulesModule,
    SeasonalRatesModule,
    GuestEquipmentModule,
    RepeatChargesModule,
    ActivitiesModule,
    IncidentsModule,
    OperationsModule,
    InternalConversationsModule,
    HoldsModule,
    AuditModule,
    CommunicationsModule,
    CampaignsModule,
    OtaModule,
    SupportModule,
    NpsModule,
    ReviewsModule,
    FormsModule,
    SocialPlannerModule,
    GamificationModule,
    AnalyticsModule,
    AiModule,
    PushSubscriptionsModule,
    PerfModule,
    IntegrationsModule,
    ObservabilityModule,
    HealthModule,
    DeveloperApiModule,
    PrivacyModule,
    PermissionsModule,
    PortfoliosModule,
    LocalizationModule,
    CurrencyTaxModule,
    ApprovalsModule,
    AbandonedCartModule,
    BackupModule,
    AutoCollectModule,
    TasksModule,
    SelfCheckinModule,
    GroupsModule,
    HousekeepingModule,
    FlexCheckModule,
    RoomMovesModule,
    GroupBookingsModule,
    // Phase 4 modules
    NotificationTriggersModule,
    StoredValueModule,
    GuestWalletModule,
    PosModule,
    AccessControlModule,
    BillingModule,
    // Phase 3 modules
    DynamicPricingModule,
    WorkflowsModule,
    PoliciesModule,
    StaffModule,
    PortfolioModule,
    UploadsModule,
    WaiversModule,
    SignaturesModule,
    OnboardingModule,
    ReferralsModule,
    TicketsModule,
    AdminModule,
    AnomaliesModule,
    IotModule,
    CharityModule,
    EarlyAccessModule,
    OrgBillingModule,
    DataImportModule,
    OrgReferralsModule,
    SetupServicesModule,
    PartnerApiModule,
    MenuConfigModule,
    FeatureProgressModule,
    KioskModule,
    IdempotencyModule,
    ValueStackModule,
    // Unified Operations / Task Management
    OpTasksModule,
    // Seasonals Management
    SeasonalsModule,
    // Lock Codes Management
    LockCodesModule,
    // Stay Rules Management
    StayRulesModule,
    // System Check
    SystemCheckModule,
  ],
  providers: []
})
export class AppModule { }
