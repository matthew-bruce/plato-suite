# PRINCIPLES.md — Plato Suite

These principles govern every product, technical, and commercial decision made on the Plato platform. They apply across all modules, all sessions, and all contributors.

---

## Product Principles

### 1. Build for the person who suffers the problem
The best tools are built by practitioners who live with the problem daily. Every feature in Plato exists because it was needed in a real Platform Engineering context. We do not build for imagined users.

### 2. The filtering isn't a feature — it's the product
Intelligent surfacing of the right information at the right time is more valuable than storage. Any module that captures data must also make it effortless to find, filter, and present. This is the core insight behind Chronicle and applies everywhere.

### 3. Show, don't tell
For demos, for selling, for teaching. A running product in front of someone is worth more than any amount of documentation or explanation. The demo tenant exists for this reason.

### 4. Bespoke costs the same as SaaS — act accordingly
For the first time in history, building a purpose-fit internal tool costs roughly the same as onboarding a SaaS product. This makes the procurement and vendor evaluation process an organisational liability. Plato is the embodiment of this principle.

### 5. Coherent suite, independent modules
Each module must be genuinely useful standalone. The suite must feel coherent when used together. Never sacrifice one for the other. Think Microsoft Office — Word works without Excel, but together they are exponentially more powerful.

### 6. Names carry meaning
Every product name in the Plato suite should carry intentional meaning that connects to the platform's purpose and philosophy. Plato — the examined, the structured, the philosophical foundation. Nucleus — the core that everything orbits. Chronicle — the record of what matters. When names change for white-label deployments, the rationale behind the default names should be documented so the new naming can carry equal intentionality.

---

## Technical Principles

### 7. If it matters, it goes in a file
Product decisions must never live only in conversation history. If an architectural decision, a naming convention, a schema change, or a coding rule is agreed — it goes into the appropriate `.md` file immediately. Documentation is not a post-build activity.

### 8. Tokens over values
Never hardcode a colour, spacing value, or typographic scale in component code. All design decisions live in the token system. This is what makes white-labelling a config change rather than a codebase change.

### 9. Components over repetition
If you style something twice, it belongs in `packages/ui/`. Page-specific variants of shared components are technical debt from the moment they are created.

### 10. Vendor abstraction everywhere
No vendor SDK is called directly from application code. Ever. The interface you build is the contract. The vendor is an implementation detail. One file to swap, nothing else changes.

### 11. Container-portable by default
Every application must run in any container runtime from day one. Vercel is a convenience, not a dependency. If it can't run in Docker, it's not done.

### 12. Any new pure function gets a test written at the same time
Not retroactively. Not later. At the same time. This applies to data transformations, utility functions, and business logic. It does not apply to UI components unless explicitly tasked.

### 13. CRUD is always complete
If a user can create something, they can edit and delete it. No exceptions. The edit form and delete confirmation are not optional extras — they are part of the feature. Never ship a create-only form.

---

## Commercial Principles

### 13. White-label is a config change, not a project
Display names, brand tokens, enabled modules, and themes all live in configuration. A client should be able to take Plato, point it at their identity provider, drop in a config file, and have their own branded product. No bespoke codebase work required.

### 14. Documentation refreshes with the brand
User documentation — including module naming rationale and brand narrative — must be refreshed in lockstep with any white-label configuration change. Shipping a renamed product with documentation that refers to "Plato" or "Nucleus" is not acceptable.

### 15. Demo first
No module ships without a working demo on realistic fictional data. The demo tenant is the primary sales tool. It must always be current, complete, and impressive.

### 16. No client fingerprints in the codebase
Zero hardcoded client names, data, logos, or assumptions anywhere in the repository. Demo data lives in seed scripts only. This is non-negotiable.

---

## Working Principles

### 17. One domain per session
Don't drift into adjacent concerns mid-session. If a new domain emerges, note it and address it in a dedicated session. Context switching mid-session produces worse outputs and harder-to-review decisions.

### 18. Challenge before complying
If a proposed approach creates technical debt, violates a principle, or has a better alternative — say so first. Do not silently comply with a suboptimal direction. This applies to both the human and the AI.

### 19. ADR before deviation
Any deviation from the locked tech stack or architectural principles requires an Architecture Decision Record before implementation. The ADR documents the decision, the context, the alternatives considered, and the rationale.

### 20. Use the right model for the task
Not every task requires the most powerful model. Using a heavier model for a simple task wastes time and money. Using a lighter model for a complex architectural decision produces worse outcomes. Match the model to the task deliberately.
