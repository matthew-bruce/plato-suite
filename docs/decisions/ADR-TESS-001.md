# ADR-TESS-001 — Tessera: Open RLS, No Authentication for MVP

**Date:** 2026-04-22
**Status:** Accepted (time-bounded)
**Superseded by:** TBD — when Tessera is genericised into a product

---

## Decision

Tessera (`apps/tessera`) has no authentication for its current MVP phase.
All Supabase RLS policies are open: `FOR ALL USING (true)`. Any request
with valid Supabase credentials can read or write any data.

---

## Context

Tessera was built in three days against a hard deadline (India trip,
26 April 2026). It is a KT Operating System for the RMG eBusiness
supplier transition — an internal tool used by a small group of named
individuals (Matt Bruce, Jonny Wooldridge, Claire Dean, Mandy Tucker).

The tool contains no sensitive personal data, no financial data, and no
data that would cause harm if accessed by an unauthorised party. The
worst-case scenario of an open database is that someone reads programme
notes about a supplier transition — a low-risk exposure.

Implementing proper authentication would require:
1. Wiring up `@plato/auth` or Supabase Auth UI
2. Deciding on identity provider configuration
3. Managing user provisioning for a small temporary group

None of this was justified for a 3-day, single-engagement, internal tool.

---

## Alternatives Considered

### Option A — Supabase Auth with email/password (rejected for MVP)

Would have added 1–2 days to the build. No business justification for
the time cost given the internal, time-bounded nature of the tool.

### Option B — IP-restricted RLS (rejected)

Could restrict access to RMG IP ranges. But the tool needs to be
accessible from hotel Wi-Fi in Noida and Gurugram. IP restriction would
break the primary use case.

### Option C — Open RLS (accepted for MVP)

Simple. Buildable in the time available. Acceptable risk given the
data involved and the user group.

---

## Consequences

**Positive:**
- No auth overhead. Tool ships on deadline.
- No user management required.
- Accessible from anywhere without VPN.

**Negative:**
- The Supabase anon key, if leaked, gives full read/write access.
- Cannot track which user made which change.
- Cannot restrict access to specific data per user (e.g. private nuggets
  are private only by convention, not by enforcement).

---

## Condition for Reversal

This ADR is explicitly time-bounded. Auth must be added before Tessera
is:
- Shown to external parties
- Used by more than ~10 named individuals
- Genericised into a product for other clients
- Extended to contain personally sensitive data

At that point, ADR-004 (OIDC-standard auth) applies without exception.
