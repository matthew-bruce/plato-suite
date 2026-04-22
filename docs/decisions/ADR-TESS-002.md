# ADR-TESS-002 — Tessera: Client-Specific Internal Tool

**Date:** 2026-04-22
**Status:** Accepted
**Related:** ADR-TESS-001 (open RLS), ADR-003 (vendor abstraction), ADR-004 (OIDC auth), PRINCIPLES.md §16 (no client fingerprints)

---

## Decision

Tessera (`apps/tessera`) is built as a client-specific internal tool for the RMG eBusiness transition project. It intentionally violates several Plato Suite architectural principles, and those violations are accepted and documented here for the duration of the tool's current form.

---

## Context

In April 2026, with three days to an India trip representing a hard deadline, the decision was made to build Tessera inside the Plato Suite monorepo as a fast-moving internal tool.

Tessera is a KT (Knowledge Transfer) Operating System for the RMG eBusiness supplier transition (Capgemini → TCS). It tracks 12 knowledge domains, 125 KT sessions across 13 application groups, RAG readiness scores, strategic insights (nuggets), a trip itinerary, and people/SME mappings.

The tool is:
- Used by 2–5 named RMG staff members
- Needed to function on a laptop in Noida and Gurugram during the final week of April 2026
- Not (yet) a product — it is an internal operational tool for a specific engagement
- Of unknown long-term fate: it may be genericised into a product, retired after the transition completes, or remain as a private internal tool

Given the deadline and the tool's internal nature, several architectural principles were explicitly set aside.

---

## Violations and Justifications

### 1. No authentication (reference: ADR-004, ADR-TESS-001)

**What:** All RLS policies are open (`FOR ALL USING (true)`). Any request can read or write any data. There is no login flow.

**Why accepted:** The tool is used by a small known group with no sensitive personal data at risk. Speed of delivery outweighs auth complexity. Adding proper OIDC auth would require wiring up the `@plato/auth` package or Supabase Auth UI, neither of which was in scope for a 3-day build.

**Condition for reversal:** If Tessera is genericised and deployed as a product for external clients, auth must be the first thing added. ADR-004 applies at that point without exception.

---

### 2. RMG-specific data hardcoded (reference: PRINCIPLES.md §16)

**What:** Tessera contains Royal Mail Group branding, RMG-specific domain names (Drupal, Camel, ForgeRock specific to the RMG eBusiness platform), named individuals (Matt Bruce, Robert Parker, Jonny Wooldridge, etc.), and supplier names (CG, TCS, HT, NH) baked into seed files and referenced by the UI.

**Why accepted:** Tessera is not a product. It is an internal tool for one specific engagement. The no-client-fingerprints principle exists to protect the suite's white-label capability — a concern that simply doesn't apply to an internal tool that will never be shown to a different client.

**Condition for reversal:** If Tessera is genericised into a product (e.g. "Plato Transitions" or similar), all RMG-specific data must move to seed/demo scripts, and the schema must be validated against the white-label principles before any release.

---

### 3. Direct Supabase SDK calls (reference: ADR-003)

**What:** Tessera page components import `createClient` from `@supabase/supabase-js` directly, bypassing the `@plato/schema` abstraction.

**Why accepted:** The `@plato/schema` package does not wrap Tessera's `kt_` tables. Wiring up the abstraction for tables that exist only in Tessera, on a 3-day deadline, would add friction with no benefit.

**Condition for reversal:** If Tessera's `kt_` tables are promoted to the shared schema layer, the abstraction must be applied at that point. ADR-003 applies to all shared-layer tables.

---

### 4. Tessera tables in the Nucleus Supabase project (reference: clean module separation)

**What:** Tessera's `kt_` tables live in the Nucleus Supabase project (`nwltpivvqynkfghazjpi`) rather than their own project.

**Why accepted:** Provisioning a new Supabase project for a 3-day internal tool is overhead with no benefit at this stage. The `kt_` prefix clearly namespaces the tables.

**Condition for reversal:** If Tessera becomes a standalone deployable product, it gets its own Supabase project and its migrations move to `apps/tessera/supabase/migrations/`.

---

### 5. No demo mode (reference: PRINCIPLES.md §15)

**What:** Tessera has no `tenant.type: 'demo'` flag, no demo seed script, and no demo URL.

**Why accepted:** It is an internal tool for a live engagement. A "demo" of a tool with real named individuals and real programme data doesn't apply in the same way.

**Condition for reversal:** Same as above — if genericised into a product, a proper demo with fictional data is required before any release.

---

## Monorepo Placement

Tessera lives in `apps/tessera/` within the Plato Suite monorepo. This is correct. Even though it is a client-specific tool today, the monorepo is the right home for it because:

- It benefits from the shared design system (`@plato/ui` RMG tokens)
- It is deployed via the same Vercel workflow
- It may be genericised in future — keeping it in the monorepo means that transition is a code cleanup, not a repo migration

ADR files specific to Tessera use the `ADR-TESS-NNN` naming convention and live in `docs/decisions/` alongside all other ADRs.

---

## Summary

| Principle | Tessera's stance | Reversal trigger |
|---|---|---|
| OIDC auth (ADR-004) | Open RLS for MVP | Genericisation into product |
| No client fingerprints (§16) | RMG data accepted | Genericisation into product |
| Vendor abstraction (ADR-003) | Direct Supabase calls | `kt_` tables promoted to shared schema |
| Module isolation | Tables in Nucleus project | Tessera gets its own Supabase project |
| Demo mode (§15) | No demo | Genericisation into product |

All of these are explicitly accepted, time-bounded exceptions for a deadline-critical internal tool.
