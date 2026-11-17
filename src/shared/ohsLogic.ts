import type {
  CapaAction,
  CapaEffectiveStatus,
  ClinicVisit,
  ClinicalReferenceRanges,
  DashboardFilters,
  DashboardSummary,
  DonutDatum,
  FishboneCause,
  FiveWhys,
  Incident,
  Investigation,
  MedicalExamination,
  MedicalStatus,
  SectionFilter,
  TrendDatum,
} from './types';

export const DEFAULT_CLINICAL_RANGES: ClinicalReferenceRanges = {
  bmiUnderweightMax: 18.49,
  bmiNormalMax: 24.99,
  bmiOverweightMax: 29.99,
  bmiObesity1Max: 34.99,
  glucoseNormalMax: 99,
  glucosePrediabetesMax: 125,
  cholesterolNormalMax: 199,
  cholesterolBorderlineMax: 239,
  uricAcidNormalMax: 7.0,
};

export function calculateBmi(weightKg: number, heightM: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightM) || weightKg <= 0 || heightM <= 0) {
    return 0;
  }
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

export function classifyBmi(
  bmi: number,
  ranges: ClinicalReferenceRanges = DEFAULT_CLINICAL_RANGES,
): string {
  if (bmi <= ranges.bmiUnderweightMax) return 'Underweight';
  if (bmi <= ranges.bmiNormalMax) return 'Normal / Ideal';
  if (bmi <= ranges.bmiOverweightMax) return 'Overweight';
  if (bmi <= ranges.bmiObesity1Max) return 'Obesity Class I';
  return 'Obesity Class II';
}

export function classifyBloodGlucose(
  glucoseMgDl: number,
  ranges: ClinicalReferenceRanges = DEFAULT_CLINICAL_RANGES,
): string {
  if (glucoseMgDl <= ranges.glucoseNormalMax) return 'Normal';
  if (glucoseMgDl <= ranges.glucosePrediabetesMax) return 'Prediabetes';
  return 'Diabetes';
}

export function classifyCholesterol(
  cholesterolMgDl: number,
  ranges: ClinicalReferenceRanges = DEFAULT_CLINICAL_RANGES,
): string {
  if (cholesterolMgDl <= ranges.cholesterolNormalMax) return 'Normal';
  if (cholesterolMgDl <= ranges.cholesterolBorderlineMax) return 'Borderline High';
  return 'High';
}

export function classifyUricAcid(
  uricAcidMgDl: number,
  ranges: ClinicalReferenceRanges = DEFAULT_CLINICAL_RANGES,
): string {
  return uricAcidMgDl <= ranges.uricAcidNormalMax ? 'Normal' : 'High';
}

export function deriveMedicalStatus(params: {
  bmiCategory: string;
  glucoseCategory: string;
  cholesterolCategory: string;
  uricAcidCategory: string;
}): MedicalStatus {
  const { bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory } = params;
  if (glucoseCategory === 'Diabetes' || bmiCategory === 'Obesity Class II') {
    return 'Follow-up Required';
  }
  if (
    cholesterolCategory === 'High' ||
    uricAcidCategory === 'High' ||
    glucoseCategory === 'Prediabetes' ||
    bmiCategory === 'Obesity Class I'
  ) {
    return 'Fit with Note';
  }
  return 'Fit';
}

export function computeCapaEffectiveStatus(
  capa: Pick<CapaAction, 'actionStatus' | 'dueDate'>,
  referenceDateIso: string = new Date().toISOString().slice(0, 10),
): CapaEffectiveStatus {
  if (capa.actionStatus === 'Verified') return 'Verified';
  if (capa.dueDate && capa.dueDate < referenceDateIso) {
    return 'Overdue';
  }
  return capa.actionStatus;
}

export interface ClosureGateResult {
  canClose: boolean;
  reasons: string[];
}

export function evaluateIncidentClosureGate(params: {
  incident: Pick<Incident, 'status'>;
  investigation: Investigation | null | undefined;
  fiveWhys: FiveWhys | null | undefined;
  fishboneCauses: FishboneCause[];
  capas: CapaAction[];
}): ClosureGateResult {
  const reasons: string[] = [];
  const { incident, investigation, fiveWhys, fishboneCauses, capas } = params;

  if (incident.status === 'Closed') {
    reasons.push('Incident is already closed.');
  }

  if (
    !investigation ||
    !investigation.investigationLeader.trim() ||
    !investigation.investigationDate.trim() ||
    !investigation.incidentChronology.trim() ||
    !investigation.immediateCause.trim()
  ) {
    reasons.push(
      'Mandatory investigation details (leader, date, chronology, immediate cause) must be completed.',
    );
  }

  const hasFiveWhys = Boolean(fiveWhys && fiveWhys.finalRootCause.trim().length >= 3);
  const hasFishbone = fishboneCauses.length > 0;
  if (!hasFiveWhys && !hasFishbone) {
    reasons.push('Root cause analysis (Five Whys final root cause or 6M Fishbone) must be documented.');
  }

  if (capas.length === 0) {
    reasons.push('At least one Corrective or Preventive Action (CAPA) must be created and verified.');
  } else {
    const unverified = capas.filter((c) => c.actionStatus !== 'Verified');
    if (unverified.length > 0) {
      reasons.push(
        `${unverified.length} CAPA action(s) are not yet verified (${unverified
          .map((c) => c.capaCode)
          .join(', ')}).`,
      );
    }
  }

  return {
    canClose: reasons.length === 0,
    reasons,
  };
}

const CHART_PALETTE = [
  '#159EBD',
  '#E97132',
  '#196B24',
  '#0F4761',
  '#A02B93',
  '#4EA72E',
  '#163E64',
  '#DC2626',
  '#F59E0B',
  '#0EA5E9',
  '#6366F1',
];

function matchesSectionFilter<
  T extends { companyId: number; locationId: number; shift: string }
>(item: T, dateStr: string, filter: SectionFilter): boolean {
  if (filter.month && filter.month !== 'ALL') {
    if (!dateStr.startsWith(filter.month)) return false;
  }
  if (filter.companyId && filter.companyId !== 'ALL') {
    if (String(item.companyId) !== String(filter.companyId)) return false;
  }
  if (filter.locationId && filter.locationId !== 'ALL') {
    if (String(item.locationId) !== String(filter.locationId)) return false;
  }
  if (filter.shift && filter.shift !== 'ALL') {
    if (item.shift !== filter.shift) return false;
  }
  return true;
}

function buildDonutCounts(
  values: (string | null | undefined)[],
  orderedLabels?: string[],
  customColors?: Record<string, string>,
): DonutDatum[] {
  const map = new Map<string, number>();
  for (const val of values) {
    if (!val) continue;
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  const keys = orderedLabels
    ? [...new Set([...orderedLabels.filter((l) => map.has(l)), ...map.keys()])]
    : Array.from(map.keys());

  return keys
    .map((name, idx) => ({
      name,
      value: map.get(name) ?? 0,
      color: customColors?.[name] ?? CHART_PALETTE[idx % CHART_PALETTE.length],
    }))
    .filter((d) => d.value > 0);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthlyTrend(dates: string[]): TrendDatum[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    if (!d || d.length < 7) continue;
    const ym = d.slice(0, 7);
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }

  const sortedMonths = Array.from(counts.keys()).sort();
  if (sortedMonths.length === 0) return [];

  const n = sortedMonths.length;
  const ys = sortedMonths.map((m) => counts.get(m) ?? 0);

  // Simple linear regression for dotted trendline matching the reference dashboard
  const sumX = (n * (n - 1)) / 2;
  const sumY = ys.reduce((acc, y) => acc + y, 0);
  const sumXY = ys.reduce((acc, y, i) => acc + i * y, 0);
  const sumXX = ys.reduce((acc, _, i) => acc + i * i, 0);
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return sortedMonths.map((ym, i) => {
    const monthNum = parseInt(ym.slice(5, 7), 10);
    const label = MONTH_NAMES[monthNum - 1] ?? ym;
    return {
      month: ym,
      label,
      count: ys[i],
      trend: Number((intercept + slope * i).toFixed(2)),
    };
  });
}

export function aggregateDashboardData(params: {
  clinicVisits: ClinicVisit[];
  medicalExams: MedicalExamination[];
  incidents: Incident[];
  capas: CapaAction[];
  investigations: Investigation[];
  filters: DashboardFilters;
  includeMedicalExams: boolean;
  referenceDateIso?: string;
}): DashboardSummary {
  const {
    clinicVisits,
    medicalExams,
    incidents,
    capas,
    investigations,
    filters,
    includeMedicalExams,
    referenceDateIso = new Date().toISOString().slice(0, 10),
  } = params;

  const filteredVisits = clinicVisits.filter((v) =>
    matchesSectionFilter(v, v.visitDate, filters.visits),
  );
  const filteredExams = includeMedicalExams
    ? medicalExams.filter((e) => matchesSectionFilter(e, e.examDate, filters.exams))
    : [];
  const filteredIncidents = incidents.filter((i) =>
    matchesSectionFilter(i, i.incidentDate, filters.incidents),
  );

  // Section A: Clinic Visits
  const newVisits = filteredVisits.filter((v) => v.visitType === 'New').length;
  const followUpVisits = filteredVisits.filter((v) => v.visitType === 'Follow-up').length;
  const generalDiagnosis = buildDonutCounts(
    filteredVisits.map((v) => v.generalDiagnosis),
    ['Influenza', 'Pharyngitis', 'Hypertension', 'Tonsillitis', 'Migraine', 'Gastritis', 'Hypotension'],
  );
  const pakDiagnosis = buildDonutCounts(
    filteredVisits.map((v) => v.pakClassification),
    [
      'Contact Dermatitis',
      'Heat Stress / Heat Stroke',
      'Heavy Metal Poisoning',
      'Noise Induced Hearing Loss (NIHL)',
    ],
  );
  const visitTrend = buildMonthlyTrend(filteredVisits.map((v) => v.visitDate));

  // Section B: Medical Examinations
  const examReasonConfig = [
    { name: 'Workplace Accident', color: '#C00000' },
    { name: 'Clinic Visit', color: '#EAB308' },
    { name: 'Daily / Periodic Exam', color: '#70AD47' },
    { name: 'Special Exam', color: '#0F4761' },
  ];
  const reasons = examReasonConfig.map((cfg) => ({
    name: cfg.name,
    color: cfg.color,
    count: filteredExams.filter((e) => e.examType === cfg.name).length,
  }));

  const bmiDonut = buildDonutCounts(
    filteredExams.map((e) => e.bmiCategory),
    ['Underweight', 'Overweight', 'Normal / Ideal', 'Obesity Class I', 'Obesity Class II'],
    {
      Underweight: '#159EBD',
      Overweight: '#E97132',
      'Normal / Ideal': '#196B24',
      'Obesity Class I': '#0F4761',
      'Obesity Class II': '#A02B93',
    },
  );
  const glucoseDonut = buildDonutCounts(
    filteredExams.map((e) => e.glucoseCategory),
    ['Diabetes', 'Normal', 'Prediabetes'],
    {
      Diabetes: '#0F4761',
      Normal: '#E97132',
      Prediabetes: '#196B24',
    },
  );
  const cholesterolDonut = buildDonutCounts(
    filteredExams.map((e) => e.cholesterolCategory),
    ['Borderline High', 'Normal', 'High'],
    {
      'Borderline High': '#159EBD',
      Normal: '#E97132',
      High: '#196B24',
    },
  );
  const uricAcidDonut = buildDonutCounts(
    filteredExams.map((e) => e.uricAcidCategory),
    ['Normal', 'High'],
    {
      Normal: '#159EBD',
      High: '#E97132',
    },
  );

  // Section C: Incidents
  const workRelatedCount = filteredIncidents.filter(
    (i) => i.workRelatedStatus === 'Work-Related',
  ).length;
  const nonWorkRelatedCount = filteredIncidents.filter(
    (i) => i.workRelatedStatus === 'Non-Work-Related',
  ).length;

  const categoryDefs: { name: string; shortName: string; color: string }[] = [
    { name: 'Fatality', shortName: 'Fatality', color: '#991B1B' },
    { name: 'First Aid Case (FAC)', shortName: 'FAC', color: '#16A34A' },
    { name: 'Lost Time Injury (LTI)', shortName: 'LTI', color: '#DC2626' },
    { name: 'Medical Treatment Case (MTC)', shortName: 'MTC', color: '#EAB308' },
    { name: 'Restricted Work Case (RWC)', shortName: 'RWC', color: '#0284C7' },
    { name: 'Near Miss', shortName: 'Near Miss', color: '#F59E0B' },
    { name: 'Property Damage', shortName: 'Property', color: '#6366F1' },
  ];
  const categories = categoryDefs.map((def) => ({
    ...def,
    count: filteredIncidents.filter((i) => i.incidentCategory === def.name).length,
  }));

  const bodyParts = buildDonutCounts(
    filteredIncidents
      .map((i) => i.affectedBodyPart)
      .filter((bp) => bp && bp !== 'None'),
    ['Head', 'Eyes', 'Face', 'Neck', 'Shoulder', 'Arms', 'Hands', 'Fingers', 'Back', 'Legs', 'Feet'],
  );

  // Workflow KPIs across active incident & CAPA logs
  const invIncidentIds = new Set(investigations.map((inv) => inv.incidentId));
  const openInvestigations = incidents.filter(
    (inc) => inc.status !== 'Closed' && (!invIncidentIds.has(inc.id) || inc.status === 'Open' || inc.status === 'Under Investigation'),
  ).length;

  let capaInProgress = 0;
  let overdueCapa = 0;
  let waitingVerification = 0;
  let verifiedCapa = 0;

  for (const capa of capas) {
    const eff = computeCapaEffectiveStatus(capa, referenceDateIso);
    if (eff === 'Overdue') overdueCapa += 1;
    if (capa.actionStatus === 'Open' || capa.actionStatus === 'In Progress' || capa.actionStatus === 'Rejected / Reopened') {
      capaInProgress += 1;
    } else if (capa.actionStatus === 'Waiting Verification') {
      waitingVerification += 1;
    } else if (capa.actionStatus === 'Verified') {
      verifiedCapa += 1;
    }
  }

  const closedIncidents = incidents.filter((i) => i.status === 'Closed').length;

  return {
    clinicVisits: {
      total: filteredVisits.length,
      newVisits,
      followUpVisits,
      generalDiagnosis,
      pakDiagnosis,
      trend: visitTrend,
    },
    medicalExams: {
      restricted: !includeMedicalExams,
      total: filteredExams.length,
      trend: buildMonthlyTrend(filteredExams.map((e) => e.examDate)),
      reasons,
      bmi: bmiDonut,
      glucose: glucoseDonut,
      cholesterol: cholesterolDonut,
      uricAcid: uricAcidDonut,
    },
    incidents: {
      total: filteredIncidents.length,
      workRelatedSplit: [
        { name: 'Non-Work-Related', count: nonWorkRelatedCount },
        { name: 'Work-Related', count: workRelatedCount },
      ],
      categories,
      bodyParts,
      trend: buildMonthlyTrend(filteredIncidents.map((i) => i.incidentDate)),
    },
    workflowKpis: {
      openInvestigations,
      capaInProgress,
      overdueCapa,
      waitingVerification,
      verifiedCapa,
      closedIncidents,
    },
  };
}
