-- Plato Core Schema — Migration 001
-- Baseline schema for Nucleus (Platform Engineering team management)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Reference / catalogue tables ────────────────────────────────────────────

CREATE TABLE public.organisations (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  slug         TEXT        UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.suppliers (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  code             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.infrastructures (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  type             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.role_definitions (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  code             TEXT,
  level            INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.disciplines (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  code             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.skills (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  discipline_id  UUID        REFERENCES public.disciplines(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  code           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platforms (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Agile delivery structure ─────────────────────────────────────────────────

CREATE TABLE public.arts (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  code             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workstreams (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  art_id       UUID        REFERENCES public.arts(id) ON DELETE SET NULL,
  platform_id  UUID        REFERENCES public.platforms(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  code         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.teams (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  art_id     UUID        REFERENCES public.arts(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  code       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_workstreams (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  workstream_id  UUID        NOT NULL REFERENCES public.workstreams(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, workstream_id)
);

-- ─── People / resourcing ──────────────────────────────────────────────────────

CREATE TABLE public.resources (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id     UUID           REFERENCES public.organisations(id) ON DELETE CASCADE,
  team_id             UUID           REFERENCES public.teams(id) ON DELETE SET NULL,
  role_definition_id  UUID           REFERENCES public.role_definitions(id) ON DELETE SET NULL,
  supplier_id         UUID           REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name                TEXT           NOT NULL,
  email               TEXT,
  type                TEXT           NOT NULL DEFAULT 'internal'
                        CHECK (type IN ('internal', 'contractor', 'managed_service')),
  fte                 NUMERIC(4, 2)  NOT NULL DEFAULT 1.0,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE public.resource_skills (
  id                UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id       UUID     NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  skill_id          UUID     NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level INTEGER  CHECK (proficiency_level BETWEEN 1 AND 5),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (resource_id, skill_id)
);

-- ─── Auth / access ────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  auth_id          UUID        UNIQUE,
  email            TEXT        UNIQUE NOT NULL,
  name             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.roles (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  role_name        TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Planning ─────────────────────────────────────────────────────────────────

CREATE TABLE public.periods (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'quarter'
                     CHECK (type IN ('quarter', 'month', 'sprint', 'pi')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.resource_period_allocations (
  id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id    UUID           NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  period_id      UUID           NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  team_id        UUID           REFERENCES public.teams(id) ON DELETE SET NULL,
  workstream_id  UUID           REFERENCES public.workstreams(id) ON DELETE SET NULL,
  allocation     NUMERIC(4, 2)  NOT NULL DEFAULT 1.0,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── Commercial ──────────────────────────────────────────────────────────────

CREATE TABLE public.supplier_rate_cards (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id         UUID           NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  role_definition_id  UUID           REFERENCES public.role_definitions(id) ON DELETE SET NULL,
  rate                NUMERIC(10, 2) NOT NULL,
  currency            TEXT           NOT NULL DEFAULT 'GBP',
  effective_from      DATE           NOT NULL,
  effective_to        DATE,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cost_configurations (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  config           JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SAFe / PI planning ───────────────────────────────────────────────────────

CREATE TABLE public.planning_increments (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  art_id     UUID        REFERENCES public.arts(id) ON DELETE SET NULL,
  period_id  UUID        REFERENCES public.periods(id) ON DELETE SET NULL,
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Org hierarchy ────────────────────────────────────────────────────────────

CREATE TABLE public.org_containers (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID        REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_id        UUID        REFERENCES public.org_containers(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  type             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
