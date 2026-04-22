-- =============================================================================
-- 001_kt_suppliers_resources.sql
-- Seed: KT transition suppliers and all known factory resources.
-- @plato/schema — applies to Nucleus Supabase project.
-- Applied in two passes 22 Apr 2025. DO NOT re-run — data already present.
-- =============================================================================

-- Suppliers (8)
INSERT INTO suppliers (supplier_name, supplier_abbreviation, supplier_slug, supplier_colour, sort_order)
VALUES
  ('Capgemini',                  'CG',   'capgemini',      '#E8382A', 1),
  ('Tata Consultancy Services',  'TCS',  'tcs',            '#1565C0', 2),
  ('Royal Mail Group',           'RMG',  'rmg',            '#2ECC71', 3),
  ('Happy Team',                 'HT',   'happy-team',     '#4A9EFF', 4),
  ('North Highland',             'NH',   'north-highland', '#F5A623', 5),
  ('EPAM',                       'EPAM', 'epam',           '#9B59B6', 6),
  ('TAAS',                       'TAAS', 'taas',           '#00897B', 7),
  ('Lean Tree',                  'LT',   'lean-tree',      '#607D8B', 8)
ON CONFLICT DO NOTHING;

-- Capgemini (35)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('Sajesh Advilkar',            'Offshore Delivery Manager',     'offshore', 'India',           1),
  ('Makarand Parab',             'Solution Architect',            'offshore', 'India',           2),
  ('Bharat Patil',               'Technical Delivery Manager',    'onshore',  'United Kingdom',  3),
  ('Nick Walter',                'Camel/Integration SME',         'onshore',  'United Kingdom',  4),
  ('Paul Dixon',                 'Platform Engineer',             'onshore',  'United Kingdom',  5),
  ('Nikhil Vibhav',              'Camel/Integration Engineer',    'offshore', 'India',           6),
  ('Vipul Suriya',               'Drupal SME',                    'offshore', 'India',           7),
  ('Poornachandran Ramakrishnan','Drupal SME',                    'offshore', 'India',           8),
  ('Hitendrasinh Rajput',        'Magento SME',                   'offshore', 'India',           9),
  ('Amol Tate',                  'QA / Test Lead',                'onshore',  'United Kingdom', 10),
  ('Nilesh Kumar',               'Performance Test Analyst',      'offshore', 'India',          11),
  ('Rajat Pandey',               'Analytics Consultant',          'offshore', 'India',          12),
  ('Shilpa Surve',               'Scrum Master',                  'offshore', 'India',          13),
  ('Manasi Ketkar',              'PMO',                           'offshore', 'India',          14),
  ('Robert Parker',              'Director',                      'onshore',  'United Kingdom', 15),
  ('Zouhir Saad-Saoud',          'Solution Architect',            'onshore',  'United Kingdom', 16),
  ('Daniel Chambers',            'Product Owner',                 'onshore',  'United Kingdom', 37),
  ('Dat Ly',                     'Product Owner',                 'onshore',  'United Kingdom', 38),
  ('Tejaswini Patil',            'Technical Analyst',             'offshore', 'India',          39),
  ('Anupama Rs',                 'Drupal Engineer',               'offshore', 'India',          40),
  ('Anupama Yadav',              'Integration (Camel) Engineer',  'offshore', 'India',          41),
  ('Praneeth Gudelli',           'Test Automation Engineer',      'offshore', 'India',          42),
  ('Shruti Shukla',              'Test Automation Engineer',      'offshore', 'India',          43),
  ('Arti Lamje',                 'Test Automation Engineer',      'offshore', 'India',          44),
  ('Dipti Chaudhari',            'Test Automation Engineer',      'offshore', 'India',          45),
  ('Yashvanth C',                'Automation Tester',             'offshore', 'India',          46),
  ('Savita Khatavkar',           'Technical Analyst',             'offshore', 'India',          47),
  ('Margala Kumar',              'Drupal Engineer',               'offshore', 'India',          48),
  ('Mohit Porwal',               'Front End (React) Engineer',    'offshore', 'India',          49),
  ('Priyanka Dhole',             'Test Automation Engineer',      'offshore', 'India',          50),
  ('Praneetha Bandlamudi',       'Test Automation Engineer',      'offshore', 'India',          51),
  ('Virginie Tan',               'UX Lead',                       'onshore',  'United Kingdom', 52),
  ('Rajat Jain',                 'Service Introduction',          'offshore', 'India',          53),
  ('Tom Tanser',                 'Security SME',                  'onshore',  'United Kingdom', 54),
  ('Sean Hall',                  'Commercial',                    'onshore',  'United Kingdom', 55)
) AS p(rname, jtitle, rloc, rcountry, sorder)
CROSS JOIN (SELECT supplier_id FROM suppliers WHERE supplier_slug = 'capgemini' AND deleted_at IS NULL) s;

-- Royal Mail Group (17)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('Matthew Bruce',       'Head of Web / Customer Platforms',  'onshore', 'United Kingdom', 17),
  ('Jonny Wooldridge',    'Director of Platforms & Build',     'onshore', 'United Kingdom', 18),
  ('Clare Dean',          'Service Manager',                   'onshore', 'United Kingdom', 19),
  ('Mandy Tucker',        'Service Manager',                   'onshore', 'United Kingdom', 20),
  ('Mark Dickson',        'Programme Director',                'onshore', 'United Kingdom', 21),
  ('Paul Williams',       'Lead Product Owner',                'onshore', 'United Kingdom', 22),
  ('Ajmal Malik',         'Lead Solutions Architect',          'onshore', 'United Kingdom', 23),
  ('Anjusmita Choudhury', 'Lead Test Manager',                 'onshore', 'United Kingdom', 24),
  ('Justin Fox',          'Lead Software Engineer',            'onshore', 'United Kingdom', 25),
  ('Selen Hamilton',      'Demand Manager',                    'onshore', 'United Kingdom', 26),
  ('Mike James',          'Delivery Owner',                    'onshore', 'United Kingdom', 27),
  ('Leopold Kwok',        'React Frontend Engineer',           'onshore', 'United Kingdom', 28),
  ('Dipti Devanga',       'Test Automation Engineer',          'onshore', 'United Kingdom', 82),
  ('Christopher Palmer',  'Front End (React) SME',             'onshore', 'United Kingdom', 83),
  ('James Baxter',        'Back End (.NET) SME',               'onshore', 'United Kingdom', 84),
  ('Rohith Nair',         'Back End (.NET) SME',               'onshore', 'United Kingdom', 85),
  ('Semiu Salawu',        'Solution Architect',                'onshore', 'United Kingdom', 86)
) AS p(rname, jtitle, rloc, rcountry, sorder)
CROSS JOIN (SELECT supplier_id FROM suppliers WHERE supplier_slug = 'rmg' AND deleted_at IS NULL) s;

-- Happy Team (17)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('Emil Nowak',         'Azure Technical Lead',        'nearshore', 'Poland', 29),
  ('Mateusz Kowalewski', 'Azure Solution Architect',    'nearshore', 'Poland', 30),
  ('Maciej Cieslak',     'Azure Solution Architect',    'nearshore', 'Poland', 31),
  ('Jakub Benzef',       'DevOps Engineer',             'nearshore', 'Poland', 32),
  ('Jan Urbaniak',       'DevOps Engineer',             'nearshore', 'Poland', 33),
  ('Paulina Krzyzanska', 'Product Owner',               'nearshore', 'Poland', 56),
  ('Tomasz Foltynski',   'Azure Full Stack Developer',  'nearshore', 'Poland', 57),
  ('Adam Dobrzeniewski', 'Front End (React) Engineer',  'nearshore', 'Poland', 58),
  ('Maciej Imiolek',     'Full Stack (Azure) Engineer', 'nearshore', 'Poland', 59),
  ('Mariusz Redzimski',  'Full Stack (Azure) Engineer', 'nearshore', 'Poland', 60),
  ('Krzysztof Derek',    'Front End (React) Engineer',  'nearshore', 'Poland', 61),
  ('Olga Bartczak',      'Technical Analyst',           'nearshore', 'Poland', 62),
  ('Grzegorz Lang',      'Full Stack (Azure) Engineer', 'nearshore', 'Poland', 63),
  ('Pawel Pluta',        'Full Stack (Azure) Engineer', 'nearshore', 'Poland', 64),
  ('Bartlomiej Kubica',  'Full Stack (Azure) Engineer', 'nearshore', 'Poland', 65),
  ('Grzegorz Bech',      'Test Automation Engineer',    'nearshore', 'Poland', 66),
  ('Kamil Bedkowski',    'Solution Architect',          'nearshore', 'Poland', 67)
) AS p(rname, jtitle, rloc, rcountry, sorder)
CROSS JOIN (SELECT supplier_id FROM suppliers WHERE supplier_slug = 'happy-team' AND deleted_at IS NULL) s;

-- North Highland (5)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('Najam Khan-Muztar', 'Analytics Consultant', 'onshore', 'United Kingdom', 34),
  ('James Taylor',      'Delivery Owner',        'onshore', 'United Kingdom', 35),
  ('Grant Bramley',     'Agile Coach',           'onshore', 'United Kingdom', 36),
  ('Rajesh Dubey',      'Scrum Master',          'onshore', 'United Kingdom', 68),
  ('Natalie Cole',      'Programme Manager',     'onshore', 'United Kingdom', 69)
) AS p(rname, jtitle, rloc, rcountry, sorder)
CROSS JOIN (SELECT supplier_id FROM suppliers WHERE supplier_slug = 'north-highland' AND deleted_at IS NULL) s;

-- EPAM (11)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT s.supplier_id, p.rname, p.jtitle, p.rloc::resource_location_enum, p.rcountry, p.sorder
FROM (VALUES
  ('Aliaksei Yakimovich', 'Delivery Owner',     'nearshore', 'Lithuania',      70),
  ('Pavel Yukhnovich',    'Front End Engineer', 'onshore',   'United Kingdom', 71),
  ('Ekaterina Webster',   'Front End Engineer', 'onshore',   'United Kingdom', 72),
  ('Roman Syromiatnikov', 'Back End Engineer',  'nearshore', 'Czech Republic', 73),
  ('Mikalai Kavaliou',    'Back End Engineer',  'nearshore', 'Belarus',        74),
  ('Svetlana Solodkaia',  'QA Engineer Lead',   'nearshore', 'Hungary',        75),
  ('Dzianis Roi',         'Technical Lead',     'onshore',   'United Kingdom', 76),
  ('Rachel Hatcher',      'Technical Analyst',  'onshore',   'United Kingdom', 77),
  ('Maksim Klimenko',     'Front End Engineer', 'onshore',   'United Kingdom', 78),
  ('Gleb Kazak',          'Back End Engineer',  'nearshore', 'Belarus',        79),
  ('Daria Grek',          'QA Engineer Lead',   'nearshore', 'Poland',         80)
) AS p(rname, jtitle, rloc, rcountry, sorder)
CROSS JOIN (SELECT supplier_id FROM suppliers WHERE supplier_slug = 'epam' AND deleted_at IS NULL) s;

-- TAAS (1)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT supplier_id, 'Ankit Singh', 'Automation Tester', 'onshore'::resource_location_enum, 'United Kingdom', 81
FROM suppliers WHERE supplier_slug = 'taas' AND deleted_at IS NULL;

-- Lean Tree (1)
INSERT INTO resources (supplier_id, resource_name, resource_job_title, resource_location, resource_country, sort_order)
SELECT supplier_id, 'Sarah Ashton', 'Project Manager', 'onshore'::resource_location_enum, 'United Kingdom', 87
FROM suppliers WHERE supplier_slug = 'lean-tree' AND deleted_at IS NULL;

-- Total: 8 suppliers, 87 resources. TCS seeded with 0 people — names TBC.
