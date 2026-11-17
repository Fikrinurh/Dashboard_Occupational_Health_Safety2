import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  computeCapaEffectiveStatus,
  DEFAULT_CLINICAL_RANGES,
  deriveMedicalStatus,
} from '../../src/shared/ohsLogic';
import type {
  AuditLog,
  AuthUser,
  CapaAction,
  ClinicVisit,
  ClinicalReferenceRanges,
  Company,
  Department,
  Employee,
  EvidenceFile,
  FishboneCause,
  FiveWhys,
  Incident,
  Investigation,
  LocationItem,
  MedicalExamination,
  VerificationRecord,
} from '../../src/shared/types';
import { getMysqlPool } from './mysql';
import type { IncidentDetailBundle, OhsRepository, StoredUser } from './types';

export class MysqlRepository implements OhsRepository {
  private pool = getMysqlPool();

  getMode(): 'MYSQL' {
    return 'MYSQL';
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, password_hash AS passwordHash,
              role, COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [email],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...(r as StoredUser), isActive: Boolean(r.isActive) };
  }

  async findUserById(id: number): Promise<StoredUser | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, password_hash AS passwordHash,
              role, COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...(r as StoredUser), isActive: Boolean(r.isActive) };
  }

  async listUsers(): Promise<AuthUser[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, role,
              COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users ORDER BY id ASC`,
    );
    return rows.map((r) => ({ ...(r as AuthUser), isActive: Boolean(r.isActive) }));
  }

  async createUser(input: {
    userCode: string;
    fullName: string;
    email: string;
    passwordHash: string;
    role: AuthUser['role'];
    departmentName: string;
  }): Promise<AuthUser> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO users (user_code, full_name, email, password_hash, role, department_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.userCode, input.fullName, input.email.toLowerCase(), input.passwordHash, input.role, input.departmentName],
    );
    return {
      id: res.insertId,
      userCode: input.userCode,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      role: input.role,
      departmentName: input.departmentName,
      isActive: true,
    };
  }

  async updateUserStatus(id: number, isActive: boolean, role?: AuthUser['role']): Promise<AuthUser | null> {
    if (role) {
      await this.pool.query(`UPDATE users SET is_active = ?, role = ? WHERE id = ?`, [isActive ? 1 : 0, role, id]);
    } else {
      await this.pool.query(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, id]);
    }
    const found = await this.findUserById(id);
    if (!found) return null;
    const { passwordHash: _ph, ...safe } = found;
    return safe;
  }

  async touchUserLogin(id: number): Promise<void> {
    await this.pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
  }

  async getMasterData() {
    const [compRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, company_code AS companyCode, name, COALESCE(industry, '') AS industry FROM companies WHERE is_active = 1 ORDER BY name`,
    );
    const [deptRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, company_id AS companyId, department_code AS departmentCode, name FROM departments ORDER BY name`,
    );
    const [locRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, company_id AS companyId, location_code AS locationCode, name, COALESCE(site_area, '') AS siteArea FROM locations ORDER BY name`,
    );
    const [empRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT e.id, e.employee_code AS employeeCode, e.full_name AS fullName, e.company_id AS companyId,
              c.name AS companyName, COALESCE(e.department_id, 0) AS departmentId,
              COALESCE(d.name, 'Operations') AS departmentName, COALESCE(e.location_id, 0) AS locationId,
              COALESCE(l.name, 'Main Site') AS locationName, e.job_position AS jobPosition, e.shift
       FROM employees e
       JOIN companies c ON c.id = e.company_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN locations l ON l.id = e.location_id
       WHERE e.is_active = 1 ORDER BY e.full_name`,
    );
    const [rangeRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT bmi_underweight_max AS bmiUnderweightMax, bmi_normal_max AS bmiNormalMax,
              bmi_overweight_max AS bmiOverweightMax, bmi_obesity1_max AS bmiObesity1Max,
              glucose_normal_max AS glucoseNormalMax, glucose_prediabetes_max AS glucosePrediabetesMax,
              cholesterol_normal_max AS cholesterolNormalMax, cholesterol_borderline_max AS cholesterolBorderlineMax,
              uric_acid_normal_max AS uricAcidNormalMax
       FROM clinical_reference_ranges WHERE config_key = 'DEFAULT' LIMIT 1`,
    );

    const clinicalRanges: ClinicalReferenceRanges = rangeRows.length
      ? {
          bmiUnderweightMax: Number(rangeRows[0].bmiUnderweightMax),
          bmiNormalMax: Number(rangeRows[0].bmiNormalMax),
          bmiOverweightMax: Number(rangeRows[0].bmiOverweightMax),
          bmiObesity1Max: Number(rangeRows[0].bmiObesity1Max),
          glucoseNormalMax: Number(rangeRows[0].glucoseNormalMax),
          glucosePrediabetesMax: Number(rangeRows[0].glucosePrediabetesMax),
          cholesterolNormalMax: Number(rangeRows[0].cholesterolNormalMax),
          cholesterolBorderlineMax: Number(rangeRows[0].cholesterolBorderlineMax),
          uricAcidNormalMax: Number(rangeRows[0].uricAcidNormalMax),
        }
      : { ...DEFAULT_CLINICAL_RANGES };

    return {
      companies: compRows as Company[],
      departments: deptRows as Department[],
      locations: locRows as LocationItem[],
      employees: empRows as Employee[],
      clinicalRanges,
    };
  }

  async createCompany(input: { companyCode: string; name: string; industry: string }): Promise<Company> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO companies (company_code, name, industry) VALUES (?, ?, ?)`,
      [input.companyCode, input.name, input.industry],
    );
    return { id: res.insertId, ...input };
  }

  async createDepartment(input: { companyId: number; departmentCode: string; name: string }): Promise<Department> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO departments (company_id, department_code, name) VALUES (?, ?, ?)`,
      [input.companyId, input.departmentCode, input.name],
    );
    return { id: res.insertId, ...input };
  }

  async createLocation(input: { companyId: number; locationCode: string; name: string; siteArea: string }): Promise<LocationItem> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO locations (company_id, location_code, name, site_area) VALUES (?, ?, ?, ?)`,
      [input.companyId, input.locationCode, input.name, input.siteArea],
    );
    return { id: res.insertId, ...input };
  }

  async createEmployee(
    input: Omit<Employee, 'id' | 'companyName' | 'departmentName' | 'locationName'>,
  ): Promise<Employee> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO employees (employee_code, full_name, company_id, department_id, location_id, job_position, shift)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.employeeCode,
        input.fullName,
        input.companyId,
        input.departmentId || null,
        input.locationId || null,
        input.jobPosition,
        input.shift,
      ],
    );
    const master = await this.getMasterData();
    return master.employees.find((e) => e.id === res.insertId)!;
  }

  async updateClinicalRanges(ranges: ClinicalReferenceRanges, userId: number): Promise<ClinicalReferenceRanges> {
    await this.pool.query(
      `INSERT INTO clinical_reference_ranges
       (config_key, bmi_underweight_max, bmi_normal_max, bmi_overweight_max, bmi_obesity1_max,
        glucose_normal_max, glucose_prediabetes_max, cholesterol_normal_max, cholesterol_borderline_max,
        uric_acid_normal_max, updated_by)
       VALUES ('DEFAULT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        bmi_underweight_max = VALUES(bmi_underweight_max),
        bmi_normal_max = VALUES(bmi_normal_max),
        bmi_overweight_max = VALUES(bmi_overweight_max),
        bmi_obesity1_max = VALUES(bmi_obesity1_max),
        glucose_normal_max = VALUES(glucose_normal_max),
        glucose_prediabetes_max = VALUES(glucose_prediabetes_max),
        cholesterol_normal_max = VALUES(cholesterol_normal_max),
        cholesterol_borderline_max = VALUES(cholesterol_borderline_max),
        uric_acid_normal_max = VALUES(uric_acid_normal_max),
        updated_by = VALUES(updated_by)`,
      [
        ranges.bmiUnderweightMax,
        ranges.bmiNormalMax,
        ranges.bmiOverweightMax,
        ranges.bmiObesity1Max,
        ranges.glucoseNormalMax,
        ranges.glucosePrediabetesMax,
        ranges.cholesterolNormalMax,
        ranges.cholesterolBorderlineMax,
        ranges.uricAcidNormalMax,
        userId,
      ],
    );

    // Reclassify existing exams in MySQL
    const exams = await this.listMedicalExams();
    for (const exam of exams) {
      const bmi = calculateBmi(exam.weightKg, exam.heightM);
      const bmiCat = classifyBmi(bmi, ranges);
      const glucCat = classifyBloodGlucose(exam.bloodGlucose, ranges);
      const cholCat = classifyCholesterol(exam.totalCholesterol, ranges);
      const uricCat = classifyUricAcid(exam.uricAcid, ranges);
      const status = deriveMedicalStatus({
        bmiCategory: bmiCat,
        glucoseCategory: glucCat,
        cholesterolCategory: cholCat,
        uricAcidCategory: uricCat,
      });
      await this.pool.query(
        `UPDATE medical_examinations
         SET bmi = ?, bmi_category = ?, glucose_category = ?, cholesterol_category = ?, uric_acid_category = ?, medical_status = ?
         WHERE id = ?`,
        [bmi, bmiCat, glucCat, cholCat, uricCat, status, exam.id],
      );
    }
    return ranges;
  }

  async listClinicVisits(): Promise<ClinicVisit[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT cv.id, cv.visit_code AS visitCode, cv.employee_code AS employeeCode, cv.employee_name AS employeeName,
              cv.company_id AS companyId, c.name AS companyName, COALESCE(d.name, 'Operations') AS departmentName,
              cv.location_id AS locationId, l.name AS locationName, cv.shift, DATE_FORMAT(cv.visit_date, '%Y-%m-%d') AS visitDate,
              cv.visit_type AS visitType, cv.general_diagnosis_name AS generalDiagnosis,
              cv.pak_classification AS pakClassification, cv.symptoms, cv.treatment,
              cv.medical_officer AS medicalOfficer, COALESCE(cv.notes, '') AS notes, cv.created_at AS createdAt
       FROM clinic_visits cv
       JOIN companies c ON c.id = cv.company_id
       JOIN locations l ON l.id = cv.location_id
       LEFT JOIN departments d ON d.id = cv.department_id
       ORDER BY cv.visit_date DESC, cv.id DESC`,
    );
    return rows as ClinicVisit[];
  }

  async createClinicVisit(
    input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
    userId: number,
  ): Promise<ClinicVisit> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO clinic_visits
       (visit_code, employee_code, employee_name, company_id, location_id, shift, visit_date, visit_type,
        general_diagnosis_name, pak_classification, symptoms, treatment, medical_officer, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.visitCode,
        input.employeeCode,
        input.employeeName,
        input.companyId,
        input.locationId,
        input.shift,
        input.visitDate,
        input.visitType,
        input.generalDiagnosis,
        input.pakClassification || null,
        input.symptoms,
        input.treatment,
        input.medicalOfficer,
        input.notes || '',
        userId,
      ],
    );
    const all = await this.listClinicVisits();
    return all.find((v) => v.id === res.insertId)!;
  }

  async updateClinicVisit(
    id: number,
    input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
  ): Promise<ClinicVisit | null> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `UPDATE clinic_visits
       SET visit_code = ?, employee_code = ?, employee_name = ?, company_id = ?, location_id = ?, shift = ?,
           visit_date = ?, visit_type = ?, general_diagnosis_name = ?, pak_classification = ?,
           symptoms = ?, treatment = ?, medical_officer = ?, notes = ?
       WHERE id = ?`,
      [
        input.visitCode,
        input.employeeCode,
        input.employeeName,
        input.companyId,
        input.locationId,
        input.shift,
        input.visitDate,
        input.visitType,
        input.generalDiagnosis,
        input.pakClassification || null,
        input.symptoms,
        input.treatment,
        input.medicalOfficer,
        input.notes || '',
        id,
      ],
    );
    if (res.affectedRows === 0) return null;
    const all = await this.listClinicVisits();
    return all.find((v) => v.id === id) ?? null;
  }

  async deleteClinicVisit(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>(`DELETE FROM clinic_visits WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }

  async listMedicalExams(): Promise<MedicalExamination[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT me.id, me.exam_code AS examCode, me.employee_code AS employeeCode, me.employee_name AS employeeName,
              me.company_id AS companyId, c.name AS companyName, COALESCE(d.name, 'Operations') AS departmentName,
              me.location_id AS locationId, l.name AS locationName, me.shift,
              DATE_FORMAT(me.exam_date, '%Y-%m-%d') AS examDate, me.exam_type AS examType,
              me.height_m AS heightM, me.weight_kg AS weightKg, me.bmi, me.bmi_category AS bmiCategory,
              me.blood_pressure AS bloodPressure, me.blood_glucose AS bloodGlucose, me.glucose_category AS glucoseCategory,
              me.total_cholesterol AS totalCholesterol, me.cholesterol_category AS cholesterolCategory,
              me.uric_acid AS uricAcid, me.uric_acid_category AS uricAcidCategory,
              me.medical_status AS medicalStatus, COALESCE(me.recommendations, '') AS recommendations,
              me.medical_officer AS medicalOfficer, me.created_at AS createdAt
       FROM medical_examinations me
       JOIN companies c ON c.id = me.company_id
       JOIN locations l ON l.id = me.location_id
       LEFT JOIN departments d ON d.id = me.department_id
       ORDER BY me.exam_date DESC, me.id DESC`,
    );
    return rows.map((r) => ({
      ...(r as MedicalExamination),
      heightM: Number(r.heightM),
      weightKg: Number(r.weightKg),
      bmi: Number(r.bmi),
      bloodGlucose: Number(r.bloodGlucose),
      totalCholesterol: Number(r.totalCholesterol),
      uricAcid: Number(r.uricAcid),
    }));
  }

  async createMedicalExam(
    input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
    userId: number,
  ): Promise<MedicalExamination> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO medical_examinations
       (exam_code, employee_code, employee_name, company_id, location_id, shift, exam_date, exam_type,
        height_m, weight_kg, bmi, bmi_category, blood_pressure, blood_glucose, glucose_category,
        total_cholesterol, cholesterol_category, uric_acid, uric_acid_category, medical_status,
        recommendations, medical_officer, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.examCode,
        input.employeeCode,
        input.employeeName,
        input.companyId,
        input.locationId,
        input.shift,
        input.examDate,
        input.examType,
        input.heightM,
        input.weightKg,
        input.bmi,
        input.bmiCategory,
        input.bloodPressure,
        input.bloodGlucose,
        input.glucoseCategory,
        input.totalCholesterol,
        input.cholesterolCategory,
        input.uricAcid,
        input.uricAcidCategory,
        input.medicalStatus,
        input.recommendations,
        input.medicalOfficer,
        userId,
      ],
    );
    const all = await this.listMedicalExams();
    return all.find((e) => e.id === res.insertId)!;
  }

  async updateMedicalExam(
    id: number,
    input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
  ): Promise<MedicalExamination | null> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `UPDATE medical_examinations
       SET exam_code = ?, employee_code = ?, employee_name = ?, company_id = ?, location_id = ?, shift = ?,
           exam_date = ?, exam_type = ?, height_m = ?, weight_kg = ?, bmi = ?, bmi_category = ?,
           blood_pressure = ?, blood_glucose = ?, glucose_category = ?, total_cholesterol = ?,
           cholesterol_category = ?, uric_acid = ?, uric_acid_category = ?, medical_status = ?,
           recommendations = ?, medical_officer = ?
       WHERE id = ?`,
      [
        input.examCode,
        input.employeeCode,
        input.employeeName,
        input.companyId,
        input.locationId,
        input.shift,
        input.examDate,
        input.examType,
        input.heightM,
        input.weightKg,
        input.bmi,
        input.bmiCategory,
        input.bloodPressure,
        input.bloodGlucose,
        input.glucoseCategory,
        input.totalCholesterol,
        input.cholesterolCategory,
        input.uricAcid,
        input.uricAcidCategory,
        input.medicalStatus,
        input.recommendations,
        input.medicalOfficer,
        id,
      ],
    );
    if (res.affectedRows === 0) return null;
    const all = await this.listMedicalExams();
    return all.find((e) => e.id === id) ?? null;
  }

  async deleteMedicalExam(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>(`DELETE FROM medical_examinations WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }

  private async getIncidentEvidence(incidentId: number): Promise<EvidenceFile[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ie.id, 'INCIDENT' AS entityType, ie.incident_id AS entityId, ie.evidence_type AS evidenceType,
              ie.original_filename AS originalFilename, ie.stored_filename AS storedFilename,
              ie.mime_type AS mimeType, ie.file_size_bytes AS fileSizeBytes,
              CONCAT('/api/evidence/file/', ie.stored_filename) AS url,
              COALESCE(u.full_name, 'System') AS uploadedByName, ie.uploaded_at AS uploadedAt
       FROM incident_evidence ie
       LEFT JOIN users u ON u.id = ie.uploaded_by
       WHERE ie.incident_id = ?
       ORDER BY ie.uploaded_at DESC`,
      [incidentId],
    );
    return rows as EvidenceFile[];
  }

  private async getCapaEvidence(capaId: number): Promise<EvidenceFile[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ce.id, 'CAPA' AS entityType, ce.capa_id AS entityId, 'DOCUMENT' AS evidenceType,
              ce.original_filename AS originalFilename, ce.stored_filename AS storedFilename,
              ce.mime_type AS mimeType, ce.file_size_bytes AS fileSizeBytes,
              CONCAT('/api/evidence/file/', ce.stored_filename) AS url,
              COALESCE(u.full_name, 'System') AS uploadedByName, ce.uploaded_at AS uploadedAt
       FROM capa_evidence ce
       LEFT JOIN users u ON u.id = ce.uploaded_by
       WHERE ce.capa_id = ?
       ORDER BY ce.uploaded_at DESC`,
      [capaId],
    );
    return rows as EvidenceFile[];
  }

  async listIncidents(): Promise<Incident[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT i.id, i.incident_code AS incidentCode, DATE_FORMAT(i.incident_date, '%Y-%m-%d') AS incidentDate,
              TIME_FORMAT(i.incident_time, '%H:%i:%s') AS incidentTime, i.company_id AS companyId, c.name AS companyName,
              COALESCE(d.name, 'Operations') AS departmentName, i.location_id AS locationId, l.name AS locationName,
              i.shift, i.employee_code AS employeeCode, i.employee_name AS employeeName, i.job_position AS jobPosition,
              i.incident_category AS incidentCategory, i.work_related_status AS workRelatedStatus, i.severity,
              i.incident_description AS incidentDescription, COALESCE(i.injury_description, '') AS injuryDescription,
              i.affected_body_part AS affectedBodyPart, COALESCE(i.injury_type, '') AS injuryType,
              i.immediate_actions AS immediateActions, i.status, i.closed_at AS closedAt,
              u.full_name AS closedByName, i.created_at AS createdAt
       FROM incidents i
       JOIN companies c ON c.id = i.company_id
       JOIN locations l ON l.id = i.location_id
       LEFT JOIN departments d ON d.id = i.department_id
       LEFT JOIN users u ON u.id = i.closed_by
       ORDER BY i.incident_date DESC, i.id DESC`,
    );

    const results: Incident[] = [];
    for (const row of rows) {
      const [witRows] = await this.pool.query<RowDataPacket[]>(
        `SELECT witness_name FROM incident_witnesses WHERE incident_id = ? LIMIT 1`,
        [row.id],
      );
      results.push({
        ...(row as Incident),
        witnessInfo: witRows[0]?.witness_name ?? '',
        evidence: await this.getIncidentEvidence(row.id),
      });
    }
    return results;
  }

  async getIncidentById(id: number): Promise<Incident | null> {
    const all = await this.listIncidents();
    return all.find((i) => i.id === id) ?? null;
  }

  async getIncidentDetail(id: number): Promise<IncidentDetailBundle | null> {
    const incident = await this.getIncidentById(id);
    if (!incident) return null;

    const [invRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, investigation_code AS investigationCode, incident_id AS incidentId,
              DATE_FORMAT(investigation_date, '%Y-%m-%d') AS investigationDate,
              investigation_leader AS investigationLeader, investigation_team AS investigationTeam,
              COALESCE(witness_statements, '') AS witnessStatements,
              incident_chronology AS incidentChronology,
              COALESCE(unsafe_act, '') AS unsafeAct,
              COALESCE(unsafe_condition, '') AS unsafeCondition,
              immediate_cause AS immediateCause,
              COALESCE(contributing_factors, '') AS contributingFactors,
              updated_at AS updatedAt
       FROM investigations WHERE incident_id = ? LIMIT 1`,
      [id],
    );

    const [fwRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, incident_id AS incidentId, why_1 AS why1, COALESCE(why_2, '') AS why2,
              COALESCE(why_3, '') AS why3, COALESCE(why_4, '') AS why4, COALESCE(why_5, '') AS why5,
              final_root_cause AS finalRootCause, updated_at AS updatedAt
       FROM five_whys WHERE incident_id = ? LIMIT 1`,
      [id],
    );

    const [fbRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, incident_id AS incidentId, category, cause_text AS causeText,
              COALESCE(sub_cause_text, '') AS subCauseText, is_primary_root AS isPrimaryRoot,
              created_at AS createdAt
       FROM fishbone_causes WHERE incident_id = ? ORDER BY id ASC`,
      [id],
    );

    const capas = (await this.listCapas()).filter((c) => c.incidentId === id);

    const [verRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT v.id, v.entity_type AS entityType, v.capa_id AS capaId, v.incident_id AS incidentId,
              v.decision, v.remarks, u.full_name AS verifiedByName, u.role AS verifiedByRole,
              v.verified_at AS verifiedAt
       FROM verifications v
       JOIN users u ON u.id = v.verified_by
       WHERE v.incident_id = ? ORDER BY v.verified_at DESC`,
      [id],
    );

    return {
      incident,
      investigation: invRows[0] ? (invRows[0] as Investigation) : null,
      fiveWhys: fwRows[0] ? (fwRows[0] as FiveWhys) : null,
      fishboneCauses: fbRows.map((r) => ({ ...(r as FishboneCause), isPrimaryRoot: Boolean(r.isPrimaryRoot) })),
      capas,
      verifications: verRows as VerificationRecord[],
    };
  }

  async createIncident(
    input: Omit<
      Incident,
      'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'
    >,
    userId: number,
  ): Promise<Incident> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO incidents
       (incident_code, incident_date, incident_time, company_id, location_id, shift, employee_code, employee_name,
        job_position, incident_category, work_related_status, severity, incident_description, injury_description,
        affected_body_part, injury_type, immediate_actions, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.incidentCode,
        input.incidentDate,
        input.incidentTime,
        input.companyId,
        input.locationId,
        input.shift,
        input.employeeCode,
        input.employeeName,
        input.jobPosition,
        input.incidentCategory,
        input.workRelatedStatus,
        input.severity,
        input.incidentDescription,
        input.injuryDescription,
        input.affectedBodyPart,
        input.injuryType,
        input.immediateActions,
        userId,
      ],
    );
    if (input.witnessInfo.trim()) {
      await this.pool.query(
        `INSERT INTO incident_witnesses (incident_id, witness_name) VALUES (?, ?)`,
        [res.insertId, input.witnessInfo.trim()],
      );
    }
    return (await this.getIncidentById(res.insertId))!;
  }

  async updateIncident(
    id: number,
    input: Omit<
      Incident,
      'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'
    >,
  ): Promise<Incident | null> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `UPDATE incidents
       SET incident_code = ?, incident_date = ?, incident_time = ?, company_id = ?, location_id = ?, shift = ?,
           employee_code = ?, employee_name = ?, job_position = ?, incident_category = ?, work_related_status = ?,
           severity = ?, incident_description = ?, injury_description = ?, affected_body_part = ?, injury_type = ?,
           immediate_actions = ?
       WHERE id = ?`,
      [
        input.incidentCode,
        input.incidentDate,
        input.incidentTime,
        input.companyId,
        input.locationId,
        input.shift,
        input.employeeCode,
        input.employeeName,
        input.jobPosition,
        input.incidentCategory,
        input.workRelatedStatus,
        input.severity,
        input.incidentDescription,
        input.injuryDescription,
        input.affectedBodyPart,
        input.injuryType,
        input.immediateActions,
        id,
      ],
    );
    if (res.affectedRows === 0) return null;
    return this.getIncidentById(id);
  }

  async deleteIncident(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>(`DELETE FROM incidents WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }

  async addIncidentEvidence(
    incidentId: number,
    file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>,
  ): Promise<EvidenceFile> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO incident_evidence (incident_id, evidence_type, original_filename, stored_filename, mime_type, file_size_bytes, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [incidentId, file.evidenceType, file.originalFilename, file.storedFilename, file.mimeType, file.fileSizeBytes, file.url],
    );
    return {
      ...file,
      id: res.insertId,
      entityType: 'INCIDENT',
      entityId: incidentId,
      uploadedAt: new Date().toISOString(),
    };
  }

  async listInvestigations(): Promise<Investigation[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, investigation_code AS investigationCode, incident_id AS incidentId,
              DATE_FORMAT(investigation_date, '%Y-%m-%d') AS investigationDate,
              investigation_leader AS investigationLeader, investigation_team AS investigationTeam,
              COALESCE(witness_statements, '') AS witnessStatements,
              incident_chronology AS incidentChronology,
              COALESCE(unsafe_act, '') AS unsafeAct,
              COALESCE(unsafe_condition, '') AS unsafeCondition,
              immediate_cause AS immediateCause,
              COALESCE(contributing_factors, '') AS contributingFactors,
              updated_at AS updatedAt
       FROM investigations`,
    );
    return rows as Investigation[];
  }

  async upsertInvestigation(
    incidentId: number,
    input: Omit<Investigation, 'id' | 'incidentId' | 'updatedAt'>,
    userId: number,
  ): Promise<Investigation> {
    await this.pool.query(
      `INSERT INTO investigations
       (investigation_code, incident_id, investigation_date, investigation_leader, investigation_team,
        witness_statements, incident_chronology, unsafe_act, unsafe_condition, immediate_cause, contributing_factors, is_completed, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
        investigation_code = VALUES(investigation_code),
        investigation_date = VALUES(investigation_date),
        investigation_leader = VALUES(investigation_leader),
        investigation_team = VALUES(investigation_team),
        witness_statements = VALUES(witness_statements),
        incident_chronology = VALUES(incident_chronology),
        unsafe_act = VALUES(unsafe_act),
        unsafe_condition = VALUES(unsafe_condition),
        immediate_cause = VALUES(immediate_cause),
        contributing_factors = VALUES(contributing_factors),
        is_completed = 1,
        updated_by = VALUES(updated_by)`,
      [
        input.investigationCode,
        incidentId,
        input.investigationDate,
        input.investigationLeader,
        input.investigationTeam,
        input.witnessStatements,
        input.incidentChronology,
        input.unsafeAct,
        input.unsafeCondition,
        input.immediateCause,
        input.contributingFactors,
        userId,
      ],
    );
    await this.pool.query(`UPDATE incidents SET status = 'Under Investigation' WHERE id = ? AND status = 'Open'`, [incidentId]);
    const list = await this.listInvestigations();
    return list.find((inv) => inv.incidentId === incidentId)!;
  }

  async upsertFiveWhys(
    incidentId: number,
    input: Omit<FiveWhys, 'id' | 'incidentId' | 'updatedAt'>,
    userId: number,
  ): Promise<FiveWhys> {
    await this.pool.query(
      `INSERT INTO five_whys (incident_id, why_1, why_2, why_3, why_4, why_5, final_root_cause, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        why_1 = VALUES(why_1), why_2 = VALUES(why_2), why_3 = VALUES(why_3),
        why_4 = VALUES(why_4), why_5 = VALUES(why_5), final_root_cause = VALUES(final_root_cause),
        updated_by = VALUES(updated_by)`,
      [incidentId, input.why1, input.why2, input.why3, input.why4, input.why5, input.finalRootCause, userId],
    );
    const detail = await this.getIncidentDetail(incidentId);
    return detail!.fiveWhys!;
  }

  async addFishboneCause(
    incidentId: number,
    input: Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>,
    userId: number,
  ): Promise<FishboneCause> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO fishbone_causes (incident_id, category, cause_text, sub_cause_text, is_primary_root, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [incidentId, input.category, input.causeText, input.subCauseText, input.isPrimaryRoot ? 1 : 0, userId],
    );
    return { id: res.insertId, incidentId, ...input, createdAt: new Date().toISOString() };
  }

  async updateFishboneCause(
    causeId: number,
    input: Partial<Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>>,
  ): Promise<FishboneCause | null> {
    const [existing] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM fishbone_causes WHERE id = ?`, [causeId]);
    if (!existing.length) return null;
    const row = existing[0];
    await this.pool.query(
      `UPDATE fishbone_causes SET category = ?, cause_text = ?, sub_cause_text = ?, is_primary_root = ? WHERE id = ?`,
      [
        input.category ?? row.category,
        input.causeText ?? row.cause_text,
        input.subCauseText ?? row.sub_cause_text,
        input.isPrimaryRoot !== undefined ? (input.isPrimaryRoot ? 1 : 0) : row.is_primary_root,
        causeId,
      ],
    );
    return {
      id: causeId,
      incidentId: Number(row.incident_id),
      category: input.category ?? row.category,
      causeText: input.causeText ?? row.cause_text,
      subCauseText: input.subCauseText ?? row.sub_cause_text ?? '',
      isPrimaryRoot: input.isPrimaryRoot ?? Boolean(row.is_primary_root),
      createdAt: String(row.created_at),
    };
  }

  async deleteFishboneCause(causeId: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>(`DELETE FROM fishbone_causes WHERE id = ?`, [causeId]);
    return res.affectedRows > 0;
  }

  async listCapas(): Promise<CapaAction[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ca.id, ca.capa_code AS capaCode, ca.incident_id AS incidentId, i.incident_code AS incidentCode,
              ca.root_cause AS rootCause, ca.action_description AS actionDescription, ca.action_type AS actionType,
              ca.responsible_pic AS responsiblePic, ca.department_name AS departmentName, ca.priority,
              DATE_FORMAT(ca.start_date, '%Y-%m-%d') AS startDate,
              DATE_FORMAT(ca.due_date, '%Y-%m-%d') AS dueDate,
              DATE_FORMAT(ca.completion_date, '%Y-%m-%d') AS completionDate,
              ca.action_status AS actionStatus, COALESCE(ca.completion_notes, '') AS completionNotes,
              ca.created_at AS createdAt
       FROM capa_actions ca
       JOIN incidents i ON i.id = ca.incident_id
       ORDER BY ca.due_date ASC`,
    );
    const out: CapaAction[] = [];
    for (const r of rows) {
      const base = r as CapaAction;
      out.push({
        ...base,
        effectiveStatus: computeCapaEffectiveStatus(base),
        evidence: await this.getCapaEvidence(base.id),
      });
    }
    return out;
  }

  async getCapaById(id: number): Promise<CapaAction | null> {
    const all = await this.listCapas();
    return all.find((c) => c.id === id) ?? null;
  }

  async createCapa(
    input: Omit<CapaAction, 'id' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>,
    userId: number,
  ): Promise<CapaAction> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO capa_actions
       (capa_code, incident_id, root_cause, action_description, action_type, responsible_pic, department_name,
        priority, start_date, due_date, completion_date, action_status, completion_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.capaCode,
        input.incidentId,
        input.rootCause,
        input.actionDescription,
        input.actionType,
        input.responsiblePic,
        input.departmentName,
        input.priority,
        input.startDate,
        input.dueDate,
        input.completionDate || null,
        input.actionStatus,
        input.completionNotes,
        userId,
      ],
    );
    await this.pool.query(
      `UPDATE incidents SET status = 'CAPA In Progress' WHERE id = ? AND status IN ('Open', 'Under Investigation')`,
      [input.incidentId],
    );
    return (await this.getCapaById(res.insertId))!;
  }

  async updateCapa(
    id: number,
    input: Partial<Omit<CapaAction, 'id' | 'incidentId' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>>,
  ): Promise<CapaAction | null> {
    const existing = await this.getCapaById(id);
    if (!existing) return null;
    await this.pool.query(
      `UPDATE capa_actions
       SET root_cause = ?, action_description = ?, action_type = ?, responsible_pic = ?, department_name = ?,
           priority = ?, start_date = ?, due_date = ?, completion_date = ?, action_status = ?, completion_notes = ?
       WHERE id = ?`,
      [
        input.rootCause ?? existing.rootCause,
        input.actionDescription ?? existing.actionDescription,
        input.actionType ?? existing.actionType,
        input.responsiblePic ?? existing.responsiblePic,
        input.departmentName ?? existing.departmentName,
        input.priority ?? existing.priority,
        input.startDate ?? existing.startDate,
        input.dueDate ?? existing.dueDate,
        input.completionDate !== undefined ? input.completionDate : existing.completionDate,
        input.actionStatus ?? existing.actionStatus,
        input.completionNotes ?? existing.completionNotes,
        id,
      ],
    );
    return this.getCapaById(id);
  }

  async deleteCapa(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>(`DELETE FROM capa_actions WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }

  async addCapaEvidence(
    capaId: number,
    file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>,
  ): Promise<EvidenceFile> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO capa_evidence (capa_id, original_filename, stored_filename, mime_type, file_size_bytes, storage_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [capaId, file.originalFilename, file.storedFilename, file.mimeType, file.fileSizeBytes, file.url],
    );
    return {
      ...file,
      id: res.insertId,
      entityType: 'CAPA',
      entityId: capaId,
      uploadedAt: new Date().toISOString(),
    };
  }

  async verifyCapa(params: {
    capaId: number;
    decision: 'APPROVED' | 'REJECTED' | 'REOPENED';
    remarks: string;
    user: AuthUser;
  }): Promise<CapaAction | null> {
    const capa = await this.getCapaById(params.capaId);
    if (!capa) return null;
    const nextStatus = params.decision === 'APPROVED' ? 'Verified' : 'Rejected / Reopened';
    const completionDate =
      params.decision === 'APPROVED'
        ? capa.completionDate || new Date().toISOString().slice(0, 10)
        : capa.completionDate;

    await this.pool.query(
      `UPDATE capa_actions SET action_status = ?, completion_date = ? WHERE id = ?`,
      [nextStatus, completionDate, params.capaId],
    );
    await this.pool.query(
      `INSERT INTO verifications (entity_type, capa_id, incident_id, decision, remarks, verified_by)
       VALUES ('CAPA', ?, ?, ?, ?, ?)`,
      [params.capaId, capa.incidentId, params.decision, params.remarks, params.user.id],
    );
    return this.getCapaById(params.capaId);
  }

  async closeIncident(params: {
    incidentId: number;
    remarks: string;
    user: AuthUser;
  }): Promise<Incident | null> {
    await this.pool.query(
      `UPDATE incidents SET status = 'Closed', closed_at = NOW(), closed_by = ? WHERE id = ?`,
      [params.user.id, params.incidentId],
    );
    await this.pool.query(
      `INSERT INTO verifications (entity_type, capa_id, incident_id, decision, remarks, verified_by)
       VALUES ('INCIDENT_CLOSURE', NULL, ?, 'APPROVED', ?, ?)`,
      [params.incidentId, params.remarks, params.user.id],
    );
    return this.getIncidentById(params.incidentId);
  }

  async listAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id, COALESCE(user_email, 'system') AS userEmail, COALESCE(user_role, 'SYSTEM') AS userRole,
              action, entity_type AS entityType, entity_id AS entityId, summary, created_at AS createdAt
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
    return rows as AuditLog[];
  }

  async appendAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (user_email, user_role, action, entity_type, entity_id, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.userEmail, entry.userRole, entry.action, entry.entityType, entry.entityId, entry.summary],
    );
  }
}
