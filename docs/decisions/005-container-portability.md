# ADR-005 — Container Portability

Date: 2026-04-19
Status: Accepted

## Decision
All Plato Suite applications must run in any OCI-compliant container
runtime from day one. No Vercel-proprietary APIs or cloud-vendor-
specific services may be used in application code. All configuration
is supplied via environment variables.

## Context
Vercel is the primary deployment target for the Plato SaaS product
and is ideal for Next.js development. However, enterprise clients
deploy to their own infrastructure — Azure Container Apps, AWS ECS,
GCP Cloud Run, or on-premises Kubernetes. If the application
depends on Vercel-proprietary features, it cannot be deployed to
enterprise environments without significant rework.

## Rules
- No `@vercel/*` packages in application code
- No Vercel Edge Functions or Vercel-specific middleware APIs
- No hardcoded infrastructure assumptions (regions, domains, ports)
- All secrets and configuration via environment variables
- Docker-ready: each app can be built with `docker build` and run
  with `docker run`
- The app must start correctly with only environment variables —
  no manual post-deploy steps

## Vercel as a convenience, not a dependency
Vercel auto-deploys on push, provides preview URLs, and has zero-
config Next.js support. These are conveniences that speed up
development. They are not features the application depends on.

## Deployment targets
| Context | Platform |
|---|---|
| Plato SaaS | Vercel |
| Enterprise (Azure) | Azure Container Apps |
| Enterprise (AWS) | ECS / Fargate |
| Enterprise (GCP) | Cloud Run |
| Enterprise (on-prem) | Kubernetes / any OCI runtime |

The application code is identical in all cases.

## Consequences
- CI/CD must include both a Vercel pipeline (GitHub Actions → Vercel)
  and a Docker build pipeline (GitHub Actions → Container Registry)
- Environment variables are documented in `.env.example` for each app
- No persistent local filesystem use — container restarts must be
  stateless (Supabase is the only source of truth)
