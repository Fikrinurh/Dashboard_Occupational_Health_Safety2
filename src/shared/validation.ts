import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const clinicVisitSchema = z.object({
  visitCode: z.string().min(2, 'Visit ID is required'),
  employeeCode: z.string().min(2, 'Employee ID is required'),
  employeeName: z.string().min(2, 'Employee name is required'),
  companyId: z.coerce.number().int().positive('Company is required'),
  departmentName: z.string().min(2, 'Department is required'),
  locationId: z.coerce.number().int().positive('Location is required'),
  shift: z.enum(['Pagi', 'Siang', 'Malam']),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Visit date must be YYYY-MM-DD'),
  visitType: z.enum(['New', 'Follow-up']),
  generalDiagnosis: z.string().min(2, 'General diagnosis is required'),
  pakClassification: z.string().nullable().optional(),
  symptoms: z.string().min(2, 'Symptoms are required'),
  treatment: z.string().min(2, 'Treatment is required'),
  medicalOfficer: z.string().min(2, 'Medical officer is required'),
  notes: z.string().optional().default(''),
});

export const medicalExamSchema = z.object({
  examCode: z.string().min(2, 'Examination ID is required'),
  employeeCode: z.string().min(2, 'Employee ID is required'),
  employeeName: z.string().min(2, 'Employee name is required'),
  companyId: z.coerce.number().int().positive('Company is required'),
  departmentName: z.string().min(2, 'Department is required'),
  locationId: z.coerce.number().int().positive('Location is required'),
  shift: z.enum(['Pagi', 'Siang', 'Malam']),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Exam date must be YYYY-MM-DD'),
  examType: z.enum([
    'Workplace Accident',
    'Clinic Visit',
    'Daily / Periodic Exam',
    'Special Exam',
  ]),
  heightM: z.coerce.number().min(0.8, 'Height must be in meters (e.g. 1.72)').max(2.5),
  weightKg: z.coerce.number().min(25).max(300),
  bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, 'Blood pressure must be e.g. 120/80'),
  bloodGlucose: z.coerce.number().min(30).max(600),
  totalCholesterol: z.coerce.number().min(50).max(600),
  uricAcid: z.coerce.number().min(1).max(20),
  medicalStatus: z.enum(['Fit', 'Fit with Note', 'Follow-up Required', 'Unfit']).optional(),
  recommendations: z.string().optional().default(''),
  medicalOfficer: z.string().min(2, 'Medical officer is required'),
});

export const incidentSchema = z.object({
  incidentCode: z.string().min(2, 'Incident ID is required'),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Incident date must be YYYY-MM-DD'),
  incidentTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Incident time is required'),
  companyId: z.coerce.number().int().positive('Company is required'),
  departmentName: z.string().min(2, 'Department is required'),
  locationId: z.coerce.number().int().positive('Location is required'),
  shift: z.enum(['Pagi', 'Siang', 'Malam']),
  employeeCode: z.string().min(2, 'Employee ID is required'),
  employeeName: z.string().min(2, 'Employee name is required'),
  jobPosition: z.string().min(2, 'Job position is required'),
  incidentCategory: z.enum([
    'Fatality',
    'First Aid Case (FAC)',
    'Lost Time Injury (LTI)',
    'Medical Treatment Case (MTC)',
    'Restricted Work Case (RWC)',
    'Near Miss',
    'Property Damage',
  ]),
  workRelatedStatus: z.enum(['Work-Related', 'Non-Work-Related']),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
  incidentDescription: z.string().min(5, 'Incident description is required'),
  injuryDescription: z.string().optional().default(''),
  affectedBodyPart: z.enum([
    'Head',
    'Eyes',
    'Face',
    'Neck',
    'Shoulder',
    'Arms',
    'Hands',
    'Fingers',
    'Back',
    'Legs',
    'Feet',
    'None',
  ]),
  injuryType: z.string().optional().default(''),
  immediateActions: z.string().min(3, 'Immediate actions are required'),
  witnessInfo: z.string().optional().default(''),
});

export const investigationSchema = z.object({
  investigationCode: z.string().min(2, 'Investigation ID is required'),
  investigationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Investigation date is required'),
  investigationLeader: z.string().min(2, 'Investigation leader is required'),
  investigationTeam: z.string().min(2, 'Investigation team is required'),
  witnessStatements: z.string().optional().default(''),
  incidentChronology: z.string().min(5, 'Incident chronology is required'),
  unsafeAct: z.string().optional().default(''),
  unsafeCondition: z.string().optional().default(''),
  immediateCause: z.string().min(3, 'Immediate cause is required'),
  contributingFactors: z.string().optional().default(''),
});

export const fiveWhysSchema = z.object({
  why1: z.string().min(3, 'Why 1 is required'),
  why2: z.string().optional().default(''),
  why3: z.string().optional().default(''),
  why4: z.string().optional().default(''),
  why5: z.string().optional().default(''),
  finalRootCause: z.string().min(3, 'Final root cause is required'),
});

export const fishboneCauseSchema = z.object({
  category: z.enum(['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment']),
  causeText: z.string().min(2, 'Cause description is required'),
  subCauseText: z.string().optional().default(''),
  isPrimaryRoot: z.boolean().optional().default(false),
});

export const capaSchema = z.object({
  capaCode: z.string().min(2, 'CAPA ID is required'),
  incidentId: z.coerce.number().int().positive('Incident is required'),
  rootCause: z.string().min(3, 'Root cause is required'),
  actionDescription: z.string().min(3, 'Action description is required'),
  actionType: z.enum(['Corrective Action', 'Preventive Action']),
  responsiblePic: z.string().min(2, 'Responsible PIC is required'),
  departmentName: z.string().min(2, 'Department is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date is required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required'),
  completionDate: z.string().nullable().optional(),
  actionStatus: z
    .enum(['Open', 'In Progress', 'Waiting Verification', 'Verified', 'Rejected / Reopened'])
    .optional(),
  completionNotes: z.string().optional().default(''),
});
