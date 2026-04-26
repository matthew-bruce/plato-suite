# ADR-006 — Vercel as Primary Deployment, Azure for Enterprise

Date: 2026-04-19
Status: Accepted

## Decision
The Plato SaaS product deploys to Vercel via GitHub Actions. Enterprise
client deployments target Azure Container Apps as the reference
enterprise platform. Both use identical application code — only
infrastructure configuration differs.

## CI/CD

### SaaS (Vercel)
- Push to `main` → Vercel auto-deploy to production
- Pull request → Vercel preview deployment
- GitHub Actions for tests and linting before deploy

### Enterprise (Azure reference)
- GitHub Actions pipeline
- Docker build → Azure Container Registry
- Azure Container Apps deployment
- ADO pipeline configuration shipped alongside GitHub Actions
  for clients running Azure DevOps

## Environment separation
| Environment | Purpose |
|---|---|
| Local | Development (`npm run dev`, port 3001+) |
| Preview | Per-PR Vercel preview URL |
| Staging | Vercel staging or Azure staging slot |
| Production | Vercel production or Azure Container Apps production |

All environment-specific values are in environment variables.
No environment is hardcoded in application code.

## Why Vercel primary
- Zero-config Next.js support
- Preview deployments per PR with no extra work
- Fastest iteration cycle during development
- Native Turborepo support

## Why Azure for enterprise reference
- The likely enterprise deployment target based on client base
- Azure Container Apps is a managed container platform that handles
  scaling, secrets, and networking without Kubernetes complexity
- ADO (Azure DevOps) is common in enterprise environments —
  shipping ADO pipeline config reduces client onboarding friction

## Consequences
- The Vercel Root Directory setting must be set to `apps/[module]`
  for each Vercel project — Turborepo requires this
- Docker build is a requirement before any enterprise deployment,
  not an afterthought
- Enterprise deployments require a reverse proxy (Azure Front Door
  or equivalent) to handle subfolder routing (ADR-026)
- Sentry and PostHog are wired in from first deployment —
  observability is not retrofitted
