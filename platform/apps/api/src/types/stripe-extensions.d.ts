declare module "stripe" {
  namespace Stripe {
    interface UsageRecord {
      id: string;
      quantity: number;
      timestamp: number;
      subscription_item?: string | null;
    }

    interface UsageRecordSummary {
      id: string;
      total_usage: number;
      period?: { start: number; end: number };
      subscription_item?: string | null;
    }

    interface SubscriptionItemsResource {
      createUsageRecord(
        id: string,
        params: { quantity: number; timestamp?: number; action?: "increment" | "set" },
        options?: RequestOptions,
      ): Promise<Stripe.Response<Stripe.UsageRecord>>;

      listUsageRecordSummaries(
        id: string,
        params?: { limit?: number; starting_after?: string; ending_before?: string },
        options?: RequestOptions,
      ): ApiListPromise<Stripe.UsageRecordSummary>;
    }

    namespace Price {
      interface Recurring {
        aggregate_usage?: "sum" | "last_during_period" | "last_ever" | "max";
      }
    }

    namespace PriceCreateParams {
      interface Recurring {
        aggregate_usage?: "sum" | "last_during_period" | "last_ever" | "max";
      }
    }
  }
}
