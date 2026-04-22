# ADR-004 — OIDC-Standard Authentication

Date: 2026-04-19
Status: Accepted

## Decision
Authentication is handled via the OpenID Connect (OIDC) standard.
The application never stores enterprise credentials. It consumes
tokens only. Four environment variables are sufficient to configure
any compliant identity provider.

```
OIDC_ISSUER_URL=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
```

## Provider compatibility
Any OIDC-compliant provider works without code changes:
- Supabase Auth (own SaaS deployment)
- Microsoft Entra ID / Azure AD
- Okta
- Ping Identity
- ForgeRock
- Auth0
- Clerk
- Any other OIDC-compliant provider

## Context
Enterprise clients have existing identity infrastructure. Requiring
them to migrate to a specific auth provider is a deployment blocker.
OIDC is the industry standard for federated identity — it is supported
by every major enterprise identity platform.

For the Plato SaaS deployment, Supabase Auth is used (email/password
or social login). For enterprise deployments, the four OIDC env vars
point at the client's existing provider.

## Auth flow
```
User hits Plato app
→ App redirects to configured IdP
→ IdP validates identity
→ IdP issues OIDC token
→ App validates token via @plato/auth
→ Session established — app never saw a password
```

## Current state (April 2026)
Auth is not yet wired up in Nucleus. Temporary anon RLS policies
allow development access (see ADR-031). Auth implementation is a
production-readiness blocker.

## Consequences
- Swapping identity providers = changing four environment variables,
  zero code changes
- The application never stores passwords or enterprise credentials
- Session management is handled by `@plato/auth` — application code
  calls `getSession()`, `requireAuth()` etc., never the IdP SDK directly
- Enterprise SSO is supported from day one — no retrofit required
