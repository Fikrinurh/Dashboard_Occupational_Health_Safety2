-- OHS EXPERT – Occupational Health & Safety Management System
-- Normalized Relational MySQL 8.0 Schema
-- Compatible with Local MySQL 8.0+ and Google Cloud SQL for MySQL

CREATE DATABASE IF NOT EXISTS ohs_expert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ohs_expert;

-- 1. Users & RBAC
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_code VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'HSE_OFFICER', 'MANAGEMENT') NOT NULL DEFAULT 'HSE_OFFICER',
  department_name VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB;

-- 2. Companies
CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL UNIQUE,
  industry VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  department_code VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_dept_code (company_id, department_code),
  UNIQUE KEY uq_company_dept_name (company_id, name),
  CONSTRAINT fk_departments_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Locations
CREATE TABLE IF NOT EXISTS locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  location_code VARCHAR(32) NOT NULL,
  name VARCHAR(160) NOT NULL,
  site_area VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_company_loc_code (company_id, location_code),
  UNIQUE KEY uq_company_loc_name (company_id, name),
  CONSTRAINT fk_locations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Employees
CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  job_position VARCHAR(120) NOT NULL,
  shift ENUM('Pagi', 'Siang', 'Malam') NOT NULL DEFAULT 'Pagi',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_company (company_id),
  INDEX idx_employees_name (full_name),
  CONSTRAINT fk_employees_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 6. Medical Diagnoses Master Catalog
CREATE TABLE IF NOT EXISTS medical_diagnoses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  diagnosis_code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL UNIQUE,
  category ENUM('GENERAL', 'OCCUPATIONAL_PAK') NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 7. Clinic Visits
CREATE TABLE IF NOT EXISTS clinic_visits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visit_code VARCHAR(40) NOT NULL UNIQUE,
  employee_id BIGINT UNSIGNED NULL,
  employee_code VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  shift ENUM('Pagi', 'Siang', 'Malam') NOT NULL,
  visit_date DATE NOT NULL,
  visit_type ENUM('New', 'Follow-up') NOT NULL,
  general_diagnosis_id BIGINT UNSIGNED NULL,
  general_diagnosis_name VARCHAR(160) NOT NULL,
  pak_classification VARCHAR(160) NULL,
  symptoms TEXT NOT NULL,
  treatment TEXT NOT NULL,
  medical_officer VARCHAR(120) NOT NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_visits_date (visit_date),
  INDEX idx_visits_company_loc_shift (company_id, location_id, shift),
  CONSTRAINT fk_visits_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_visits_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_visits_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_visits_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_visits_diagnosis FOREIGN KEY (general_diagnosis_id) REFERENCES medical_diagnoses(id) ON DELETE SET NULL,
  CONSTRAINT fk_visits_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Configurable Clinical Reference Ranges
CREATE TABLE IF NOT EXISTS clinical_reference_ranges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL UNIQUE,
  bmi_underweight_max DECIMAL(5,2) NOT NULL DEFAULT 18.49,
  bmi_normal_max DECIMAL(5,2) NOT NULL DEFAULT 24.99,
  bmi_overweight_max DECIMAL(5,2) NOT NULL DEFAULT 29.99,
  bmi_obesity1_max DECIMAL(5,2) NOT NULL DEFAULT 34.99,
  glucose_normal_max DECIMAL(6,2) NOT NULL DEFAULT 99.00,
  glucose_prediabetes_max DECIMAL(6,2) NOT NULL DEFAULT 125.00,
  cholesterol_normal_max DECIMAL(6,2) NOT NULL DEFAULT 199.00,
  cholesterol_borderline_max DECIMAL(6,2) NOT NULL DEFAULT 239.00,
  uric_acid_normal_max DECIMAL(5,2) NOT NULL DEFAULT 7.00,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_ranges_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Medical Examinations
CREATE TABLE IF NOT EXISTS medical_examinations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exam_code VARCHAR(40) NOT NULL UNIQUE,
  employee_id BIGINT UNSIGNED NULL,
  employee_code VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  shift ENUM('Pagi', 'Siang', 'Malam') NOT NULL,
  exam_date DATE NOT NULL,
  exam_type ENUM('Workplace Accident', 'Clinic Visit', 'Daily / Periodic Exam', 'Special Exam') NOT NULL,
  height_m DECIMAL(4,2) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  bmi DECIMAL(5,2) NOT NULL,
  bmi_category VARCHAR(40) NOT NULL,
  blood_pressure VARCHAR(32) NOT NULL,
  blood_glucose DECIMAL(6,2) NOT NULL,
  glucose_category VARCHAR(32) NOT NULL,
  total_cholesterol DECIMAL(6,2) NOT NULL,
  cholesterol_category VARCHAR(32) NOT NULL,
  uric_acid DECIMAL(5,2) NOT NULL,
  uric_acid_category VARCHAR(32) NOT NULL,
  medical_status ENUM('Fit', 'Fit with Note', 'Follow-up Required', 'Unfit') NOT NULL,
  recommendations TEXT NULL,
  medical_officer VARCHAR(120) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_exams_date (exam_date),
  INDEX idx_exams_company_loc_shift (company_id, location_id, shift),
  CONSTRAINT fk_exams_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_exams_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exams_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_exams_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_exams_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 10. Workplace Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_code VARCHAR(40) NOT NULL UNIQUE,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NOT NULL,
  shift ENUM('Pagi', 'Siang', 'Malam') NOT NULL,
  employee_id BIGINT UNSIGNED NULL,
  employee_code VARCHAR(40) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  job_position VARCHAR(120) NOT NULL,
  incident_category ENUM('Fatality', 'First Aid Case (FAC)', 'Lost Time Injury (LTI)', 'Medical Treatment Case (MTC)', 'Restricted Work Case (RWC)', 'Near Miss', 'Property Damage') NOT NULL,
  work_related_status ENUM('Work-Related', 'Non-Work-Related') NOT NULL,
  severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
  incident_description TEXT NOT NULL,
  injury_description TEXT NULL,
  affected_body_part ENUM('Head', 'Eyes', 'Face', 'Neck', 'Shoulder', 'Arms', 'Hands', 'Fingers', 'Back', 'Legs', 'Feet', 'None') NOT NULL DEFAULT 'None',
  injury_type VARCHAR(120) NULL,
  immediate_actions TEXT NOT NULL,
  status ENUM('Open', 'Under Investigation', 'CAPA In Progress', 'Waiting Verification', 'Closed') NOT NULL DEFAULT 'Open',
  closed_at DATETIME NULL,
  closed_by BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_incidents_date (incident_date),
  INDEX idx_incidents_status (status),
  INDEX idx_incidents_company_loc_shift (company_id, location_id, shift),
  CONSTRAINT fk_incidents_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT fk_incidents_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_incidents_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_incidents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 11. Incident Witnesses
CREATE TABLE IF NOT EXISTS incident_witnesses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL,
  witness_name VARCHAR(160) NOT NULL,
  witness_role VARCHAR(120) NULL,
  contact_info VARCHAR(120) NULL,
  statement TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_witness_incident (incident_id),
  CONSTRAINT fk_witnesses_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Incident Evidence (Metadata + secure local/object path)
CREATE TABLE IF NOT EXISTS incident_evidence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL,
  evidence_type ENUM('PHOTO', 'DOCUMENT') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inc_evidence_incident (incident_id),
  CONSTRAINT fk_inc_evidence_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_inc_evidence_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 13. Investigations
CREATE TABLE IF NOT EXISTS investigations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigation_code VARCHAR(40) NOT NULL UNIQUE,
  incident_id BIGINT UNSIGNED NOT NULL UNIQUE,
  investigation_date DATE NOT NULL,
  investigation_leader VARCHAR(160) NOT NULL,
  investigation_team TEXT NOT NULL,
  witness_statements TEXT NULL,
  incident_chronology TEXT NOT NULL,
  unsafe_act TEXT NULL,
  unsafe_condition TEXT NULL,
  immediate_cause TEXT NOT NULL,
  contributing_factors TEXT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_investigation_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_investigation_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 14. Investigation Causes (Normalized Cause Catalog Links)
CREATE TABLE IF NOT EXISTS investigation_causes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  investigation_id BIGINT UNSIGNED NOT NULL,
  cause_type ENUM('UNSAFE_ACT', 'UNSAFE_CONDITION', 'IMMEDIATE_CAUSE', 'CONTRIBUTING_FACTOR') NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inv_causes_inv (investigation_id),
  CONSTRAINT fk_inv_causes_investigation FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Five Whys Analysis
CREATE TABLE IF NOT EXISTS five_whys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL UNIQUE,
  why_1 TEXT NOT NULL,
  why_2 TEXT NULL,
  why_3 TEXT NULL,
  why_4 TEXT NULL,
  why_5 TEXT NULL,
  final_root_cause TEXT NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_five_whys_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_five_whys_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 16. Fishbone 6M Causes
CREATE TABLE IF NOT EXISTS fishbone_causes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL,
  category ENUM('Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment') NOT NULL,
  cause_text VARCHAR(500) NOT NULL,
  sub_cause_text VARCHAR(500) NULL,
  is_primary_root TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fishbone_incident (incident_id),
  CONSTRAINT fk_fishbone_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_fishbone_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 17. CAPA Actions
CREATE TABLE IF NOT EXISTS capa_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  capa_code VARCHAR(40) NOT NULL UNIQUE,
  incident_id BIGINT UNSIGNED NOT NULL,
  root_cause TEXT NOT NULL,
  action_description TEXT NOT NULL,
  action_type ENUM('Corrective Action', 'Preventive Action') NOT NULL,
  responsible_pic VARCHAR(160) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  completion_date DATE NULL,
  action_status ENUM('Open', 'In Progress', 'Waiting Verification', 'Verified', 'Rejected / Reopened') NOT NULL DEFAULT 'Open',
  completion_notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_capa_incident (incident_id),
  INDEX idx_capa_status_due (action_status, due_date),
  CONSTRAINT fk_capa_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_capa_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 18. CAPA Evidence
CREATE TABLE IF NOT EXISTS capa_evidence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  capa_id BIGINT UNSIGNED NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_capa_evidence_capa (capa_id),
  CONSTRAINT fk_capa_evidence_capa FOREIGN KEY (capa_id) REFERENCES capa_actions(id) ON DELETE CASCADE,
  CONSTRAINT fk_capa_evidence_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 19. Verifications
CREATE TABLE IF NOT EXISTS verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('CAPA', 'INCIDENT_CLOSURE') NOT NULL,
  capa_id BIGINT UNSIGNED NULL,
  incident_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('APPROVED', 'REJECTED', 'REOPENED') NOT NULL,
  remarks TEXT NOT NULL,
  verified_by BIGINT UNSIGNED NOT NULL,
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_verifications_incident (incident_id),
  INDEX idx_verifications_capa (capa_id),
  CONSTRAINT fk_verifications_capa FOREIGN KEY (capa_id) REFERENCES capa_actions(id) ON DELETE CASCADE,
  CONSTRAINT fk_verifications_incident FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
  CONSTRAINT fk_verifications_user FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 20. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  user_email VARCHAR(160) NULL,
  user_role VARCHAR(32) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  details_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
