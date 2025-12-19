import { adk } from "@google/adk";
import { createRevenueTools, createOpsTools } from "./adk-tools";

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

export const createAgentRegistry = (services: any) => {
    // Specialized Agents
    const revenueAgent = adk.llmAgent({
        name: "RevenueManager",
        instructions: REVENUE_MANAGER_PROMPT,
        tools: createRevenueTools(services.pricingV2, services.seasonalRates),
    });

    const opsAgent = adk.llmAgent({
        name: "OperationsChief",
        instructions: OPERATIONS_CHIEF_PROMPT,
        tools: createOpsTools(services.reservations, services.maintenance, services.repeatCharges),
    });

    // The Orchestrator (Dispatcher)
    // It handles user intent and routes to the correct expert
    return adk.orchestrator({
        name: "ActivePartnerOrchestrator",
        instructions: "You are the Active AI Partner for a campground owner. Route the user to the correct expert based on their goal.",
        agents: [revenueAgent, opsAgent],
    });
};
