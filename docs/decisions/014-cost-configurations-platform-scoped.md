# ADR-014 — Cost Configurations Scoped to Platforms

Date: 2026-04-19
Status: Accepted

## Decision
Cost configurations (VAT uplift, on-costs uplift, blended day rate
override) are scoped per Platform, not per organisation. Each Platform
runs its own finance calculator independently. `effective_from`
preserves history when uplifts change.

## Context
Different Platforms within the same organisation may have different
commercial arrangements — different VAT treatment, different on-cost
structures, or different blended rate targets. Scoping configurations
to Platform level gives each Platform autonomy over its own financial
model while keeping all data in a single installation.

## Data model
```sql
cost_configurations (
  platform_id               — FK to platforms
  vat_uplift_percent        — e.g. 20.00
  on_costs_uplift_percent   — e.g. 12.50
  blended_day_rate_override — optional override in pence
  effective_from            — date this configuration takes effect
)
```

Multiple rows per platform are allowed, differentiated by
`effective_from`. The active configuration for a given period is the
most recent row where `effective_from <= period_start_date`.

## Consequences
- Cost configurations are superuser-only RLS — commercially sensitive
- The finance calculator must join `cost_configurations` on platform
  and date to get the correct uplifts for any given period
- A new Platform starts with no cost configuration — the calculator
  must handle this gracefully (zero uplifts, no blended override)
- Changes to uplifts do not retroactively affect closed periods
  (the snapshot model in ADR-013 applies)
