-- 002_q4_fy2526_schedule.sql
-- Seeds Q4 FY 25/26 and Q1 FY 26/27 periods, the Web Platform cost
-- configuration effective from 2025-01-01, and ~65 resource_period
-- allocations for Q4 FY 25/26.
--
-- Idempotent: periods use PK ON CONFLICT; cost_configurations use PK
-- ON CONFLICT; allocations use a NOT EXISTS guard since the table has
-- no natural unique constraint on (resource_id, period_id, role_id).
--
-- Resources are resolved by name. If a resource does not exist in the
-- DB (e.g. "Natalia Zalewska", or "TBC" placeholders), the JOIN drops
-- the row silently — this is intentional.
--
-- All money is stored as integer pence per ADR-029.

-- ─── 2a — Periods ────────────────────────────────────────────────────
INSERT INTO periods (period_id, period_name, period_start_date, period_end_date, period_status)
VALUES
  ('bb000001-0000-0000-0000-000000000001',
   'Q4 FY 25/26', '2025-01-01', '2025-03-31', 'closed'),
  ('bb000001-0000-0000-0000-000000000002',
   'Q1 FY 26/27', '2025-04-01', '2025-06-30', 'active')
ON CONFLICT (period_id) DO NOTHING;

-- ─── 2b — Cost configuration for Web Platform (Q4 FY 25/26) ──────────
-- £550/day = 55000 pence (human-set rate, not auto-calculated)
-- VAT uplift of 7.082% — RMG irrecoverable VAT (partial exemption — postal services)
INSERT INTO cost_configurations (
  cost_configuration_id, platform_id,
  vat_uplift_percent, on_costs_uplift_percent, blended_day_rate_override,
  effective_from
)
VALUES (
  'cc000001-0000-0000-0000-000000000001',
  (SELECT platform_id FROM platforms WHERE platform_code = 'WEB'),
  7.082,
  0,
  55000,
  '2025-01-01'
)
ON CONFLICT (cost_configuration_id) DO NOTHING;

-- ─── 2c — Resource period allocations for Q4 FY 25/26 ────────────────
-- 63 working days, Jan–Mar 2025. day_rate in pence.
INSERT INTO resource_period_allocations
  (resource_id, period_id, role_title, planview_code, day_rate, utilisation_percent, capacity_days, is_chargeable)
SELECT
  r.resource_id,
  'bb000001-0000-0000-0000-000000000001'::uuid,
  v.role_title,
  v.planview_code,
  v.day_rate,
  v.utilisation_percent,
  v.capacity_days,
  v.is_chargeable
FROM (VALUES
  -- (resource_name, role_title, planview_code, day_rate_pence, util_pct, capacity_days, is_chargeable)
  ('Matthew Bruce',              'Platform Owner',                'BAU',   58000,  0,  0,  false),
  ('Paul Williams',              'Lead Product Owner',            'F_Gov', 58000,  100, 63, false),
  ('Selen Hamilton',             'Lead Product Owner',            'F_Gov', 58000,  100, 63, false),
  ('Mike James',                 'Lead Product Owner',            'PR',    58000,  100, 63, true),
  ('Ajmal Malik',                'Lead Solution Architect',       'F_Gov', 58000,  100, 63, false),
  ('Justin Fox',                 'Lead Software Engineer',        'F_Gov', 58000,  0,  63, false),
  ('Anjusmita Choudhury',        'Lead Test Manager',             'F_Gov', 58000,  100, 63, false),
  ('Dipti Devanga',              'Test Lead',                     'PR',    58000,  90, 63, true),
  ('Leopold Kwok',               'Software Engineer (FE)',        'PR',    58000,  90, 63, true),
  ('James Baxter',               'Software Engineer (BE)',        'PR',    58000,  90, 17, true),
  ('Rohith Nair',                'Software Engineer (BE)',        'PR',    58000,  90, 52, true),
  ('Semiu Salawu',               'Solution Architect',            'PR',    91485,  100, 63, true),
  ('Sarah Ashton',               'Project Manager',               'PR',    80000,  100, 63, true),
  ('Ankit Singh',                'Test Engineer',                 'PR',    40000,  90, 63, true),
  ('Paulina Krzyzanska',         'Technical Analyst',             'PR',    36000,  100, 63, true),
  ('Emil Nowak',                 'Azure Infrastructure Engineer', 'PR',    60000,  50, 63, true),
  ('Mateusz Kowalewski',         'Azure Solution Architect',      'PR',    60000,  100, 63, true),
  ('Maciej Imiolek',             'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Tomasz Foltynski',           'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Mariusz Redzimski',          'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Adam Dobrzeniewski',         'React Developer',               'PR',    45000,  100, 63, true),
  ('Krzysztof Derek',            'React Developer',               'PR',    45000,  100, 63, true),
  ('Jan Urbaniak',               'Platform / DevOps Engineer',    'PR',    48000,  100, 63, true),
  ('Natalia Zalewska',           'Technical Analyst',             'PR',    36000,  100, 63, true),
  ('Maciej Cieslak',             'Azure Solution Architect',      'PR',    60000,  100, 63, true),
  ('Grzegorz Lang',              'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Pawel Pluta',                'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Bartlomiej Kubica',          'Azure Full Stack Developer',    'PR',    45000,  100, 63, true),
  ('Jakub Benzef',               'Platform / DevOps Engineer',    'PR',    48000,  100, 63, true),
  ('Grzegorz Bech',              'Test Automation Engineer',      'PR',    38000,  100, 63, true),
  ('Olga Bartczak',              'Technical Analyst',             'PR',    36000,  100, 63, true),
  ('Grant Bramley',              'Scrum Master',                  'PR',    75000,  100, 57, true),
  ('James Taylor',               'Senior Product Owner',          'PR',    99500,  100, 57, true),
  ('Najam Khan-Muztar',          'Analytics / Data Lead',         'PR',    85000,  100, 57, true),
  ('Rajesh Dubey',               'Scrum Master',                  'PR',    75000,  100, 57, true),
  ('Bharat Patil',               'Senior Project Manager',        'F_Gov', 117492, 100, 57, false),
  ('Sajesh Advilkar',            'Programme Manager',             'F_Gov', 37980,  100, 54, false),
  ('Manasi Ketkar',              'PMO Manager',                   'F_Gov', 15559,  100, 15, false),
  ('Makarand Parab',             'App / Solution Architect',      'PR',    44181,  100, 54, true),
  ('Tejaswini Patil',            'Business Analyst',              'PR',    28422,  100, 54, true),
  ('Poornachandran Ramakrishnan','DevOps Principal Consultant',   'PR',    31370,  100, 54, true),
  ('Nikhil Vibhav',              'DevOps Principal Consultant',   'PR',    31370,  100, 54, true),
  ('Nick Walter',                'DevOps Principal Consultant',   'PR',    132020, 100, 12, true),
  ('Anupama Yadav',              'Senior Developer / Analyst',    'PR',    18517,  100, 54, true),
  ('Daniel Chambers',            'Business Analyst',              'PR',    81177,  100, 19, true),
  ('Yashvanth C',                'Test Automation Analyst',       'PR',    16661,  100, 54, true),
  ('Dat Ly',                     'Senior Project Manager',        'PR',    117492, 100, 54, true),
  ('Zouhir Saad-Saoud',          'App / Solution Architect',      'PR',    111694, 100, 56, true),
  ('Nilesh Kumar',               'NFT Manager',                   'PR',    27557,  100, 54, true),
  ('Paul Dixon',                 'DevOps Principal Consultant',   'PR',    132020, 100, 6,  true),
  ('Praneeth Gudelli',           'Senior Test Analyst',           'PR',    20422,  100, 54, true),
  ('Vipul Suriya',               'Developer / Analyst',           'PR',    31370,  100, 54, true),
  ('Praneetha Bandlamudi',       'Senior Test Analyst',           'PR',    16661,  100, 18, true),
  ('Savita Khatavkar',           'Business Analyst',              'PR',    28422,  100, 54, true),
  ('Priyanka Dhole',             'Senior Test Analyst',           'PR',    16661,  100, 54, true),
  ('Margala Kumar',              'DevOps Senior Consultant',      'PR',    20948,  100, 54, true),
  ('Shilpa Surve',               'Scrum Master',                  'PR',    14895,  100, 54, true),
  ('Mohit Porwal',               'DevOps Senior Consultant',      'PR',    16661,  100, 18, true),
  ('Arti Lamje',                 'Test Lead',                     'PR',    20422,  100, 54, true),
  ('Shruti Shukla',              'Test Analyst',                  'PR',    12446,  100, 18, true),
  ('Virginie Tan',               'UX Lead',                       'PR',    91715,  100, 47, true),
  ('Tom Tanser',                 'Security Manager',              'PR',    100242, 100, 3,  true),
  ('Rajat Pandey',               'Web Analytics Specialist',      'PR',    20901,  100, 54, true),
  ('Rajat Jain',                 'Senior Project Manager',        'PR',    31634,  100, 6,  true),
  ('Amol Tate',                  'Test Lead',                     'F_Gov', 20422,  100, 9,  false),
  ('Dipti Chaudhari',            'Test Analyst',                  'F_Gov', 40082,  100, 45, false),
  ('Anupama Rs',                 'Business Analyst',              'PR',    16661,  100, 54, true)
) AS v(resource_name, role_title, planview_code, day_rate, utilisation_percent, capacity_days, is_chargeable)
JOIN resources r ON r.resource_name = v.resource_name AND r.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM resource_period_allocations rpa
  WHERE rpa.resource_id = r.resource_id
    AND rpa.period_id = 'bb000001-0000-0000-0000-000000000001'::uuid
    AND rpa.role_id IS NULL
);
