# Known Limitations & Stubbed Features

This document outlines features that are implemented as stubs (UI-only or local-only) without real external integrations. These work for demo/testing but require real integrations before production use.

---

## Payment & Financial

| Feature                   | Status  | Notes                                                 |
| ------------------------- | ------- | ----------------------------------------------------- |
| **Gift Cards**            | Stubbed | Issue/redeem codes work locally, no payment processor |
| **POS Refunds/Exchanges** | Stubbed | Records refunds locally, no processor call            |
| **Referral Payouts**      | Stubbed | Tracks referrals, no real money movement              |
| **Multi-currency FX**     | Stubbed | Config available, no real FX rates                    |

---

## Integrations

| Feature                   | Status  | Notes                                            |
| ------------------------- | ------- | ------------------------------------------------ |
| **OTA Sync**              | Stubbed | Credentials saved locally, no provider API calls |
| **OTA Availability Push** | Stubbed | Logs pushes but doesn't call external APIs       |
| **CRM Sync**              | Stubbed | "Sync to CRM" button exists, no external call    |
| **Access Control (IoT)**  | Stubbed | Device registry UI, no real lock/meter APIs      |
| **Warehouse Connector**   | Stubbed | Export UI available, no S3/warehouse push        |

---

## Communications

| Feature                     | Status  | Notes                                       |
| --------------------------- | ------- | ------------------------------------------- |
| **Abandoned Cart Recovery** | Stubbed | Queue exists, uses internal comms endpoints |
| **Push Notifications**      | Local   | Device registration works, no push server   |

---

## AI & Analytics

| Feature                | Status        | Notes                                       |
| ---------------------- | ------------- | ------------------------------------------- |
| **AI Recommendations** | Stubbed       | UI works with mock data, no external AI key |
| **CampGuide AI**       | Mock fallback | Returns stubs when AI key missing           |
| **Dynamic Pricing AI** | Stubbed       | Shows suggestions with mock data            |
| **Semantic Search**    | Stubbed       | UI exists, uses mock results                |

---

## Operations

| Feature                | Status     | Notes                               |
| ---------------------- | ---------- | ----------------------------------- |
| **Equipment Rentals**  | Local-only | CRUD works, no external systems     |
| **Activity Capacity**  | Stubbed    | Waitlist and caps work locally      |
| **Auto-task Triggers** | Stubbed    | UI shows triggers, not automated    |
| **Inventory Reorder**  | Stubbed    | Suggestions shown, no PO generation |

---

## Admin & Security

| Feature                  | Status  | Notes                                    |
| ------------------------ | ------- | ---------------------------------------- |
| **Backup/DR**            | Stubbed | Shows status, "simulate restore" is stub |
| **Privacy/PII Controls** | Stubbed | Toggle UI works, no real redaction       |

---

## Marketing

| Feature                  | Status     | Notes                                       |
| ------------------------ | ---------- | ------------------------------------------- |
| **Social Media Posting** | Local-only | Planner/calendar works, no external posting |
| **Promo Optimizer**      | Mock data  | A/B stats shown with mock data              |

---

## Before Production Checklist

1. **Payments**: Connect real Stripe/processor for refunds, gift cards
2. **OTA**: Implement provider-specific APIs (Hipcamp, Airbnb, etc.)
3. **Push**: Configure push notification server
4. **AI**: Add OpenAI/Anthropic API keys for AI features
5. **Backups**: Wire to real backup storage

---

> [!NOTE]
> All stubbed features have complete UI and API shapes. They're designed to work end-to-end locally and can be connected to real services by implementing the integration layer.
