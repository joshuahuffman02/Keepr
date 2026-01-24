/**
 * Help Tooltip System
 *
 * A comprehensive contextual help system for the application.
 *
 * @example
 * ```tsx
 * import { HelpTooltip, PageOnboardingHint } from "@/components/help";
 *
 * // Simple tooltip
 * <HelpTooltip content={<div>Explanation</div>} />
 *
 * // Page hint
 * <PageOnboardingHint id="page-id" title="Welcome!" content={<div>...</div>} />
 * ```
 */

export {
  HelpTooltip,
  HelpTooltipContent,
  HelpTooltipSection,
  HelpTooltipList,
  HelpTooltipLink,
} from "./HelpTooltip";

export { OnboardingHint, PageOnboardingHint } from "./OnboardingHint";

export { HelpAnchor } from "./HelpAnchor";

export { HelpPanel } from "./HelpPanel";
