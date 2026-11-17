import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateDashboardData,
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  computeCapaEffectiveStatus,
  DEFAULT_CLINICAL_RANGES,
  deriveMedicalStatus,
  evaluateIncidentClosureGate,
} from './ohsLogic';
import type { CapaAction, ClinicVisit, FishboneCause, FiveWhys, Incident, Investigation, MedicalExamination } from './types';

test('BMI calculation and clinical classification follow reference ranges', () => {
  assert.equal(calculateBmi(80, 1.75), 26.12);
  assert.equal(calculateBmi(65, 1.75), 21.22);
  assert.equal(classifyBmi(17.8, DEFAULT_CLINICAL_RANGES), 'Underweight');
  assert.equal(classifyBmi(21.22, DEFAULT_CLINICAL_RANGES), 'Normal / Ideal');
  assert.equal(classifyBmi(26.12, DEFAULT_CLINICAL_RANGES), 'Overweight');
  assert.equal(classifyBmi(31.5, DEFAULT_CLINICAL_RANGES), 'Obesity Class I');
  assert.equal(classifyBmi(36.2, DEFAULT_CLINICAL_RANGES), 'Obesity Class II');

  assert.equal(classifyBloodGlucose(92), 'Normal');
  assert.equal(classifyBloodGlucose(112), 'Prediabetes');
  assert.equal(classifyBloodGlucose(145), 'Diabetes');

  assert.equal(classifyCholesterol(185), 'Normal');
  assert.equal(classifyCholesterol(215), 'Borderline High');
  assert.equal(classifyCholesterol(255), 'High');

  assert.equal(classifyUricAcid(6.2), 'Normal');
  assert.equal(classifyUricAcid(8.1), 'High');

  assert.equal(
    deriveMedicalStatus({
      bmiCategory: 'Normal / Ideal',
      glucoseCategory: 'Diabetes',
      cholesterolCategory: 'Normal',
      uricAcidCategory: 'Normal',
    }),
    'Follow-up Required',
  );
});

test('CAPA overdue detection flags open/in-progress items past dueDate', () => {
  assert.equal(
    computeCapaEffectiveStatus({ actionStatus: 'In Progress', dueDate: '2026-10-01' }, '2026-11-17'),
    'Overdue',
  );
  assert.equal(
    computeCapaEffectiveStatus({ actionStatus: 'Verified', dueDate: '2026-10-01' }, '2026-11-17'),
    'Verified',
  );
  assert.equal(
    computeCapaEffectiveStatus({ actionStatus: 'Waiting Verification', dueDate: '2026-12-15' }, '2026-11-17'),
    'Waiting Verification',
  );
});

test('Incident closure gate blocks closure until investigation, RCA, and verified CAPAs exist', () => {
  const incident: Pick<Incident, 'status'> = { status: 'Waiting Verification' };
  const investigation: Investigation = {
    id: 1,
    investigationCode: 'INV-001',
    incidentId: 1,
    investigationDate: '2026-05-12',
    investigationLeader: 'Rendra Pratama',
    investigationTeam: 'Site Safety Team',
    witnessStatements: 'Confirmed valve seal leak.',
    incidentChronology: '10:15 Operator approached manifold; 10:18 seal ruptured.',
    unsafeAct: 'Bypassed pressure relief check',
    unsafeCondition: 'Corroded gasket',
    immediateCause: 'High-pressure steam release',
    contributingFactors: 'Overdue PM schedule',
    updatedAt: '2026-05-12T10:00:00Z',
  };
  const fiveWhys: FiveWhys = {
    id: 1,
    incidentId: 1,
    why1: 'Gasket failed under pressure',
    why2: 'Gasket was corroded',
    why3: 'Scheduled PM was skipped',
    why4: 'CMMS alert lacked escalation',
    why5: 'No backup preventive schedule owner',
    finalRootCause: 'Lack of preventive maintenance escalation ownership in CMMS',
    updatedAt: '2026-05-12T10:00:00Z',
  };
  const fishbone: FishboneCause[] = [];
  const pendingCapa: CapaAction = {
    id: 1,
    capaCode: 'CAPA-001',
    incidentId: 1,
    rootCause: fiveWhys.finalRootCause,
    actionDescription: 'Replace manifold gasket and enable CMMS escalation.',
    actionType: 'Corrective Action',
    responsiblePic: 'Maintenance Lead',
    departmentName: 'Mechanical Maintenance',
    priority: 'High',
    startDate: '2026-05-13',
    dueDate: '2026-05-25',
    completionDate: null,
    actionStatus: 'Waiting Verification',
    effectiveStatus: 'Waiting Verification',
    completionNotes: '',
    evidence: [],
    createdAt: '2026-05-13T08:00:00Z',
  };

  const blocked = evaluateIncidentClosureGate({
    incident,
    investigation,
    fiveWhys,
    fishboneCauses: fishbone,
    capas: [pendingCapa],
  });
  assert.equal(blocked.canClose, false);
  assert.equal(blocked.reasons.length, 1);

  const allowed = evaluateIncidentClosureGate({
    incident,
    investigation,
    fiveWhys,
    fishboneCauses: fishbone,
    capas: [{ ...pendingCapa, actionStatus: 'Verified', effectiveStatus: 'Verified' }],
  });
  assert.equal(allowed.canClose, true);
  assert.equal(allowed.reasons.length, 0);
});

test('Dashboard aggregation filters each section independently and computes workflow KPIs', () => {
  const visits: ClinicVisit[] = [
    {
      id: 1,
      visitCode: 'CV-001',
      employeeCode: 'EMP-01',
      employeeName: 'Budi',
      companyId: 3,
      companyName: 'Perusahaan C',
      departmentName: 'Fleet',
      locationId: 3,
      locationName: 'Lokasi E',
      shift: 'Malam',
      visitDate: '2026-03-10',
      visitType: 'New',
      generalDiagnosis: 'Influenza',
      pakClassification: 'Contact Dermatitis',
      symptoms: 'Fever',
      treatment: 'Rest',
      medicalOfficer: 'Dr. Nadia',
      notes: '',
      createdAt: '2026-03-10T00:00:00Z',
    },
    {
      id: 2,
      visitCode: 'CV-002',
      employeeCode: 'EMP-02',
      employeeName: 'Sari',
      companyId: 1,
      companyName: 'Perusahaan A',
      departmentName: 'Plant',
      locationId: 1,
      locationName: 'Lokasi A',
      shift: 'Pagi',
      visitDate: '2026-04-12',
      visitType: 'Follow-up',
      generalDiagnosis: 'Pharyngitis',
      pakClassification: null,
      symptoms: 'Sore throat',
      treatment: 'Lozenges',
      medicalOfficer: 'Dr. Nadia',
      notes: '',
      createdAt: '2026-04-12T00:00:00Z',
    },
  ];
  const exams: MedicalExamination[] = [
    {
      id: 1,
      examCode: 'EX-001',
      employeeCode: 'EMP-01',
      employeeName: 'Budi',
      companyId: 1,
      companyName: 'Perusahaan A',
      departmentName: 'Plant',
      locationId: 1,
      locationName: 'Lokasi A',
      shift: 'Pagi',
      examDate: '2026-03-15',
      examType: 'Daily / Periodic Exam',
      heightM: 1.75,
      weightKg: 70,
      bmi: 22.86,
      bmiCategory: 'Normal / Ideal',
      bloodPressure: '120/80',
      bloodGlucose: 92,
      glucoseCategory: 'Normal',
      totalCholesterol: 180,
      cholesterolCategory: 'Normal',
      uricAcid: 5.5,
      uricAcidCategory: 'Normal',
      medicalStatus: 'Fit',
      recommendations: '',
      medicalOfficer: 'Dr. Nadia',
      createdAt: '2026-03-15T00:00:00Z',
    },
  ];
  const incidents: Incident[] = [
    {
      id: 1,
      incidentCode: 'INC-001',
      incidentDate: '2026-04-10',
      incidentTime: '14:00:00',
      companyId: 1,
      companyName: 'Perusahaan A',
      departmentName: 'Plant',
      locationId: 1,
      locationName: 'Lokasi A',
      shift: 'Malam',
      employeeCode: 'EMP-01',
      employeeName: 'Budi',
      jobPosition: 'Operator',
      incidentCategory: 'Medical Treatment Case (MTC)',
      workRelatedStatus: 'Work-Related',
      severity: 'Medium',
      incidentDescription: 'Hand abrasion',
      injuryDescription: 'Abrasion on palm',
      affectedBodyPart: 'Hands',
      injuryType: 'Laceration',
      immediateActions: 'First aid applied',
      witnessInfo: 'Supervisor',
      status: 'Open',
      closedAt: null,
      closedByName: null,
      evidence: [],
      createdAt: '2026-04-10T14:00:00Z',
    },
  ];

  const summary = aggregateDashboardData({
    clinicVisits: visits,
    medicalExams: exams,
    incidents,
    capas: [],
    investigations: [],
    filters: {
      visits: { month: 'ALL', companyId: '3', locationId: 'ALL', shift: 'ALL' },
      exams: { month: 'ALL', companyId: 'ALL', locationId: 'ALL', shift: 'ALL' },
      incidents: { month: 'ALL', companyId: 'ALL', locationId: 'ALL', shift: 'ALL' },
    },
    includeMedicalExams: true,
    referenceDateIso: '2026-11-17',
  });

  assert.equal(summary.clinicVisits.total, 1);
  assert.equal(summary.clinicVisits.newVisits, 1);
  assert.equal(summary.medicalExams.total, 1);
  assert.equal(summary.incidents.total, 1);
  assert.equal(summary.workflowKpis.openInvestigations, 1);
});
