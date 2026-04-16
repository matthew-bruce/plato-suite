-- =============================================================================
-- 002_seed_lookups.sql
-- Plato Suite — lookup seed data + additive columns
-- Package: @plato/schema
-- =============================================================================
--
-- Depends on: 001_core_schema.sql
-- Adds: discipline_description, discipline_example_roles to disciplines
--       skill_description to skills
-- Seeds: 20 disciplines, starter skill set across all four categories
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Additive columns — disciplines
-- -----------------------------------------------------------------------------
ALTER TABLE disciplines
  ADD COLUMN IF NOT EXISTS discipline_description  TEXT,
  ADD COLUMN IF NOT EXISTS discipline_example_roles TEXT;

-- -----------------------------------------------------------------------------
-- Additive column — skills
-- -----------------------------------------------------------------------------
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS skill_description TEXT;

-- -----------------------------------------------------------------------------
-- Seed: disciplines
-- -----------------------------------------------------------------------------
INSERT INTO disciplines
  (discipline_name, discipline_slug, discipline_description, discipline_example_roles, sort_order)
VALUES
  (
    'Backend Engineering',
    'backend-engineering',
    'Engineers who build server-side systems, APIs, and data processing logic. Responsible for the services and integrations that power applications.',
    'Backend Engineer, API Developer, Java Developer, .NET Developer, Integration Engineer',
    10
  ),
  (
    'Frontend Engineering',
    'frontend-engineering',
    'Engineers who build web-based user interfaces and browser-side experiences. Focused on what users see and interact with directly.',
    'Frontend Engineer, Web Developer, UI Engineer, React Developer',
    20
  ),
  (
    'Full Stack Engineering',
    'full-stack-engineering',
    'Engineers comfortable across both frontend and backend, typically owning features end-to-end across the full technology stack.',
    'Full Stack Engineer, Software Engineer, Full Stack Developer',
    30
  ),
  (
    'Mobile Engineering',
    'mobile-engineering',
    'Engineers who build native or cross-platform mobile applications for iOS and Android devices.',
    'iOS Engineer, Android Engineer, React Native Developer, Mobile Developer, App Engineer',
    40
  ),
  (
    'Platform & DevOps',
    'platform-devops',
    'Engineers who build and maintain the infrastructure, cloud environments, and delivery pipelines that development teams depend on. Includes cloud specialists, SREs, and infrastructure engineers.',
    'DevOps Engineer, Platform Engineer, Cloud Infrastructure Engineer, SRE, CloudOps Engineer, Azure Engineer, Infrastructure Engineer',
    50
  ),
  (
    'Architecture',
    'architecture',
    'Senior technical specialists who define system design, set technology standards, and provide engineering direction across teams and platforms.',
    'Solution Architect, Technical Architect, Enterprise Architect, Principal Engineer, Lead Architect',
    60
  ),
  (
    'Cyber Security',
    'cyber-security',
    'Specialists who protect systems, data, and users from security threats, and ensure platforms meet security and regulatory compliance standards.',
    'Security Engineer, Cyber Security Analyst, Penetration Tester, Security Architect, InfoSec Specialist',
    70
  ),
  (
    'Data Engineering',
    'data-engineering',
    'Engineers who design and build data pipelines, data warehouses, and the infrastructure that moves and stores data at scale.',
    'Data Engineer, ETL Developer, Analytics Engineer, Data Platform Engineer, Data Infrastructure Engineer',
    80
  ),
  (
    'Digital Analytics',
    'digital-analytics',
    'Specialists in digital measurement, tag management, consent frameworks, and analytics platforms. Focused on how data is collected, governed, and reported across digital channels.',
    'Digital Analyst, Tealium Specialist, Adobe Analytics Developer, Data Privacy SME, Tag Manager, Web Analyst',
    90
  ),
  (
    'Data Analysis',
    'data-analysis',
    'Analysts who work with data to generate insight, build reports, and support data-driven decision-making across the business.',
    'Data Analyst, BI Developer, Reporting Analyst, Insight Analyst, MI Analyst',
    100
  ),
  (
    'Quality Assurance',
    'quality-assurance',
    'Engineers and analysts responsible for testing, quality gates, and ensuring software meets defined standards before release.',
    'QA Engineer, Test Analyst, Automation Engineer, Performance Tester, Test Lead',
    110
  ),
  (
    'UX & Design',
    'ux-design',
    'Practitioners who research, design, and validate user experiences, interfaces, and interaction patterns. Bridging user needs and technical delivery.',
    'UX Designer, UI Designer, Product Designer, UX Researcher, Interaction Designer, Service Designer',
    120
  ),
  (
    'Business Analysis',
    'business-analysis',
    'Analysts who translate business needs into requirements, map processes, and bridge the gap between stakeholders and delivery teams.',
    'Business Analyst, Systems Analyst, Requirements Engineer, Process Analyst, BA Lead',
    130
  ),
  (
    'Product Management',
    'product-management',
    'Practitioners responsible for product strategy, backlog ownership, and the prioritisation of features against business outcomes.',
    'Product Manager, Product Owner, Senior Product Manager, Head of Product',
    140
  ),
  (
    'Delivery Management',
    'delivery-management',
    'Practitioners who lead the day-to-day delivery of software, managing risk, dependencies, and team pace to keep work flowing.',
    'Delivery Manager, Project Manager, Delivery Lead, Flow Manager',
    150
  ),
  (
    'Programme & Project Management',
    'programme-management',
    'Senior practitioners managing portfolios of work, cross-team dependencies, budgets, and delivery governance at programme or portfolio scale.',
    'Programme Manager, Project Manager, PMO Lead, Portfolio Manager, Delivery Director',
    160
  ),
  (
    'Commercial Management',
    'commercial-management',
    'Specialists managing supplier contracts, commercial governance, procurement, and cost control across the platform organisation.',
    'Commercial Manager, Vendor Manager, Procurement Specialist, Contract Manager, Commercial Lead',
    170
  ),
  (
    'Service Management',
    'service-management',
    'Practitioners responsible for ITIL-aligned service operations, incident management, change governance, and service continuity.',
    'Service Manager, ITIL Practitioner, Incident Manager, Change Manager, Service Desk Lead',
    180
  ),
  (
    'Scrum Master',
    'scrum-master',
    'Practitioners who facilitate agile ceremonies, remove blockers, and coach delivery teams on Scrum practices and continuous improvement.',
    'Scrum Master, Agile Practitioner, Team Coach',
    190
  ),
  (
    'Agile Coaching',
    'agile-coaching',
    'Senior agile practitioners who coach teams, value streams, or entire organisations on agile ways of working, culture change, and continuous improvement at scale.',
    'Agile Coach, Enterprise Agile Coach, Transformation Lead, SAFe Programme Consultant',
    200
  )
ON CONFLICT (discipline_slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: skills — languages
-- -----------------------------------------------------------------------------
INSERT INTO skills (skill_name, skill_slug, skill_category, skill_description, sort_order)
VALUES
  ('Java',       'java',       'language', 'General-purpose, object-oriented language widely used in enterprise backend and Android development.', 10),
  ('C#',         'csharp',     'language', 'Microsoft''s primary object-oriented language, used extensively in .NET and Azure ecosystems.', 20),
  ('Python',     'python',     'language', 'Versatile language popular for backend services, data engineering, scripting, and machine learning.', 30),
  ('JavaScript', 'javascript', 'language', 'The primary language of the web, used for both frontend browser code and backend via Node.js.', 40),
  ('TypeScript', 'typescript', 'language', 'Strongly typed superset of JavaScript. Increasingly standard for production frontend and Node.js work.', 50),
  ('Swift',      'swift',      'language', 'Apple''s modern language for building native iOS and macOS applications.', 60),
  ('Kotlin',     'kotlin',     'language', 'Modern JVM language used for Android development and increasingly for backend services.', 70),
  ('Go',         'go',         'language', 'Statically typed, compiled language from Google. Popular for cloud-native services and CLI tooling.', 80),
  ('Ruby',       'ruby',       'language', 'Expressive, dynamic language commonly associated with Ruby on Rails web applications.', 90),
  ('PHP',        'php',        'language', 'Server-side scripting language widely used in web development, including Drupal and WordPress platforms.', 100),
  ('Scala',      'scala',      'language', 'JVM language combining object-oriented and functional programming. Common in data engineering and streaming.', 110),
  ('SQL',        'sql',        'language', 'Standard language for querying and managing relational databases. Required across most technical disciplines.', 120)
ON CONFLICT (skill_slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: skills — frameworks
-- -----------------------------------------------------------------------------
INSERT INTO skills (skill_name, skill_slug, skill_category, skill_description, sort_order)
VALUES
  ('.NET',          'dotnet',         'framework', 'Microsoft''s cross-platform development framework for building web, desktop, and cloud applications in C#.', 10),
  ('React',         'react',          'framework', 'Facebook''s JavaScript library for building component-based user interfaces. Dominant in modern frontend.', 20),
  ('Next.js',       'nextjs',         'framework', 'React framework with server-side rendering and full-stack capabilities. Increasingly standard for web platforms.', 30),
  ('Angular',       'angular',        'framework', 'Google''s TypeScript-based frontend framework. Common in enterprise web applications.', 40),
  ('Vue.js',        'vuejs',          'framework', 'Progressive JavaScript framework for building user interfaces. Lighter-weight alternative to Angular.', 50),
  ('Spring Boot',   'spring-boot',    'framework', 'Java framework for building production-grade backend services and APIs with minimal configuration.', 60),
  ('Django',        'django',         'framework', 'Python web framework that encourages rapid development and clean, pragmatic design.', 70),
  ('Apache Camel',  'apache-camel',   'framework', 'Integration framework implementing enterprise integration patterns. Common in complex message routing and ETL.', 80),
  ('Drupal',        'drupal',         'framework', 'Open-source PHP content management framework used for large-scale web platforms and digital experiences.', 90),
  ('React Native',  'react-native',   'framework', 'Cross-platform mobile framework using React to build native iOS and Android applications from a shared codebase.', 100),
  ('Flutter',       'flutter',        'framework', 'Google''s UI toolkit for building natively compiled mobile, web, and desktop apps from a single Dart codebase.', 110),
  ('Node.js',       'nodejs',         'framework', 'JavaScript runtime for building server-side and network applications. Enables full-stack JavaScript development.', 120)
ON CONFLICT (skill_slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: skills — platforms
-- -----------------------------------------------------------------------------
INSERT INTO skills (skill_name, skill_slug, skill_category, skill_description, sort_order)
VALUES
  ('Azure',             'azure',              'platform', 'Microsoft''s cloud computing platform. Dominant in enterprise and the primary cloud for many UK organisations.', 10),
  ('AWS',               'aws',                'platform', 'Amazon Web Services. The world''s largest cloud platform, used across infrastructure, storage, compute, and data.', 20),
  ('GCP',               'gcp',                'platform', 'Google Cloud Platform. Strong in data engineering, machine learning, and Kubernetes workloads.', 30),
  ('Kubernetes',        'kubernetes',         'platform', 'Container orchestration platform for deploying, scaling, and managing containerised workloads.', 40),
  ('Docker',            'docker',             'platform', 'Container platform for packaging applications and their dependencies into portable, reproducible images.', 50),
  ('Terraform',         'terraform',          'platform', 'Infrastructure-as-code tool for provisioning and managing cloud infrastructure declaratively.', 60),
  ('Tealium',           'tealium',            'platform', 'Enterprise tag management and customer data platform. Used for data collection governance and digital analytics.', 70),
  ('Adobe Analytics',   'adobe-analytics',    'platform', 'Enterprise digital analytics platform for measuring and analysing web and app user behaviour.', 80),
  ('Google Analytics',  'google-analytics',   'platform', 'Google''s web analytics platform for tracking site traffic, user journeys, and conversion metrics.', 90),
  ('TrustArc',          'trustarc',           'platform', 'Consent management and data privacy compliance platform. Used for GDPR and cookie consent governance.', 100),
  ('Salesforce',        'salesforce',         'platform', 'Leading CRM platform with a broad ecosystem of sales, service, and marketing cloud products.', 110),
  ('ServiceNow',        'servicenow',         'platform', 'Enterprise ITSM and service management platform for incident, change, and asset management workflows.', 120),
  ('PostgreSQL',        'postgresql',         'platform', 'Powerful open-source relational database. Industry standard for production web and data applications.', 130),
  ('MongoDB',           'mongodb',            'platform', 'Document-oriented NoSQL database for flexible, schema-less data storage at scale.', 140),
  ('Redis',             'redis',              'platform', 'In-memory data store used for caching, session management, and real-time data pipelines.', 150),
  ('Elasticsearch',     'elasticsearch',      'platform', 'Distributed search and analytics engine. Used for log analysis, full-text search, and observability.', 160),
  ('Supabase',          'supabase',           'platform', 'Open-source Firebase alternative built on PostgreSQL. Provides database, auth, storage, and edge functions.', 170),
  ('Kafka',             'kafka',              'platform', 'Distributed event streaming platform for high-throughput, real-time data pipelines and event-driven architectures.', 180)
ON CONFLICT (skill_slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Seed: skills — practices
-- -----------------------------------------------------------------------------
INSERT INTO skills (skill_name, skill_slug, skill_category, skill_description, sort_order)
VALUES
  ('Agile / Scrum',             'agile-scrum',            'practice', 'Iterative delivery approach using Sprints, ceremonies, and a Scrum framework to manage team workflow.', 10),
  ('SAFe',                      'safe',                   'practice', 'Scaled Agile Framework for coordinating multiple agile teams across programmes and value streams.', 20),
  ('CI/CD',                     'ci-cd',                  'practice', 'Continuous integration and continuous delivery. Automating build, test, and deployment pipelines.', 30),
  ('Infrastructure as Code',    'infrastructure-as-code', 'practice', 'Managing and provisioning infrastructure through machine-readable configuration files rather than manual processes.', 40),
  ('DevSecOps',                 'devsecops',              'practice', 'Integrating security practices into the DevOps pipeline so security is built in rather than bolted on.', 50),
  ('Test Driven Development',   'tdd',                    'practice', 'Writing automated tests before writing implementation code, driving design through test coverage.', 60),
  ('Domain Driven Design',      'ddd',                    'practice', 'Software design approach focused on modelling the business domain and aligning code with business language.', 70),
  ('Microservices',             'microservices',          'practice', 'Architectural approach of decomposing applications into small, independently deployable services.', 80),
  ('Event Driven Architecture', 'event-driven',           'practice', 'Designing systems where components communicate via events rather than direct calls, enabling loose coupling.', 90),
  ('API Design',                'api-design',             'practice', 'Designing clear, consistent, and well-documented APIs — REST, GraphQL, or event-based — for internal and external consumers.', 100),
  ('Accessibility (WCAG)',      'accessibility',          'practice', 'Designing and building digital products that meet WCAG accessibility standards for all users.', 110),
  ('Observability',             'observability',          'practice', 'Instrumenting systems with logging, metrics, and tracing to understand behaviour in production.', 120)
ON CONFLICT (skill_slug) DO NOTHING;

-- =============================================================================
-- End of 002_seed_lookups.sql
-- =============================================================================
