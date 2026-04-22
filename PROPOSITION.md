# PROPOSITION.md — Plato Suite

## What Plato Is

Plato is a modular productivity platform for Platform Engineering teams. It brings together the tooling that Platform leaders, Heads of Delivery, and Engineering managers actually need — org structure, resource management, financial planning, PI planning, knowledge management, and roadmapping — in a coherent, integrated suite.

Each module works as a standalone product. Together, they work as an operating system for Platform Engineering.

---

## The Problem

Platform Engineering teams are expected to run sophisticated, multi-team technology organisations. But the tooling available to them is either:

- **Too generic** — project management tools like Monday.com, Jira, or Azure DevOps that weren't built for platform leadership concerns
- **Too expensive** — enterprise tools that require procurement cycles, vendor negotiations, and IT approval before a team lead can test anything
- **Too fragmented** — a roadmap tool here, a resource planner there, PI planning in a spreadsheet, org charts in PowerPoint, knowledge in Confluence, finances in Excel

The result is that most Platform Engineering teams manage their most important operational workflows in PowerPoint slides, shared spreadsheets, and email.

---

## The Insight

The person who needs to run a PI planning session is the same person who needs to know their team's blended day rate, maintain their org chart, track their delivery evidence, and present their roadmap to the CTO. These are not separate problems. They share the same data — the same teams, the same people, the same organisational context.

A platform built around that shared context — where your teams and resources are defined once and flow through every tool — is fundamentally more powerful than four disconnected point solutions.

---

## Who This Is For

**Primary audience:** Heads of Platform, Heads of Delivery, Engineering Managers, Platform Architects

**Secondary audience:** Individual contributors in Platform teams who need personal evidence tracking and achievement management (Chronicle)

**Tertiary audience:** Organisations evaluating tooling spend — Plato is a fraction of the cost of enterprise alternatives and deployable to existing Azure infrastructure

---

## The Four Modules

### Org Chart — *the backbone*
Map your platform organisation. Define teams, name resources, set roles and day rates. This is the data layer that every other module draws from.

**Standalone value:** Any organisation that needs a living, accurate picture of its platform teams and resource costs.

### Dispatch
Orchestrate PI Planning. Run Big Room Planning events, manage team capacity, track features across trains and teams. Built for SAFe-adjacent teams running quarterly planning at scale.

**Standalone value:** Any organisation running PI planning that's outgrown spreadsheets and sticky notes.

### Chronicle
Your professional knowledge OS. Capture achievements, evidence delivery, track OKRs, build the business case for your platform. Intelligent filtering surfaces the right evidence at the right time — for appraisals, for stakeholders, for team retrospectives.

**Standalone value:** Any platform practitioner who needs to demonstrate impact, or any team building an evidence base for investment decisions.

### Roadmap
An executive-grade roadmap canvas. Communicate platform strategy clearly to leadership, without PowerPoint.

**Standalone value:** Any platform leader presenting a multi-quarter technology roadmap to a non-technical audience.

---

## What Makes This Different

**Built by a practitioner, for practitioners.** Every feature in Plato exists because it was needed in a real Platform Engineering context. This isn't a generic project management tool retrofitted with platform terminology.

**Shared data model.** Teams defined in Org Chart appear automatically in Dispatch. Resources with day rates feed the finance calculator. Chronicle evidence links to roadmap outcomes. The integration isn't bolted on — it's structural.

**White-label ready.** Every display name, theme, and brand element is configuration. Organisations can deploy Plato under their own brand, with their own identity provider, on their own infrastructure.

**Deployable anywhere.** Containerised, OIDC-standard, 12-factor. Runs on Vercel, Azure, AWS, GCP, or any container runtime.

---

## Business Model

- **One-off source code sale** per module or full suite
- Optional paid bespoke work as a separate engagement
- No ongoing support obligation in base price
- White-label licensing available

**Indicative pricing (subject to change):**

| Module | Indicative Price |
|---|---|
| Org Chart | £2,500 |
| Dispatch | £3,500 |
| Chronicle | £750 (or open source — TBD) |
| Roadmap | £1,500 |
| Full Suite | TBD |

---

## Go-To-Market Approach

- Brand-led, anonymous — not personal LinkedIn
- Free public demos on fictional seed data as primary funnel
- Chronicle as the entry point and community hook (vibe engineering audience)
- Dispatch as the flagship commercial product
- Open source consideration for Chronicle to drive awareness

---

## Brand Voice

These lines capture the Plato thesis. Use them in demos, presentations, and documentation.

- *"SaaS is dead for workflow tooling."* — The SaaSPocalypse framing. Deliberately provocative for the right audience.
- *"The filtering isn't a feature — it's the product."* — Chronicle's core insight, and a design principle across the suite.
- *"The best people to solve a problem are the ones who suffer it daily."*
- *"Catch the fish. Then teach them to fish. Then give them the rod, the net, the bucket, and the licence."*
- *"The model you use today is the worst you will ever use for the rest of your life."* — Kevin Weil, CPO OpenAI. The case for building on AI now, not waiting.

---

## White-Label Skin Demo

At the completion of Module 1 (Nucleus), the suite will demonstrate white-labelling by shipping two skins:

1. **Plato Default** — the generic product skin. Clean, professional, distinctive. Establishes the Plato design language.
2. **RMG Reference Skin** — applies Royal Mail Group brand tokens (royalRed `#EE2722`, royalYellow `#FDDD1C`, RMG value stream palette) over the same components.

Switching between them is a single config change — no component code changes. This is the most powerful demonstration of the architecture's white-label capability and should be a centrepiece of any sales conversation.

---

- A replacement for Jira, Linear, or GitHub Issues (task management)
- A replacement for Confluence or Notion (general knowledge management)
- A tool for any specific client or industry
- A feature-for-feature competitor to Monday.com or Productboard

Plato is narrow on audience and deep on fit. Platform Engineering teams are underserved. That's the position.

---

## Module Roadmap (high level)

**Now — Module 1:** Org Chart rebuild. Generic, production-ready, no client fingerprints. Shared schema backbone. Finance / blended day rate calculator as first concrete output.

**Next — Module 2:** Dispatch genericisation. Strip RMG references. Connect to shared teams/resources schema.

**Then — Module 3:** Chronicle on shared platform. Auth, shared schema, design system.

**Then — Module 4:** Roadmap — rebuild on shared platform.

**Future:** Additional modules as the platform matures. Each becomes another independently shippable product.
