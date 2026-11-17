import bcrypt from 'bcryptjs';
import {
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  DEFAULT_CLINICAL_RANGES,
  deriveMedicalStatus,
} from '../../src/shared/ohsLogic';
import type {
  AuditLog,
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
import type { StoredUser } from './types';

export interface DemoDatabaseState {
  nextId: number;
  users: StoredUser[];
  companies: Company[];
  departments: Department[];
  locations: LocationItem[];
  employees: Employee[];
  clinicalRanges: ClinicalReferenceRanges;
  clinicVisits: ClinicVisit[];
  medicalExams: MedicalExamination[];
  incidents: Incident[];
  investigations: Investigation[];
  fiveWhys: FiveWhys[];
  fishboneCauses: FishboneCause[];
  capas: CapaAction[];
  evidenceFiles: EvidenceFile[];
  verifications: VerificationRecord[];
  auditLogs: AuditLog[];
}

export function createInitialSeedState(): DemoDatabaseState {
  const defaultPasswordHash = bcrypt.hashSync('OhsExpert2026!', 10);

  const users: StoredUser[] = [
    {
      id: 1,
      userCode: 'USR-001',
      fullName: 'Dr. Nadia Kusuma',
      email: 'admin@ohsexpert.io',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      departmentName: 'Corporate HSE',
      isActive: true,
    },
    {
      id: 2,
      userCode: 'USR-002',
      fullName: 'Rendra Pratama',
      email: 'hse@ohsexpert.io',
      passwordHash: defaultPasswordHash,
      role: 'HSE_OFFICER',
      departmentName: 'Plant Safety',
      isActive: true,
    },
    {
      id: 3,
      userCode: 'USR-003',
      fullName: 'Hendra Wijaya',
      email: 'management@ohsexpert.io',
      passwordHash: defaultPasswordHash,
      role: 'MANAGEMENT',
      departmentName: 'Executive Operations',
      isActive: true,
    },
  ];

  const companies: Company[] = [
    { id: 1, companyCode: 'COMP-A', name: 'Perusahaan A', industry: 'Mining & Heavy Operations' },
    { id: 2, companyCode: 'COMP-B', name: 'Perusahaan B', industry: 'Petrochemical Processing' },
    { id: 3, companyCode: 'COMP-C', name: 'Perusahaan C', industry: 'Logistics & Fleet Services' },
  ];

  const departments: Department[] = [
    { id: 1, companyId: 1, departmentCode: 'DEPT-OPS', name: 'Plant Operations' },
    { id: 2, companyId: 1, departmentCode: 'DEPT-MNT', name: 'Mechanical Maintenance' },
    { id: 3, companyId: 2, departmentCode: 'DEPT-LAB', name: 'Process Engineering' },
    { id: 4, companyId: 3, departmentCode: 'DEPT-LOG', name: 'Fleet & Warehouse' },
  ];

  const locations: LocationItem[] = [
    { id: 1, companyId: 1, locationCode: 'LOC-A', name: 'Lokasi A', siteArea: 'North Sector' },
    { id: 2, companyId: 1, locationCode: 'LOC-B', name: 'Lokasi B', siteArea: 'Processing Plant' },
    { id: 3, companyId: 3, locationCode: 'LOC-E', name: 'Lokasi E', siteArea: 'Central Terminal' },
  ];

  const employees: Employee[] = [
    {
      id: 1,
      employeeCode: 'EMP-1001',
      fullName: 'Budi Santoso',
      companyId: 3,
      companyName: 'Perusahaan C',
      departmentId: 4,
      departmentName: 'Fleet & Warehouse',
      locationId: 3,
      locationName: 'Lokasi E',
      jobPosition: 'Heavy Fleet Operator',
      shift: 'Malam',
    },
    {
      id: 2,
      employeeCode: 'EMP-1002',
      fullName: 'Sari Dewi Lestari',
      companyId: 1,
      companyName: 'Perusahaan A',
      departmentId: 1,
      departmentName: 'Plant Operations',
      locationId: 1,
      locationName: 'Lokasi A',
      jobPosition: 'Control Room Technician',
      shift: 'Pagi',
    },
    {
      id: 3,
      employeeCode: 'EMP-1003',
      fullName: 'Agus Firmansyah',
      companyId: 1,
      companyName: 'Perusahaan A',
      departmentId: 2,
      departmentName: 'Mechanical Maintenance',
      locationId: 1,
      locationName: 'Lokasi A',
      jobPosition: 'Senior Millwright',
      shift: 'Malam',
    },
    {
      id: 4,
      employeeCode: 'EMP-1004',
      fullName: 'Dewi Anggraini',
      companyId: 2,
      companyName: 'Perusahaan B',
      departmentId: 3,
      departmentName: 'Process Engineering',
      locationId: 2,
      locationName: 'Lokasi B',
      jobPosition: 'Chemical Process Analyst',
      shift: 'Siang',
    },
  ];

  // 20 Clinic Visits distributed across Feb–May 2026 matching reference charts
  const visitBlueprints: Array<{
    date: string;
    type: 'New' | 'Follow-up';
    companyId: number;
    locId: number;
    shift: 'Pagi' | 'Siang' | 'Malam';
    gen: string;
    pak: string | null;
    empIdx: number;
  }> = [
    { date: '2026-02-04', type: 'New', companyId: 3, locId: 3, shift: 'Malam', gen: 'Influenza', pak: 'Contact Dermatitis', empIdx: 0 },
    { date: '2026-02-11', type: 'New', companyId: 3, locId: 3, shift: 'Malam', gen: 'Pharyngitis', pak: null, empIdx: 0 },
    { date: '2026-02-19', type: 'Follow-up', companyId: 3, locId: 3, shift: 'Malam', gen: 'Pharyngitis', pak: 'Heat Stress / Heat Stroke', empIdx: 0 },
    { date: '2026-03-02', type: 'New', companyId: 3, locId: 3, shift: 'Malam', gen: 'Hypertension', pak: null, empIdx: 0 },
    { date: '2026-03-07', type: 'New', companyId: 1, locId: 1, shift: 'Pagi', gen: 'Tonsillitis', pak: null, empIdx: 1 },
    { date: '2026-03-12', type: 'Follow-up', companyId: 1, locId: 1, shift: 'Malam', gen: 'Migraine', pak: 'Noise Induced Hearing Loss (NIHL)', empIdx: 2 },
    { date: '2026-03-18', type: 'New', companyId: 2, locId: 2, shift: 'Siang', gen: 'Gastritis', pak: 'Heavy Metal Poisoning', empIdx: 3 },
    { date: '2026-03-22', type: 'New', companyId: 1, locId: 1, shift: 'Pagi', gen: 'Pharyngitis', pak: null, empIdx: 1 },
    { date: '2026-03-27', type: 'Follow-up', companyId: 3, locId: 3, shift: 'Malam', gen: 'Hypotension', pak: null, empIdx: 0 },
    { date: '2026-04-03', type: 'New', companyId: 1, locId: 1, shift: 'Malam', gen: 'Influenza', pak: 'Contact Dermatitis', empIdx: 2 },
    { date: '2026-04-09', type: 'New', companyId: 1, locId: 1, shift: 'Pagi', gen: 'Pharyngitis', pak: null, empIdx: 1 },
    { date: '2026-04-14', type: 'New', companyId: 2, locId: 2, shift: 'Siang', gen: 'Hypertension', pak: null, empIdx: 3 },
    { date: '2026-04-19', type: 'Follow-up', companyId: 1, locId: 1, shift: 'Malam', gen: 'Migraine', pak: 'Heat Stress / Heat Stroke', empIdx: 2 },
    { date: '2026-04-23', type: 'New', companyId: 3, locId: 3, shift: 'Malam', gen: 'Gastritis', pak: null, empIdx: 0 },
    { date: '2026-04-28', type: 'New', companyId: 1, locId: 1, shift: 'Pagi', gen: 'Tonsillitis', pak: null, empIdx: 1 },
    { date: '2026-05-03', type: 'New', companyId: 1, locId: 1, shift: 'Malam', gen: 'Influenza', pak: null, empIdx: 2 },
    { date: '2026-05-08', type: 'Follow-up', companyId: 3, locId: 3, shift: 'Malam', gen: 'Pharyngitis', pak: 'Noise Induced Hearing Loss (NIHL)', empIdx: 0 },
    { date: '2026-05-14', type: 'New', companyId: 2, locId: 2, shift: 'Siang', gen: 'Hypotension', pak: null, empIdx: 3 },
    { date: '2026-05-19', type: 'New', companyId: 1, locId: 1, shift: 'Pagi', gen: 'Migraine', pak: null, empIdx: 1 },
    { date: '2026-05-25', type: 'New', companyId: 1, locId: 1, shift: 'Malam', gen: 'Gastritis', pak: null, empIdx: 2 },
  ];

  const clinicVisits: ClinicVisit[] = visitBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId)!;
    const loc = locations.find((l) => l.id === bp.locId)!;
    return {
      id: idx + 1,
      visitCode: `CV-2026-${String(idx + 1).padStart(3, '0')}`,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      companyId: comp.id,
      companyName: comp.name,
      departmentName: emp.departmentName,
      locationId: loc.id,
      locationName: loc.name,
      shift: bp.shift,
      visitDate: bp.date,
      visitType: bp.type,
      generalDiagnosis: bp.gen,
      pakClassification: bp.pak,
      symptoms: `${bp.gen} presentation during ${bp.shift} shift duty`,
      treatment: 'Clinical consultation, symptomatic medication, hydration advisory',
      medicalOfficer: 'Dr. Nadia Kusuma',
      notes: bp.pak ? `Suspected occupational factor: ${bp.pak}` : 'Routine clinic management',
      createdAt: `${bp.date}T08:30:00Z`,
    };
  });

  // 20 Medical Examinations across Feb–May 2026
  const examBlueprints: Array<{
    date: string;
    type: MedicalExamination['examType'];
    companyId: number;
    locId: number;
    shift: 'Pagi' | 'Siang' | 'Malam';
    h: number;
    w: number;
    bp: string;
    gluc: number;
    chol: number;
    uric: number;
    empIdx: number;
  }> = [
    { date: '2026-02-05', type: 'Workplace Accident', companyId: 1, locId: 1, shift: 'Malam', h: 1.72, w: 68, bp: '120/80', gluc: 94, chol: 185, uric: 5.8, empIdx: 2 },
    { date: '2026-02-14', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.65, w: 58, bp: '115/75', gluc: 88, chol: 175, uric: 4.9, empIdx: 1 },
    { date: '2026-02-22', type: 'Special Exam', companyId: 3, locId: 3, shift: 'Malam', h: 1.75, w: 84, bp: '132/84', gluc: 112, chol: 222, uric: 7.4, empIdx: 0 },
    { date: '2026-03-03', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.68, w: 51, bp: '110/70', gluc: 84, chol: 170, uric: 5.1, empIdx: 1 },
    { date: '2026-03-08', type: 'Clinic Visit', companyId: 2, locId: 2, shift: 'Siang', h: 1.62, w: 72, bp: '126/82', gluc: 105, chol: 210, uric: 6.1, empIdx: 3 },
    { date: '2026-03-11', type: 'Workplace Accident', companyId: 1, locId: 1, shift: 'Malam', h: 1.74, w: 94, bp: '138/88', gluc: 132, chol: 248, uric: 7.9, empIdx: 2 },
    { date: '2026-03-16', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.70, w: 67, bp: '118/76', gluc: 90, chol: 188, uric: 5.4, empIdx: 1 },
    { date: '2026-03-21', type: 'Special Exam', companyId: 3, locId: 3, shift: 'Malam', h: 1.76, w: 86, bp: '128/84', gluc: 118, chol: 205, uric: 6.8, empIdx: 0 },
    { date: '2026-03-29', type: 'Daily / Periodic Exam', companyId: 2, locId: 2, shift: 'Siang', h: 1.64, w: 60, bp: '116/74', gluc: 89, chol: 180, uric: 4.8, empIdx: 3 },
    { date: '2026-04-02', type: 'Workplace Accident', companyId: 1, locId: 1, shift: 'Malam', h: 1.73, w: 108, bp: '144/92', gluc: 148, chol: 262, uric: 8.4, empIdx: 2 },
    { date: '2026-04-07', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.66, w: 63, bp: '120/78', gluc: 95, chol: 192, uric: 5.7, empIdx: 1 },
    { date: '2026-04-12', type: 'Clinic Visit', companyId: 3, locId: 3, shift: 'Malam', h: 1.75, w: 82, bp: '124/80', gluc: 97, chol: 196, uric: 6.4, empIdx: 0 },
    { date: '2026-04-18', type: 'Special Exam', companyId: 2, locId: 2, shift: 'Siang', h: 1.63, w: 59, bp: '118/76', gluc: 91, chol: 184, uric: 5.0, empIdx: 3 },
    { date: '2026-04-24', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Malam', h: 1.71, w: 79, bp: '128/82', gluc: 108, chol: 218, uric: 6.9, empIdx: 2 },
    { date: '2026-04-29', type: 'Daily / Periodic Exam', companyId: 3, locId: 3, shift: 'Malam', h: 1.78, w: 72, bp: '120/78', gluc: 93, chol: 189, uric: 5.6, empIdx: 0 },
    { date: '2026-05-04', type: 'Workplace Accident', companyId: 1, locId: 1, shift: 'Malam', h: 1.72, w: 76, bp: '124/80', gluc: 96, chol: 190, uric: 6.2, empIdx: 2 },
    { date: '2026-05-09', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.65, w: 61, bp: '114/74', gluc: 86, chol: 172, uric: 4.7, empIdx: 1 },
    { date: '2026-05-14', type: 'Special Exam', companyId: 2, locId: 2, shift: 'Siang', h: 1.67, w: 89, bp: '136/86', gluc: 122, chol: 245, uric: 7.6, empIdx: 3 },
    { date: '2026-05-20', type: 'Clinic Visit', companyId: 3, locId: 3, shift: 'Malam', h: 1.75, w: 74, bp: '122/78', gluc: 94, chol: 194, uric: 6.0, empIdx: 0 },
    { date: '2026-05-26', type: 'Daily / Periodic Exam', companyId: 1, locId: 1, shift: 'Pagi', h: 1.69, w: 65, bp: '118/76', gluc: 89, chol: 178, uric: 5.2, empIdx: 1 },
  ];

  const medicalExams: MedicalExamination[] = examBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId)!;
    const loc = locations.find((l) => l.id === bp.locId)!;
    const bmi = calculateBmi(bp.w, bp.h);
    const bmiCategory = classifyBmi(bmi, DEFAULT_CLINICAL_RANGES);
    const glucoseCategory = classifyBloodGlucose(bp.gluc, DEFAULT_CLINICAL_RANGES);
    const cholesterolCategory = classifyCholesterol(bp.chol, DEFAULT_CLINICAL_RANGES);
    const uricAcidCategory = classifyUricAcid(bp.uric, DEFAULT_CLINICAL_RANGES);
    const medicalStatus = deriveMedicalStatus({
      bmiCategory,
      glucoseCategory,
      cholesterolCategory,
      uricAcidCategory,
    });
    return {
      id: idx + 1,
      examCode: `ME-2026-${String(idx + 1).padStart(3, '0')}`,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      companyId: comp.id,
      companyName: comp.name,
      departmentName: emp.departmentName,
      locationId: loc.id,
      locationName: loc.name,
      shift: bp.shift,
      examDate: bp.date,
      examType: bp.type,
      heightM: bp.h,
      weightKg: bp.w,
      bmi,
      bmiCategory,
      bloodPressure: bp.bp,
      bloodGlucose: bp.gluc,
      glucoseCategory,
      totalCholesterol: bp.chol,
      cholesterolCategory,
      uricAcid: bp.uric,
      uricAcidCategory,
      medicalStatus,
      recommendations:
        medicalStatus === 'Fit'
          ? 'Maintain regular exercise and hydration'
          : 'Schedule nutritional & metabolic follow-up within 14 days',
      medicalOfficer: 'Dr. Nadia Kusuma',
      createdAt: `${bp.date}T09:00:00Z`,
    };
  });

  // 20 Incidents across Feb–May 2026 matching reference charts
  const incidentBlueprints: Array<{
    date: string;
    time: string;
    companyId: number;
    locId: number;
    shift: 'Pagi' | 'Siang' | 'Malam';
    cat: Incident['incidentCategory'];
    wr: Incident['workRelatedStatus'];
    sev: Incident['severity'];
    part: Incident['affectedBodyPart'];
    status: Incident['status'];
    desc: string;
    empIdx: number;
  }> = [
    { date: '2026-02-04', time: '22:15:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Medical Treatment Case (MTC)', wr: 'Work-Related', sev: 'High', part: 'Hands', status: 'Closed', desc: 'Pinch-point laceration on right hand while tightening conveyor flange.', empIdx: 2 },
    { date: '2026-02-12', time: '09:30:00', companyId: 1, locId: 1, shift: 'Pagi', cat: 'First Aid Case (FAC)', wr: 'Work-Related', sev: 'Low', part: 'Fingers', status: 'Closed', desc: 'Minor abrasion on index finger during tool calibration.', empIdx: 1 },
    { date: '2026-02-20', time: '14:40:00', companyId: 3, locId: 3, shift: 'Malam', cat: 'Near Miss', wr: 'Work-Related', sev: 'Medium', part: 'None', status: 'Closed', desc: 'Unsecured pallet shifted near loading dock walkway.', empIdx: 0 },
    { date: '2026-03-02', time: '23:10:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Lost Time Injury (LTI)', wr: 'Work-Related', sev: 'Critical', part: 'Back', status: 'Waiting Verification', desc: 'Acute lumbar strain while lifting hydraulic actuator without hoist.', empIdx: 2 },
    { date: '2026-03-07', time: '10:20:00', companyId: 2, locId: 2, shift: 'Siang', cat: 'First Aid Case (FAC)', wr: 'Work-Related', sev: 'Low', part: 'Eyes', status: 'Closed', desc: 'Dust particle irritation in left eye during filter inspection.', empIdx: 3 },
    { date: '2026-03-11', time: '16:05:00', companyId: 1, locId: 1, shift: 'Pagi', cat: 'Medical Treatment Case (MTC)', wr: 'Non-Work-Related', sev: 'Medium', part: 'Legs', status: 'CAPA In Progress', desc: 'Slip on wet parking apron outside gate after shift handover.', empIdx: 1 },
    { date: '2026-03-17', time: '21:45:00', companyId: 3, locId: 3, shift: 'Malam', cat: 'Restricted Work Case (RWC)', wr: 'Work-Related', sev: 'Medium', part: 'Shoulder', status: 'CAPA In Progress', desc: 'Right rotator cuff strain pulling dock leveler chain.', empIdx: 0 },
    { date: '2026-03-22', time: '11:00:00', companyId: 1, locId: 1, shift: 'Pagi', cat: 'First Aid Case (FAC)', wr: 'Work-Related', sev: 'Low', part: 'Arms', status: 'Closed', desc: 'Superficial thermal contact on forearm near steam trace line.', empIdx: 1 },
    { date: '2026-03-28', time: '01:30:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Property Damage', wr: 'Work-Related', sev: 'Medium', part: 'None', status: 'Under Investigation', desc: 'Forklift mast clipped warehouse bay bollard during night shift.', empIdx: 2 },
    { date: '2026-04-03', time: '22:50:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Medical Treatment Case (MTC)', wr: 'Work-Related', sev: 'High', part: 'Hands', status: 'Waiting Verification', desc: 'Hydraulic oil spray burn on palm due to loose quick-coupler.', empIdx: 2 },
    { date: '2026-04-08', time: '08:15:00', companyId: 2, locId: 2, shift: 'Siang', cat: 'First Aid Case (FAC)', wr: 'Non-Work-Related', sev: 'Low', part: 'Feet', status: 'Closed', desc: 'Twisted ankle descending administrative stairwell.', empIdx: 3 },
    { date: '2026-04-14', time: '13:20:00', companyId: 3, locId: 3, shift: 'Malam', cat: 'Medical Treatment Case (MTC)', wr: 'Work-Related', sev: 'Medium', part: 'Face', status: 'CAPA In Progress', desc: 'Struck on cheek by rebounding bungee strap on cargo tarpaulin.', empIdx: 0 },
    { date: '2026-04-19', time: '20:10:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Near Miss', wr: 'Work-Related', sev: 'High', part: 'Head', status: 'Under Investigation', desc: 'Torque wrench dropped from upper catwalk grating; missed spotter.', empIdx: 2 },
    { date: '2026-04-24', time: '07:45:00', companyId: 1, locId: 1, shift: 'Pagi', cat: 'First Aid Case (FAC)', wr: 'Work-Related', sev: 'Low', part: 'Hands', status: 'Closed', desc: 'Small blister and nick while stripping sensor conduit.', empIdx: 1 },
    { date: '2026-04-28', time: '15:35:00', companyId: 2, locId: 2, shift: 'Siang', cat: 'Restricted Work Case (RWC)', wr: 'Non-Work-Related', sev: 'Medium', part: 'Neck', status: 'Open', desc: 'Cervical muscle spasm reported following commuter braking incident.', empIdx: 3 },
    { date: '2026-05-03', time: '22:05:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'Medical Treatment Case (MTC)', wr: 'Work-Related', sev: 'High', part: 'Legs', status: 'Open', desc: 'Bruised shin striking unguarded pump skid frame in dim aisle.', empIdx: 2 },
    { date: '2026-05-09', time: '09:50:00', companyId: 1, locId: 1, shift: 'Pagi', cat: 'First Aid Case (FAC)', wr: 'Work-Related', sev: 'Low', part: 'Fingers', status: 'Under Investigation', desc: 'Minor pinch on ring finger closing switchgear cabinet door.', empIdx: 1 },
    { date: '2026-05-15', time: '14:15:00', companyId: 3, locId: 3, shift: 'Malam', cat: 'Near Miss', wr: 'Work-Related', sev: 'Medium', part: 'None', status: 'Open', desc: 'Temporary wheel chock dislodged on sloped bay ramp.', empIdx: 0 },
    { date: '2026-05-20', time: '23:40:00', companyId: 1, locId: 1, shift: 'Malam', cat: 'First Aid Case (FAC)', wr: 'Non-Work-Related', sev: 'Low', part: 'Back', status: 'Open', desc: 'Mild back soreness reported prior to shift start.', empIdx: 2 },
    { date: '2026-05-26', time: '11:25:00', companyId: 2, locId: 2, shift: 'Siang', cat: 'Medical Treatment Case (MTC)', wr: 'Work-Related', sev: 'High', part: 'Eyes', status: 'Open', desc: 'Chemical mist exposure during sample valve purge without face shield.', empIdx: 3 },
  ];

  const incidents: Incident[] = incidentBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId)!;
    const loc = locations.find((l) => l.id === bp.locId)!;
    return {
      id: idx + 1,
      incidentCode: `INC-2026-${String(idx + 1).padStart(3, '0')}`,
      incidentDate: bp.date,
      incidentTime: bp.time,
      companyId: comp.id,
      companyName: comp.name,
      departmentName: emp.departmentName,
      locationId: loc.id,
      locationName: loc.name,
      shift: bp.shift,
      employeeCode: emp.employeeCode,
      employeeName: emp.fullName,
      jobPosition: emp.jobPosition,
      incidentCategory: bp.cat,
      workRelatedStatus: bp.wr,
      severity: bp.sev,
      incidentDescription: bp.desc,
      injuryDescription: bp.part === 'None' ? 'No personnel injury' : `Affected ${bp.part.toLowerCase()} requiring clinical assessment`,
      affectedBodyPart: bp.part,
      injuryType: bp.part === 'None' ? 'None' : bp.cat,
      immediateActions: 'Area secured, first-aid/medical evaluation initiated, supervisor notified.',
      witnessInfo: 'Shift Supervisor & Area Operator',
      status: bp.status,
      closedAt: bp.status === 'Closed' ? `${bp.date}T18:00:00Z` : null,
      closedByName: bp.status === 'Closed' ? 'Hendra Wijaya' : null,
      evidence: [],
      createdAt: `${bp.date}T${bp.time}Z`,
    };
  });

  // Pre-seed Investigations, Five Whys, Fishbone 6M, and CAPA for key incidents so workflows are immediately inspectable
  const investigations: Investigation[] = [
    {
      id: 1,
      investigationCode: 'INV-2026-004',
      incidentId: 4,
      investigationDate: '2026-03-03',
      investigationLeader: 'Rendra Pratama',
      investigationTeam: 'Rendra Pratama, Maintenance Lead, Shift Supervisor',
      witnessStatements: 'Area operator stated portable jib hoist was tagged out at another bay.',
      incidentChronology: '23:00 Valve actuator removal began; 23:08 manual lift attempted; 23:10 acute lumbar pain reported.',
      unsafeAct: 'Manual lifting of >35kg actuator without mechanical lifting aid',
      unsafeCondition: 'Only one portable jib hoist available for two maintenance bays',
      immediateCause: 'Excessive manual load exceeding ergonomic lifting threshold',
      contributingFactors: 'Night shift time pressure and lack of lifting gear availability check in PTW',
      updatedAt: '2026-03-04T10:00:00Z',
    },
    {
      id: 2,
      investigationCode: 'INV-2026-010',
      incidentId: 10,
      investigationDate: '2026-04-04',
      investigationLeader: 'Rendra Pratama',
      investigationTeam: 'Rendra Pratama, Hydraulic Specialist',
      witnessStatements: 'Coupler locking sleeve did not click fully prior to pump test.',
      incidentChronology: '22:40 Hose connected; 22:48 hydraulic pump energized; 22:50 spray hit operator palm.',
      unsafeAct: 'Pressurized system prior to verifying mechanical lock engagement',
      unsafeCondition: 'Worn quick-coupler retaining ball detent',
      immediateCause: 'High-pressure hydraulic oil mist release',
      contributingFactors: 'Missing pre-use coupler inspection checklist and worn leather gloves',
      updatedAt: '2026-04-05T09:00:00Z',
    },
  ];

  const fiveWhys: FiveWhys[] = [
    {
      id: 1,
      incidentId: 4,
      why1: 'Technician sustained lumbar strain lifting a 38 kg actuator manually.',
      why2: 'Portable lifting hoist was not used during actuator removal.',
      why3: 'The shared hoist was occupied in Bay 1 and no spare lifting gantry was staged.',
      why4: 'Pre-task Permit-to-Work did not verify mechanical lifting gear availability.',
      why5: 'Maintenance SOP lacked a mandatory hoist sign-off gate for loads >20 kg.',
      finalRootCause: 'Absence of mandatory ergonomic lifting-aid verification gate in Permit-to-Work and insufficient hoist allocation.',
      updatedAt: '2026-03-04T11:00:00Z',
    },
    {
      id: 2,
      incidentId: 10,
      why1: 'Operator sustained hydraulic oil burn on right palm.',
      why2: 'Quick-coupler detached under 180 bar test pressure.',
      why3: 'Coupler ball detent failed to lock the collar securely.',
      why4: 'Coupler wear was undetected during routine shift changeover.',
      why5: 'Hydraulic hoses and couplers were excluded from quarterly PM wear-gauge checks.',
      finalRootCause: 'Exclusion of hydraulic quick-couplers from preventive wear-gauge inspection schedule.',
      updatedAt: '2026-04-05T10:00:00Z',
    },
  ];

  const fishboneCauses: FishboneCause[] = [
    { id: 1, incidentId: 4, category: 'Man', causeText: 'Manual lift attempted under night-shift deadline', subCauseText: 'Fatigue factor at 23:10', isPrimaryRoot: false, createdAt: '2026-03-04T11:00:00Z' },
    { id: 2, incidentId: 4, category: 'Machine', causeText: 'Single portable jib hoist shared across 3 bays', subCauseText: 'Hoist unavailable in Bay 2', isPrimaryRoot: true, createdAt: '2026-03-04T11:00:00Z' },
    { id: 3, incidentId: 4, category: 'Method', causeText: 'PTW lacks mandatory >20kg mechanical lift gate', subCauseText: 'No ergonomic stop-work trigger', isPrimaryRoot: true, createdAt: '2026-03-04T11:00:00Z' },
    { id: 4, incidentId: 4, category: 'Material', causeText: 'Heavy 38 kg actuator assembly without grab handles', subCauseText: '', isPrimaryRoot: false, createdAt: '2026-03-04T11:00:00Z' },
    { id: 5, incidentId: 4, category: 'Measurement', causeText: 'Load weight markings missing on spare actuators', subCauseText: '', isPrimaryRoot: false, createdAt: '2026-03-04T11:00:00Z' },
    { id: 6, incidentId: 4, category: 'Environment', causeText: 'Narrow clearance around manifold skid', subCauseText: 'Restricted posture', isPrimaryRoot: false, createdAt: '2026-03-04T11:00:00Z' },
  ];

  const capas: CapaAction[] = [
    {
      id: 1,
      capaCode: 'CAPA-2026-001',
      incidentId: 4,
      incidentCode: 'INC-2026-004',
      rootCause: fiveWhys[0].finalRootCause,
      actionDescription: 'Procure dedicated 500kg mobile gantry hoist for Bay 2 and add load-weight stencil.',
      actionType: 'Corrective Action',
      responsiblePic: 'Bambang Sutrisno',
      departmentName: 'Mechanical Maintenance',
      priority: 'Critical',
      startDate: '2026-03-05',
      dueDate: '2026-03-25',
      completionDate: '2026-03-22',
      actionStatus: 'Verified',
      effectiveStatus: 'Verified',
      completionNotes: 'Gantry commissioned and inspected by HSE.',
      evidence: [],
      createdAt: '2026-03-05T08:00:00Z',
    },
    {
      id: 2,
      capaCode: 'CAPA-2026-002',
      incidentId: 4,
      incidentCode: 'INC-2026-004',
      rootCause: fiveWhys[0].finalRootCause,
      actionDescription: 'Update Permit-to-Work template to mandate mechanical lifting verification for >20kg parts.',
      actionType: 'Preventive Action',
      responsiblePic: 'Rendra Pratama',
      departmentName: 'Plant Operations',
      priority: 'High',
      startDate: '2026-03-05',
      dueDate: '2026-12-01',
      completionDate: '2026-03-19',
      actionStatus: 'Waiting Verification',
      effectiveStatus: 'Waiting Verification',
      completionNotes: 'Revised PTW Form v4.2 deployed to control room; awaiting management sign-off.',
      evidence: [],
      createdAt: '2026-03-05T08:15:00Z',
    },
    {
      id: 3,
      capaCode: 'CAPA-2026-003',
      incidentId: 10,
      incidentCode: 'INC-2026-010',
      rootCause: fiveWhys[1].finalRootCause,
      actionDescription: 'Replace all quick-couplers in Test Bench A with locking safety-collar couplings.',
      actionType: 'Corrective Action',
      responsiblePic: 'Agus Firmansyah',
      departmentName: 'Mechanical Maintenance',
      priority: 'High',
      startDate: '2026-04-06',
      dueDate: '2026-04-20',
      completionDate: '2026-04-18',
      actionStatus: 'Waiting Verification',
      effectiveStatus: 'Waiting Verification',
      completionNotes: 'All 12 couplers replaced; pressure test log attached.',
      evidence: [],
      createdAt: '2026-04-06T09:00:00Z',
    },
    {
      id: 4,
      capaCode: 'CAPA-2026-004',
      incidentId: 7,
      incidentCode: 'INC-2026-007',
      rootCause: 'High pull-force resistance on manual dock leveler chain mechanism.',
      actionDescription: 'Lubricate dock leveler torsion springs and install ergonomic pull-handle extension.',
      actionType: 'Corrective Action',
      responsiblePic: 'Budi Santoso',
      departmentName: 'Fleet & Warehouse',
      priority: 'Medium',
      startDate: '2026-03-20',
      dueDate: '2026-05-01',
      completionDate: null,
      actionStatus: 'In Progress',
      effectiveStatus: 'Overdue',
      completionNotes: 'Spring kit ordered; awaiting weekend dock shutdown.',
      evidence: [],
      createdAt: '2026-03-20T10:00:00Z',
    },
  ];

  const verifications: VerificationRecord[] = [
    {
      id: 1,
      entityType: 'CAPA',
      capaId: 1,
      incidentId: 4,
      decision: 'APPROVED',
      remarks: 'Verified Bay 2 gantry commissioning certificate and weight stencils on site.',
      verifiedByName: 'Hendra Wijaya',
      verifiedByRole: 'MANAGEMENT',
      verifiedAt: '2026-03-24T15:00:00Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 1,
      userEmail: 'hse@ohsexpert.io',
      userRole: 'HSE_OFFICER',
      action: 'SAVE_INVESTIGATION',
      entityType: 'INCIDENT',
      entityId: 'INC-2026-004',
      summary: 'Completed investigation details, Five Whys, and 6M Fishbone analysis for INC-2026-004.',
      createdAt: '2026-03-04T11:05:00Z',
    },
    {
      id: 2,
      userEmail: 'management@ohsexpert.io',
      userRole: 'MANAGEMENT',
      action: 'VERIFY_CAPA',
      entityType: 'CAPA',
      entityId: 'CAPA-2026-001',
      summary: 'Approved CAPA-2026-001 after inspecting Bay 2 mobile gantry installation.',
      createdAt: '2026-03-24T15:00:00Z',
    },
  ];

  return {
    nextId: 200,
    users,
    companies,
    departments,
    locations,
    employees,
    clinicalRanges: { ...DEFAULT_CLINICAL_RANGES },
    clinicVisits,
    medicalExams,
    incidents,
    investigations,
    fiveWhys,
    fishboneCauses,
    capas,
    evidenceFiles: [],
    verifications,
    auditLogs,
  };
}
