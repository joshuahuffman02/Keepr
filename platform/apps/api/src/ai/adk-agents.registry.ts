import { createRevenueTools, createOpsTools, AdkModule } from "./adk-tools";
import { PricingV2Service } from "../pricing-v2/pricing-v2.service";
import { SeasonalRatesService } from "../seasonal-rates/seasonal-rates.service";
import { ReservationsService } from "../reservations/reservations.service";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { RepeatChargesService } from "../repeat-charges/repeat-charges.service";

/**
 * Registry for specialized LLMAgents.
 * Each agent represents a "Virtual Expert" persona with a dedicated mission.
 */

const REVENUE_MANAGER_PROMPT = `
You are the Revenue Manager for Camp-Everyday.
Your mission is to maximize profitability (Yield and ADR).
Always explain your reasoning using occupancy data.
If you suggest a price change, provide a conservative estimate of the revenue lift.
Include deep links to relevant reports when answering data questions.
`;

const OPERATIONS_CHIEF_PROMPT = `
You are the Operations Chief for Camp-Everyday.
Your mission is park efficiency and guest safety.
Focus on maintenance status, site availability, and task completion.
Keep responses operational and direct.
`;

type AgentServices = {
  pricingV2: PricingV2Service;
  seasonalRates: SeasonalRatesService;
  reservations: ReservationsService;
  maintenance: MaintenanceService;
  repeatCharges: RepeatChargesService;
};

type AdkRunOptions = Record<string, unknown>;

type AdkRunner = {
  run: (input: string, options?: AdkRunOptions) => Promise<unknown>;
};

type AdkRuntime = AdkModule & {
  llmAgent: (config: { name: string; instructions: string; tools: unknown[] }) => unknown;
  orchestrator: (config: { name: string; instructions: string; agents: unknown[] }) => AdkRunner;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAdkRuntimeModule = (value: unknown): value is { adk: AdkRuntime } => {
  if (!isRecord(value)) return false;
  const adk = value.adk;
  if (!isRecord(adk)) return false;
  return (
    typeof adk.tool === "function" &&
    typeof adk.llmAgent === "function" &&
    typeof adk.orchestrator === "function"
  );
};

export const createAgentRegistry = (services: AgentServices) => {
  let runnerPromise: Promise<AdkRunner> | null = null;
  let loadError: Error | null = null;

  const loadRunner = async () => {
    if (loadError) {
      throw loadError;
    }
    if (!runnerPromise) {
      runnerPromise = (async () => {
        const mod = await import("@google/adk");
        if (!isAdkRuntimeModule(mod)) {
          throw new Error("ADK module missing expected runtime exports.");
        }
        const { adk } = mod;

        const revenueAgent = adk.llmAgent({
          name: "RevenueManager",
          instructions: REVENUE_MANAGER_PROMPT,
          tools: createRevenueTools(adk, services.pricingV2, services.seasonalRates),
        });

        const opsAgent = adk.llmAgent({
          name: "OperationsChief",
          instructions: OPERATIONS_CHIEF_PROMPT,
          tools: createOpsTools(
            adk,
            services.reservations,
            services.maintenance,
            services.repeatCharges,
          ),
        });

        return adk.orchestrator({
          name: "ActivePartnerOrchestrator",
          instructions:
            "You are the Active AI Partner for a campground owner. Route the user to the correct expert based on their goal.",
          agents: [revenueAgent, opsAgent],
        });
      })().catch((err: Error) => {
        loadError = err;
        runnerPromise = null;
        throw err;
      });
    }
    return runnerPromise;
  };

  return {
    async run(input: string, options?: AdkRunOptions) {
      const runner = await loadRunner();
      return runner.run(input, options);
    },
  };
};
