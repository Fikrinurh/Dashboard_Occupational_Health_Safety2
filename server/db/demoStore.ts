import fs from 'fs';
import path from 'path';
import {
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  computeCapaEffectiveStatus,
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
} from '../../src/shared/types';
import { createInitialSeedState, type DemoDatabaseState } from './seedData';
import type { IncidentDetailBundle, OhsRepository, StoredUser } from './types';

const DEMO_DB_PATH = path.resolve(process.cwd(), 'server/data/demo-db.json');

export class DemoStoreRepository implements OhsRepository {
  private state: DemoDatabaseState;

  constructor() {
    this.state = this.loadState();
  }

  getMode(): 'DEMO_STORE' {
    return 'DEMO_STORE';
  }

  private loadState(): DemoDatabaseState {
    try {
      if (fs.existsSync(DEMO_DB_PATH)) {
        const raw = fs.readFileSync(DEMO_DB_PATH, 'utf-8');
        return JSON.parse(raw) as DemoDatabaseState;
      }
    } catch {
      // Fallback to fresh seed if corrupted
    }
    const seed = createInitialSeedState();
    this.saveState(seed);
    return seed;
  }

  private saveState(stateToSave: DemoDatabaseState = this.state): void {
    fs.mkdirSync(path.dirname(DEMO_DB_PATH), { recursive: true });
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(stateToSave, null, 2), 'utf-8');
  }

  private nextId(): number {
    this.state.nextId += 1;
    return this.state.nextId;
  }

  private companyName(companyId: number): string {
    return this.state.companies.find((c) => c.id === companyId)?.name ?? 'Unknown Company';
  }

  private locationName(locationId: number): string {
    return this.state.locations.find((l) => l.id === locationId)?.name ?? 'Unknown Location';
  }

  private attachEvidenceToIncident(inc: Incident): Incident {
    return {
      ...inc,
      evidence: this.state.evidenceFiles.filter(
        (e) => e.entityType === 'INCIDENT' && e.entityId === inc.id,
      ),
    };
  }

  private enrichCapa(capa: CapaAction): CapaAction {
    const inc = this.state.incidents.find((i) => i.id === capa.incidentId);
    return {
      ...capa,
      incidentCode: inc?.incidentCode ?? `INC-${capa.incidentId}`,
      effectiveStatus: computeCapaEffectiveStatus(capa),
      evidence: this.state.evidenceFiles.filter(
        (e) => e.entityType === 'CAPA' && e.entityId === capa.id,
      ),
    };
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return (
      this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
    );
  }

  async findUserById(id: number): Promise<StoredUser | null> {
    return this.state.users.find((u) => u.id === id) ?? null;
  }

  async listUsers(): Promise<AuthUser[]> {
    return this.state.users.map(({ passwordHash: _ph, ...u }) => u);
  }

  async createUser(input: {
    userCode: string;
    fullName: string;
    email: string;
    passwordHash: string;
    role: AuthUser['role'];
    departmentName: string;
  }): Promise<AuthUser> {
    const user: StoredUser = {
      id: this.nextId(),
      userCode: input.userCode,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      departmentName: input.departmentName,
      isActive: true,
    };
    this.state.users.push(user);
    this.saveState();
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async updateUserStatus(
    id: number,
    isActive: boolean,
    role?: AuthUser['role'],
  ): Promise<AuthUser | null> {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) return null;
    user.isActive = isActive;
    if (role) user.role = role;
    this.saveState();
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }

  async touchUserLogin(_id: number): Promise<void> {
    // No-op timestamp update for demo store
  }

  async getMasterData() {
    return {
      companies: [...this.state.companies],
      departments: [...this.state.departments],
      locations: [...this.state.locations],
      employees: [...this.state.employees],
      clinicalRanges: { ...this.state.clinicalRanges },
    };
  }

  async createCompany(input: { companyCode: string; name: string; industry: string }): Promise<Company> {
    const company: Company = { id: this.nextId(), ...input };
    this.state.companies.push(company);
    this.saveState();
    return company;
  }

  async createDepartment(input: {
    companyId: number;
    departmentCode: string;
    name: string;
  }): Promise<Department> {
    const dept: Department = { id: this.nextId(), ...input };
    this.state.departments.push(dept);
    this.saveState();
    return dept;
  }

  async createLocation(input: {
    companyId: number;
    locationCode: string;
    name: string;
    siteArea: string;
  }): Promise<LocationItem> {
    const loc: LocationItem = { id: this.nextId(), ...input };
    this.state.locations.push(loc);
    this.saveState();
    return loc;
  }

  async createEmployee(
    input: Omit<Employee, 'id' | 'companyName' | 'departmentName' | 'locationName'>,
  ): Promise<Employee> {
    const dept = this.state.departments.find((d) => d.id === input.departmentId);
    const emp: Employee = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      departmentName: dept?.name ?? 'Operations',
      locationName: this.locationName(input.locationId),
    };
    this.state.employees.push(emp);
    this.saveState();
    return emp;
  }

  async updateClinicalRanges(
    ranges: ClinicalReferenceRanges,
    _userId: number,
  ): Promise<ClinicalReferenceRanges> {
    this.state.clinicalRanges = { ...ranges };
    // Reclassify existing medical examinations against updated ranges
    for (const exam of this.state.medicalExams) {
      exam.bmi = calculateBmi(exam.weightKg, exam.heightM);
      exam.bmiCategory = classifyBmi(exam.bmi, ranges);
      exam.glucoseCategory = classifyBloodGlucose(exam.bloodGlucose, ranges);
      exam.cholesterolCategory = classifyCholesterol(exam.totalCholesterol, ranges);
      exam.uricAcidCategory = classifyUricAcid(exam.uricAcid, ranges);
      exam.medicalStatus = deriveMedicalStatus({
        bmiCategory: exam.bmiCategory,
        glucoseCategory: exam.glucoseCategory,
        cholesterolCategory: exam.cholesterolCategory,
        uricAcidCategory: exam.uricAcidCategory,
      });
    }
    this.saveState();
    return { ...this.state.clinicalRanges };
  }

  async listClinicVisits(): Promise<ClinicVisit[]> {
    return [...this.state.clinicVisits].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }

  async createClinicVisit(
    input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
    _userId: number,
  ): Promise<ClinicVisit> {
    const created: ClinicVisit = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      createdAt: new Date().toISOString(),
    };
    this.state.clinicVisits.unshift(created);
    this.saveState();
    return created;
  }

  async updateClinicVisit(
    id: number,
    input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
  ): Promise<ClinicVisit | null> {
    const idx = this.state.clinicVisits.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    const updated: ClinicVisit = {
      ...this.state.clinicVisits[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
    };
    this.state.clinicVisits[idx] = updated;
    this.saveState();
    return updated;
  }

  async deleteClinicVisit(id: number): Promise<boolean> {
    const before = this.state.clinicVisits.length;
    this.state.clinicVisits = this.state.clinicVisits.filter((v) => v.id !== id);
    if (this.state.clinicVisits.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }

  async listMedicalExams(): Promise<MedicalExamination[]> {
    return [...this.state.medicalExams].sort((a, b) => b.examDate.localeCompare(a.examDate));
  }

  async createMedicalExam(
    input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
    _userId: number,
  ): Promise<MedicalExamination> {
    const created: MedicalExamination = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      createdAt: new Date().toISOString(),
    };
    this.state.medicalExams.unshift(created);
    this.saveState();
    return created;
  }

  async updateMedicalExam(
    id: number,
    input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>,
  ): Promise<MedicalExamination | null> {
    const idx = this.state.medicalExams.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated: MedicalExamination = {
      ...this.state.medicalExams[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
    };
    this.state.medicalExams[idx] = updated;
    this.saveState();
    return updated;
  }

  async deleteMedicalExam(id: number): Promise<boolean> {
    const before = this.state.medicalExams.length;
    this.state.medicalExams = this.state.medicalExams.filter((e) => e.id !== id);
    if (this.state.medicalExams.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }

  async listIncidents(): Promise<Incident[]> {
    return [...this.state.incidents]
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate))
      .map((inc) => this.attachEvidenceToIncident(inc));
  }

  async getIncidentById(id: number): Promise<Incident | null> {
    const inc = this.state.incidents.find((i) => i.id === id);
    return inc ? this.attachEvidenceToIncident(inc) : null;
  }

  async getIncidentDetail(id: number): Promise<IncidentDetailBundle | null> {
    const inc = await this.getIncidentById(id);
    if (!inc) return null;
    return {
      incident: inc,
      investigation: this.state.investigations.find((inv) => inv.incidentId === id) ?? null,
      fiveWhys: this.state.fiveWhys.find((fw) => fw.incidentId === id) ?? null,
      fishboneCauses: this.state.fishboneCauses.filter((fc) => fc.incidentId === id),
      capas: this.state.capas
        .filter((c) => c.incidentId === id)
        .map((c) => this.enrichCapa(c)),
      verifications: this.state.verifications.filter((v) => v.incidentId === id),
    };
  }

  async createIncident(
    input: Omit<
      Incident,
      'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'
    >,
    _userId: number,
  ): Promise<Incident> {
    const created: Incident = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      status: 'Open',
      closedAt: null,
      closedByName: null,
      evidence: [],
      createdAt: new Date().toISOString(),
    };
    this.state.incidents.unshift(created);
    this.saveState();
    return created;
  }

  async updateIncident(
    id: number,
    input: Omit<
      Incident,
      'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'
    >,
  ): Promise<Incident | null> {
    const idx = this.state.incidents.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const updated: Incident = {
      ...this.state.incidents[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
    };
    this.state.incidents[idx] = updated;
    this.saveState();
    return this.attachEvidenceToIncident(updated);
  }

  async deleteIncident(id: number): Promise<boolean> {
    const before = this.state.incidents.length;
    this.state.incidents = this.state.incidents.filter((i) => i.id !== id);
    if (this.state.incidents.length !== before) {
      this.state.investigations = this.state.investigations.filter((inv) => inv.incidentId !== id);
      this.state.fiveWhys = this.state.fiveWhys.filter((fw) => fw.incidentId !== id);
      this.state.fishboneCauses = this.state.fishboneCauses.filter((fc) => fc.incidentId !== id);
      this.state.capas = this.state.capas.filter((c) => c.incidentId !== id);
      this.saveState();
      return true;
    }
    return false;
  }

  async addIncidentEvidence(
    incidentId: number,
    file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>,
  ): Promise<EvidenceFile> {
    const created: EvidenceFile = {
      ...file,
      id: this.nextId(),
      entityType: 'INCIDENT',
      entityId: incidentId,
      uploadedAt: new Date().toISOString(),
    };
    this.state.evidenceFiles.push(created);
    this.saveState();
    return created;
  }

  async listInvestigations(): Promise<Investigation[]> {
    return [...this.state.investigations];
  }

  async upsertInvestigation(
    incidentId: number,
    input: Omit<Investigation, 'id' | 'incidentId' | 'updatedAt'>,
    _userId: number,
  ): Promise<Investigation> {
    const idx = this.state.investigations.findIndex((inv) => inv.incidentId === incidentId);
    const now = new Date().toISOString();
    let result: Investigation;
    if (idx === -1) {
      result = { id: this.nextId(), incidentId, ...input, updatedAt: now };
      this.state.investigations.push(result);
    } else {
      result = { ...this.state.investigations[idx], ...input, updatedAt: now };
      this.state.investigations[idx] = result;
    }
    const inc = this.state.incidents.find((i) => i.id === incidentId);
    if (inc && inc.status === 'Open') {
      inc.status = 'Under Investigation';
    }
    this.saveState();
    return result;
  }

  async upsertFiveWhys(
    incidentId: number,
    input: Omit<FiveWhys, 'id' | 'incidentId' | 'updatedAt'>,
    _userId: number,
  ): Promise<FiveWhys> {
    const idx = this.state.fiveWhys.findIndex((fw) => fw.incidentId === incidentId);
    const now = new Date().toISOString();
    let result: FiveWhys;
    if (idx === -1) {
      result = { id: this.nextId(), incidentId, ...input, updatedAt: now };
      this.state.fiveWhys.push(result);
    } else {
      result = { ...this.state.fiveWhys[idx], ...input, updatedAt: now };
      this.state.fiveWhys[idx] = result;
    }
    this.saveState();
    return result;
  }

  async addFishboneCause(
    incidentId: number,
    input: Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>,
    _userId: number,
  ): Promise<FishboneCause> {
    const created: FishboneCause = {
      ...input,
      id: this.nextId(),
      incidentId,
      createdAt: new Date().toISOString(),
    };
    this.state.fishboneCauses.push(created);
    this.saveState();
    return created;
  }

  async updateFishboneCause(
    causeId: number,
    input: Partial<Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>>,
  ): Promise<FishboneCause | null> {
    const idx = this.state.fishboneCauses.findIndex((c) => c.id === causeId);
    if (idx === -1) return null;
    this.state.fishboneCauses[idx] = { ...this.state.fishboneCauses[idx], ...input };
    this.saveState();
    return this.state.fishboneCauses[idx];
  }

  async deleteFishboneCause(causeId: number): Promise<boolean> {
    const before = this.state.fishboneCauses.length;
    this.state.fishboneCauses = this.state.fishboneCauses.filter((c) => c.id !== causeId);
    if (this.state.fishboneCauses.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }

  async listCapas(): Promise<CapaAction[]> {
    return [...this.state.capas]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((c) => this.enrichCapa(c));
  }

  async getCapaById(id: number): Promise<CapaAction | null> {
    const c = this.state.capas.find((item) => item.id === id);
    return c ? this.enrichCapa(c) : null;
  }

  async createCapa(
    input: Omit<CapaAction, 'id' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>,
    _userId: number,
  ): Promise<CapaAction> {
    const created: CapaAction = {
      ...input,
      id: this.nextId(),
      effectiveStatus: computeCapaEffectiveStatus(input),
      evidence: [],
      createdAt: new Date().toISOString(),
    };
    this.state.capas.unshift(created);
    const inc = this.state.incidents.find((i) => i.id === input.incidentId);
    if (inc && (inc.status === 'Open' || inc.status === 'Under Investigation')) {
      inc.status = 'CAPA In Progress';
    }
    this.saveState();
    return this.enrichCapa(created);
  }

  async updateCapa(
    id: number,
    input: Partial<Omit<CapaAction, 'id' | 'incidentId' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>>,
  ): Promise<CapaAction | null> {
    const idx = this.state.capas.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const updated: CapaAction = {
      ...this.state.capas[idx],
      ...input,
    };
    this.state.capas[idx] = updated;
    this.syncIncidentStatusFromCapas(updated.incidentId);
    this.saveState();
    return this.enrichCapa(updated);
  }

  async deleteCapa(id: number): Promise<boolean> {
    const existing = this.state.capas.find((c) => c.id === id);
    if (!existing) return false;
    this.state.capas = this.state.capas.filter((c) => c.id !== id);
    this.syncIncidentStatusFromCapas(existing.incidentId);
    this.saveState();
    return true;
  }

  async addCapaEvidence(
    capaId: number,
    file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>,
  ): Promise<EvidenceFile> {
    const created: EvidenceFile = {
      ...file,
      id: this.nextId(),
      entityType: 'CAPA',
      entityId: capaId,
      uploadedAt: new Date().toISOString(),
    };
    this.state.evidenceFiles.push(created);
    this.saveState();
    return created;
  }

  private syncIncidentStatusFromCapas(incidentId: number): void {
    const inc = this.state.incidents.find((i) => i.id === incidentId);
    if (!inc || inc.status === 'Closed') return;
    const incCapas = this.state.capas.filter((c) => c.incidentId === incidentId);
    if (incCapas.length === 0) return;
    if (incCapas.every((c) => c.actionStatus === 'Waiting Verification' || c.actionStatus === 'Verified')) {
      inc.status = 'Waiting Verification';
    } else {
      inc.status = 'CAPA In Progress';
    }
  }

  async verifyCapa(params: {
    capaId: number;
    decision: 'APPROVED' | 'REJECTED' | 'REOPENED';
    remarks: string;
    user: AuthUser;
  }): Promise<CapaAction | null> {
    const capa = this.state.capas.find((c) => c.id === params.capaId);
    if (!capa) return null;

    if (params.decision === 'APPROVED') {
      capa.actionStatus = 'Verified';
      if (!capa.completionDate) {
        capa.completionDate = new Date().toISOString().slice(0, 10);
      }
    } else {
      capa.actionStatus = 'Rejected / Reopened';
    }

    this.state.verifications.unshift({
      id: this.nextId(),
      entityType: 'CAPA',
      capaId: capa.id,
      incidentId: capa.incidentId,
      decision: params.decision,
      remarks: params.remarks,
      verifiedByName: params.user.fullName,
      verifiedByRole: params.user.role,
      verifiedAt: new Date().toISOString(),
    });

    this.syncIncidentStatusFromCapas(capa.incidentId);
    this.saveState();
    return this.enrichCapa(capa);
  }

  async closeIncident(params: {
    incidentId: number;
    remarks: string;
    user: AuthUser;
  }): Promise<Incident | null> {
    const inc = this.state.incidents.find((i) => i.id === params.incidentId);
    if (!inc) return null;

    inc.status = 'Closed';
    inc.closedAt = new Date().toISOString();
    inc.closedByName = params.user.fullName;

    this.state.verifications.unshift({
      id: this.nextId(),
      entityType: 'INCIDENT_CLOSURE',
      capaId: null,
      incidentId: inc.id,
      decision: 'APPROVED',
      remarks: params.remarks,
      verifiedByName: params.user.fullName,
      verifiedByRole: params.user.role,
      verifiedAt: inc.closedAt,
    });

    this.saveState();
    return this.attachEvidenceToIncident(inc);
  }

  async listAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.state.auditLogs.slice(0, limit);
  }

  async appendAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    this.state.auditLogs.unshift({
      ...entry,
      id: this.nextId(),
      createdAt: new Date().toISOString(),
    });
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.saveState();
  }
}
