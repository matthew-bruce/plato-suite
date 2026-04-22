-- =============================================================================
-- Seed: 001_kt_suppliers_resources.sql
-- Suppliers and resources for the KT (Knowledge Transfer) project
-- Organisation: Royal Mail Group (eBusiness Platform)
-- =============================================================================
-- Last updated: 2026-04-22
-- Changes: Updated supplier_colour values to brand-accurate hex codes; added HCL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SUPPLIERS
-- -----------------------------------------------------------------------------
-- Colours are brand-accurate where a logo exists; invented where noted.
-- HCL included for cross-platform reference (not used on eBiz platform).

INSERT INTO suppliers (supplier_name, supplier_abbreviation, supplier_slug, supplier_colour, sort_order) VALUES
  ('Capgemini',                'CG',   'capgemini',     '#003C82', 1),  -- Capgemini cobalt blue (logo mark)
  ('Tata Consultancy Services','TCS',  'tcs',           '#9B0A6E', 2),  -- TCS deep magenta (gradient logo, purple end)
  ('Royal Mail Group',         'RMG',  'rmg',           '#E2001A', 3),  -- Royal Mail Red (brand official)
  ('Happy Team',               'HT',   'happy-team',    '#FF8C00', 4),  -- Happy Team orange (smiley logo accent)
  ('North Highland',           'NH',   'north-highland', '#1A2B5B', 5), -- North Highland navy (primary brand colour)
  ('EPAM',                     'EPAM', 'epam',          '#3D3D3D', 6),  -- EPAM charcoal (dark brand identity)
  ('TAAS',                     'TAAS', 'taas',          '#7C3AED', 7),  -- Violet (invented — no logo available)
  ('Lean Tree',                'LT',   'lean-tree',     '#3ABFB8', 8),  -- Lean Tree teal (teal leaf from logo)
  ('HCL',                      'HCL',  'hcl',           '#1976F2', 9)   -- HCL vivid blue (wordmark)
ON CONFLICT (supplier_slug) DO UPDATE SET
  supplier_name        = EXCLUDED.supplier_name,
  supplier_abbreviation = EXCLUDED.supplier_abbreviation,
  supplier_colour      = EXCLUDED.supplier_colour,
  sort_order           = EXCLUDED.sort_order;


-- -----------------------------------------------------------------------------
-- RESOURCES
-- Helper: resolve supplier_id by abbreviation at seed time
-- -----------------------------------------------------------------------------
-- Note: TCS has 0 resources — names TBC
-- -----------------------------------------------------------------------------

INSERT INTO resources (supplier_id, resource_name, resource_location, resource_country, resource_job_title, sort_order)
SELECT s.supplier_id, r.resource_name, r.resource_location::resource_location_enum, r.resource_country, r.resource_job_title, r.sort_order
FROM (VALUES

  -- CG — Capgemini (35 resources)
  ('CG', 'Sajesh Advilkar',             'offshore', 'India',          'Offshore Delivery Manager',     1),
  ('CG', 'Makarand Parab',              'offshore', 'India',          'Solution Architect',             2),
  ('CG', 'Bharat Patil',                'onshore',  'United Kingdom', 'Technical Delivery Manager',     3),
  ('CG', 'Nick Walter',                 'onshore',  'United Kingdom', 'Camel/Integration SME',          4),
  ('CG', 'Paul Dixon',                  'onshore',  'United Kingdom', 'Platform Engineer',              5),
  ('CG', 'Nikhil Vibhav',               'offshore', 'India',          'Camel/Integration Engineer',     6),
  ('CG', 'Vipul Suriya',                'offshore', 'India',          'Drupal SME',                     7),
  ('CG', 'Poornachandran Ramakrishnan', 'offshore', 'India',          'Drupal SME',                     8),
  ('CG', 'Hitendrasinh Rajput',         'offshore', 'India',          'Magento SME',                    9),
  ('CG', 'Amol Tate',                   'onshore',  'United Kingdom', 'QA / Test Lead',                10),
  ('CG', 'Nilesh Kumar',                'offshore', 'India',          'Performance Test Analyst',       11),
  ('CG', 'Rajat Pandey',                'offshore', 'India',          'Analytics Consultant',           12),
  ('CG', 'Shilpa Surve',                'offshore', 'India',          'Scrum Master',                   13),
  ('CG', 'Manasi Ketkar',               'offshore', 'India',          'PMO',                            14),
  ('CG', 'Robert Parker',               'onshore',  'United Kingdom', 'Director',                       15),
  ('CG', 'Zouhir Saad-Saoud',           'onshore',  'United Kingdom', 'Solution Architect',             16),
  ('CG', 'Daniel Chambers',             'onshore',  'United Kingdom', 'Product Owner',                  37),
  ('CG', 'Dat Ly',                      'onshore',  'United Kingdom', 'Product Owner',                  38),
  ('CG', 'Tejaswini Patil',             'offshore', 'India',          'Technical Analyst',              39),
  ('CG', 'Anupama Rs',                  'offshore', 'India',          'Drupal Engineer',                40),
  ('CG', 'Anupama Yadav',               'offshore', 'India',          'Integration (Camel) Engineer',   41),
  ('CG', 'Praneeth Gudelli',            'offshore', 'India',          'Test Automation Engineer',       42),
  ('CG', 'Shruti Shukla',               'offshore', 'India',          'Test Automation Engineer',       43),
  ('CG', 'Arti Lamje',                  'offshore', 'India',          'Test Automation Engineer',       44),
  ('CG', 'Dipti Chaudhari',             'offshore', 'India',          'Test Automation Engineer',       45),
  ('CG', 'Yashvanth C',                 'offshore', 'India',          'Automation Tester',              46),
  ('CG', 'Savita Khatavkar',            'offshore', 'India',          'Technical Analyst',              47),
  ('CG', 'Margala Kumar',               'offshore', 'India',          'Drupal Engineer',                48),
  ('CG', 'Mohit Porwal',                'offshore', 'India',          'Front End (React) Engineer',     49),
  ('CG', 'Priyanka Dhole',              'offshore', 'India',          'Test Automation Engineer',       50),
  ('CG', 'Praneetha Bandlamudi',        'offshore', 'India',          'Test Automation Engineer',       51),
  ('CG', 'Virginie Tan',                'onshore',  'United Kingdom', 'UX Lead',                        52),
  ('CG', 'Rajat Jain',                  'offshore', 'India',          'Service Introduction',           53),
  ('CG', 'Tom Tanser',                  'onshore',  'United Kingdom', 'Security SME',                   54),
  ('CG', 'Sean Hall',                   'onshore',  'United Kingdom', 'Commercial',                     55),

  -- RMG — Royal Mail Group (14 resources)
  ('RMG', 'Matthew Bruce',    'onshore', 'United Kingdom', 'Head of Web / Customer Platforms', 17),
  ('RMG', 'Jonny Wooldridge', 'onshore', 'United Kingdom', 'Director of Platforms & Build',    18),
  ('RMG', 'Clare Dean',       'onshore', 'United Kingdom', 'Service Manager',                  19),
  ('RMG', 'Mandy Tucker',     'onshore', 'United Kingdom', 'Service Manager',                  20),
  ('RMG', 'Mark Dickson',     'onshore', 'United Kingdom', 'Programme Director',               21),
  ('RMG', 'Paul Williams',    'onshore', 'United Kingdom', 'Lead Product Owner',               22),
  ('RMG', 'Ajmal Malik',      'onshore', 'United Kingdom', 'Lead Solutions Architect',         23),
  ('RMG', 'Anjusmita Choudhury','onshore','United Kingdom','Lead Test Manager',                24),
  ('RMG', 'Justin Fox',       'onshore', 'United Kingdom', 'Lead Software Engineer',           25),
  ('RMG', 'Selen Hamilton',   'onshore', 'United Kingdom', 'Demand Manager',                   26),
  ('RMG', 'Mike James',       'onshore', 'United Kingdom', 'Delivery Owner',                   27),
  ('RMG', 'Leopold Kwok',     'onshore', 'United Kingdom', 'React Frontend Engineer',          28),
  ('RMG', 'Dipti Devanga',    'onshore', 'United Kingdom', 'Test Automation Engineer',         82),
  ('RMG', 'Christopher Palmer','onshore','United Kingdom', 'Front End (React) SME',            83),
  ('RMG', 'James Baxter',     'onshore', 'United Kingdom', 'Back End (.NET) SME',              84),
  ('RMG', 'Rohith Nair',      'onshore', 'United Kingdom', 'Back End (.NET) SME',              85),
  ('RMG', 'Semiu Salawu',     'onshore', 'United Kingdom', 'Solution Architect',               86),

  -- HT — Happy Team (17 resources, nearshore Poland)
  ('HT', 'Paulina Krzyzanska',  'nearshore', 'Poland', 'Product Owner',               56),
  ('HT', 'Tomasz Foltynski',    'nearshore', 'Poland', 'Azure Full Stack Developer',  57),
  ('HT', 'Adam Dobrzeniewski',  'nearshore', 'Poland', 'Front End (React) Engineer',  58),
  ('HT', 'Maciej Imiolek',      'nearshore', 'Poland', 'Full Stack (Azure) Engineer', 59),
  ('HT', 'Mariusz Redzimski',   'nearshore', 'Poland', 'Full Stack (Azure) Engineer', 60),
  ('HT', 'Krzysztof Derek',     'nearshore', 'Poland', 'Front End (React) Engineer',  61),
  ('HT', 'Olga Bartczak',       'nearshore', 'Poland', 'Technical Analyst',           62),
  ('HT', 'Grzegorz Lang',       'nearshore', 'Poland', 'Full Stack (Azure) Engineer', 63),
  ('HT', 'Pawel Pluta',         'nearshore', 'Poland', 'Full Stack (Azure) Engineer', 64),
  ('HT', 'Bartlomiej Kubica',   'nearshore', 'Poland', 'Full Stack (Azure) Engineer', 65),
  ('HT', 'Grzegorz Bech',       'nearshore', 'Poland', 'Test Automation Engineer',    66),
  ('HT', 'Kamil Bedkowski',     'nearshore', 'Poland', 'Solution Architect',          67),
  ('HT', 'Emil Nowak',          'nearshore', 'Poland', 'Azure Technical Lead',        29),
  ('HT', 'Mateusz Kowalewski',  'nearshore', 'Poland', 'Azure Solution Architect',    30),
  ('HT', 'Maciej Cieslak',      'nearshore', 'Poland', 'Azure Solution Architect',    31),
  ('HT', 'Jakub Benzef',        'nearshore', 'Poland', 'DevOps Engineer',             32),
  ('HT', 'Jan Urbaniak',        'nearshore', 'Poland', 'DevOps Engineer',             33),

  -- NH — North Highland (5 resources)
  ('NH', 'Najam Khan-Muztar', 'onshore', 'United Kingdom', 'Analytics Consultant', 34),
  ('NH', 'James Taylor',      'onshore', 'United Kingdom', 'Delivery Owner',        35),
  ('NH', 'Grant Bramley',     'onshore', 'United Kingdom', 'Agile Coach',           36),
  ('NH', 'Rajesh Dubey',      'onshore', 'United Kingdom', 'Scrum Master',          68),
  ('NH', 'Natalie Cole',      'onshore', 'United Kingdom', 'Programme Manager',     69),

  -- EPAM (11 resources, mixed onshore/nearshore)
  ('EPAM', 'Aliaksei Yakimovich', 'nearshore', 'Lithuania',       'Delivery Owner',     70),
  ('EPAM', 'Pavel Yukhnovich',    'onshore',   'United Kingdom',  'Front End Engineer', 71),
  ('EPAM', 'Ekaterina Webster',   'onshore',   'United Kingdom',  'Front End Engineer', 72),
  ('EPAM', 'Roman Syromiatnikov', 'nearshore', 'Czech Republic',  'Back End Engineer',  73),
  ('EPAM', 'Mikalai Kavaliou',    'nearshore', 'Belarus',         'Back End Engineer',  74),
  ('EPAM', 'Svetlana Solodkaia',  'nearshore', 'Hungary',         'QA Engineer Lead',   75),
  ('EPAM', 'Dzianis Roi',         'onshore',   'United Kingdom',  'Technical Lead',     76),
  ('EPAM', 'Rachel Hatcher',      'onshore',   'United Kingdom',  'Technical Analyst',  77),
  ('EPAM', 'Maksim Klimenko',     'onshore',   'United Kingdom',  'Front End Engineer', 78),
  ('EPAM', 'Gleb Kazak',          'nearshore', 'Belarus',         'Back End Engineer',  79),
  ('EPAM', 'Daria Grek',          'nearshore', 'Poland',          'QA Engineer Lead',   80),

  -- TAAS (1 resource)
  ('TAAS', 'Ankit Singh', 'onshore', 'United Kingdom', 'Automation Tester', 81),

  -- TCS — Tata Consultancy Services (0 resources — names TBC)

  -- LT — Lean Tree (1 resource)
  ('LT', 'Sarah Ashton', 'onshore', 'United Kingdom', 'Project Manager', 87)

) AS r(supplier_abbr, resource_name, resource_location, resource_country, resource_job_title, sort_order)
JOIN suppliers s ON s.supplier_abbreviation = r.supplier_abbr
ON CONFLICT DO NOTHING;
