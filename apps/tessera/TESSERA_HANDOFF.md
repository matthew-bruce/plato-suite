# Tessera — Handoff from India Trip Project

## Context

Tessera is a new app in the Plato Suite — a KT (Knowledge Transfer) Operating System built to manage a complex supplier transition (Capgemini → TCS) on Royal Mail Group's eBusiness platform. It was designed in full in the India Trip Claude Project. Everything below is additive context that the Plato Project does not have. Build target: `apps/tessera/` inside the Turborepo monorepo.

**Hard deadline: functional before Sunday 26 April.** The user travels to India that evening.

---

## 1. Feature Decisions

### MVP1 — Must exist before Sunday 26 April
- Navigation shell with track selector, domain browser, person filter
- Domain detail views — structured content for both tracks per domain, navigable on a standard laptop screen (not large monitor, not mobile)
- KT Readiness Dashboard — RAG scoring per domain across 6 defined dimensions
- Itinerary page — day-by-day trip schedule with session-linked objectives and nuggets
- Resources page — people, roles, suppliers, domain linkages, visible gaps
- Nuggets page — filterable insight cards by theme/category
- Gantt view — transition timeline and milestone tracker (needed as standalone HTML artefact first, then embedded in app)

### Phase 2
- Gap register
- Actions tracker
- Team coordination / shared capture across users
- CRUD for people and domain linkages
- Gantt real-time feed from app data

### Phase 3
- Claude API hook for in-session AI capture and dashboard enrichment
- Slideshow/presentation mode surfacing nugget cards by theme (same pattern as Chronicle)

### Explicitly NOT in MVP
- Authentication
- Supabase Realtime
- Multi-user collaboration
- Mobile optimisation

---

## 2. Schema Decisions

Own Supabase tables, Nucleus naming conventions, compatible for future migration to shared DB. Architect for Claude API hook in Phase 3 — don't build it yet, just don't make it impossible.

### Core tables

**domains**
- id, name, subtitle, description, risk_level (enum: HIGH, MEDIUM, LOW, SCOPED), display_order

**domain_track_content**
- id, domain_id, track (enum: A, B), field_type (enum: smes, extract_topics, opening_question, test_block, red_flag, confluence_artefacts, parker_mapping, notes, cg_caveat, note_block), content (text)

**people**
- id, name, role, supplier (enum: CG, TCS, RMG, HT, NH, EPAM, TAAS, TBC), location (enum: ONSHORE_UK, OFFSHORE_INDIA, NEARSHORE_POLAND, ONSHORE_UK_TEMP), availability_pct (int), notes

**domain_people**
- id, domain_id, person_id, track (enum: A, B, BOTH), role_in_kt (text)

**rag_scores**
- id, domain_id, dimension (enum: PEOPLE, SESSIONS, DEMO, DOCUMENTATION, PEER_REVIEW, MILESTONE), score (enum: RED, AMBER, GREEN), evidence (text), updated_at, updated_by

**nuggets**
- id, number (int), title, content (text), tags (text array), is_private (bool, default true)

**itinerary_days**
- id, date, day_label, notes

**itinerary_sessions**
- id, day_id, team (enum: DELIVERY, SERVICE), location, supplier_host (enum: TCS, CG), focus (text), linked_domain_ids (int array), linked_nugget_ids (int array)

**parker_questions**
- id, number (int 1-7), question (text)

**domain_parker_mapping**
- domain_id, parker_question_id

### Future Phase 2 tables (schema-only stubs, no UI)
- gaps (id, domain_id, description, severity, owner, status, created_at)
- actions (id, description, owner, due_date, status, domain_id, source)

---

## 3. Naming and Terminology

These are fixed. Use them consistently in UI copy, labels, and code.

| Term | Meaning |
|---|---|
| Tessera | The app name |
| Domain | One of 12 knowledge areas the transition must cover |
| Track A | CG Extraction — knowledge pulled from Capgemini before they leave |
| Track B | TCS Onboarding — knowledge TCS needs to service manage the full platform |
| Nugget | A private insight, talking point, or strategic observation for use in-session |
| RAG | Red/Amber/Green readiness score |
| KT | Knowledge Transfer |
| CG | Capgemini |
| TCS | Tata Consultancy Services |
| HT | Happy Team (nearshore Poland) |
| NH | North Highland (onshore UK) |
| RMG | Royal Mail Group (internal) |
| eBiz | eBusiness platform (royalmail.com, parcelforce.com) |
| BIG | A separate platform workstream (Jonny's domain, one quarter behind eBiz) |
| Parker's 7 | Seven questions from CG Director Robert Parker that the app implicitly answers |
| Peak | Royal Mail's Christmas peak trading period (mid-Nov → early Jan) |

Track A colour: `#e8382a` (red)
Track B colour: `#4a9eff` (blue)

Supplier colour coding (person tags throughout UI):
- CG: red `#e8382a`
- RMG: green `#2ecc71`
- HT: blue `#4a9eff`
- NH: amber `#f5a623`
- TBC/unknown: purple `#9b59b6`

---

## 4. UI and Layout Decisions

- **Laptop-screen-first.** User works primarily on a standard laptop. Not large monitor. Not mobile. Every view must be fully functional and readable at 1366×768 minimum.
- **Navigation:** persistent sidebar or top nav with sections: Dashboard, Domains, Itinerary, Resources, Nuggets, Gantt.
- **Track selector:** global or per-domain toggle that sets context to Track A or Track B. When viewing a domain, both tracks should be visible simultaneously (side-by-side panels).
- **Domain browser:** filterable by risk level, supplier relevance, track. Each domain card shows name, risk pill, RAG status at a glance.
- **Person filter:** ability to filter the domain view or resources page by a named individual (e.g. show all domains linked to Nick Walter).
- **RAG scoring:** overall domain RAG = worst single dimension score (not average). This is intentionally strict. One RED dimension = domain is RED overall.
- **Collapsible sections** within domain detail views — framework content is dense, must be expandable/collapsible.
- **Nuggets:** each card shows number, title, content. Filterable by tag. Private by default — no public-facing flag needed for MVP.
- **Itinerary page:** day-by-day cards. Each session card shows team split (Delivery vs Service), location, supplier host, linked domain domains, linked nuggets as chips.
- **Gantt:** milestone-based, not task-based. Shows Q1/Q2/Q3 eBiz timeline and Q2/Q3/Q4 BIG timeline. Extractable as standalone HTML.

---

## 5. Seed Data

### 12 Domains (in order)

| # | Name | Risk Level |
|---|---|---|
| 1 | Drupal / Legacy CMS | HIGH |
| 2 | Camel / Integration + Zeus | HIGH |
| 3 | Platform Engineering / DevOps | HIGH |
| 4 | Magento / eCommerce | MEDIUM |
| 5 | ForgeRock / IAM | SCOPED |
| 6 | Release Management | HIGH |
| 7 | QA / Testing | HIGH |
| 8 | Analytics | LOW |
| 9 | Azure Platform / Cloud Infrastructure | HIGH |
| 10 | React / Frontend Framework | MEDIUM |
| 11 | Security | MEDIUM |
| 12 | Service Management / Support Operations | HIGH |

### Transition Timeline (Gantt seed)

eBiz: Q1 Apr–Jun 26 (CG prime / TCS shadow) → Q2 Jul–Sep 26 (switch) → Q3 Oct–Dec 26 (TCS prime / CG hypercare)
BIG: Q2 Jul–Sep 26 (CG prime / TCS shadow) → Q3 Oct–Dec 26 (switch) → Q4 Jan–Mar 27 (TCS prime / CG hypercare)

### Trip Itinerary Seed

| Date | Team | Location | Supplier Host |
|---|---|---|---|
| Sun 26 Apr | All | Depart Heathrow 20:10 | — |
| Mon 27 Apr | All | Delhi arrival + joint dinner | TCS + CG |
| Tue 28 Apr | Delivery (Matt + Jonny) | Gurgaon | TCS |
| Tue 28 Apr | Service (Clare + Mandy) | Noida | CG |
| Wed 29 Apr | Delivery (Matt + Jonny) | Gurgaon | TCS |
| Wed 29 Apr | Service (Clare + Mandy) | Noida | CG |
| Thu 30 Apr | Delivery (Matt + Jonny) | Noida | CG |
| Thu 30 Apr | Service (Clare + Mandy) | Gurgaon | TCS |
| Fri 1 May | All | Depart Delhi 02:05, arrive Heathrow 07:20 | — |

CG address: 139–140 Noida SEZ A Block, Phase-2, Noida, UP 201305
TCS address: Skyview Corporate Park, Sector-74A, NH-8, Gurugram, Haryana 122001

### Key People Seed

**Capgemini (CG)**
- Sajesh Advilkar — Offshore Delivery Manager, India (primary contact)
- Makarand Parab — Solution Architect, India
- Bharat Patil — Technical Delivery Manager, UK
- Nick Walter — Camel/Integration SME, UK, 60% committed
- Paul Dixon — Platform Engineer, UK, up to 100%
- Nikhil Vibhav — Camel/Integration, India
- Vipul Suriya — Drupal SME, India (split Cosmos/Janus)
- Ramakrisnan Poornachandran — Drupal SME, India
- Hitendrasinh Rajput — Magento SME, India (back with SM team but available for KT)
- Amol Tate — QA / Test Lead
- Nilesh Kumar — Performance Test Analyst, India
- Rajat Pandey — Analytics Consultant, India (leaving)
- Shilpa Surve — Scrum Master, India
- Manasi Ketkar — PMO, India (5 days/month)
- Robert Parker — CG Director (retained 1–2 days/week through year end)
- Zouhir Saad-Saoud — Solution Architect, UK (Cygnus)

**RMG**
- Matthew Bruce — Head of Web / Customer Platforms (primary user of Tessera)
- Jonny Wooldridge — Director of Platforms & Build (BIG lead on trip)
- Clare Dean — Service Manager
- Mandy Tucker — Service Manager
- Mark Dickson — Programme Director, Project Dudley
- Paul Williams — Lead Product Owner (candidate KT data steward — not yet confirmed)
- Ajmal Malik — Lead Solutions Architect
- Anjusmita Choudhury — Lead Test Manager
- Justin Fox — Lead Software Engineer
- Selen Hamilton — Demand Manager
- Mike James — Delivery Owner

**Happy Team (HT) — Nearshore Poland**
- Emil Nowak — Azure Technical Lead
- Mateusz Kowalewski — Azure Solution Architect
- Maciej Cieslak — Azure Solution Architect
- Jakub Benzef — DevOps Engineer
- Jan Urbaniak — DevOps Engineer
- Leopold Kwok — React Frontend (RMG, not HT — correct in DB)

**North Highland (NH) — Onshore UK**
- Najam Khan-Muztar — Analytics (staying, not leaving)
- James Taylor — Delivery Owner
- Grant Bramley — Agile Coach

### Parker's 7 Questions Seed

1. What's the KT demand of Dudley on the factory, if any, and how can that be accommodated?
2. What's the resource demand on factory to support migrations and can that be accommodated?
3. What is the impact of migrations on the factory pipeline and how can it be managed?
4. What is the impact of migrations on service activities and how can it be managed?
5. What does the service transition timeline mean for factory releases and KT?
6. What is the optimal plan for transitioning factory resources from CG to TCS?
7. How do we track and manage the above including impacts of any plan changes?

### 19 Nuggets Seed

All nuggets are private (is_private: true). Content as follows:

1. Real objective = transfer critical knowledge without service degradation while establishing control over a new, unproven supplier. Trip is optics — what WE bring determines whether it's also useful.
2. Flip the timing narrative: "We should have been here earlier. We're correcting that now." Humility without undermining authority. Structured extraction > morale management.
3. KT illusion — shadowing ≠ understanding, documentation ≠ operability. Test KT, don't observe. Ask TCS to demonstrate something independently. Don't use this language externally.
4. Direct operational icebreakers: "What breaks first if you left tomorrow?" / "Where is documentation misleading or outdated?" / "What does TCS not yet understand?" — entry points into the real conversation.
5. TCS conditional carrot — not a commitment, a pathway. Keep the lights on legacy + build the right strategic teams = earn a role in the new Azure world. CG failed this test. TCS can choose differently. Multi-supplier model, not monopoly.
6. Trip is CIO-sanctioned. Steve Potts referenced it personally in a note to CG's Billie Major. Not a morale visit — positioned at CIO level as a signal of commitment. Use that weight.
7. Robert Parker and Jon are staying — 1–2 days/week through year end. His 7 questions are not rhetorical. He'll follow up. Framework outputs must be presentable to him.
8. BIG timeline ringfenced — shadow over Peak 26, transition Jan 27. Steve personally committed to commercial certainty for CG BIG team through peak. Don't over-promise BIG CG resource availability before January.
9. Political temperature is warm — by design. CG leadership praised and asked to stay. People in India should be primed to cooperate. Don't mistake managed politeness for genuine capability transfer.
10. DST dispute settled. No unresolved commercial grievance to navigate.
11. eBiz timeline confirmed: Q1 Apr–Jun (CG prime/TCS shadow) → Q2 Jul–Sep (switch) → Q3 Oct–Dec (TCS prime/CG hypercare). TCS not charging for transition but "billable" trigger is undefined — commercial time bomb. Must be resolved before Q2.
12. ForgeRock v5.5 — survival mode only. Just needs to stay alive through Peak (mid-Nov 26 → Jan 27). Ping Identity SaaS replacement already in motion. Don't invest India trip time beyond confirming a runbook exists.
13. Analytics boundary — Digital owns it, not Platform. Rajat Pandey (CG) is the only leaver. Najam (NH) stays. KT scope: TrustArc, Tealium, Adobe Analytics, event-driven data layer status. Don't over-engineer this domain.
14. "eBusiness' Incomplete Guide to Everything" — a real Confluence page title. Use as a disarming opener: "We literally named a page that — so tell me what's genuinely not written down anywhere." Invites honesty without confrontation.
15. Magento has no named KT resource in the estimate. Hitendrasinh Rajput (CG) was on loan until end of March — he's back with SM team but still available. Ask Sajesh directly: "Who holds Magento knowledge on your side today?"
16. Trip split confirmed. Matt + Jonny = 2 days TCS (Tue/Wed, Gurgaon) + 1 day CG (Thu, Noida). Clare + Mandy = 2 days CG + 1 day TCS. Track A must land everything in ONE day. Ruthless prioritisation required.
17. TCS will be ~20% through KT on arrival — Mark's expectation, not confirmed reality. Test this assumption on day one with the framework test blocks. Don't accept "on track" without evidence.
18. Ways of working for TCS in factory is UNRESOLVED. CG accepted shadowing but flagged accountability confusion if TCS write code or execute tests. Must be addressed — at minimum as a stated intent — before leaving India. Open action: Matt, Tahir, Chris M, Ian Hanson.
19. CG retention shape likely mirrors HCL deal: 1-year SoW + 10% retainer on completion. Commercial lever to keep critical KT people (Sajesh, Nick Walter, Paul Dixon) engaged through Q3. Parker + Jon already retained separately at CIO level.

### RAG Scoring Criteria Seed

Six dimensions. Overall domain RAG = worst single dimension (not average).

| Dimension | GREEN | AMBER | RED |
|---|---|---|---|
| PEOPLE | Named SME (CG/other) AND TCS counterpart both confirmed | One side named, other TBC | Neither side named |
| SESSIONS | At least one KT session held | Session scheduled, not yet held | Nothing scheduled |
| DEMO | TCS demonstrated independent capability | Can describe but not execute | Not attempted or failed |
| DOCUMENTATION | Exists, current, TCS have access | Exists but outdated or access unconfirmed | Doesn't exist or location unknown |
| PEER_REVIEW | RMG SME has technically assured the KT output | In progress | Not started |
| MILESTONE | On track for Q2 switch | At risk, needs action | Off track, blocker identified |

---

## 6. Open Questions

These were raised but not yet resolved. Tessera should surface them as open items:

- **Ways of working** — TCS role in factory (shadowing vs. active development/testing) not yet agreed. Action owner: Matt Bruce, Tahir Mahmood, Chris M, Ian Hanson.
- **Billable trigger** — when does TCS transition activity become chargeable? Undefined. Commercial time bomb before Q2.
- **Paul Williams as KT data steward** — proposed but not confirmed.
- **TCS developer candidates** — were expected for review shortly after 1 April. Status unknown.
- **CG retention SoW** — being shaped on HCL model, not yet signed. Affects whether key KT people (Nick Walter, Paul Dixon etc.) are commercially secured through Q3.
- **Confluence full export** — the full eBusiness Platform Confluence space (~6,752 pages) has not yet been extracted. The ToC structure is known; page content is not.
- **Magento current SME** — Hitendrasinh is available but his actual engagement for KT has not been confirmed with Sajesh.

---

## 7. Additional Context

- **Matt Bruce** (Head of Web / Customer Platforms) is the primary user. He is the person on the ground in India. The app must serve him in-session — fast to navigate, readable on a laptop, nothing that requires a large screen.
- **Jonny Wooldridge** covers BIG (Lot 2). BIG's transition is one quarter behind eBiz. Some domains (especially Azure, React, Service Management) are relevant to both. Tessera should accommodate BIG as a second workstream in a future iteration — but eBiz is the only scope for MVP.
- **Clare Dean and Mandy Tucker** are Service Managers. They spend 2 days with CG and 1 day with TCS. Their capture (if any) feeds into the same framework. Team coordination between Delivery (Matt/Jonny) and Service (Clare/Mandy) is a Phase 2 feature.
- **Mark Dickson** is Programme Director for Project Dudley. He needs a Gantt for CTO/CIO consumption — this is a parallel priority to the app itself. The Gantt should be extractable from Tessera as a standalone HTML artefact.
- **Robert Parker** (CG Director) is retained 1–2 days/week. He has submitted 7 formal questions about the transition. Tessera's RAG dashboard implicitly answers them. The Parker question mapping (which domains feed which Parker question) is already defined in the framework content.
- The existing KT OS Framework is built as a single HTML file (KT_OS_Framework.html, v1.1). All 12 domain content, both tracks, all nuggets, itinerary, and Parker mapping are fully written up in that file. This is the content source for Tessera's seed data — the Plato project should request this file if needed.