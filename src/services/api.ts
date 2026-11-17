import type {
  AuditLog,
  AuthUser,
  CapaAction,
  ClinicVisit,
  ClinicalReferenceRanges,
  Company,
  DashboardFilters,
  DashboardSummary,
  Department,
  Employee,
  EvidenceFile,
  FishboneCause,
  FiveWhys,
  Incident,
  Investigation,
  LocationItem,
  MedicalExamination,
  SystemStatus,
  UserRole,
  VerificationRecord,
} from '../shared/types';

const TOKEN_KEY = 'ohs_expert_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let reasons: string[] | undefined;
    try {
      const body = (await res.json()) as { error?: string; reasons?: string[] };
      if (body.error) message = body.error;
      if (body.reasons) reasons = body.reasons;
    } catch {
      // ignore json parse error
    }
    const err = new Error(message) as Error & { status?: number; reasons?: string[] };
    err.status = res.status;
    err.reasons = reasons;
    throw err;
  }
  return (await res.json()) as T;
}

export interface MasterDataResponse {
  companies: Company[];
  departments: Department[];
  locations: LocationItem[];
  employees: Employee[];
  clinicalRanges: ClinicalReferenceRanges;
}

export interface IncidentDetailResponse {
  incident: Incident;
  investigation: Investigation | null;
  fiveWhys: FiveWhys | null;
  fishboneCauses: FishboneCause[];
  capas: CapaAction[];
  verifications: VerificationRecord[];
  closureGate: { canClose: boolean; reasons: string[] };
}

export const api = {
  getSystemStatus: () => request<SystemStatus>('/api/system/status'),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser; systemStatus: SystemStatus }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  demoLogin: (role: UserRole) =>
    request<{ token: string; user: AuthUser; systemStatus: SystemStatus }>('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  me: () => request<{ user: AuthUser; systemStatus: SystemStatus }>('/api/auth/me'),

  getMasterData: () => request<MasterDataResponse>('/api/master'),

  getDashboard: (filters: DashboardFilters) => {
    const params = new URLSearchParams({
      vMonth: filters.visits.month,
      vCompanyId: filters.visits.companyId,
      vLocationId: filters.visits.locationId,
      vShift: filters.visits.shift,
      eMonth: filters.exams.month,
      eCompanyId: filters.exams.companyId,
      eLocationId: filters.exams.locationId,
      eShift: filters.exams.shift,
      iMonth: filters.incidents.month,
      iCompanyId: filters.incidents.companyId,
      iLocationId: filters.incidents.locationId,
      iShift: filters.incidents.shift,
    });
    return request<{ summary: DashboardSummary; recentIncidents: Incident[]; capas: CapaAction[] }>(
      `/api/dashboard?${params.toString()}`,
    );
  },

  // Clinic Visits
  listClinicVisits: () => request<ClinicVisit[]>('/api/clinic-visits'),
  createClinicVisit: (payload: Record<string, unknown>) =>
    request<ClinicVisit>('/api/clinic-visits', { method: 'POST', body: JSON.stringify(payload) }),
  updateClinicVisit: (id: number, payload: Record<string, unknown>) =>
    request<ClinicVisit>(`/api/clinic-visits/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteClinicVisit: (id: number) =>
    request<{ ok: boolean }>(`/api/clinic-visits/${id}`, { method: 'DELETE' }),

  // Medical Examinations
  listMedicalExams: () => request<MedicalExamination[]>('/api/medical-examinations'),
  createMedicalExam: (payload: Record<string, unknown>) =>
    request<MedicalExamination>('/api/medical-examinations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMedicalExam: (id: number, payload: Record<string, unknown>) =>
    request<MedicalExamination>(`/api/medical-examinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMedicalExam: (id: number) =>
    request<{ ok: boolean }>(`/api/medical-examinations/${id}`, { method: 'DELETE' }),

  // Incidents & Investigation
  listIncidents: () => request<Incident[]>('/api/incidents'),
  getIncidentDetail: (id: number) => request<IncidentDetailResponse>(`/api/incidents/${id}/detail`),
  createIncident: (payload: Record<string, unknown>) =>
    request<Incident>('/api/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  updateIncident: (id: number, payload: Record<string, unknown>) =>
    request<Incident>(`/api/incidents/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteIncident: (id: number) =>
    request<{ ok: boolean }>(`/api/incidents/${id}`, { method: 'DELETE' }),
  uploadIncidentEvidence: (incidentId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<EvidenceFile>(`/api/incidents/${incidentId}/evidence`, {
      method: 'POST',
      body: fd,
    });
  },

  saveInvestigation: (incidentId: number, payload: Record<string, unknown>) =>
    request<Investigation>(`/api/incidents/${incidentId}/investigation`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  saveFiveWhys: (incidentId: number, payload: Record<string, unknown>) =>
    request<FiveWhys>(`/api/incidents/${incidentId}/five-whys`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  addFishboneCause: (incidentId: number, payload: Record<string, unknown>) =>
    request<FishboneCause>(`/api/incidents/${incidentId}/fishbone`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFishboneCause: (causeId: number, payload: Record<string, unknown>) =>
    request<FishboneCause>(`/api/fishbone/${causeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteFishboneCause: (causeId: number) =>
    request<{ ok: boolean }>(`/api/fishbone/${causeId}`, { method: 'DELETE' }),

  // CAPA & Verification
  listCapas: () => request<CapaAction[]>('/api/capas'),
  createCapa: (payload: Record<string, unknown>) =>
    request<CapaAction>('/api/capas', { method: 'POST', body: JSON.stringify(payload) }),
  updateCapa: (id: number, payload: Record<string, unknown>) =>
    request<CapaAction>(`/api/capas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCapa: (id: number) => request<{ ok: boolean }>(`/api/capas/${id}`, { method: 'DELETE' }),
  uploadCapaEvidence: (capaId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<EvidenceFile>(`/api/capas/${capaId}/evidence`, {
      method: 'POST',
      body: fd,
    });
  },
  verifyCapa: (capaId: number, decision: 'APPROVED' | 'REJECTED' | 'REOPENED', remarks: string) =>
    request<CapaAction>(`/api/capas/${capaId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ decision, remarks }),
    }),
  closeIncident: (incidentId: number, remarks: string) =>
    request<Incident>(`/api/incidents/${incidentId}/close`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),

  // Admin & Audit
  listUsers: () => request<AuthUser[]>('/api/users'),
  createUser: (payload: Record<string, unknown>) =>
    request<AuthUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUserStatus: (id: number, isActive: boolean, role?: UserRole) =>
    request<AuthUser>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive, role }),
    }),
  createCompany: (payload: Record<string, unknown>) =>
    request<Company>('/api/master/companies', { method: 'POST', body: JSON.stringify(payload) }),
  createDepartment: (payload: Record<string, unknown>) =>
    request<Department>('/api/master/departments', { method: 'POST', body: JSON.stringify(payload) }),
  createLocation: (payload: Record<string, unknown>) =>
    request<LocationItem>('/api/master/locations', { method: 'POST', body: JSON.stringify(payload) }),
  createEmployee: (payload: Record<string, unknown>) =>
    request<Employee>('/api/master/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateClinicalRanges: (ranges: ClinicalReferenceRanges) =>
    request<ClinicalReferenceRanges>('/api/master/clinical-ranges', {
      method: 'PUT',
      body: JSON.stringify(ranges),
    }),
  listAuditLogs: (limit = 100) => request<AuditLog[]>(`/api/audit-logs?limit=${limit}`),

  getEvidenceDownloadUrl: (url: string) => {
    const token = getStoredToken();
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  },
};
