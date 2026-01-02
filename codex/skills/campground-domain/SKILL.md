---
name: campground-domain
description: Campground/RV park domain knowledge for reservations and pricing.
allowed-tools: Read, Glob, Grep
---

# Campground Domain (Codex)

## Use when
- Working on reservations, sites, pricing, or operational workflows.

## Core concepts
- Sites belong to site classes; RV, tent, cabin, unique types.
- Reservation lifecycle: quote -> pending -> confirmed -> checked-in/out -> canceled.
- Availability: not reserved, not blocked, meets guest requirements.

## Pricing rules
- Base rate x nights + fees + upsells - discounts + taxes.
- Seasonality, weekends, length-of-stay, and site premiums.
- Deposits and cancellation policies matter.

## Operations
- Check-in/out steps, site assignment, balance collection.
- Housekeeping and readiness status.
- Group bookings and OTA channel sync.

## Allowed scope
- Domain guidance only.

## Ask before proceeding if unclear
- The business rule or user role is not defined.

## Stop condition
- Relevant domain rules are summarized.
