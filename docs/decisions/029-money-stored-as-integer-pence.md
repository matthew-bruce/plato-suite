# ADR-029 — Money Stored as Integer Pence

Date: 2026-04-19
Status: Accepted

## Decision
All monetary values in the database are stored as `INTEGER` representing
pence (the smallest GBP unit). Never DECIMAL, NUMERIC with fractional
parts, or FLOAT. Display conversion to pounds (£) is the UI layer's
responsibility.

```sql
day_rate           INTEGER NOT NULL   -- e.g. 85000 = £850.00
day_rate_override  INTEGER            -- e.g. 92500 = £925.00
```

## Context
Floating point arithmetic on monetary values produces rounding errors
that compound over calculations. DECIMAL is accurate but adds
unnecessary complexity when integer arithmetic is sufficient.

The smallest meaningful unit in this system is 1 pence. No rate card
or day rate requires sub-penny precision. Integer arithmetic is
exact, fast, and simple.

## Display convention
```ts
// Database → UI
const displayRate = (pence: number) =>
  `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

// UI → Database (on form submit)
const storePence = (pounds: string) => Math.round(parseFloat(pounds) * 100)
```

## Consequences
- All day rate fields across all tables are INTEGER
- The finance calculator performs all intermediate calculations in
  pence and converts to pounds only for display
- Form inputs accept pounds (£850.00) and convert to pence on submit
- A rate of £0 is stored as 0, not NULL — NULL means "no rate set"
- The blended rate calculator must handle integer division carefully
  (use rounding, not truncation)
