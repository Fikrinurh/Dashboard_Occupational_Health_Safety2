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

export interface StoredUser extends AuthUser {
  passwordHash: string;
}

export interface IncidentDetailBundle {
  incident: Incident;
  investigation: Investigation | null;
  fiveWhys: FiveWhys | null;
  fishboneCauses: FishboneCause[];
  capas: CapaAction[];
  verifications: VerificationRecord[];
}

export interface OhsRepository {
  getMode(): 'MYSQL' | 'DEMO_STORE';
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: number): Promise<StoredUser | null>;
  listUsers(): Promise<AuthUser[]>;
  createUser(input: {
    userCode: string;
    fullName: string;
    email: string;
    passwordHash: string;
    role: AuthUser['role'];
    departmentName: string;
  }): Promise<AuthUser>;
  updateUserStatus(id: number, isActive: boolean, role?: AuthUser['role']): Promise<AuthUser | null>;
  touchUserLogin(id: number): Promise<void>;

  getMasterData(): Promise<{
    companies: Company[];
    departments: Department[];
    locations: LocationItem[];
    employees: Employee[];
    clinicalRanges: ClinicalReferenceRanges;
  }>;
  createCompany(input: { companyCode: string; name: string; industry: string }): Promise<Company>;
  createDepartment(input: { companyId: number; departmentCode: string; name: string }): Promise<Department>;
  createLocation(input: { companyId: number; locationCode: string; name: string; siteArea: string }): Promise<LocationItem>;
  createEmployee(input: Omit<Employee, 'id' | 'companyName' | 'departmentName' | 'locationName'>): Promise<Employee>;
  updateClinicalRanges(ranges: ClinicalReferenceRanges, userId: number): Promise<ClinicalReferenceRanges>;

  listClinicVisits(): Promise<ClinicVisit[]>;
  createClinicVisit(input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>, userId: number): Promise<ClinicVisit>;
  updateClinicVisit(id: number, input: Omit<ClinicVisit, 'id' | 'companyName' | 'locationName' | 'createdAt'>): Promise<ClinicVisit | null>;
  deleteClinicVisit(id: number): Promise<boolean>;

  listMedicalExams(): Promise<MedicalExamination[]>;
  createMedicalExam(input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>, userId: number): Promise<MedicalExamination>;
  updateMedicalExam(id: number, input: Omit<MedicalExamination, 'id' | 'companyName' | 'locationName' | 'createdAt'>): Promise<MedicalExamination | null>;
  deleteMedicalExam(id: number): Promise<boolean>;

  listIncidents(): Promise<Incident[]>;
  getIncidentById(id: number): Promise<Incident | null>;
  getIncidentDetail(id: number): Promise<IncidentDetailBundle | null>;
  createIncident(input: Omit<Incident, 'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'>, userId: number): Promise<Incident>;
  updateIncident(id: number, input: Omit<Incident, 'id' | 'companyName' | 'locationName' | 'status' | 'closedAt' | 'closedByName' | 'evidence' | 'createdAt'>): Promise<Incident | null>;
  deleteIncident(id: number): Promise<boolean>;
  addIncidentEvidence(incidentId: number, file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>): Promise<EvidenceFile>;

  listInvestigations(): Promise<Investigation[]>;
  upsertInvestigation(incidentId: number, input: Omit<Investigation, 'id' | 'incidentId' | 'updatedAt'>, userId: number): Promise<Investigation>;
  upsertFiveWhys(incidentId: number, input: Omit<FiveWhys, 'id' | 'incidentId' | 'updatedAt'>, userId: number): Promise<FiveWhys>;
  addFishboneCause(incidentId: number, input: Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>, userId: number): Promise<FishboneCause>;
  updateFishboneCause(causeId: number, input: Partial<Omit<FishboneCause, 'id' | 'incidentId' | 'createdAt'>>): Promise<FishboneCause | null>;
  deleteFishboneCause(causeId: number): Promise<boolean>;

  listCapas(): Promise<CapaAction[]>;
  getCapaById(id: number): Promise<CapaAction | null>;
  createCapa(input: Omit<CapaAction, 'id' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>, userId: number): Promise<CapaAction>;
  updateCapa(id: number, input: Partial<Omit<CapaAction, 'id' | 'incidentId' | 'incidentCode' | 'effectiveStatus' | 'evidence' | 'createdAt'>>): Promise<CapaAction | null>;
  deleteCapa(id: number): Promise<boolean>;
  addCapaEvidence(capaId: number, file: Omit<EvidenceFile, 'id' | 'entityType' | 'entityId' | 'uploadedAt'>): Promise<EvidenceFile>;

  verifyCapa(params: {
    capaId: number;
    decision: 'APPROVED' | 'REJECTED' | 'REOPENED';
    remarks: string;
    user: AuthUser;
  }): Promise<CapaAction | null>;

  closeIncident(params: {
    incidentId: number;
    remarks: string;
    user: AuthUser;
  }): Promise<Incident | null>;

  listAuditLogs(limit?: number): Promise<AuditLog[]>;
  appendAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
}
