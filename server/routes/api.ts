import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  aggregateDashboardData,
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  deriveMedicalStatus,
  evaluateIncidentClosureGate,
} from '../../src/shared/ohsLogic';
import type { DashboardFilters, SectionFilter, UserRole } from '../../src/shared/types';
import {
  capaSchema,
  clinicVisitSchema,
  fishboneCauseSchema,
  fiveWhysSchema,
  incidentSchema,
  investigationSchema,
  loginSchema,
  medicalExamSchema,
} from '../../src/shared/validation';
import { env } from '../config/env';
import { getRepository, getSystemStatus } from '../db/adapter';
import {
  authenticateJwt,
  requireRoles,
  signAuthToken,
  type AuthenticatedRequest,
} from '../middleware/auth';
import { evidenceUpload } from '../middleware/upload';

export const apiRouter = Router();

function parseSectionFilter(prefix: string, query: Record<string, unknown>): SectionFilter {
  const month = typeof query[`${prefix}Month`] === 'string' ? (query[`${prefix}Month`] as string) : 'ALL';
  const companyId = typeof query[`${prefix}CompanyId`] === 'string' ? (query[`${prefix}CompanyId`] as string) : 'ALL';
  const locationId = typeof query[`${prefix}LocationId`] === 'string' ? (query[`${prefix}LocationId`] as string) : 'ALL';
  const shift = typeof query[`${prefix}Shift`] === 'string' ? (query[`${prefix}Shift`] as string) : 'ALL';
  return { month, companyId, locationId, shift };
}

function sendValidationError(res: Response, err: unknown) {
  res.status(400).json({
    error: 'Validation failed',
    details: err instanceof Error ? err.message : 'Invalid payload',
  });
}

// Health & Database Status
apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, status: getSystemStatus(), timestamp: new Date().toISOString() });
});

apiRouter.get('/system/status', (_req, res) => {
  res.json(getSystemStatus());
});

// Authentication
apiRouter.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials format' });
    return;
  }

  const repo = getRepository();
  const user = await repo.findUserByEmail(parsed.data.email);
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  await repo.touchUserLogin(user.id);
  const { passwordHash: _ph, ...safeUser } = user;
  const token = signAuthToken(safeUser);
  await repo.appendAuditLog({
    userEmail: safeUser.email,
    userRole: safeUser.role,
    action: 'USER_LOGIN',
    entityType: 'AUTH',
    entityId: safeUser.userCode,
    summary: `${safeUser.fullName} (${safeUser.role}) signed in.`,
  });

  res.json({ token, user: safeUser, systemStatus: getSystemStatus() });
});

apiRouter.post('/auth/demo-login', async (req, res) => {
  const status = getSystemStatus();
  if (status.mode !== 'DEMO_STORE') {
    res.status(403).json({ error: 'Demo quick login is disabled when connected to production MySQL.' });
    return;
  }
  const role = req.body?.role as UserRole | undefined;
  const emailMap: Record<UserRole, string> = {
    ADMIN: 'admin@ohsexpert.io',
    HSE_OFFICER: 'hse@ohsexpert.io',
    MANAGEMENT: 'management@ohsexpert.io',
  };
  const targetEmail = emailMap[role || 'ADMIN'] || emailMap.ADMIN;
  const repo = getRepository();
  const user = await repo.findUserByEmail(targetEmail);
  if (!user || !user.isActive) {
    res.status(404).json({ error: 'Demo account not found.' });
    return;
  }
  const { passwordHash: _ph, ...safeUser } = user;
  const token = signAuthToken(safeUser);
  res.json({ token, user: safeUser, systemStatus: status });
});

apiRouter.get('/auth/me', authenticateJwt, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user, systemStatus: getSystemStatus() });
});

// Master Data & Clinical Reference Ranges
apiRouter.get('/master', authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  const master = await repo.getMasterData();
  res.json(master);
});

apiRouter.post('/master/companies', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const { companyCode, name, industry } = req.body || {};
  if (!companyCode || !name) {
    res.status(400).json({ error: 'companyCode and name are required' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createCompany({ companyCode, name, industry: industry || '' });
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_COMPANY',
    entityType: 'COMPANY',
    entityId: created.companyCode,
    summary: `Created company ${created.name}`,
  });
  res.status(201).json(created);
});

apiRouter.post('/master/departments', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const { companyId, departmentCode, name } = req.body || {};
  if (!companyId || !departmentCode || !name) {
    res.status(400).json({ error: 'companyId, departmentCode, and name are required' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createDepartment({ companyId: Number(companyId), departmentCode, name });
  res.status(201).json(created);
});

apiRouter.post('/master/locations', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const { companyId, locationCode, name, siteArea } = req.body || {};
  if (!companyId || !locationCode || !name) {
    res.status(400).json({ error: 'companyId, locationCode, and name are required' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createLocation({
    companyId: Number(companyId),
    locationCode,
    name,
    siteArea: siteArea || '',
  });
  res.status(201).json(created);
});

apiRouter.post('/master/employees', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const { employeeCode, fullName, companyId, departmentId, locationId, jobPosition, shift } = req.body || {};
  if (!employeeCode || !fullName || !companyId || !jobPosition) {
    res.status(400).json({ error: 'employeeCode, fullName, companyId, and jobPosition are required' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createEmployee({
    employeeCode,
    fullName,
    companyId: Number(companyId),
    departmentId: Number(departmentId || 0),
    locationId: Number(locationId || 0),
    jobPosition,
    shift: shift || 'Pagi',
  });
  res.status(201).json(created);
});

apiRouter.put('/master/clinical-ranges', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const repo = getRepository();
  const updated = await repo.updateClinicalRanges(req.body, req.user!.id);
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_CLINICAL_RANGES',
    entityType: 'CLINICAL_CONFIG',
    entityId: 'DEFAULT',
    summary: 'Updated clinical reference ranges and reclassified medical exams.',
  });
  res.json(updated);
});

// User Management (ADMIN only)
apiRouter.get('/users', authenticateJwt, requireRoles('ADMIN'), async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listUsers());
});

apiRouter.post('/users', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const { userCode, fullName, email, password, role, departmentName } = req.body || {};
  if (!userCode || !fullName || !email || !password || !role) {
    res.status(400).json({ error: 'userCode, fullName, email, password, and role are required.' });
    return;
  }
  const repo = getRepository();
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await repo.createUser({
    userCode,
    fullName,
    email,
    passwordHash,
    role,
    departmentName: departmentName || 'HSE',
  });
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_USER',
    entityType: 'USER',
    entityId: created.userCode,
    summary: `Created user ${created.email} with role ${created.role}`,
  });
  res.status(201).json(created);
});

apiRouter.patch('/users/:id', authenticateJwt, requireRoles('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const { isActive, role } = req.body || {};
  const repo = getRepository();
  const updated = await repo.updateUserStatus(id, Boolean(isActive), role);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_USER',
    entityType: 'USER',
    entityId: updated.userCode,
    summary: `Updated user ${updated.email} (active=${updated.isActive}, role=${updated.role})`,
  });
  res.json(updated);
});

// Dashboard Aggregation Endpoint
apiRouter.get('/dashboard', authenticateJwt, async (req: AuthenticatedRequest, res) => {
  const repo = getRepository();
  const filters: DashboardFilters = {
    visits: parseSectionFilter('v', req.query as Record<string, unknown>),
    exams: parseSectionFilter('e', req.query as Record<string, unknown>),
    incidents: parseSectionFilter('i', req.query as Record<string, unknown>),
  };

  const [clinicVisits, medicalExams, incidents, capas, investigations] = await Promise.all([
    repo.listClinicVisits(),
    repo.listMedicalExams(),
    repo.listIncidents(),
    repo.listCapas(),
    repo.listInvestigations(),
  ]);

  const includeMedicalExams = ['ADMIN', 'HSE_OFFICER', 'MANAGEMENT'].includes(req.user!.role);

  const summary = aggregateDashboardData({
    clinicVisits,
    medicalExams,
    incidents,
    capas,
    investigations,
    filters,
    includeMedicalExams,
  });

  res.json({
    summary,
    recentIncidents: incidents,
    capas,
  });
});

// Clinic Visits CRUD
apiRouter.get('/clinic-visits', authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listClinicVisits());
});

apiRouter.post('/clinic-visits', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const parsed = clinicVisitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid clinic visit input' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createClinicVisit(
    {
      ...parsed.data,
      pakClassification: parsed.data.pakClassification || null,
    },
    req.user!.id,
  );
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_CLINIC_VISIT',
    entityType: 'CLINIC_VISIT',
    entityId: created.visitCode,
    summary: `Logged clinic visit ${created.visitCode} for ${created.employeeName}`,
  });
  res.status(201).json(created);
});

apiRouter.put('/clinic-visits/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = clinicVisitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid clinic visit input' });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateClinicVisit(id, {
    ...parsed.data,
    pakClassification: parsed.data.pakClassification || null,
  });
  if (!updated) {
    res.status(404).json({ error: 'Clinic visit not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_CLINIC_VISIT',
    entityType: 'CLINIC_VISIT',
    entityId: updated.visitCode,
    summary: `Updated clinic visit ${updated.visitCode}`,
  });
  res.json(updated);
});

apiRouter.delete('/clinic-visits/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteClinicVisit(id);
  if (!deleted) {
    res.status(404).json({ error: 'Clinic visit not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'DELETE_CLINIC_VISIT',
    entityType: 'CLINIC_VISIT',
    entityId: String(id),
    summary: `Deleted clinic visit record #${id}`,
  });
  res.json({ ok: true });
});

// Medical Examinations CRUD (with server-side BMI & clinical reference classification)
apiRouter.get('/medical-examinations', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER', 'MANAGEMENT'), async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listMedicalExams());
});

apiRouter.post('/medical-examinations', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const parsed = medicalExamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid medical exam input' });
    return;
  }
  const repo = getRepository();
  const { clinicalRanges } = await repo.getMasterData();
  const bmi = calculateBmi(parsed.data.weightKg, parsed.data.heightM);
  const bmiCategory = classifyBmi(bmi, clinicalRanges);
  const glucoseCategory = classifyBloodGlucose(parsed.data.bloodGlucose, clinicalRanges);
  const cholesterolCategory = classifyCholesterol(parsed.data.totalCholesterol, clinicalRanges);
  const uricAcidCategory = classifyUricAcid(parsed.data.uricAcid, clinicalRanges);
  const medicalStatus =
    parsed.data.medicalStatus ||
    deriveMedicalStatus({ bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory });

  const created = await repo.createMedicalExam(
    {
      ...parsed.data,
      bmi,
      bmiCategory,
      glucoseCategory,
      cholesterolCategory,
      uricAcidCategory,
      medicalStatus,
    },
    req.user!.id,
  );
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_MEDICAL_EXAM',
    entityType: 'MEDICAL_EXAM',
    entityId: created.examCode,
    summary: `Recorded medical exam ${created.examCode} (BMI ${created.bmi}, Status: ${created.medicalStatus})`,
  });
  res.status(201).json(created);
});

apiRouter.put('/medical-examinations/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = medicalExamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid medical exam input' });
    return;
  }
  const repo = getRepository();
  const { clinicalRanges } = await repo.getMasterData();
  const bmi = calculateBmi(parsed.data.weightKg, parsed.data.heightM);
  const bmiCategory = classifyBmi(bmi, clinicalRanges);
  const glucoseCategory = classifyBloodGlucose(parsed.data.bloodGlucose, clinicalRanges);
  const cholesterolCategory = classifyCholesterol(parsed.data.totalCholesterol, clinicalRanges);
  const uricAcidCategory = classifyUricAcid(parsed.data.uricAcid, clinicalRanges);
  const medicalStatus =
    parsed.data.medicalStatus ||
    deriveMedicalStatus({ bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory });

  const updated = await repo.updateMedicalExam(id, {
    ...parsed.data,
    bmi,
    bmiCategory,
    glucoseCategory,
    cholesterolCategory,
    uricAcidCategory,
    medicalStatus,
  });
  if (!updated) {
    res.status(404).json({ error: 'Medical examination not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_MEDICAL_EXAM',
    entityType: 'MEDICAL_EXAM',
    entityId: updated.examCode,
    summary: `Updated medical exam ${updated.examCode}`,
  });
  res.json(updated);
});

apiRouter.delete('/medical-examinations/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteMedicalExam(id);
  if (!deleted) {
    res.status(404).json({ error: 'Medical examination not found' });
    return;
  }
  res.json({ ok: true });
});

// Incidents CRUD & Investigation Bundle
apiRouter.get('/incidents', authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listIncidents());
});

apiRouter.get('/incidents/:id/detail', authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const bundle = await repo.getIncidentDetail(id);
  if (!bundle) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  const closureGate = evaluateIncidentClosureGate(bundle);
  res.json({ ...bundle, closureGate });
});

apiRouter.post('/incidents', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid incident data' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createIncident(parsed.data, req.user!.id);
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_INCIDENT',
    entityType: 'INCIDENT',
    entityId: created.incidentCode,
    summary: `Reported workplace incident ${created.incidentCode} (${created.incidentCategory})`,
  });
  res.status(201).json(created);
});

apiRouter.put('/incidents/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid incident data' });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateIncident(id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_INCIDENT',
    entityType: 'INCIDENT',
    entityId: updated.incidentCode,
    summary: `Updated incident report ${updated.incidentCode}`,
  });
  res.json(updated);
});

apiRouter.delete('/incidents/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteIncident(id);
  if (!deleted) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'DELETE_INCIDENT',
    entityType: 'INCIDENT',
    entityId: String(id),
    summary: `Deleted incident #${id}`,
  });
  res.json({ ok: true });
});

// Incident Evidence Upload (Multer)
apiRouter.post(
  '/incidents/:id/evidence',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  (req, res, next) => {
    evidenceUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'File upload failed' });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res) => {
    const incidentId = Number(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: 'No file attached' });
      return;
    }
    const repo = getRepository();
    const incident = await repo.getIncidentById(incidentId);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const evidenceType = req.file.mimetype === 'application/pdf' ? 'DOCUMENT' : 'PHOTO';
    const saved = await repo.addIncidentEvidence(incidentId, {
      evidenceType,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      url: `/api/evidence/file/${req.file.filename}`,
      uploadedByName: req.user!.fullName,
    });
    await repo.appendAuditLog({
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'UPLOAD_INCIDENT_EVIDENCE',
      entityType: 'INCIDENT',
      entityId: incident.incidentCode,
      summary: `Uploaded ${evidenceType} evidence (${req.file.originalname}) to ${incident.incidentCode}`,
    });
    res.status(201).json(saved);
  },
);

// Investigation Details, Five Whys, and Fishbone 6M
apiRouter.put(
  '/incidents/:id/investigation',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  async (req: AuthenticatedRequest, res) => {
    const incidentId = Number(req.params.id);
    const parsed = investigationSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]);
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const saved = await repo.upsertInvestigation(incidentId, parsed.data, req.user!.id);
    await repo.appendAuditLog({
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'SAVE_INVESTIGATION',
      entityType: 'INCIDENT',
      entityId: inc.incidentCode,
      summary: `Saved investigation ${saved.investigationCode} for ${inc.incidentCode}`,
    });
    res.json(saved);
  },
);

apiRouter.put(
  '/incidents/:id/five-whys',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  async (req: AuthenticatedRequest, res) => {
    const incidentId = Number(req.params.id);
    const parsed = fiveWhysSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Five Whys data' });
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const saved = await repo.upsertFiveWhys(incidentId, parsed.data, req.user!.id);
    await repo.appendAuditLog({
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'SAVE_FIVE_WHYS',
      entityType: 'INCIDENT',
      entityId: inc.incidentCode,
      summary: `Documented Five Whys RCA for ${inc.incidentCode}`,
    });
    res.json(saved);
  },
);

apiRouter.post(
  '/incidents/:id/fishbone',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  async (req: AuthenticatedRequest, res) => {
    const incidentId = Number(req.params.id);
    const parsed = fishboneCauseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid fishbone cause' });
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    const saved = await repo.addFishboneCause(incidentId, parsed.data, req.user!.id);
    await repo.appendAuditLog({
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADD_FISHBONE_CAUSE',
      entityType: 'INCIDENT',
      entityId: inc.incidentCode,
      summary: `Added 6M Fishbone cause [${saved.category}] to ${inc.incidentCode}`,
    });
    res.status(201).json(saved);
  },
);

apiRouter.put(
  '/fishbone/:causeId',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  async (req: AuthenticatedRequest, res) => {
    const causeId = Number(req.params.causeId);
    const parsed = fishboneCauseSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid fishbone update' });
      return;
    }
    const repo = getRepository();
    const updated = await repo.updateFishboneCause(causeId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'Fishbone cause not found' });
      return;
    }
    res.json(updated);
  },
);

apiRouter.delete(
  '/fishbone/:causeId',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  async (req: AuthenticatedRequest, res) => {
    const causeId = Number(req.params.causeId);
    const repo = getRepository();
    const deleted = await repo.deleteFishboneCause(causeId);
    if (!deleted) {
      res.status(404).json({ error: 'Fishbone cause not found' });
      return;
    }
    res.json({ ok: true });
  },
);

// CAPA CRUD & Evidence & Verification
apiRouter.get('/capas', authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listCapas());
});

apiRouter.post('/capas', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const parsed = capaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid CAPA data' });
    return;
  }
  const repo = getRepository();
  const created = await repo.createCapa(
    {
      ...parsed.data,
      completionDate: parsed.data.completionDate || null,
      actionStatus: parsed.data.actionStatus || 'Open',
    },
    req.user!.id,
  );
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CREATE_CAPA',
    entityType: 'CAPA',
    entityId: created.capaCode,
    summary: `Created ${created.actionType} ${created.capaCode} for ${created.incidentCode}`,
  });
  res.status(201).json(created);
});

apiRouter.put('/capas/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = capaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid CAPA update' });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateCapa(id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'CAPA record not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'UPDATE_CAPA',
    entityType: 'CAPA',
    entityId: updated.capaCode,
    summary: `Updated ${updated.capaCode} status to ${updated.actionStatus}`,
  });
  res.json(updated);
});

apiRouter.delete('/capas/:id', authenticateJwt, requireRoles('ADMIN', 'HSE_OFFICER'), async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteCapa(id);
  if (!deleted) {
    res.status(404).json({ error: 'CAPA record not found' });
    return;
  }
  res.json({ ok: true });
});

apiRouter.post(
  '/capas/:id/evidence',
  authenticateJwt,
  requireRoles('ADMIN', 'HSE_OFFICER'),
  (req, res, next) => {
    evidenceUpload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'File upload failed' });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res) => {
    const capaId = Number(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: 'No file attached' });
      return;
    }
    const repo = getRepository();
    const capa = await repo.getCapaById(capaId);
    if (!capa) {
      res.status(404).json({ error: 'CAPA record not found' });
      return;
    }
    const saved = await repo.addCapaEvidence(capaId, {
      evidenceType: req.file.mimetype === 'application/pdf' ? 'DOCUMENT' : 'PHOTO',
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      url: `/api/evidence/file/${req.file.filename}`,
      uploadedByName: req.user!.fullName,
    });
    await repo.appendAuditLog({
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'UPLOAD_CAPA_EVIDENCE',
      entityType: 'CAPA',
      entityId: capa.capaCode,
      summary: `Uploaded completion evidence (${req.file.originalname}) for ${capa.capaCode}`,
    });
    res.status(201).json(saved);
  },
);

// Verification & Closure (MANAGEMENT or ADMIN only!)
apiRouter.post('/capas/:id/verify', authenticateJwt, requireRoles('MANAGEMENT', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const capaId = Number(req.params.id);
  const { decision, remarks } = req.body || {};
  if (!['APPROVED', 'REJECTED', 'REOPENED'].includes(decision) || !remarks?.trim()) {
    res.status(400).json({ error: 'Valid decision (APPROVED/REJECTED/REOPENED) and remarks are required.' });
    return;
  }
  const repo = getRepository();
  const updated = await repo.verifyCapa({
    capaId,
    decision,
    remarks: remarks.trim(),
    user: req.user!,
  });
  if (!updated) {
    res.status(404).json({ error: 'CAPA record not found' });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'VERIFY_CAPA',
    entityType: 'CAPA',
    entityId: updated.capaCode,
    summary: `${decision} CAPA ${updated.capaCode}: ${remarks.trim()}`,
  });
  res.json(updated);
});

apiRouter.post('/incidents/:id/close', authenticateJwt, requireRoles('MANAGEMENT', 'ADMIN'), async (req: AuthenticatedRequest, res) => {
  const incidentId = Number(req.params.id);
  const { remarks } = req.body || {};
  if (!remarks?.trim()) {
    res.status(400).json({ error: 'Closure remarks are required.' });
    return;
  }
  const repo = getRepository();
  const detail = await repo.getIncidentDetail(incidentId);
  if (!detail) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  const gate = evaluateIncidentClosureGate(detail);
  if (!gate.canClose) {
    res.status(422).json({
      error: 'Incident closure blocked by governance rules.',
      reasons: gate.reasons,
    });
    return;
  }
  const closed = await repo.closeIncident({
    incidentId,
    remarks: remarks.trim(),
    user: req.user!,
  });
  await repo.appendAuditLog({
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'CLOSE_INCIDENT',
    entityType: 'INCIDENT',
    entityId: detail.incident.incidentCode,
    summary: `Closed incident ${detail.incident.incidentCode}: ${remarks.trim()}`,
  });
  res.json(closed);
});

// Audit Logs
apiRouter.get('/audit-logs', authenticateJwt, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const repo = getRepository();
  res.json(await repo.listAuditLogs(Math.min(limit, 300)));
});

// Secure Evidence File Serving (authenticated only, path traversal safe)
apiRouter.get('/evidence/file/:storedFilename', authenticateJwt, (req, res) => {
  const safeName = path.basename(String(req.params.storedFilename));
  const fullPath = path.resolve(env.uploadDir, safeName);
  if (!fullPath.startsWith(env.uploadDir) || !fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Evidence file not found' });
    return;
  }
  res.sendFile(fullPath);
});
