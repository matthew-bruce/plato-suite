# ADR-026 — Suite Module URL Structure: Subfolders Not Subdomains

Date: 2026-04-19
Status: Accepted

## Decision
Plato Suite modules are deployed under subfolders of a single domain,
not on separate subdomains.

Generic SaaS deployment:
  app.example.com/nucleus
  app.example.com/dispatch
  app.example.com/chronicle
  app.example.com/cursus

White-label client deployment:
  platform.client.com/nucleus
  platform.client.com/dispatch
  platform.client.com/chronicle

## Context
Each module is a separate Next.js app that can be deployed standalone.
In the integrated suite deployment, a gateway/router sits at the root
and proxies to each module under its subfolder prefix.

The subfolder approach was chosen over subdomains because shared cookies
and auth tokens work across subfolders without CORS configuration; the
suite shell can be a true shared React component rather than a link-out
pattern; white-label clients typically operate under one domain, not five.

## Alternatives Considered
**Separate subdomains** (`nucleus.app.example.com`) — rejected. Requires
CORS handling for shared auth, makes the app switcher a link-out rather
than a shared component, complicates SSL management for white-label.

**Single Next.js monolith** — rejected. Violates the independently-
deployable principle. Creates a monolithic build and deploy cycle.

## Consequences
- Each module has its own build and deploy pipeline
- A reverse proxy / gateway handles subfolder routing in production
- The suite shell navigates between modules using relative paths
  (`/dispatch`, `/chronicle`) rather than absolute URLs
- White-label config in `tenant.config.ts` specifies base path per
  module — no hardcoded domain or client name anywhere in code
- Local development: each module runs on its own port (nucleus: 3001,
  dispatch: 3002, etc.) — subfolder routing is a production concern only
- No client names, domains, or identifiers appear in application code
  — all deployment configuration is via environment variables
