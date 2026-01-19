# Task

Build a product using the Ralph loop framework and deliver it across five phases. All work must be driven by the Ralph loop so that each iteration is logged and verified.

## Definition of done
- All phases in `PHASES.md` are complete with acceptance criteria met.
- Ralph loop checks pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm smoke`).
- Each phase has documented goals, non-goals, acceptance criteria, and open questions.
- Operational docs reflect any new commands, services, or environment requirements.

## Current focus
- Phase 1: Pricing & Payments (blocked until open questions are resolved).

## Follow-ups
- Investigate Socket handle leak to lift the `JEST_MAX_WORKERS` cap (see `JEST_DEBUG_HANDLES`).
