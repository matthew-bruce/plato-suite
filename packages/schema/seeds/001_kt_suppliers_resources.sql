-- =============================================================================
-- 001_kt_suppliers_resources.sql
-- Seed: KT transition suppliers and people.
-- Applied to Nucleus project 22 Apr 2025 alongside 002 migration.
-- DO NOT re-run — data is already present.
-- =============================================================================

INSERT INTO suppliers (supplier_name, supplier_abbreviation, supplier_slug, supplier_colour, sort_order)
VALUES
  ('Capgemini',                 'CG',   'capgemini',      '#E8382A', 1),
  ('Tata Consultancy Services', 'TCS',  'tcs',            '#1565C0', 2),
  ('Royal Mail Group',          'RMG',  'rmg',            '#2ECC71', 3),
  ('Happy Team',                'HT',   'happy-team',     '#4A9EFF', 4),
  ('North Highland',            'NH',   'north-highland', '#F5A623', 5),
  ('EPAM',                      'EPAM', 'epam',           '#9B59B6', 6),
  ('TAAS',                      'TAAS', 'taas',           '#00897B', 7)
ON CONFLICT DO NOTHING;

INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('capgemini', 'Sajesh Advilkar',            'Offshore Delivery Manager',    'offshore',  'India',          1),
  ('capgemini', 'Makarand Parab',             'Solution Architect',           'offshore',  'India',          2),
  ('capgemini', 'Bharat Patil',               'Technical Delivery Manager',   'onshore',   'United Kingdom', 3),
  ('capgemini', 'Nick Walter',                'Camel/Integration SME',        'onshore',   'United Kingdom', 4),
  ('capgemini', 'Paul Dixon',                 'Platform Engineer',            'onshore',   'United Kingdom', 5),
  ('capgemini', 'Nikhil Vibhav',              'Camel/Integration Engineer',   'offshore',  'India',          6),
  ('capgemini', 'Vipul Suriya',               'Drupal SME',                   'offshore',  'India',          7),
  ('capgemini', 'Ramakrisnan Poornachandran', 'Drupal SME',                   'offshore',  'India',          8),
  ('capgemini', 'Hitendrasinh Rajput',        'Magento SME',                  'offshore',  'India',          9),
  ('capgemini', 'Amol Tate',                  'QA / Test Lead',               'offshore',  'India',          10),
  ('capgemini', 'Nilesh Kumar',               'Performance Test Analyst',     'offshore',  'India',          11),
  ('capgemini', 'Rajat Pandey',               'Analytics Consultant',         'offshore',  'India',          12),
  ('capgemini', 'Shilpa Surve',               'Scrum Master',                 'offshore',  'India',          13),
  ('capgemini', 'Manasi Ketkar',              'PMO',                          'offshore',  'India',          14),
  ('capgemini', 'Robert Parker',              'Director',                     'onshore',   'United Kingdom', 15),
  ('capgemini', 'Zouhir Saad-Saoud',          'Solution Architect',           'onshore',   'United Kingdom', 16),
  ('rmg', 'Matthew Bruce',        'Head of Web / Customer Platforms', 'onshore', 'United Kingdom', 17),
  ('rmg', 'Jonny Wooldridge',     'Director of Platforms & Build',    'onshore', 'United Kingdom', 18),
  ('rmg', 'Clare Dean',           'Service Manager',                  'onshore', 'United Kingdom', 19),
  ('rmg', 'Mandy Tucker',         'Service Manager',                  'onshore', 'United Kingdom', 20),
  ('rmg', 'Mark Dickson',         'Programme Director',               'onshore', 'United Kingdom', 21),
  ('rmg', 'Paul Williams',        'Lead Product Owner',               'onshore', 'United Kingdom', 22),
  ('rmg', 'Ajmal Malik',          'Lead Solutions Architect',         'onshore', 'United Kingdom', 23),
  ('rmg', 'Anjusmita Choudhury',  'Lead Test Manager',                'onshore', 'United Kingdom', 24),
  ('rmg', 'Justin Fox',           'Lead Software Engineer',           'onshore', 'United Kingdom', 25),
  ('rmg', 'Selen Hamilton',       'Demand Manager',                   'onshore', 'United Kingdom', 26),
  ('rmg', 'Mike James',           'Delivery Owner',                   'onshore', 'United Kingdom', 27),
  ('rmg', 'Leopold Kwok',         'React Frontend Engineer',          'onshore', 'United Kingdom', 28),
  ('happy-team', 'Emil Nowak',         'Azure Technical Lead',     'nearshore', 'Poland', 29),
  ('happy-team', 'Mateusz Kowalewski', 'Azure Solution Architect', 'nearshore', 'Poland', 30),
  ('happy-team', 'Maciej Cieslak',     'Azure Solution Architect', 'nearshore', 'Poland', 31),
  ('happy-team', 'Jakub Benzef',       'DevOps Engineer',          'nearshore', 'Poland', 32),
  ('happy-team', 'Jan Urbaniak',       'DevOps Engineer',          'nearshore', 'Poland', 33),
  ('north-highland', 'Najam Khan-Muztar', 'Analytics Consultant', 'onshore', 'United Kingdom', 34),
  ('north-highland', 'James Taylor',     'Delivery Owner',         'onshore', 'United Kingdom', 35),
  ('north-highland', 'Grant Bramley',    'Agile Coach',            'onshore', 'United Kingdom', 36)
) AS p(supplier_slug, rname, jtitle, rloc, rcountry, sorder)
JOIN suppliers s ON s.supplier_slug = p.supplier_slug AND s.deleted_at IS NULL;

-- ============================================================
-- PATCH: Applied 22 Apr 2025 — factory team reconciliation
-- ============================================================

-- Corrections to original seed
UPDATE resources SET resource_location = 'onshore', resource_country = 'United Kingdom'
  WHERE resource_name = 'Amol Tate';
UPDATE resources SET resource_name = 'Poornachandran Ramakrishnan'
  WHERE resource_name = 'Ramakrisnan Poornachandran';

-- New supplier: Lean Tree
INSERT INTO suppliers (supplier_name, supplier_abbreviation, supplier_slug, supplier_colour, sort_order)
VALUES ('Lean Tree', 'LT', 'lean-tree', '#607D8B', 8) ON CONFLICT DO NOTHING;
