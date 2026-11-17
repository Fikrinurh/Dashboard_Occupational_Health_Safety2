export type UserRole = 'ADMIN' | 'HSE_OFFICER' | 'MANAGEMENT';

export type ShiftType = 'Pagi' | 'Siang' | 'Malam';

export type VisitType = 'New' | 'Follow-up';

export type ExamType =
  | 'Workplace Accident'
  | 'Clinic Visit'
  | 'Daily / Periodic Exam'
  | 'Special Exam';

export type MedicalStatus = 'Fit' | 'Fit with Note' | 'Follow-up Required' | 'Unfit';

export type IncidentCategory =
  | 'Fatality'
  | 'First Aid Case (FAC)'
  | 'Lost Time Injury (LTI)'
  | 'Medical Treatment Case (MTC)'
  | 'Restricted Work Case (RWC)'
  | 'Near Miss'
  | 'Property Damage';

export type WorkRelatedStatus = 'Work-Related' | 'Non-Work-Related';

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type BodyPart =
  | 'Head'
  | 'Eyes'
  | 'Face'
  | 'Neck'
  | 'Shoulder'
  | 'Arms'
  | 'Hands'
  | 'Fingers'
  | 'Back'
  | 'Legs'
  | 'Feet'
  | 'None';

export type IncidentStatus =
  | 'Open'
  | 'Under Investigation'
  | 'CAPA In Progress'
  | 'Waiting Verification'
  | 'Closed';

export type FishboneCategory =
  | 'Man'
  | 'Machine'
  | 'Method'
  | 'Material'
  | 'Measurement'
  | 'Environment';

export type CapaActionType = 'Corrective Action' | 'Preventive Action';

export type CapaStatus =
  | 'Open'
  | 'In Progress'
  | 'Waiting Verification'
  | 'Verified'
  | 'Rejected / Reopened';

export type CapaEffectiveStatus = CapaStatus | 'Overdue';

export interface AuthUser {
  id: number;
  userCode: string;
  fullName: string;
  email: string;
  role: UserRole;
  departmentName: string;
  isActive: boolean;
}

export interface Company {
  id: number;
  companyCode: string;
  name: string;
  industry: string;
}

export interface Department {
  id: number;
  companyId: number;
  departmentCode: string;
  name: string;
}

export interface LocationItem {
  id: number;
  companyId: number;
  locationCode: string;
  name: string;
  siteArea: string;
}

export interface Employee {
  id: number;
  employeeCode: string;
  fullName: string;
  companyId: number;
  companyName: string;
  departmentId: number;
  departmentName: string;
  locationId: number;
  locationName: string;
  jobPosition: string;
  shift: ShiftType;
}

export interface ClinicalReferenceRanges {
  bmiUnderweightMax: number;
  bmiNormalMax: number;
  bmiOverweightMax: number;
  bmiObesity1Max: number;
  glucoseNormalMax: number;
  glucosePrediabetesMax: number;
  cholesterolNormalMax: number;
  cholesterolBorderlineMax: number;
  uricAcidNormalMax: number;
}

export interface ClinicVisit {
  id: number;
  visitCode: string;
  employeeCode: string;
  employeeName: string;
  companyId: number;
  companyName: string;
  departmentName: string;
  locationId: number;
  locationName: string;
  shift: ShiftType;
  visitDate: string; // YYYY-MM-DD
  visitType: VisitType;
  generalDiagnosis: string;
  pakClassification: string | null;
  symptoms: string;
  treatment: string;
  medicalOfficer: string;
  notes: string;
  createdAt: string;
}

export interface MedicalExamination {
  id: number;
  examCode: string;
  employeeCode: string;
  employeeName: string;
  companyId: number;
  companyName: string;
  departmentName: string;
  locationId: number;
  locationName: string;
  shift: ShiftType;
  examDate: string; // YYYY-MM-DD
  examType: ExamType;
  heightM: number;
  weightKg: number;
  bmi: number;
  bmiCategory: string;
  bloodPressure: string;
  bloodGlucose: number;
  glucoseCategory: string;
  totalCholesterol: number;
  cholesterolCategory: string;
  uricAcid: number;
  uricAcidCategory: string;
  medicalStatus: MedicalStatus;
  recommendations: string;
  medicalOfficer: string;
  createdAt: string;
}

export interface EvidenceFile {
  id: number;
  entityType: 'INCIDENT' | 'CAPA';
  entityId: number;
  evidenceType: 'PHOTO' | 'DOCUMENT';
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface Incident {
  id: number;
  incidentCode: string;
  incidentDate: string;
  incidentTime: string;
  companyId: number;
  companyName: string;
  departmentName: string;
  locationId: number;
  locationName: string;
  shift: ShiftType;
  employeeCode: string;
  employeeName: string;
  jobPosition: string;
  incidentCategory: IncidentCategory;
  workRelatedStatus: WorkRelatedStatus;
  severity: SeverityLevel;
  incidentDescription: string;
  injuryDescription: string;
  affectedBodyPart: BodyPart;
  injuryType: string;
  immediateActions: string;
  witnessInfo: string;
  status: IncidentStatus;
  closedAt: string | null;
  closedByName: string | null;
  evidence: EvidenceFile[];
  createdAt: string;
}

export interface Investigation {
  id: number;
  investigationCode: string;
  incidentId: number;
  investigationDate: string;
  investigationLeader: string;
  investigationTeam: string;
  witnessStatements: string;
  incidentChronology: string;
  unsafeAct: string;
  unsafeCondition: string;
  immediateCause: string;
  contributingFactors: string;
  updatedAt: string;
}

export interface FiveWhys {
  id: number;
  incidentId: number;
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  finalRootCause: string;
  updatedAt: string;
}

export interface FishboneCause {
  id: number;
  incidentId: number;
  category: FishboneCategory;
  causeText: string;
  subCauseText: string;
  isPrimaryRoot: boolean;
  createdAt: string;
}

export interface CapaAction {
  id: number;
  capaCode: string;
  incidentId: number;
  incidentCode?: string;
  rootCause: string;
  actionDescription: string;
  actionType: CapaActionType;
  responsiblePic: string;
  departmentName: string;
  priority: SeverityLevel;
  startDate: string;
  dueDate: string;
  completionDate: string | null;
  actionStatus: CapaStatus;
  effectiveStatus: CapaEffectiveStatus;
  completionNotes: string;
  evidence: EvidenceFile[];
  createdAt: string;
}

export interface VerificationRecord {
  id: number;
  entityType: 'CAPA' | 'INCIDENT_CLOSURE';
  capaId: number | null;
  incidentId: number;
  decision: 'APPROVED' | 'REJECTED' | 'REOPENED';
  remarks: string;
  verifiedByName: string;
  verifiedByRole: UserRole;
  verifiedAt: string;
}

export interface AuditLog {
  id: number;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface SectionFilter {
  month: string; // 'ALL' or '2026-01'..'2026-12'
  companyId: string; // 'ALL' or numeric string
  locationId: string; // 'ALL' or numeric string
  shift: string; // 'ALL' | 'Pagi' | 'Siang' | 'Malam'
}

export interface DashboardFilters {
  visits: SectionFilter;
  exams: SectionFilter;
  incidents: SectionFilter;
}

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export interface TrendDatum {
  month: string;
  label: string;
  count: number;
  trend: number;
}

export interface DashboardSummary {
  clinicVisits: {
    total: number;
    newVisits: number;
    followUpVisits: number;
    generalDiagnosis: DonutDatum[];
    pakDiagnosis: DonutDatum[];
    trend: TrendDatum[];
  };
  medicalExams: {
    restricted: boolean;
    total: number;
    trend: TrendDatum[];
    reasons: { name: string; count: number; color: string }[];
    bmi: DonutDatum[];
    glucose: DonutDatum[];
    cholesterol: DonutDatum[];
    uricAcid: DonutDatum[];
  };
  incidents: {
    total: number;
    workRelatedSplit: { name: string; count: number }[];
    categories: { name: string; shortName: string; count: number; color: string }[];
    bodyParts: DonutDatum[];
    trend: TrendDatum[];
  };
  workflowKpis: {
    openInvestigations: number;
    capaInProgress: number;
    overdueCapa: number;
    waitingVerification: number;
    verifiedCapa: number;
    closedIncidents: number;
  };
}

export interface SystemStatus {
  mode: 'MYSQL' | 'DEMO_STORE';
  mysqlConfigured: boolean;
  mysqlConnected: boolean;
  message: string;
}
