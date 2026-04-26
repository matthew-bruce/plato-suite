-- =============================================================================
-- 001_kt_schema.sql
-- Tessera KT Operating System — core schema.
-- Single-tenant MVP per ADR-TESS-001. RLS enabled with open policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core domain registry
-- ---------------------------------------------------------------------------
CREATE TABLE kt_domains (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  subtitle      TEXT,
  description   TEXT,
  risk_level    TEXT        CHECK (risk_level IN ('HIGH','MEDIUM','LOW','SCOPED')),
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Track A / Track B structured content per domain
-- ---------------------------------------------------------------------------
CREATE TABLE kt_domain_track_content (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   UUID        NOT NULL REFERENCES kt_domains(id) ON DELETE CASCADE,
  track       TEXT        NOT NULL CHECK (track IN ('A','B')),
  field_type  TEXT        NOT NULL CHECK (field_type IN (
                'smes','extract_topics','opening_question','test_block',
                'red_flag','confluence_artefacts','parker_mapping',
                'notes','cg_caveat','note_block')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- People (factory resources involved in KT)
-- ---------------------------------------------------------------------------
CREATE TABLE kt_people (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  role             TEXT,
  supplier         TEXT        NOT NULL CHECK (supplier IN (
                     'CG','TCS','RMG','HT','NH','EPAM','TAAS','TBC')),
  location         TEXT        CHECK (location IN (
                     'ONSHORE_UK','OFFSHORE_INDIA','NEARSHORE_POLAND','ONSHORE_UK_TEMP')),
  availability_pct INT         DEFAULT 100,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Domain ↔ People join (with KT-specific role)
-- ---------------------------------------------------------------------------
CREATE TABLE kt_domain_people (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   UUID        NOT NULL REFERENCES kt_domains(id)  ON DELETE CASCADE,
  person_id   UUID        NOT NULL REFERENCES kt_people(id)   ON DELETE CASCADE,
  track       TEXT        CHECK (track IN ('A','B','BOTH')),
  role_in_kt  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- RAG scoring per domain × dimension
-- ---------------------------------------------------------------------------
CREATE TABLE kt_rag_scores (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   UUID        NOT NULL REFERENCES kt_domains(id) ON DELETE CASCADE,
  dimension   TEXT        NOT NULL CHECK (dimension IN (
                'PEOPLE','SESSIONS','DEMO','DOCUMENTATION','PEER_REVIEW','MILESTONE')),
  score       TEXT        NOT NULL CHECK (score IN ('RED','AMBER','GREEN')),
  evidence    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT,
  UNIQUE (domain_id, dimension)
);

-- ---------------------------------------------------------------------------
-- Knowledge nuggets
-- ---------------------------------------------------------------------------
CREATE TABLE kt_nuggets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  number     INT         NOT NULL,
  title      TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  tags       TEXT[]      DEFAULT '{}',
  is_private BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Itinerary
-- ---------------------------------------------------------------------------
CREATE TABLE kt_itinerary_days (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL,
  day_label   TEXT        NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kt_itinerary_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id             UUID        NOT NULL REFERENCES kt_itinerary_days(id) ON DELETE CASCADE,
  team               TEXT        CHECK (team IN ('DELIVERY','SERVICE')),
  location           TEXT,
  supplier_host      TEXT        CHECK (supplier_host IN ('TCS','CG')),
  focus              TEXT,
  linked_domain_ids  UUID[]      DEFAULT '{}',
  linked_nugget_ids  UUID[]      DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Parker's 7 Questions
-- ---------------------------------------------------------------------------
CREATE TABLE kt_parker_questions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  number     INT         NOT NULL UNIQUE,
  question   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kt_domain_parker_mapping (
  domain_id          UUID NOT NULL REFERENCES kt_domains(id)          ON DELETE CASCADE,
  parker_question_id UUID NOT NULL REFERENCES kt_parker_questions(id) ON DELETE CASCADE,
  PRIMARY KEY (domain_id, parker_question_id)
);

-- ---------------------------------------------------------------------------
-- Phase 2 stubs (DDL only — no seed, no UI)
-- ---------------------------------------------------------------------------
CREATE TABLE kt_gaps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   UUID        REFERENCES kt_domains(id) ON DELETE SET NULL,
  description TEXT        NOT NULL,
  severity    TEXT        CHECK (severity IN ('HIGH','MEDIUM','LOW')),
  owner       TEXT,
  status      TEXT        DEFAULT 'OPEN',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kt_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT        NOT NULL,
  owner       TEXT,
  due_date    DATE,
  status      TEXT        DEFAULT 'OPEN',
  domain_id   UUID        REFERENCES kt_domains(id) ON DELETE SET NULL,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- RLS — enabled on all tables, open policies for MVP
-- ---------------------------------------------------------------------------
ALTER TABLE kt_domains               ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_domain_track_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_people                ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_domain_people         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_rag_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_nuggets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_itinerary_days        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_itinerary_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_parker_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_domain_parker_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_gaps                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kt_actions               ENABLE ROW LEVEL SECURITY;

-- kt_domains
CREATE POLICY "open_select" ON kt_domains               FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_domains               FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_domains               FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_domains               FOR DELETE USING (true);

-- kt_domain_track_content
CREATE POLICY "open_select" ON kt_domain_track_content  FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_domain_track_content  FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_domain_track_content  FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_domain_track_content  FOR DELETE USING (true);

-- kt_people
CREATE POLICY "open_select" ON kt_people                FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_people                FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_people                FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_people                FOR DELETE USING (true);

-- kt_domain_people
CREATE POLICY "open_select" ON kt_domain_people         FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_domain_people         FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_domain_people         FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_domain_people         FOR DELETE USING (true);

-- kt_rag_scores
CREATE POLICY "open_select" ON kt_rag_scores            FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_rag_scores            FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_rag_scores            FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_rag_scores            FOR DELETE USING (true);

-- kt_nuggets
CREATE POLICY "open_select" ON kt_nuggets               FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_nuggets               FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_nuggets               FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_nuggets               FOR DELETE USING (true);

-- kt_itinerary_days
CREATE POLICY "open_select" ON kt_itinerary_days        FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_itinerary_days        FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_itinerary_days        FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_itinerary_days        FOR DELETE USING (true);

-- kt_itinerary_sessions
CREATE POLICY "open_select" ON kt_itinerary_sessions    FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_itinerary_sessions    FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_itinerary_sessions    FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_itinerary_sessions    FOR DELETE USING (true);

-- kt_parker_questions
CREATE POLICY "open_select" ON kt_parker_questions      FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_parker_questions      FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_parker_questions      FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_parker_questions      FOR DELETE USING (true);

-- kt_domain_parker_mapping
CREATE POLICY "open_select" ON kt_domain_parker_mapping FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_domain_parker_mapping FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_domain_parker_mapping FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_domain_parker_mapping FOR DELETE USING (true);

-- kt_gaps
CREATE POLICY "open_select" ON kt_gaps                  FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_gaps                  FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_gaps                  FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_gaps                  FOR DELETE USING (true);

-- kt_actions
CREATE POLICY "open_select" ON kt_actions               FOR SELECT USING (true);
CREATE POLICY "open_insert" ON kt_actions               FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update" ON kt_actions               FOR UPDATE USING (true);
CREATE POLICY "open_delete" ON kt_actions               FOR DELETE USING (true);
