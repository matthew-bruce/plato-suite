-- Seeds the 29 confirmed Capgemini → TCS ("Dudley") transition records into
-- resource_supplier_transitions (created in 033).
--
-- DML, applied via execute_sql rather than apply_migration per the Supabase
-- MCP conventions in WORKING_AGREEMENT.md. Committed here so the repo's
-- migration history matches the deployed data.
--
-- Real, Matt-confirmed data reconciled 16 Aug 2026 — not placeholder content.
--
-- Names are resolved to resource_id and supplier abbreviations to supplier_id
-- by lookup, never by hardcoded UUID. Two guards matter:
--
--   1. resources has a soft-deleted duplicate of 'Hitendrasinh Rajput', so the
--      lookup filters deleted_at IS NULL or the join would go ambiguous.
--   2. Matthew Bruce is the Platform Head, not a delivery resource, and must
--      never appear on the Resource Timeline view (standing rule, confirmed
--      16 Aug). He is not in the list below, and the explicit exclusion in the
--      final WHERE keeps it that way if this file is ever edited.
--
-- Idempotent: ON CONFLICT against resource_supplier_transitions_unique makes
-- a re-run an update rather than a duplicate insert.
--
-- On the three dates, see the column comments in 033. In particular
-- joining_date is recorded but never drives bar geometry, and a NULL
-- commercial_start means "derive from Q3 monthly days" — which is why the nine
-- established-at-TCS joiners at the bottom deliberately have none.

WITH seed(resource_name, from_abbr, to_abbr, last_working_day, joining_date, commercial_start, status, notes) AS (
  VALUES
    ('Amol Tate',                   'CG',  'TCS', DATE '2026-08-13', DATE '2026-08-24', DATE '2026-08-24', 'confirmed',      'F_Gov role, no billing delay'),
    ('Rajat Pandey',                'CG',  'TCS', DATE '2026-08-25', DATE '2026-09-01', DATE '2026-09-01', 'confirmed',      'F_Gov role, no billing delay'),
    ('Praneeth Gudelli',            'CG',  'TCS', DATE '2026-09-29', DATE '2026-10-01', DATE '2026-10-08', 'confirmed',      NULL),
    ('Dipti Borole',                'CG',  'TCS', DATE '2026-09-29', DATE '2026-10-05', DATE '2026-10-12', 'confirmed',      NULL),
    ('Hitendrasinh Rajput',         'CG',  'TCS', NULL,              DATE '2026-10-07', DATE '2026-10-14', 'confirmed',      'CG unaware — no resignation on record; flag as overlap risk'),
    ('Makarand Parab',              'CG',  'TCS', DATE '2026-10-16', DATE '2026-10-22', DATE '2026-11-02', 'confirmed',      'Agreed override; verify against real working-day calc at render time'),
    ('Anupama Yadav',               'CG',  'TCS', DATE '2026-09-30', DATE '2026-10-26', DATE '2026-11-02', 'confirmed',      'Maternity leave, not resignation'),
    ('Priyanka Dhole',              'CG',  'TCS', DATE '2026-10-16', DATE '2026-10-26', DATE '2026-11-02', 'confirmed',      NULL),
    ('Vipul Suriya',                'CG',  'TCS', DATE '2026-10-30', DATE '2026-11-09', DATE '2026-11-16', 'confirmed',      NULL),
    ('Poornachandran Ramakrishnan', 'CG',  'TCS', DATE '2026-11-04', DATE '2026-11-23', DATE '2026-12-01', 'confirmed',      'Agreed override — commercial start moved to 1 Dec'),
    ('Nikhil Vibhav',               'CG',  'TCS', DATE '2026-10-31', NULL,              DATE '2026-12-01', 'signed_doj_tbc', 'Commercial start tentative — 1 Dec'),
    ('Nilesh Kumar',                'CG',  'TCS', DATE '2026-10-31', NULL,              DATE '2026-12-01', 'signed_doj_tbc', 'Commercial start tentative — 1 Dec'),
    ('Sajesh Advilkar',             'CG',  NULL,  DATE '2026-10-31', NULL,              NULL,              'not_moving',     'Hypercare only, no TCS move'),
    ('Bharat Patil',                'CG',  NULL,  DATE '2026-10-31', NULL,              NULL,              'not_moving',     'Hypercare only, no TCS move'),
    ('Deepak Balasaheb Pawar',      'CG',  NULL,  DATE '2026-10-31', NULL,              NULL,              'not_moving',     'Hypercare only, no TCS move'),
    ('Pradeep Bolke',               'CG',  NULL,  DATE '2026-10-31', NULL,              NULL,              'left_platform',  'Moving to Service, not this platform'),
    ('Praneetha Bandlamudi',        'CG',  NULL,  DATE '2026-09-06', NULL,              NULL,              'not_moving',     NULL),
    ('Anupama Rs',                  'CG',  NULL,  DATE '2026-09-30', NULL,              NULL,              'not_moving',     NULL),
    ('Arti Lamje',                  'CG',  NULL,  DATE '2026-09-30', NULL,              NULL,              'not_moving',     NULL),
    ('Savita Khatavkar',            'CG',  NULL,  DATE '2026-09-30', NULL,              NULL,              'not_moving',     NULL),
    ('Yashvanth C',                 'CG',  NULL,  DATE '2026-09-30', NULL,              NULL,              'not_moving',     NULL),
    ('Mathivanan Pandurangan',      NULL,  'TCS', NULL,              DATE '2026-09-01', NULL,              'confirmed',      'No CG history — commercial start derived from Q3 monthly days, not this DOJ'),
    ('Deva Palanisamy',             NULL,  'TCS', NULL,              DATE '2026-09-01', NULL,              'confirmed',      'No CG history — commercial start derived from Q3 monthly days, not this DOJ'),
    ('Pradibha Devendran',          NULL,  'TCS', NULL,              DATE '2026-09-01', NULL,              'confirmed',      'No CG history — commercial start derived from Q3 monthly days, not this DOJ'),
    ('Naresh Kottala',              NULL,  'TCS', NULL,              DATE '2026-09-01', NULL,              'confirmed',      'No CG history — commercial start derived from Q3 monthly days, not this DOJ'),
    ('Kiran MH',                    NULL,  'TCS', NULL,              DATE '2026-09-01', NULL,              'confirmed',      'No CG history — commercial start derived from Q3 monthly days, not this DOJ'),
    ('Samiran Banerjee',            NULL,  'TCS', NULL,              DATE '2026-10-01', NULL,              'confirmed',      'Derive real start from Q3 monthly days'),
    ('Sandeep Medidi',              NULL,  'TCS', NULL,              DATE '2026-10-05', NULL,              'confirmed',      'Derive real start from Q3 monthly days'),
    ('Prajwal Kumar',               NULL,  'TCS', NULL,              DATE '2026-10-26', NULL,              'confirmed',      'Derive real start from Q3 monthly days')
)
INSERT INTO public.resource_supplier_transitions (
  resource_id, from_supplier_id, to_supplier_id,
  last_working_day, joining_date, commercial_start,
  status, notes, is_confirmed
)
SELECT
  r.resource_id,
  fs.supplier_id,
  ts.supplier_id,
  s.last_working_day,
  s.joining_date,
  s.commercial_start,
  s.status,
  s.notes,
  TRUE
FROM seed s
JOIN public.resources r
  ON lower(trim(r.resource_name)) = lower(trim(s.resource_name))
 AND r.deleted_at IS NULL
LEFT JOIN public.suppliers fs ON fs.supplier_abbreviation = s.from_abbr
LEFT JOIN public.suppliers ts ON ts.supplier_abbreviation = s.to_abbr
WHERE lower(trim(s.resource_name)) <> 'matthew bruce'
ON CONFLICT (resource_id, from_supplier_id, to_supplier_id)
  WHERE deleted_at IS NULL
DO UPDATE SET
  last_working_day = EXCLUDED.last_working_day,
  joining_date     = EXCLUDED.joining_date,
  commercial_start = EXCLUDED.commercial_start,
  status           = EXCLUDED.status,
  notes            = EXCLUDED.notes,
  is_confirmed     = EXCLUDED.is_confirmed,
  updated_at       = now();
