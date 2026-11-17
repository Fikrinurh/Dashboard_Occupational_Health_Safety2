-- OHS EXPERT Seed Data for Local / Cloud SQL MySQL
-- Default demo password for all seeded users: "OhsExpert2026!" (bcrypt hashed)
USE ohs_expert;

INSERT INTO companies (company_code, name, industry) VALUES
('COMP-A', 'Perusahaan A', 'Mining & Heavy Operations'),
('COMP-B', 'Perusahaan B', 'Petrochemical Processing'),
('COMP-C', 'Perusahaan C', 'Logistics & Fleet Services')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO departments (company_id, department_code, name) VALUES
(1, 'DEPT-OPS', 'Plant Operations'),
(1, 'DEPT-MNT', 'Mechanical Maintenance'),
(2, 'DEPT-LAB', 'Process Engineering'),
(3, 'DEPT-LOG', 'Fleet & Warehouse')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO locations (company_id, location_code, name, site_area) VALUES
(1, 'LOC-A', 'Lokasi A', 'North Sector'),
(1, 'LOC-B', 'Lokasi B', 'Processing Plant'),
(3, 'LOC-E', 'Lokasi E', 'Central Terminal')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO medical_diagnoses (diagnosis_code, name, category) VALUES
('GEN-01', 'Influenza', 'GENERAL'),
('GEN-02', 'Pharyngitis', 'GENERAL'),
('GEN-03', 'Hypertension', 'GENERAL'),
('GEN-04', 'Tonsillitis', 'GENERAL'),
('GEN-05', 'Migraine', 'GENERAL'),
('GEN-06', 'Gastritis', 'GENERAL'),
('GEN-07', 'Hypotension', 'GENERAL'),
('PAK-01', 'Contact Dermatitis', 'OCCUPATIONAL_PAK'),
('PAK-02', 'Heat Stress / Heat Stroke', 'OCCUPATIONAL_PAK'),
('PAK-03', 'Heavy Metal Poisoning', 'OCCUPATIONAL_PAK'),
('PAK-04', 'Noise Induced Hearing Loss (NIHL)', 'OCCUPATIONAL_PAK')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO clinical_reference_ranges (config_key) VALUES ('DEFAULT')
ON DUPLICATE KEY UPDATE config_key = 'DEFAULT';

-- Password hash below corresponds to "OhsExpert2026!"
-- Default password: OhsExpert2026!
INSERT INTO users
(user_code, full_name, email, password_hash, role, department_name)
VALUES
(
  'USR-001',
  'Dr. Nadia Kusuma',
  'admin@ohsexpert.io',
  '$2b$10$jPUHhdPmSQf21kzb6llbW.o.Sye12LAXaQwDJBfeO/mfvxAUfmnHO',
  'ADMIN',
  'Corporate HSE'
),
(
  'USR-002',
  'Rendra Pratama',
  'hse@ohsexpert.io',
  '$2b$10$jPUHhdPmSQf21kzb6llbW.o.Sye12LAXaQwDJBfeO/mfvxAUfmnHO',
  'HSE_OFFICER',
  'Plant Safety'
),
(
  'USR-003',
  'Hendra Wijaya',
  'management@ohsexpert.io',
  '$2b$10$jPUHhdPmSQf21kzb6llbW.o.Sye12LAXaQwDJBfeO/mfvxAUfmnHO',
  'MANAGEMENT',
  'Executive Operations'
)
ON DUPLICATE KEY UPDATE
full_name = VALUES(full_name);