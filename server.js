// server.ts
import express from "express";
import path5 from "path";
import { createServer as createViteServer } from "vite";

// server/config/env.ts
import dotenv from "dotenv";
import path from "path";
dotenv.config();
var env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3e3),
  jwtSecret: process.env.JWT_SECRET || "ohs-expert-dev-jwt-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  dbHost: process.env.DB_HOST || "",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || "ohs_user",
  dbPassword: process.env.DB_PASSWORD || "",
  dbName: process.env.DB_NAME || "ohs_expert",
  dbConnectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  dbSsl: process.env.DB_SSL === "true",
  cloudSqlConnectionName: process.env.CLOUD_SQL_CONNECTION_NAME || "",
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./uploads"),
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024
};

// server/db/demoStore.ts
import fs from "fs";
import path2 from "path";

// src/shared/ohsLogic.ts
var DEFAULT_CLINICAL_RANGES = {
  bmiUnderweightMax: 18.49,
  bmiNormalMax: 24.99,
  bmiOverweightMax: 29.99,
  bmiObesity1Max: 34.99,
  glucoseNormalMax: 99,
  glucosePrediabetesMax: 125,
  cholesterolNormalMax: 199,
  cholesterolBorderlineMax: 239,
  uricAcidNormalMax: 7
};
function calculateBmi(weightKg, heightM) {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightM) || weightKg <= 0 || heightM <= 0) {
    return 0;
  }
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}
function classifyBmi(bmi, ranges = DEFAULT_CLINICAL_RANGES) {
  if (bmi <= ranges.bmiUnderweightMax) return "Underweight";
  if (bmi <= ranges.bmiNormalMax) return "Normal / Ideal";
  if (bmi <= ranges.bmiOverweightMax) return "Overweight";
  if (bmi <= ranges.bmiObesity1Max) return "Obesity Class I";
  return "Obesity Class II";
}
function classifyBloodGlucose(glucoseMgDl, ranges = DEFAULT_CLINICAL_RANGES) {
  if (glucoseMgDl <= ranges.glucoseNormalMax) return "Normal";
  if (glucoseMgDl <= ranges.glucosePrediabetesMax) return "Prediabetes";
  return "Diabetes";
}
function classifyCholesterol(cholesterolMgDl, ranges = DEFAULT_CLINICAL_RANGES) {
  if (cholesterolMgDl <= ranges.cholesterolNormalMax) return "Normal";
  if (cholesterolMgDl <= ranges.cholesterolBorderlineMax) return "Borderline High";
  return "High";
}
function classifyUricAcid(uricAcidMgDl, ranges = DEFAULT_CLINICAL_RANGES) {
  return uricAcidMgDl <= ranges.uricAcidNormalMax ? "Normal" : "High";
}
function deriveMedicalStatus(params) {
  const { bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory } = params;
  if (glucoseCategory === "Diabetes" || bmiCategory === "Obesity Class II") {
    return "Follow-up Required";
  }
  if (cholesterolCategory === "High" || uricAcidCategory === "High" || glucoseCategory === "Prediabetes" || bmiCategory === "Obesity Class I") {
    return "Fit with Note";
  }
  return "Fit";
}
function computeCapaEffectiveStatus(capa, referenceDateIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) {
  if (capa.actionStatus === "Verified") return "Verified";
  if (capa.dueDate && capa.dueDate < referenceDateIso) {
    return "Overdue";
  }
  return capa.actionStatus;
}
function evaluateIncidentClosureGate(params) {
  const reasons = [];
  const { incident, investigation, fiveWhys, fishboneCauses, capas } = params;
  if (incident.status === "Closed") {
    reasons.push("Incident is already closed.");
  }
  if (!investigation || !investigation.investigationLeader.trim() || !investigation.investigationDate.trim() || !investigation.incidentChronology.trim() || !investigation.immediateCause.trim()) {
    reasons.push(
      "Mandatory investigation details (leader, date, chronology, immediate cause) must be completed."
    );
  }
  const hasFiveWhys = Boolean(fiveWhys && fiveWhys.finalRootCause.trim().length >= 3);
  const hasFishbone = fishboneCauses.length > 0;
  if (!hasFiveWhys && !hasFishbone) {
    reasons.push("Root cause analysis (Five Whys final root cause or 6M Fishbone) must be documented.");
  }
  if (capas.length === 0) {
    reasons.push("At least one Corrective or Preventive Action (CAPA) must be created and verified.");
  } else {
    const unverified = capas.filter((c) => c.actionStatus !== "Verified");
    if (unverified.length > 0) {
      reasons.push(
        `${unverified.length} CAPA action(s) are not yet verified (${unverified.map((c) => c.capaCode).join(", ")}).`
      );
    }
  }
  return {
    canClose: reasons.length === 0,
    reasons
  };
}
var CHART_PALETTE = [
  "#159EBD",
  "#E97132",
  "#196B24",
  "#0F4761",
  "#A02B93",
  "#4EA72E",
  "#163E64",
  "#DC2626",
  "#F59E0B",
  "#0EA5E9",
  "#6366F1"
];
function matchesSectionFilter(item, dateStr, filter) {
  if (filter.month && filter.month !== "ALL") {
    if (!dateStr.startsWith(filter.month)) return false;
  }
  if (filter.companyId && filter.companyId !== "ALL") {
    if (String(item.companyId) !== String(filter.companyId)) return false;
  }
  if (filter.locationId && filter.locationId !== "ALL") {
    if (String(item.locationId) !== String(filter.locationId)) return false;
  }
  if (filter.shift && filter.shift !== "ALL") {
    if (item.shift !== filter.shift) return false;
  }
  return true;
}
function buildDonutCounts(values, orderedLabels, customColors) {
  const map = /* @__PURE__ */ new Map();
  for (const val of values) {
    if (!val) continue;
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  const keys = orderedLabels ? [.../* @__PURE__ */ new Set([...orderedLabels.filter((l) => map.has(l)), ...map.keys()])] : Array.from(map.keys());
  return keys.map((name, idx) => ({
    name,
    value: map.get(name) ?? 0,
    color: customColors?.[name] ?? CHART_PALETTE[idx % CHART_PALETTE.length]
  })).filter((d) => d.value > 0);
}
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function buildMonthlyTrend(dates) {
  const counts = /* @__PURE__ */ new Map();
  for (const d of dates) {
    if (!d || d.length < 7) continue;
    const ym = d.slice(0, 7);
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  const sortedMonths = Array.from(counts.keys()).sort();
  if (sortedMonths.length === 0) return [];
  const n = sortedMonths.length;
  const ys = sortedMonths.map((m) => counts.get(m) ?? 0);
  const sumX = n * (n - 1) / 2;
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
      trend: Number((intercept + slope * i).toFixed(2))
    };
  });
}
function aggregateDashboardData(params) {
  const {
    clinicVisits,
    medicalExams,
    incidents,
    capas,
    investigations,
    filters,
    includeMedicalExams,
    referenceDateIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
  } = params;
  const filteredVisits = clinicVisits.filter(
    (v) => matchesSectionFilter(v, v.visitDate, filters.visits)
  );
  const filteredExams = includeMedicalExams ? medicalExams.filter((e) => matchesSectionFilter(e, e.examDate, filters.exams)) : [];
  const filteredIncidents = incidents.filter(
    (i) => matchesSectionFilter(i, i.incidentDate, filters.incidents)
  );
  const newVisits = filteredVisits.filter((v) => v.visitType === "New").length;
  const followUpVisits = filteredVisits.filter((v) => v.visitType === "Follow-up").length;
  const generalDiagnosis = buildDonutCounts(
    filteredVisits.map((v) => v.generalDiagnosis),
    ["Influenza", "Pharyngitis", "Hypertension", "Tonsillitis", "Migraine", "Gastritis", "Hypotension"]
  );
  const pakDiagnosis = buildDonutCounts(
    filteredVisits.map((v) => v.pakClassification),
    [
      "Contact Dermatitis",
      "Heat Stress / Heat Stroke",
      "Heavy Metal Poisoning",
      "Noise Induced Hearing Loss (NIHL)"
    ]
  );
  const visitTrend = buildMonthlyTrend(filteredVisits.map((v) => v.visitDate));
  const examReasonConfig = [
    { name: "Workplace Accident", color: "#C00000" },
    { name: "Clinic Visit", color: "#EAB308" },
    { name: "Daily / Periodic Exam", color: "#70AD47" },
    { name: "Special Exam", color: "#0F4761" }
  ];
  const reasons = examReasonConfig.map((cfg) => ({
    name: cfg.name,
    color: cfg.color,
    count: filteredExams.filter((e) => e.examType === cfg.name).length
  }));
  const bmiDonut = buildDonutCounts(
    filteredExams.map((e) => e.bmiCategory),
    ["Underweight", "Overweight", "Normal / Ideal", "Obesity Class I", "Obesity Class II"],
    {
      Underweight: "#159EBD",
      Overweight: "#E97132",
      "Normal / Ideal": "#196B24",
      "Obesity Class I": "#0F4761",
      "Obesity Class II": "#A02B93"
    }
  );
  const glucoseDonut = buildDonutCounts(
    filteredExams.map((e) => e.glucoseCategory),
    ["Diabetes", "Normal", "Prediabetes"],
    {
      Diabetes: "#0F4761",
      Normal: "#E97132",
      Prediabetes: "#196B24"
    }
  );
  const cholesterolDonut = buildDonutCounts(
    filteredExams.map((e) => e.cholesterolCategory),
    ["Borderline High", "Normal", "High"],
    {
      "Borderline High": "#159EBD",
      Normal: "#E97132",
      High: "#196B24"
    }
  );
  const uricAcidDonut = buildDonutCounts(
    filteredExams.map((e) => e.uricAcidCategory),
    ["Normal", "High"],
    {
      Normal: "#159EBD",
      High: "#E97132"
    }
  );
  const workRelatedCount = filteredIncidents.filter(
    (i) => i.workRelatedStatus === "Work-Related"
  ).length;
  const nonWorkRelatedCount = filteredIncidents.filter(
    (i) => i.workRelatedStatus === "Non-Work-Related"
  ).length;
  const categoryDefs = [
    { name: "Fatality", shortName: "Fatality", color: "#991B1B" },
    { name: "First Aid Case (FAC)", shortName: "FAC", color: "#16A34A" },
    { name: "Lost Time Injury (LTI)", shortName: "LTI", color: "#DC2626" },
    { name: "Medical Treatment Case (MTC)", shortName: "MTC", color: "#EAB308" },
    { name: "Restricted Work Case (RWC)", shortName: "RWC", color: "#0284C7" },
    { name: "Near Miss", shortName: "Near Miss", color: "#F59E0B" },
    { name: "Property Damage", shortName: "Property", color: "#6366F1" }
  ];
  const categories = categoryDefs.map((def) => ({
    ...def,
    count: filteredIncidents.filter((i) => i.incidentCategory === def.name).length
  }));
  const bodyParts = buildDonutCounts(
    filteredIncidents.map((i) => i.affectedBodyPart).filter((bp) => bp && bp !== "None"),
    ["Head", "Eyes", "Face", "Neck", "Shoulder", "Arms", "Hands", "Fingers", "Back", "Legs", "Feet"]
  );
  const invIncidentIds = new Set(investigations.map((inv) => inv.incidentId));
  const openInvestigations = incidents.filter(
    (inc) => inc.status !== "Closed" && (!invIncidentIds.has(inc.id) || inc.status === "Open" || inc.status === "Under Investigation")
  ).length;
  let capaInProgress = 0;
  let overdueCapa = 0;
  let waitingVerification = 0;
  let verifiedCapa = 0;
  for (const capa of capas) {
    const eff = computeCapaEffectiveStatus(capa, referenceDateIso);
    if (eff === "Overdue") overdueCapa += 1;
    if (capa.actionStatus === "Open" || capa.actionStatus === "In Progress" || capa.actionStatus === "Rejected / Reopened") {
      capaInProgress += 1;
    } else if (capa.actionStatus === "Waiting Verification") {
      waitingVerification += 1;
    } else if (capa.actionStatus === "Verified") {
      verifiedCapa += 1;
    }
  }
  const closedIncidents = incidents.filter((i) => i.status === "Closed").length;
  return {
    clinicVisits: {
      total: filteredVisits.length,
      newVisits,
      followUpVisits,
      generalDiagnosis,
      pakDiagnosis,
      trend: visitTrend
    },
    medicalExams: {
      restricted: !includeMedicalExams,
      total: filteredExams.length,
      trend: buildMonthlyTrend(filteredExams.map((e) => e.examDate)),
      reasons,
      bmi: bmiDonut,
      glucose: glucoseDonut,
      cholesterol: cholesterolDonut,
      uricAcid: uricAcidDonut
    },
    incidents: {
      total: filteredIncidents.length,
      workRelatedSplit: [
        { name: "Non-Work-Related", count: nonWorkRelatedCount },
        { name: "Work-Related", count: workRelatedCount }
      ],
      categories,
      bodyParts,
      trend: buildMonthlyTrend(filteredIncidents.map((i) => i.incidentDate))
    },
    workflowKpis: {
      openInvestigations,
      capaInProgress,
      overdueCapa,
      waitingVerification,
      verifiedCapa,
      closedIncidents
    }
  };
}

// server/db/seedData.ts
import bcrypt from "bcryptjs";
function createInitialSeedState() {
  const defaultPasswordHash = bcrypt.hashSync("OhsExpert2026!", 10);
  const users = [
    {
      id: 1,
      userCode: "USR-001",
      fullName: "Dr. Nadia Kusuma",
      email: "admin@ohsexpert.io",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
      departmentName: "Corporate HSE",
      isActive: true
    },
    {
      id: 2,
      userCode: "USR-002",
      fullName: "Rendra Pratama",
      email: "hse@ohsexpert.io",
      passwordHash: defaultPasswordHash,
      role: "HSE_OFFICER",
      departmentName: "Plant Safety",
      isActive: true
    },
    {
      id: 3,
      userCode: "USR-003",
      fullName: "Hendra Wijaya",
      email: "management@ohsexpert.io",
      passwordHash: defaultPasswordHash,
      role: "MANAGEMENT",
      departmentName: "Executive Operations",
      isActive: true
    }
  ];
  const companies = [
    { id: 1, companyCode: "COMP-A", name: "Perusahaan A", industry: "Mining & Heavy Operations" },
    { id: 2, companyCode: "COMP-B", name: "Perusahaan B", industry: "Petrochemical Processing" },
    { id: 3, companyCode: "COMP-C", name: "Perusahaan C", industry: "Logistics & Fleet Services" }
  ];
  const departments = [
    { id: 1, companyId: 1, departmentCode: "DEPT-OPS", name: "Plant Operations" },
    { id: 2, companyId: 1, departmentCode: "DEPT-MNT", name: "Mechanical Maintenance" },
    { id: 3, companyId: 2, departmentCode: "DEPT-LAB", name: "Process Engineering" },
    { id: 4, companyId: 3, departmentCode: "DEPT-LOG", name: "Fleet & Warehouse" }
  ];
  const locations = [
    { id: 1, companyId: 1, locationCode: "LOC-A", name: "Lokasi A", siteArea: "North Sector" },
    { id: 2, companyId: 1, locationCode: "LOC-B", name: "Lokasi B", siteArea: "Processing Plant" },
    { id: 3, companyId: 3, locationCode: "LOC-E", name: "Lokasi E", siteArea: "Central Terminal" }
  ];
  const employees = [
    {
      id: 1,
      employeeCode: "EMP-1001",
      fullName: "Budi Santoso",
      companyId: 3,
      companyName: "Perusahaan C",
      departmentId: 4,
      departmentName: "Fleet & Warehouse",
      locationId: 3,
      locationName: "Lokasi E",
      jobPosition: "Heavy Fleet Operator",
      shift: "Malam"
    },
    {
      id: 2,
      employeeCode: "EMP-1002",
      fullName: "Sari Dewi Lestari",
      companyId: 1,
      companyName: "Perusahaan A",
      departmentId: 1,
      departmentName: "Plant Operations",
      locationId: 1,
      locationName: "Lokasi A",
      jobPosition: "Control Room Technician",
      shift: "Pagi"
    },
    {
      id: 3,
      employeeCode: "EMP-1003",
      fullName: "Agus Firmansyah",
      companyId: 1,
      companyName: "Perusahaan A",
      departmentId: 2,
      departmentName: "Mechanical Maintenance",
      locationId: 1,
      locationName: "Lokasi A",
      jobPosition: "Senior Millwright",
      shift: "Malam"
    },
    {
      id: 4,
      employeeCode: "EMP-1004",
      fullName: "Dewi Anggraini",
      companyId: 2,
      companyName: "Perusahaan B",
      departmentId: 3,
      departmentName: "Process Engineering",
      locationId: 2,
      locationName: "Lokasi B",
      jobPosition: "Chemical Process Analyst",
      shift: "Siang"
    }
  ];
  const visitBlueprints = [
    { date: "2026-02-04", type: "New", companyId: 3, locId: 3, shift: "Malam", gen: "Influenza", pak: "Contact Dermatitis", empIdx: 0 },
    { date: "2026-02-11", type: "New", companyId: 3, locId: 3, shift: "Malam", gen: "Pharyngitis", pak: null, empIdx: 0 },
    { date: "2026-02-19", type: "Follow-up", companyId: 3, locId: 3, shift: "Malam", gen: "Pharyngitis", pak: "Heat Stress / Heat Stroke", empIdx: 0 },
    { date: "2026-03-02", type: "New", companyId: 3, locId: 3, shift: "Malam", gen: "Hypertension", pak: null, empIdx: 0 },
    { date: "2026-03-07", type: "New", companyId: 1, locId: 1, shift: "Pagi", gen: "Tonsillitis", pak: null, empIdx: 1 },
    { date: "2026-03-12", type: "Follow-up", companyId: 1, locId: 1, shift: "Malam", gen: "Migraine", pak: "Noise Induced Hearing Loss (NIHL)", empIdx: 2 },
    { date: "2026-03-18", type: "New", companyId: 2, locId: 2, shift: "Siang", gen: "Gastritis", pak: "Heavy Metal Poisoning", empIdx: 3 },
    { date: "2026-03-22", type: "New", companyId: 1, locId: 1, shift: "Pagi", gen: "Pharyngitis", pak: null, empIdx: 1 },
    { date: "2026-03-27", type: "Follow-up", companyId: 3, locId: 3, shift: "Malam", gen: "Hypotension", pak: null, empIdx: 0 },
    { date: "2026-04-03", type: "New", companyId: 1, locId: 1, shift: "Malam", gen: "Influenza", pak: "Contact Dermatitis", empIdx: 2 },
    { date: "2026-04-09", type: "New", companyId: 1, locId: 1, shift: "Pagi", gen: "Pharyngitis", pak: null, empIdx: 1 },
    { date: "2026-04-14", type: "New", companyId: 2, locId: 2, shift: "Siang", gen: "Hypertension", pak: null, empIdx: 3 },
    { date: "2026-04-19", type: "Follow-up", companyId: 1, locId: 1, shift: "Malam", gen: "Migraine", pak: "Heat Stress / Heat Stroke", empIdx: 2 },
    { date: "2026-04-23", type: "New", companyId: 3, locId: 3, shift: "Malam", gen: "Gastritis", pak: null, empIdx: 0 },
    { date: "2026-04-28", type: "New", companyId: 1, locId: 1, shift: "Pagi", gen: "Tonsillitis", pak: null, empIdx: 1 },
    { date: "2026-05-03", type: "New", companyId: 1, locId: 1, shift: "Malam", gen: "Influenza", pak: null, empIdx: 2 },
    { date: "2026-05-08", type: "Follow-up", companyId: 3, locId: 3, shift: "Malam", gen: "Pharyngitis", pak: "Noise Induced Hearing Loss (NIHL)", empIdx: 0 },
    { date: "2026-05-14", type: "New", companyId: 2, locId: 2, shift: "Siang", gen: "Hypotension", pak: null, empIdx: 3 },
    { date: "2026-05-19", type: "New", companyId: 1, locId: 1, shift: "Pagi", gen: "Migraine", pak: null, empIdx: 1 },
    { date: "2026-05-25", type: "New", companyId: 1, locId: 1, shift: "Malam", gen: "Gastritis", pak: null, empIdx: 2 }
  ];
  const clinicVisits = visitBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId);
    const loc = locations.find((l) => l.id === bp.locId);
    return {
      id: idx + 1,
      visitCode: `CV-2026-${String(idx + 1).padStart(3, "0")}`,
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
      treatment: "Clinical consultation, symptomatic medication, hydration advisory",
      medicalOfficer: "Dr. Nadia Kusuma",
      notes: bp.pak ? `Suspected occupational factor: ${bp.pak}` : "Routine clinic management",
      createdAt: `${bp.date}T08:30:00Z`
    };
  });
  const examBlueprints = [
    { date: "2026-02-05", type: "Workplace Accident", companyId: 1, locId: 1, shift: "Malam", h: 1.72, w: 68, bp: "120/80", gluc: 94, chol: 185, uric: 5.8, empIdx: 2 },
    { date: "2026-02-14", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.65, w: 58, bp: "115/75", gluc: 88, chol: 175, uric: 4.9, empIdx: 1 },
    { date: "2026-02-22", type: "Special Exam", companyId: 3, locId: 3, shift: "Malam", h: 1.75, w: 84, bp: "132/84", gluc: 112, chol: 222, uric: 7.4, empIdx: 0 },
    { date: "2026-03-03", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.68, w: 51, bp: "110/70", gluc: 84, chol: 170, uric: 5.1, empIdx: 1 },
    { date: "2026-03-08", type: "Clinic Visit", companyId: 2, locId: 2, shift: "Siang", h: 1.62, w: 72, bp: "126/82", gluc: 105, chol: 210, uric: 6.1, empIdx: 3 },
    { date: "2026-03-11", type: "Workplace Accident", companyId: 1, locId: 1, shift: "Malam", h: 1.74, w: 94, bp: "138/88", gluc: 132, chol: 248, uric: 7.9, empIdx: 2 },
    { date: "2026-03-16", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.7, w: 67, bp: "118/76", gluc: 90, chol: 188, uric: 5.4, empIdx: 1 },
    { date: "2026-03-21", type: "Special Exam", companyId: 3, locId: 3, shift: "Malam", h: 1.76, w: 86, bp: "128/84", gluc: 118, chol: 205, uric: 6.8, empIdx: 0 },
    { date: "2026-03-29", type: "Daily / Periodic Exam", companyId: 2, locId: 2, shift: "Siang", h: 1.64, w: 60, bp: "116/74", gluc: 89, chol: 180, uric: 4.8, empIdx: 3 },
    { date: "2026-04-02", type: "Workplace Accident", companyId: 1, locId: 1, shift: "Malam", h: 1.73, w: 108, bp: "144/92", gluc: 148, chol: 262, uric: 8.4, empIdx: 2 },
    { date: "2026-04-07", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.66, w: 63, bp: "120/78", gluc: 95, chol: 192, uric: 5.7, empIdx: 1 },
    { date: "2026-04-12", type: "Clinic Visit", companyId: 3, locId: 3, shift: "Malam", h: 1.75, w: 82, bp: "124/80", gluc: 97, chol: 196, uric: 6.4, empIdx: 0 },
    { date: "2026-04-18", type: "Special Exam", companyId: 2, locId: 2, shift: "Siang", h: 1.63, w: 59, bp: "118/76", gluc: 91, chol: 184, uric: 5, empIdx: 3 },
    { date: "2026-04-24", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Malam", h: 1.71, w: 79, bp: "128/82", gluc: 108, chol: 218, uric: 6.9, empIdx: 2 },
    { date: "2026-04-29", type: "Daily / Periodic Exam", companyId: 3, locId: 3, shift: "Malam", h: 1.78, w: 72, bp: "120/78", gluc: 93, chol: 189, uric: 5.6, empIdx: 0 },
    { date: "2026-05-04", type: "Workplace Accident", companyId: 1, locId: 1, shift: "Malam", h: 1.72, w: 76, bp: "124/80", gluc: 96, chol: 190, uric: 6.2, empIdx: 2 },
    { date: "2026-05-09", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.65, w: 61, bp: "114/74", gluc: 86, chol: 172, uric: 4.7, empIdx: 1 },
    { date: "2026-05-14", type: "Special Exam", companyId: 2, locId: 2, shift: "Siang", h: 1.67, w: 89, bp: "136/86", gluc: 122, chol: 245, uric: 7.6, empIdx: 3 },
    { date: "2026-05-20", type: "Clinic Visit", companyId: 3, locId: 3, shift: "Malam", h: 1.75, w: 74, bp: "122/78", gluc: 94, chol: 194, uric: 6, empIdx: 0 },
    { date: "2026-05-26", type: "Daily / Periodic Exam", companyId: 1, locId: 1, shift: "Pagi", h: 1.69, w: 65, bp: "118/76", gluc: 89, chol: 178, uric: 5.2, empIdx: 1 }
  ];
  const medicalExams = examBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId);
    const loc = locations.find((l) => l.id === bp.locId);
    const bmi = calculateBmi(bp.w, bp.h);
    const bmiCategory = classifyBmi(bmi, DEFAULT_CLINICAL_RANGES);
    const glucoseCategory = classifyBloodGlucose(bp.gluc, DEFAULT_CLINICAL_RANGES);
    const cholesterolCategory = classifyCholesterol(bp.chol, DEFAULT_CLINICAL_RANGES);
    const uricAcidCategory = classifyUricAcid(bp.uric, DEFAULT_CLINICAL_RANGES);
    const medicalStatus = deriveMedicalStatus({
      bmiCategory,
      glucoseCategory,
      cholesterolCategory,
      uricAcidCategory
    });
    return {
      id: idx + 1,
      examCode: `ME-2026-${String(idx + 1).padStart(3, "0")}`,
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
      recommendations: medicalStatus === "Fit" ? "Maintain regular exercise and hydration" : "Schedule nutritional & metabolic follow-up within 14 days",
      medicalOfficer: "Dr. Nadia Kusuma",
      createdAt: `${bp.date}T09:00:00Z`
    };
  });
  const incidentBlueprints = [
    { date: "2026-02-04", time: "22:15:00", companyId: 1, locId: 1, shift: "Malam", cat: "Medical Treatment Case (MTC)", wr: "Work-Related", sev: "High", part: "Hands", status: "Closed", desc: "Pinch-point laceration on right hand while tightening conveyor flange.", empIdx: 2 },
    { date: "2026-02-12", time: "09:30:00", companyId: 1, locId: 1, shift: "Pagi", cat: "First Aid Case (FAC)", wr: "Work-Related", sev: "Low", part: "Fingers", status: "Closed", desc: "Minor abrasion on index finger during tool calibration.", empIdx: 1 },
    { date: "2026-02-20", time: "14:40:00", companyId: 3, locId: 3, shift: "Malam", cat: "Near Miss", wr: "Work-Related", sev: "Medium", part: "None", status: "Closed", desc: "Unsecured pallet shifted near loading dock walkway.", empIdx: 0 },
    { date: "2026-03-02", time: "23:10:00", companyId: 1, locId: 1, shift: "Malam", cat: "Lost Time Injury (LTI)", wr: "Work-Related", sev: "Critical", part: "Back", status: "Waiting Verification", desc: "Acute lumbar strain while lifting hydraulic actuator without hoist.", empIdx: 2 },
    { date: "2026-03-07", time: "10:20:00", companyId: 2, locId: 2, shift: "Siang", cat: "First Aid Case (FAC)", wr: "Work-Related", sev: "Low", part: "Eyes", status: "Closed", desc: "Dust particle irritation in left eye during filter inspection.", empIdx: 3 },
    { date: "2026-03-11", time: "16:05:00", companyId: 1, locId: 1, shift: "Pagi", cat: "Medical Treatment Case (MTC)", wr: "Non-Work-Related", sev: "Medium", part: "Legs", status: "CAPA In Progress", desc: "Slip on wet parking apron outside gate after shift handover.", empIdx: 1 },
    { date: "2026-03-17", time: "21:45:00", companyId: 3, locId: 3, shift: "Malam", cat: "Restricted Work Case (RWC)", wr: "Work-Related", sev: "Medium", part: "Shoulder", status: "CAPA In Progress", desc: "Right rotator cuff strain pulling dock leveler chain.", empIdx: 0 },
    { date: "2026-03-22", time: "11:00:00", companyId: 1, locId: 1, shift: "Pagi", cat: "First Aid Case (FAC)", wr: "Work-Related", sev: "Low", part: "Arms", status: "Closed", desc: "Superficial thermal contact on forearm near steam trace line.", empIdx: 1 },
    { date: "2026-03-28", time: "01:30:00", companyId: 1, locId: 1, shift: "Malam", cat: "Property Damage", wr: "Work-Related", sev: "Medium", part: "None", status: "Under Investigation", desc: "Forklift mast clipped warehouse bay bollard during night shift.", empIdx: 2 },
    { date: "2026-04-03", time: "22:50:00", companyId: 1, locId: 1, shift: "Malam", cat: "Medical Treatment Case (MTC)", wr: "Work-Related", sev: "High", part: "Hands", status: "Waiting Verification", desc: "Hydraulic oil spray burn on palm due to loose quick-coupler.", empIdx: 2 },
    { date: "2026-04-08", time: "08:15:00", companyId: 2, locId: 2, shift: "Siang", cat: "First Aid Case (FAC)", wr: "Non-Work-Related", sev: "Low", part: "Feet", status: "Closed", desc: "Twisted ankle descending administrative stairwell.", empIdx: 3 },
    { date: "2026-04-14", time: "13:20:00", companyId: 3, locId: 3, shift: "Malam", cat: "Medical Treatment Case (MTC)", wr: "Work-Related", sev: "Medium", part: "Face", status: "CAPA In Progress", desc: "Struck on cheek by rebounding bungee strap on cargo tarpaulin.", empIdx: 0 },
    { date: "2026-04-19", time: "20:10:00", companyId: 1, locId: 1, shift: "Malam", cat: "Near Miss", wr: "Work-Related", sev: "High", part: "Head", status: "Under Investigation", desc: "Torque wrench dropped from upper catwalk grating; missed spotter.", empIdx: 2 },
    { date: "2026-04-24", time: "07:45:00", companyId: 1, locId: 1, shift: "Pagi", cat: "First Aid Case (FAC)", wr: "Work-Related", sev: "Low", part: "Hands", status: "Closed", desc: "Small blister and nick while stripping sensor conduit.", empIdx: 1 },
    { date: "2026-04-28", time: "15:35:00", companyId: 2, locId: 2, shift: "Siang", cat: "Restricted Work Case (RWC)", wr: "Non-Work-Related", sev: "Medium", part: "Neck", status: "Open", desc: "Cervical muscle spasm reported following commuter braking incident.", empIdx: 3 },
    { date: "2026-05-03", time: "22:05:00", companyId: 1, locId: 1, shift: "Malam", cat: "Medical Treatment Case (MTC)", wr: "Work-Related", sev: "High", part: "Legs", status: "Open", desc: "Bruised shin striking unguarded pump skid frame in dim aisle.", empIdx: 2 },
    { date: "2026-05-09", time: "09:50:00", companyId: 1, locId: 1, shift: "Pagi", cat: "First Aid Case (FAC)", wr: "Work-Related", sev: "Low", part: "Fingers", status: "Under Investigation", desc: "Minor pinch on ring finger closing switchgear cabinet door.", empIdx: 1 },
    { date: "2026-05-15", time: "14:15:00", companyId: 3, locId: 3, shift: "Malam", cat: "Near Miss", wr: "Work-Related", sev: "Medium", part: "None", status: "Open", desc: "Temporary wheel chock dislodged on sloped bay ramp.", empIdx: 0 },
    { date: "2026-05-20", time: "23:40:00", companyId: 1, locId: 1, shift: "Malam", cat: "First Aid Case (FAC)", wr: "Non-Work-Related", sev: "Low", part: "Back", status: "Open", desc: "Mild back soreness reported prior to shift start.", empIdx: 2 },
    { date: "2026-05-26", time: "11:25:00", companyId: 2, locId: 2, shift: "Siang", cat: "Medical Treatment Case (MTC)", wr: "Work-Related", sev: "High", part: "Eyes", status: "Open", desc: "Chemical mist exposure during sample valve purge without face shield.", empIdx: 3 }
  ];
  const incidents = incidentBlueprints.map((bp, idx) => {
    const emp = employees[bp.empIdx];
    const comp = companies.find((c) => c.id === bp.companyId);
    const loc = locations.find((l) => l.id === bp.locId);
    return {
      id: idx + 1,
      incidentCode: `INC-2026-${String(idx + 1).padStart(3, "0")}`,
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
      injuryDescription: bp.part === "None" ? "No personnel injury" : `Affected ${bp.part.toLowerCase()} requiring clinical assessment`,
      affectedBodyPart: bp.part,
      injuryType: bp.part === "None" ? "None" : bp.cat,
      immediateActions: "Area secured, first-aid/medical evaluation initiated, supervisor notified.",
      witnessInfo: "Shift Supervisor & Area Operator",
      status: bp.status,
      closedAt: bp.status === "Closed" ? `${bp.date}T18:00:00Z` : null,
      closedByName: bp.status === "Closed" ? "Hendra Wijaya" : null,
      evidence: [],
      createdAt: `${bp.date}T${bp.time}Z`
    };
  });
  const investigations = [
    {
      id: 1,
      investigationCode: "INV-2026-004",
      incidentId: 4,
      investigationDate: "2026-03-03",
      investigationLeader: "Rendra Pratama",
      investigationTeam: "Rendra Pratama, Maintenance Lead, Shift Supervisor",
      witnessStatements: "Area operator stated portable jib hoist was tagged out at another bay.",
      incidentChronology: "23:00 Valve actuator removal began; 23:08 manual lift attempted; 23:10 acute lumbar pain reported.",
      unsafeAct: "Manual lifting of >35kg actuator without mechanical lifting aid",
      unsafeCondition: "Only one portable jib hoist available for two maintenance bays",
      immediateCause: "Excessive manual load exceeding ergonomic lifting threshold",
      contributingFactors: "Night shift time pressure and lack of lifting gear availability check in PTW",
      updatedAt: "2026-03-04T10:00:00Z"
    },
    {
      id: 2,
      investigationCode: "INV-2026-010",
      incidentId: 10,
      investigationDate: "2026-04-04",
      investigationLeader: "Rendra Pratama",
      investigationTeam: "Rendra Pratama, Hydraulic Specialist",
      witnessStatements: "Coupler locking sleeve did not click fully prior to pump test.",
      incidentChronology: "22:40 Hose connected; 22:48 hydraulic pump energized; 22:50 spray hit operator palm.",
      unsafeAct: "Pressurized system prior to verifying mechanical lock engagement",
      unsafeCondition: "Worn quick-coupler retaining ball detent",
      immediateCause: "High-pressure hydraulic oil mist release",
      contributingFactors: "Missing pre-use coupler inspection checklist and worn leather gloves",
      updatedAt: "2026-04-05T09:00:00Z"
    }
  ];
  const fiveWhys = [
    {
      id: 1,
      incidentId: 4,
      why1: "Technician sustained lumbar strain lifting a 38 kg actuator manually.",
      why2: "Portable lifting hoist was not used during actuator removal.",
      why3: "The shared hoist was occupied in Bay 1 and no spare lifting gantry was staged.",
      why4: "Pre-task Permit-to-Work did not verify mechanical lifting gear availability.",
      why5: "Maintenance SOP lacked a mandatory hoist sign-off gate for loads >20 kg.",
      finalRootCause: "Absence of mandatory ergonomic lifting-aid verification gate in Permit-to-Work and insufficient hoist allocation.",
      updatedAt: "2026-03-04T11:00:00Z"
    },
    {
      id: 2,
      incidentId: 10,
      why1: "Operator sustained hydraulic oil burn on right palm.",
      why2: "Quick-coupler detached under 180 bar test pressure.",
      why3: "Coupler ball detent failed to lock the collar securely.",
      why4: "Coupler wear was undetected during routine shift changeover.",
      why5: "Hydraulic hoses and couplers were excluded from quarterly PM wear-gauge checks.",
      finalRootCause: "Exclusion of hydraulic quick-couplers from preventive wear-gauge inspection schedule.",
      updatedAt: "2026-04-05T10:00:00Z"
    }
  ];
  const fishboneCauses = [
    { id: 1, incidentId: 4, category: "Man", causeText: "Manual lift attempted under night-shift deadline", subCauseText: "Fatigue factor at 23:10", isPrimaryRoot: false, createdAt: "2026-03-04T11:00:00Z" },
    { id: 2, incidentId: 4, category: "Machine", causeText: "Single portable jib hoist shared across 3 bays", subCauseText: "Hoist unavailable in Bay 2", isPrimaryRoot: true, createdAt: "2026-03-04T11:00:00Z" },
    { id: 3, incidentId: 4, category: "Method", causeText: "PTW lacks mandatory >20kg mechanical lift gate", subCauseText: "No ergonomic stop-work trigger", isPrimaryRoot: true, createdAt: "2026-03-04T11:00:00Z" },
    { id: 4, incidentId: 4, category: "Material", causeText: "Heavy 38 kg actuator assembly without grab handles", subCauseText: "", isPrimaryRoot: false, createdAt: "2026-03-04T11:00:00Z" },
    { id: 5, incidentId: 4, category: "Measurement", causeText: "Load weight markings missing on spare actuators", subCauseText: "", isPrimaryRoot: false, createdAt: "2026-03-04T11:00:00Z" },
    { id: 6, incidentId: 4, category: "Environment", causeText: "Narrow clearance around manifold skid", subCauseText: "Restricted posture", isPrimaryRoot: false, createdAt: "2026-03-04T11:00:00Z" }
  ];
  const capas = [
    {
      id: 1,
      capaCode: "CAPA-2026-001",
      incidentId: 4,
      incidentCode: "INC-2026-004",
      rootCause: fiveWhys[0].finalRootCause,
      actionDescription: "Procure dedicated 500kg mobile gantry hoist for Bay 2 and add load-weight stencil.",
      actionType: "Corrective Action",
      responsiblePic: "Bambang Sutrisno",
      departmentName: "Mechanical Maintenance",
      priority: "Critical",
      startDate: "2026-03-05",
      dueDate: "2026-03-25",
      completionDate: "2026-03-22",
      actionStatus: "Verified",
      effectiveStatus: "Verified",
      completionNotes: "Gantry commissioned and inspected by HSE.",
      evidence: [],
      createdAt: "2026-03-05T08:00:00Z"
    },
    {
      id: 2,
      capaCode: "CAPA-2026-002",
      incidentId: 4,
      incidentCode: "INC-2026-004",
      rootCause: fiveWhys[0].finalRootCause,
      actionDescription: "Update Permit-to-Work template to mandate mechanical lifting verification for >20kg parts.",
      actionType: "Preventive Action",
      responsiblePic: "Rendra Pratama",
      departmentName: "Plant Operations",
      priority: "High",
      startDate: "2026-03-05",
      dueDate: "2026-12-01",
      completionDate: "2026-03-19",
      actionStatus: "Waiting Verification",
      effectiveStatus: "Waiting Verification",
      completionNotes: "Revised PTW Form v4.2 deployed to control room; awaiting management sign-off.",
      evidence: [],
      createdAt: "2026-03-05T08:15:00Z"
    },
    {
      id: 3,
      capaCode: "CAPA-2026-003",
      incidentId: 10,
      incidentCode: "INC-2026-010",
      rootCause: fiveWhys[1].finalRootCause,
      actionDescription: "Replace all quick-couplers in Test Bench A with locking safety-collar couplings.",
      actionType: "Corrective Action",
      responsiblePic: "Agus Firmansyah",
      departmentName: "Mechanical Maintenance",
      priority: "High",
      startDate: "2026-04-06",
      dueDate: "2026-04-20",
      completionDate: "2026-04-18",
      actionStatus: "Waiting Verification",
      effectiveStatus: "Waiting Verification",
      completionNotes: "All 12 couplers replaced; pressure test log attached.",
      evidence: [],
      createdAt: "2026-04-06T09:00:00Z"
    },
    {
      id: 4,
      capaCode: "CAPA-2026-004",
      incidentId: 7,
      incidentCode: "INC-2026-007",
      rootCause: "High pull-force resistance on manual dock leveler chain mechanism.",
      actionDescription: "Lubricate dock leveler torsion springs and install ergonomic pull-handle extension.",
      actionType: "Corrective Action",
      responsiblePic: "Budi Santoso",
      departmentName: "Fleet & Warehouse",
      priority: "Medium",
      startDate: "2026-03-20",
      dueDate: "2026-05-01",
      completionDate: null,
      actionStatus: "In Progress",
      effectiveStatus: "Overdue",
      completionNotes: "Spring kit ordered; awaiting weekend dock shutdown.",
      evidence: [],
      createdAt: "2026-03-20T10:00:00Z"
    }
  ];
  const verifications = [
    {
      id: 1,
      entityType: "CAPA",
      capaId: 1,
      incidentId: 4,
      decision: "APPROVED",
      remarks: "Verified Bay 2 gantry commissioning certificate and weight stencils on site.",
      verifiedByName: "Hendra Wijaya",
      verifiedByRole: "MANAGEMENT",
      verifiedAt: "2026-03-24T15:00:00Z"
    }
  ];
  const auditLogs = [
    {
      id: 1,
      userEmail: "hse@ohsexpert.io",
      userRole: "HSE_OFFICER",
      action: "SAVE_INVESTIGATION",
      entityType: "INCIDENT",
      entityId: "INC-2026-004",
      summary: "Completed investigation details, Five Whys, and 6M Fishbone analysis for INC-2026-004.",
      createdAt: "2026-03-04T11:05:00Z"
    },
    {
      id: 2,
      userEmail: "management@ohsexpert.io",
      userRole: "MANAGEMENT",
      action: "VERIFY_CAPA",
      entityType: "CAPA",
      entityId: "CAPA-2026-001",
      summary: "Approved CAPA-2026-001 after inspecting Bay 2 mobile gantry installation.",
      createdAt: "2026-03-24T15:00:00Z"
    }
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
    auditLogs
  };
}

// server/db/demoStore.ts
var DEMO_DB_PATH = path2.resolve(process.cwd(), "server/data/demo-db.json");
var DemoStoreRepository = class {
  constructor() {
    this.state = this.loadState();
  }
  getMode() {
    return "DEMO_STORE";
  }
  loadState() {
    try {
      if (fs.existsSync(DEMO_DB_PATH)) {
        const raw = fs.readFileSync(DEMO_DB_PATH, "utf-8");
        return JSON.parse(raw);
      }
    } catch {
    }
    const seed = createInitialSeedState();
    this.saveState(seed);
    return seed;
  }
  saveState(stateToSave = this.state) {
    fs.mkdirSync(path2.dirname(DEMO_DB_PATH), { recursive: true });
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(stateToSave, null, 2), "utf-8");
  }
  nextId() {
    this.state.nextId += 1;
    return this.state.nextId;
  }
  companyName(companyId) {
    return this.state.companies.find((c) => c.id === companyId)?.name ?? "Unknown Company";
  }
  locationName(locationId) {
    return this.state.locations.find((l) => l.id === locationId)?.name ?? "Unknown Location";
  }
  attachEvidenceToIncident(inc) {
    return {
      ...inc,
      evidence: this.state.evidenceFiles.filter(
        (e) => e.entityType === "INCIDENT" && e.entityId === inc.id
      )
    };
  }
  enrichCapa(capa) {
    const inc = this.state.incidents.find((i) => i.id === capa.incidentId);
    return {
      ...capa,
      incidentCode: inc?.incidentCode ?? `INC-${capa.incidentId}`,
      effectiveStatus: computeCapaEffectiveStatus(capa),
      evidence: this.state.evidenceFiles.filter(
        (e) => e.entityType === "CAPA" && e.entityId === capa.id
      )
    };
  }
  async findUserByEmail(email) {
    return this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  async findUserById(id) {
    return this.state.users.find((u) => u.id === id) ?? null;
  }
  async listUsers() {
    return this.state.users.map(({ passwordHash: _ph, ...u }) => u);
  }
  async createUser(input) {
    const user = {
      id: this.nextId(),
      userCode: input.userCode,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      departmentName: input.departmentName,
      isActive: true
    };
    this.state.users.push(user);
    this.saveState();
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }
  async updateUserStatus(id, isActive, role) {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) return null;
    user.isActive = isActive;
    if (role) user.role = role;
    this.saveState();
    const { passwordHash: _ph, ...safe } = user;
    return safe;
  }
  async touchUserLogin(_id) {
  }
  async getMasterData() {
    return {
      companies: [...this.state.companies],
      departments: [...this.state.departments],
      locations: [...this.state.locations],
      employees: [...this.state.employees],
      clinicalRanges: { ...this.state.clinicalRanges }
    };
  }
  async createCompany(input) {
    const company = { id: this.nextId(), ...input };
    this.state.companies.push(company);
    this.saveState();
    return company;
  }
  async createDepartment(input) {
    const dept = { id: this.nextId(), ...input };
    this.state.departments.push(dept);
    this.saveState();
    return dept;
  }
  async createLocation(input) {
    const loc = { id: this.nextId(), ...input };
    this.state.locations.push(loc);
    this.saveState();
    return loc;
  }
  async createEmployee(input) {
    const dept = this.state.departments.find((d) => d.id === input.departmentId);
    const emp = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      departmentName: dept?.name ?? "Operations",
      locationName: this.locationName(input.locationId)
    };
    this.state.employees.push(emp);
    this.saveState();
    return emp;
  }
  async updateClinicalRanges(ranges, _userId) {
    this.state.clinicalRanges = { ...ranges };
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
        uricAcidCategory: exam.uricAcidCategory
      });
    }
    this.saveState();
    return { ...this.state.clinicalRanges };
  }
  async listClinicVisits() {
    return [...this.state.clinicVisits].sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }
  async createClinicVisit(input, _userId) {
    const created = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.clinicVisits.unshift(created);
    this.saveState();
    return created;
  }
  async updateClinicVisit(id, input) {
    const idx = this.state.clinicVisits.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    const updated = {
      ...this.state.clinicVisits[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId)
    };
    this.state.clinicVisits[idx] = updated;
    this.saveState();
    return updated;
  }
  async deleteClinicVisit(id) {
    const before = this.state.clinicVisits.length;
    this.state.clinicVisits = this.state.clinicVisits.filter((v) => v.id !== id);
    if (this.state.clinicVisits.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }
  async listMedicalExams() {
    return [...this.state.medicalExams].sort((a, b) => b.examDate.localeCompare(a.examDate));
  }
  async createMedicalExam(input, _userId) {
    const created = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.medicalExams.unshift(created);
    this.saveState();
    return created;
  }
  async updateMedicalExam(id, input) {
    const idx = this.state.medicalExams.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const updated = {
      ...this.state.medicalExams[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId)
    };
    this.state.medicalExams[idx] = updated;
    this.saveState();
    return updated;
  }
  async deleteMedicalExam(id) {
    const before = this.state.medicalExams.length;
    this.state.medicalExams = this.state.medicalExams.filter((e) => e.id !== id);
    if (this.state.medicalExams.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }
  async listIncidents() {
    return [...this.state.incidents].sort((a, b) => b.incidentDate.localeCompare(a.incidentDate)).map((inc) => this.attachEvidenceToIncident(inc));
  }
  async getIncidentById(id) {
    const inc = this.state.incidents.find((i) => i.id === id);
    return inc ? this.attachEvidenceToIncident(inc) : null;
  }
  async getIncidentDetail(id) {
    const inc = await this.getIncidentById(id);
    if (!inc) return null;
    return {
      incident: inc,
      investigation: this.state.investigations.find((inv) => inv.incidentId === id) ?? null,
      fiveWhys: this.state.fiveWhys.find((fw) => fw.incidentId === id) ?? null,
      fishboneCauses: this.state.fishboneCauses.filter((fc) => fc.incidentId === id),
      capas: this.state.capas.filter((c) => c.incidentId === id).map((c) => this.enrichCapa(c)),
      verifications: this.state.verifications.filter((v) => v.incidentId === id)
    };
  }
  async createIncident(input, _userId) {
    const created = {
      ...input,
      id: this.nextId(),
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId),
      status: "Open",
      closedAt: null,
      closedByName: null,
      evidence: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.incidents.unshift(created);
    this.saveState();
    return created;
  }
  async updateIncident(id, input) {
    const idx = this.state.incidents.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const updated = {
      ...this.state.incidents[idx],
      ...input,
      companyName: this.companyName(input.companyId),
      locationName: this.locationName(input.locationId)
    };
    this.state.incidents[idx] = updated;
    this.saveState();
    return this.attachEvidenceToIncident(updated);
  }
  async deleteIncident(id) {
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
  async addIncidentEvidence(incidentId, file) {
    const created = {
      ...file,
      id: this.nextId(),
      entityType: "INCIDENT",
      entityId: incidentId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.evidenceFiles.push(created);
    this.saveState();
    return created;
  }
  async listInvestigations() {
    return [...this.state.investigations];
  }
  async upsertInvestigation(incidentId, input, _userId) {
    const idx = this.state.investigations.findIndex((inv) => inv.incidentId === incidentId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let result;
    if (idx === -1) {
      result = { id: this.nextId(), incidentId, ...input, updatedAt: now };
      this.state.investigations.push(result);
    } else {
      result = { ...this.state.investigations[idx], ...input, updatedAt: now };
      this.state.investigations[idx] = result;
    }
    const inc = this.state.incidents.find((i) => i.id === incidentId);
    if (inc && inc.status === "Open") {
      inc.status = "Under Investigation";
    }
    this.saveState();
    return result;
  }
  async upsertFiveWhys(incidentId, input, _userId) {
    const idx = this.state.fiveWhys.findIndex((fw) => fw.incidentId === incidentId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let result;
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
  async addFishboneCause(incidentId, input, _userId) {
    const created = {
      ...input,
      id: this.nextId(),
      incidentId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.fishboneCauses.push(created);
    this.saveState();
    return created;
  }
  async updateFishboneCause(causeId, input) {
    const idx = this.state.fishboneCauses.findIndex((c) => c.id === causeId);
    if (idx === -1) return null;
    this.state.fishboneCauses[idx] = { ...this.state.fishboneCauses[idx], ...input };
    this.saveState();
    return this.state.fishboneCauses[idx];
  }
  async deleteFishboneCause(causeId) {
    const before = this.state.fishboneCauses.length;
    this.state.fishboneCauses = this.state.fishboneCauses.filter((c) => c.id !== causeId);
    if (this.state.fishboneCauses.length !== before) {
      this.saveState();
      return true;
    }
    return false;
  }
  async listCapas() {
    return [...this.state.capas].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((c) => this.enrichCapa(c));
  }
  async getCapaById(id) {
    const c = this.state.capas.find((item) => item.id === id);
    return c ? this.enrichCapa(c) : null;
  }
  async createCapa(input, _userId) {
    const created = {
      ...input,
      id: this.nextId(),
      effectiveStatus: computeCapaEffectiveStatus(input),
      evidence: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.capas.unshift(created);
    const inc = this.state.incidents.find((i) => i.id === input.incidentId);
    if (inc && (inc.status === "Open" || inc.status === "Under Investigation")) {
      inc.status = "CAPA In Progress";
    }
    this.saveState();
    return this.enrichCapa(created);
  }
  async updateCapa(id, input) {
    const idx = this.state.capas.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const updated = {
      ...this.state.capas[idx],
      ...input
    };
    this.state.capas[idx] = updated;
    this.syncIncidentStatusFromCapas(updated.incidentId);
    this.saveState();
    return this.enrichCapa(updated);
  }
  async deleteCapa(id) {
    const existing = this.state.capas.find((c) => c.id === id);
    if (!existing) return false;
    this.state.capas = this.state.capas.filter((c) => c.id !== id);
    this.syncIncidentStatusFromCapas(existing.incidentId);
    this.saveState();
    return true;
  }
  async addCapaEvidence(capaId, file) {
    const created = {
      ...file,
      id: this.nextId(),
      entityType: "CAPA",
      entityId: capaId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.evidenceFiles.push(created);
    this.saveState();
    return created;
  }
  syncIncidentStatusFromCapas(incidentId) {
    const inc = this.state.incidents.find((i) => i.id === incidentId);
    if (!inc || inc.status === "Closed") return;
    const incCapas = this.state.capas.filter((c) => c.incidentId === incidentId);
    if (incCapas.length === 0) return;
    if (incCapas.every((c) => c.actionStatus === "Waiting Verification" || c.actionStatus === "Verified")) {
      inc.status = "Waiting Verification";
    } else {
      inc.status = "CAPA In Progress";
    }
  }
  async verifyCapa(params) {
    const capa = this.state.capas.find((c) => c.id === params.capaId);
    if (!capa) return null;
    if (params.decision === "APPROVED") {
      capa.actionStatus = "Verified";
      if (!capa.completionDate) {
        capa.completionDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      }
    } else {
      capa.actionStatus = "Rejected / Reopened";
    }
    this.state.verifications.unshift({
      id: this.nextId(),
      entityType: "CAPA",
      capaId: capa.id,
      incidentId: capa.incidentId,
      decision: params.decision,
      remarks: params.remarks,
      verifiedByName: params.user.fullName,
      verifiedByRole: params.user.role,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.syncIncidentStatusFromCapas(capa.incidentId);
    this.saveState();
    return this.enrichCapa(capa);
  }
  async closeIncident(params) {
    const inc = this.state.incidents.find((i) => i.id === params.incidentId);
    if (!inc) return null;
    inc.status = "Closed";
    inc.closedAt = (/* @__PURE__ */ new Date()).toISOString();
    inc.closedByName = params.user.fullName;
    this.state.verifications.unshift({
      id: this.nextId(),
      entityType: "INCIDENT_CLOSURE",
      capaId: null,
      incidentId: inc.id,
      decision: "APPROVED",
      remarks: params.remarks,
      verifiedByName: params.user.fullName,
      verifiedByRole: params.user.role,
      verifiedAt: inc.closedAt
    });
    this.saveState();
    return this.attachEvidenceToIncident(inc);
  }
  async listAuditLogs(limit = 100) {
    return this.state.auditLogs.slice(0, limit);
  }
  async appendAuditLog(entry) {
    this.state.auditLogs.unshift({
      ...entry,
      id: this.nextId(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.saveState();
  }
};

// server/db/mysql.ts
import mysql from "mysql2/promise";
var pool = null;
function isMysqlConfigured() {
  return Boolean(env.dbHost.trim() || env.cloudSqlConnectionName.trim());
}
function getMysqlPool() {
  if (pool) return pool;
  const baseConfig = {
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: env.dbConnectionLimit,
    queueLimit: 0,
    dateStrings: true
  };
  if (env.cloudSqlConnectionName.trim()) {
    baseConfig.socketPath = `/cloudsql/${env.cloudSqlConnectionName.trim()}`;
  } else {
    baseConfig.host = env.dbHost;
    baseConfig.port = env.dbPort;
    if (env.dbSsl) {
      baseConfig.ssl = { rejectUnauthorized: false };
    }
  }
  pool = mysql.createPool(baseConfig);
  return pool;
}
async function testMysqlConnection() {
  if (!isMysqlConfigured()) {
    return { ok: false, error: "DB_HOST / CLOUD_SQL_CONNECTION_NAME not configured" };
  }
  try {
    const p = getMysqlPool();
    await p.query("SELECT 1 AS ok");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown MySQL error" };
  }
}

// server/db/mysqlRepository.ts
var MysqlRepository = class {
  constructor() {
    this.pool = getMysqlPool();
  }
  getMode() {
    return "MYSQL";
  }
  async findUserByEmail(email) {
    const [rows] = await this.pool.query(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, password_hash AS passwordHash,
              role, COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
      [email]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...r, isActive: Boolean(r.isActive) };
  }
  async findUserById(id) {
    const [rows] = await this.pool.query(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, password_hash AS passwordHash,
              role, COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { ...r, isActive: Boolean(r.isActive) };
  }
  async listUsers() {
    const [rows] = await this.pool.query(
      `SELECT id, user_code AS userCode, full_name AS fullName, email, role,
              COALESCE(department_name, '') AS departmentName, is_active AS isActive
       FROM users ORDER BY id ASC`
    );
    return rows.map((r) => ({ ...r, isActive: Boolean(r.isActive) }));
  }
  async createUser(input) {
    const [res] = await this.pool.query(
      `INSERT INTO users (user_code, full_name, email, password_hash, role, department_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.userCode, input.fullName, input.email.toLowerCase(), input.passwordHash, input.role, input.departmentName]
    );
    return {
      id: res.insertId,
      userCode: input.userCode,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      role: input.role,
      departmentName: input.departmentName,
      isActive: true
    };
  }
  async updateUserStatus(id, isActive, role) {
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
  async touchUserLogin(id) {
    await this.pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [id]);
  }
  async getMasterData() {
    const [compRows] = await this.pool.query(
      `SELECT id, company_code AS companyCode, name, COALESCE(industry, '') AS industry FROM companies WHERE is_active = 1 ORDER BY name`
    );
    const [deptRows] = await this.pool.query(
      `SELECT id, company_id AS companyId, department_code AS departmentCode, name FROM departments ORDER BY name`
    );
    const [locRows] = await this.pool.query(
      `SELECT id, company_id AS companyId, location_code AS locationCode, name, COALESCE(site_area, '') AS siteArea FROM locations ORDER BY name`
    );
    const [empRows] = await this.pool.query(
      `SELECT e.id, e.employee_code AS employeeCode, e.full_name AS fullName, e.company_id AS companyId,
              c.name AS companyName, COALESCE(e.department_id, 0) AS departmentId,
              COALESCE(d.name, 'Operations') AS departmentName, COALESCE(e.location_id, 0) AS locationId,
              COALESCE(l.name, 'Main Site') AS locationName, e.job_position AS jobPosition, e.shift
       FROM employees e
       JOIN companies c ON c.id = e.company_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN locations l ON l.id = e.location_id
       WHERE e.is_active = 1 ORDER BY e.full_name`
    );
    const [rangeRows] = await this.pool.query(
      `SELECT bmi_underweight_max AS bmiUnderweightMax, bmi_normal_max AS bmiNormalMax,
              bmi_overweight_max AS bmiOverweightMax, bmi_obesity1_max AS bmiObesity1Max,
              glucose_normal_max AS glucoseNormalMax, glucose_prediabetes_max AS glucosePrediabetesMax,
              cholesterol_normal_max AS cholesterolNormalMax, cholesterol_borderline_max AS cholesterolBorderlineMax,
              uric_acid_normal_max AS uricAcidNormalMax
       FROM clinical_reference_ranges WHERE config_key = 'DEFAULT' LIMIT 1`
    );
    const clinicalRanges = rangeRows.length ? {
      bmiUnderweightMax: Number(rangeRows[0].bmiUnderweightMax),
      bmiNormalMax: Number(rangeRows[0].bmiNormalMax),
      bmiOverweightMax: Number(rangeRows[0].bmiOverweightMax),
      bmiObesity1Max: Number(rangeRows[0].bmiObesity1Max),
      glucoseNormalMax: Number(rangeRows[0].glucoseNormalMax),
      glucosePrediabetesMax: Number(rangeRows[0].glucosePrediabetesMax),
      cholesterolNormalMax: Number(rangeRows[0].cholesterolNormalMax),
      cholesterolBorderlineMax: Number(rangeRows[0].cholesterolBorderlineMax),
      uricAcidNormalMax: Number(rangeRows[0].uricAcidNormalMax)
    } : { ...DEFAULT_CLINICAL_RANGES };
    return {
      companies: compRows,
      departments: deptRows,
      locations: locRows,
      employees: empRows,
      clinicalRanges
    };
  }
  async createCompany(input) {
    const [res] = await this.pool.query(
      `INSERT INTO companies (company_code, name, industry) VALUES (?, ?, ?)`,
      [input.companyCode, input.name, input.industry]
    );
    return { id: res.insertId, ...input };
  }
  async createDepartment(input) {
    const [res] = await this.pool.query(
      `INSERT INTO departments (company_id, department_code, name) VALUES (?, ?, ?)`,
      [input.companyId, input.departmentCode, input.name]
    );
    return { id: res.insertId, ...input };
  }
  async createLocation(input) {
    const [res] = await this.pool.query(
      `INSERT INTO locations (company_id, location_code, name, site_area) VALUES (?, ?, ?, ?)`,
      [input.companyId, input.locationCode, input.name, input.siteArea]
    );
    return { id: res.insertId, ...input };
  }
  async createEmployee(input) {
    const [res] = await this.pool.query(
      `INSERT INTO employees (employee_code, full_name, company_id, department_id, location_id, job_position, shift)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.employeeCode,
        input.fullName,
        input.companyId,
        input.departmentId || null,
        input.locationId || null,
        input.jobPosition,
        input.shift
      ]
    );
    const master = await this.getMasterData();
    return master.employees.find((e) => e.id === res.insertId);
  }
  async updateClinicalRanges(ranges, userId) {
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
        userId
      ]
    );
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
        uricAcidCategory: uricCat
      });
      await this.pool.query(
        `UPDATE medical_examinations
         SET bmi = ?, bmi_category = ?, glucose_category = ?, cholesterol_category = ?, uric_acid_category = ?, medical_status = ?
         WHERE id = ?`,
        [bmi, bmiCat, glucCat, cholCat, uricCat, status, exam.id]
      );
    }
    return ranges;
  }
  async listClinicVisits() {
    const [rows] = await this.pool.query(
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
       ORDER BY cv.visit_date DESC, cv.id DESC`
    );
    return rows;
  }
  async createClinicVisit(input, userId) {
    const [res] = await this.pool.query(
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
        input.notes || "",
        userId
      ]
    );
    const all = await this.listClinicVisits();
    return all.find((v) => v.id === res.insertId);
  }
  async updateClinicVisit(id, input) {
    const [res] = await this.pool.query(
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
        input.notes || "",
        id
      ]
    );
    if (res.affectedRows === 0) return null;
    const all = await this.listClinicVisits();
    return all.find((v) => v.id === id) ?? null;
  }
  async deleteClinicVisit(id) {
    const [res] = await this.pool.query(`DELETE FROM clinic_visits WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
  async listMedicalExams() {
    const [rows] = await this.pool.query(
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
       ORDER BY me.exam_date DESC, me.id DESC`
    );
    return rows.map((r) => ({
      ...r,
      heightM: Number(r.heightM),
      weightKg: Number(r.weightKg),
      bmi: Number(r.bmi),
      bloodGlucose: Number(r.bloodGlucose),
      totalCholesterol: Number(r.totalCholesterol),
      uricAcid: Number(r.uricAcid)
    }));
  }
  async createMedicalExam(input, userId) {
    const [res] = await this.pool.query(
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
        userId
      ]
    );
    const all = await this.listMedicalExams();
    return all.find((e) => e.id === res.insertId);
  }
  async updateMedicalExam(id, input) {
    const [res] = await this.pool.query(
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
        id
      ]
    );
    if (res.affectedRows === 0) return null;
    const all = await this.listMedicalExams();
    return all.find((e) => e.id === id) ?? null;
  }
  async deleteMedicalExam(id) {
    const [res] = await this.pool.query(`DELETE FROM medical_examinations WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
  async getIncidentEvidence(incidentId) {
    const [rows] = await this.pool.query(
      `SELECT ie.id, 'INCIDENT' AS entityType, ie.incident_id AS entityId, ie.evidence_type AS evidenceType,
              ie.original_filename AS originalFilename, ie.stored_filename AS storedFilename,
              ie.mime_type AS mimeType, ie.file_size_bytes AS fileSizeBytes,
              CONCAT('/api/evidence/file/', ie.stored_filename) AS url,
              COALESCE(u.full_name, 'System') AS uploadedByName, ie.uploaded_at AS uploadedAt
       FROM incident_evidence ie
       LEFT JOIN users u ON u.id = ie.uploaded_by
       WHERE ie.incident_id = ?
       ORDER BY ie.uploaded_at DESC`,
      [incidentId]
    );
    return rows;
  }
  async getCapaEvidence(capaId) {
    const [rows] = await this.pool.query(
      `SELECT ce.id, 'CAPA' AS entityType, ce.capa_id AS entityId, 'DOCUMENT' AS evidenceType,
              ce.original_filename AS originalFilename, ce.stored_filename AS storedFilename,
              ce.mime_type AS mimeType, ce.file_size_bytes AS fileSizeBytes,
              CONCAT('/api/evidence/file/', ce.stored_filename) AS url,
              COALESCE(u.full_name, 'System') AS uploadedByName, ce.uploaded_at AS uploadedAt
       FROM capa_evidence ce
       LEFT JOIN users u ON u.id = ce.uploaded_by
       WHERE ce.capa_id = ?
       ORDER BY ce.uploaded_at DESC`,
      [capaId]
    );
    return rows;
  }
  async listIncidents() {
    const [rows] = await this.pool.query(
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
       ORDER BY i.incident_date DESC, i.id DESC`
    );
    const results = [];
    for (const row of rows) {
      const [witRows] = await this.pool.query(
        `SELECT witness_name FROM incident_witnesses WHERE incident_id = ? LIMIT 1`,
        [row.id]
      );
      results.push({
        ...row,
        witnessInfo: witRows[0]?.witness_name ?? "",
        evidence: await this.getIncidentEvidence(row.id)
      });
    }
    return results;
  }
  async getIncidentById(id) {
    const all = await this.listIncidents();
    return all.find((i) => i.id === id) ?? null;
  }
  async getIncidentDetail(id) {
    const incident = await this.getIncidentById(id);
    if (!incident) return null;
    const [invRows] = await this.pool.query(
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
      [id]
    );
    const [fwRows] = await this.pool.query(
      `SELECT id, incident_id AS incidentId, why_1 AS why1, COALESCE(why_2, '') AS why2,
              COALESCE(why_3, '') AS why3, COALESCE(why_4, '') AS why4, COALESCE(why_5, '') AS why5,
              final_root_cause AS finalRootCause, updated_at AS updatedAt
       FROM five_whys WHERE incident_id = ? LIMIT 1`,
      [id]
    );
    const [fbRows] = await this.pool.query(
      `SELECT id, incident_id AS incidentId, category, cause_text AS causeText,
              COALESCE(sub_cause_text, '') AS subCauseText, is_primary_root AS isPrimaryRoot,
              created_at AS createdAt
       FROM fishbone_causes WHERE incident_id = ? ORDER BY id ASC`,
      [id]
    );
    const capas = (await this.listCapas()).filter((c) => c.incidentId === id);
    const [verRows] = await this.pool.query(
      `SELECT v.id, v.entity_type AS entityType, v.capa_id AS capaId, v.incident_id AS incidentId,
              v.decision, v.remarks, u.full_name AS verifiedByName, u.role AS verifiedByRole,
              v.verified_at AS verifiedAt
       FROM verifications v
       JOIN users u ON u.id = v.verified_by
       WHERE v.incident_id = ? ORDER BY v.verified_at DESC`,
      [id]
    );
    return {
      incident,
      investigation: invRows[0] ? invRows[0] : null,
      fiveWhys: fwRows[0] ? fwRows[0] : null,
      fishboneCauses: fbRows.map((r) => ({ ...r, isPrimaryRoot: Boolean(r.isPrimaryRoot) })),
      capas,
      verifications: verRows
    };
  }
  async createIncident(input, userId) {
    const [res] = await this.pool.query(
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
        userId
      ]
    );
    if (input.witnessInfo.trim()) {
      await this.pool.query(
        `INSERT INTO incident_witnesses (incident_id, witness_name) VALUES (?, ?)`,
        [res.insertId, input.witnessInfo.trim()]
      );
    }
    return await this.getIncidentById(res.insertId);
  }
  async updateIncident(id, input) {
    const [res] = await this.pool.query(
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
        id
      ]
    );
    if (res.affectedRows === 0) return null;
    return this.getIncidentById(id);
  }
  async deleteIncident(id) {
    const [res] = await this.pool.query(`DELETE FROM incidents WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
  async addIncidentEvidence(incidentId, file) {
    const [res] = await this.pool.query(
      `INSERT INTO incident_evidence (incident_id, evidence_type, original_filename, stored_filename, mime_type, file_size_bytes, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [incidentId, file.evidenceType, file.originalFilename, file.storedFilename, file.mimeType, file.fileSizeBytes, file.url]
    );
    return {
      ...file,
      id: res.insertId,
      entityType: "INCIDENT",
      entityId: incidentId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async listInvestigations() {
    const [rows] = await this.pool.query(
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
       FROM investigations`
    );
    return rows;
  }
  async upsertInvestigation(incidentId, input, userId) {
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
        userId
      ]
    );
    await this.pool.query(`UPDATE incidents SET status = 'Under Investigation' WHERE id = ? AND status = 'Open'`, [incidentId]);
    const list = await this.listInvestigations();
    return list.find((inv) => inv.incidentId === incidentId);
  }
  async upsertFiveWhys(incidentId, input, userId) {
    await this.pool.query(
      `INSERT INTO five_whys (incident_id, why_1, why_2, why_3, why_4, why_5, final_root_cause, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        why_1 = VALUES(why_1), why_2 = VALUES(why_2), why_3 = VALUES(why_3),
        why_4 = VALUES(why_4), why_5 = VALUES(why_5), final_root_cause = VALUES(final_root_cause),
        updated_by = VALUES(updated_by)`,
      [incidentId, input.why1, input.why2, input.why3, input.why4, input.why5, input.finalRootCause, userId]
    );
    const detail = await this.getIncidentDetail(incidentId);
    return detail.fiveWhys;
  }
  async addFishboneCause(incidentId, input, userId) {
    const [res] = await this.pool.query(
      `INSERT INTO fishbone_causes (incident_id, category, cause_text, sub_cause_text, is_primary_root, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [incidentId, input.category, input.causeText, input.subCauseText, input.isPrimaryRoot ? 1 : 0, userId]
    );
    return { id: res.insertId, incidentId, ...input, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  async updateFishboneCause(causeId, input) {
    const [existing] = await this.pool.query(`SELECT * FROM fishbone_causes WHERE id = ?`, [causeId]);
    if (!existing.length) return null;
    const row = existing[0];
    await this.pool.query(
      `UPDATE fishbone_causes SET category = ?, cause_text = ?, sub_cause_text = ?, is_primary_root = ? WHERE id = ?`,
      [
        input.category ?? row.category,
        input.causeText ?? row.cause_text,
        input.subCauseText ?? row.sub_cause_text,
        input.isPrimaryRoot !== void 0 ? input.isPrimaryRoot ? 1 : 0 : row.is_primary_root,
        causeId
      ]
    );
    return {
      id: causeId,
      incidentId: Number(row.incident_id),
      category: input.category ?? row.category,
      causeText: input.causeText ?? row.cause_text,
      subCauseText: input.subCauseText ?? row.sub_cause_text ?? "",
      isPrimaryRoot: input.isPrimaryRoot ?? Boolean(row.is_primary_root),
      createdAt: String(row.created_at)
    };
  }
  async deleteFishboneCause(causeId) {
    const [res] = await this.pool.query(`DELETE FROM fishbone_causes WHERE id = ?`, [causeId]);
    return res.affectedRows > 0;
  }
  async listCapas() {
    const [rows] = await this.pool.query(
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
       ORDER BY ca.due_date ASC`
    );
    const out = [];
    for (const r of rows) {
      const base = r;
      out.push({
        ...base,
        effectiveStatus: computeCapaEffectiveStatus(base),
        evidence: await this.getCapaEvidence(base.id)
      });
    }
    return out;
  }
  async getCapaById(id) {
    const all = await this.listCapas();
    return all.find((c) => c.id === id) ?? null;
  }
  async createCapa(input, userId) {
    const [res] = await this.pool.query(
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
        userId
      ]
    );
    await this.pool.query(
      `UPDATE incidents SET status = 'CAPA In Progress' WHERE id = ? AND status IN ('Open', 'Under Investigation')`,
      [input.incidentId]
    );
    return await this.getCapaById(res.insertId);
  }
  async updateCapa(id, input) {
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
        input.completionDate !== void 0 ? input.completionDate : existing.completionDate,
        input.actionStatus ?? existing.actionStatus,
        input.completionNotes ?? existing.completionNotes,
        id
      ]
    );
    return this.getCapaById(id);
  }
  async deleteCapa(id) {
    const [res] = await this.pool.query(`DELETE FROM capa_actions WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
  async addCapaEvidence(capaId, file) {
    const [res] = await this.pool.query(
      `INSERT INTO capa_evidence (capa_id, original_filename, stored_filename, mime_type, file_size_bytes, storage_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [capaId, file.originalFilename, file.storedFilename, file.mimeType, file.fileSizeBytes, file.url]
    );
    return {
      ...file,
      id: res.insertId,
      entityType: "CAPA",
      entityId: capaId,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async verifyCapa(params) {
    const capa = await this.getCapaById(params.capaId);
    if (!capa) return null;
    const nextStatus = params.decision === "APPROVED" ? "Verified" : "Rejected / Reopened";
    const completionDate = params.decision === "APPROVED" ? capa.completionDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) : capa.completionDate;
    await this.pool.query(
      `UPDATE capa_actions SET action_status = ?, completion_date = ? WHERE id = ?`,
      [nextStatus, completionDate, params.capaId]
    );
    await this.pool.query(
      `INSERT INTO verifications (entity_type, capa_id, incident_id, decision, remarks, verified_by)
       VALUES ('CAPA', ?, ?, ?, ?, ?)`,
      [params.capaId, capa.incidentId, params.decision, params.remarks, params.user.id]
    );
    return this.getCapaById(params.capaId);
  }
  async closeIncident(params) {
    await this.pool.query(
      `UPDATE incidents SET status = 'Closed', closed_at = NOW(), closed_by = ? WHERE id = ?`,
      [params.user.id, params.incidentId]
    );
    await this.pool.query(
      `INSERT INTO verifications (entity_type, capa_id, incident_id, decision, remarks, verified_by)
       VALUES ('INCIDENT_CLOSURE', NULL, ?, 'APPROVED', ?, ?)`,
      [params.incidentId, params.remarks, params.user.id]
    );
    return this.getIncidentById(params.incidentId);
  }
  async listAuditLogs(limit = 100) {
    const [rows] = await this.pool.query(
      `SELECT id, COALESCE(user_email, 'system') AS userEmail, COALESCE(user_role, 'SYSTEM') AS userRole,
              action, entity_type AS entityType, entity_id AS entityId, summary, created_at AS createdAt
       FROM audit_logs ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  }
  async appendAuditLog(entry) {
    await this.pool.query(
      `INSERT INTO audit_logs (user_email, user_role, action, entity_type, entity_id, summary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.userEmail, entry.userRole, entry.action, entry.entityType, entry.entityId, entry.summary]
    );
  }
};

// server/db/adapter.ts
var activeRepo = null;
var systemStatus = {
  mode: "DEMO_STORE",
  mysqlConfigured: false,
  mysqlConnected: false,
  message: "Initializing database adapter..."
};
async function initializeDatabaseAdapter() {
  const configured = isMysqlConfigured();
  if (configured) {
    const check = await testMysqlConnection();
    if (check.ok) {
      activeRepo = new MysqlRepository();
      systemStatus = {
        mode: "MYSQL",
        mysqlConfigured: true,
        mysqlConnected: true,
        message: "Connected to MySQL database pool."
      };
      return activeRepo;
    }
    activeRepo = new DemoStoreRepository();
    systemStatus = {
      mode: "DEMO_STORE",
      mysqlConfigured: true,
      mysqlConnected: false,
      message: `MySQL configured but unreachable (${check.error}). Running in isolated Demo Store mode.`
    };
    return activeRepo;
  }
  activeRepo = new DemoStoreRepository();
  systemStatus = {
    mode: "DEMO_STORE",
    mysqlConfigured: false,
    mysqlConnected: false,
    message: "MySQL credentials not configured in environment. Running with deterministic Demo Store."
  };
  return activeRepo;
}
function getRepository() {
  if (!activeRepo) {
    activeRepo = new DemoStoreRepository();
  }
  return activeRepo;
}
function getSystemStatus() {
  return systemStatus;
}

// server/routes/api.ts
import bcrypt2 from "bcryptjs";
import { Router } from "express";
import fs3 from "fs";
import path4 from "path";

// src/shared/validation.ts
import { z } from "zod";
var loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
var clinicVisitSchema = z.object({
  visitCode: z.string().min(2, "Visit ID is required"),
  employeeCode: z.string().min(2, "Employee ID is required"),
  employeeName: z.string().min(2, "Employee name is required"),
  companyId: z.coerce.number().int().positive("Company is required"),
  departmentName: z.string().min(2, "Department is required"),
  locationId: z.coerce.number().int().positive("Location is required"),
  shift: z.enum(["Pagi", "Siang", "Malam"]),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Visit date must be YYYY-MM-DD"),
  visitType: z.enum(["New", "Follow-up"]),
  generalDiagnosis: z.string().min(2, "General diagnosis is required"),
  pakClassification: z.string().nullable().optional(),
  symptoms: z.string().min(2, "Symptoms are required"),
  treatment: z.string().min(2, "Treatment is required"),
  medicalOfficer: z.string().min(2, "Medical officer is required"),
  notes: z.string().optional().default("")
});
var medicalExamSchema = z.object({
  examCode: z.string().min(2, "Examination ID is required"),
  employeeCode: z.string().min(2, "Employee ID is required"),
  employeeName: z.string().min(2, "Employee name is required"),
  companyId: z.coerce.number().int().positive("Company is required"),
  departmentName: z.string().min(2, "Department is required"),
  locationId: z.coerce.number().int().positive("Location is required"),
  shift: z.enum(["Pagi", "Siang", "Malam"]),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date must be YYYY-MM-DD"),
  examType: z.enum([
    "Workplace Accident",
    "Clinic Visit",
    "Daily / Periodic Exam",
    "Special Exam"
  ]),
  heightM: z.coerce.number().min(0.8, "Height must be in meters (e.g. 1.72)").max(2.5),
  weightKg: z.coerce.number().min(25).max(300),
  bloodPressure: z.string().regex(/^\d{2,3}\/\d{2,3}$/, "Blood pressure must be e.g. 120/80"),
  bloodGlucose: z.coerce.number().min(30).max(600),
  totalCholesterol: z.coerce.number().min(50).max(600),
  uricAcid: z.coerce.number().min(1).max(20),
  medicalStatus: z.enum(["Fit", "Fit with Note", "Follow-up Required", "Unfit"]).optional(),
  recommendations: z.string().optional().default(""),
  medicalOfficer: z.string().min(2, "Medical officer is required")
});
var incidentSchema = z.object({
  incidentCode: z.string().min(2, "Incident ID is required"),
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Incident date must be YYYY-MM-DD"),
  incidentTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Incident time is required"),
  companyId: z.coerce.number().int().positive("Company is required"),
  departmentName: z.string().min(2, "Department is required"),
  locationId: z.coerce.number().int().positive("Location is required"),
  shift: z.enum(["Pagi", "Siang", "Malam"]),
  employeeCode: z.string().min(2, "Employee ID is required"),
  employeeName: z.string().min(2, "Employee name is required"),
  jobPosition: z.string().min(2, "Job position is required"),
  incidentCategory: z.enum([
    "Fatality",
    "First Aid Case (FAC)",
    "Lost Time Injury (LTI)",
    "Medical Treatment Case (MTC)",
    "Restricted Work Case (RWC)",
    "Near Miss",
    "Property Damage"
  ]),
  workRelatedStatus: z.enum(["Work-Related", "Non-Work-Related"]),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  incidentDescription: z.string().min(5, "Incident description is required"),
  injuryDescription: z.string().optional().default(""),
  affectedBodyPart: z.enum([
    "Head",
    "Eyes",
    "Face",
    "Neck",
    "Shoulder",
    "Arms",
    "Hands",
    "Fingers",
    "Back",
    "Legs",
    "Feet",
    "None"
  ]),
  injuryType: z.string().optional().default(""),
  immediateActions: z.string().min(3, "Immediate actions are required"),
  witnessInfo: z.string().optional().default("")
});
var investigationSchema = z.object({
  investigationCode: z.string().min(2, "Investigation ID is required"),
  investigationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Investigation date is required"),
  investigationLeader: z.string().min(2, "Investigation leader is required"),
  investigationTeam: z.string().min(2, "Investigation team is required"),
  witnessStatements: z.string().optional().default(""),
  incidentChronology: z.string().min(5, "Incident chronology is required"),
  unsafeAct: z.string().optional().default(""),
  unsafeCondition: z.string().optional().default(""),
  immediateCause: z.string().min(3, "Immediate cause is required"),
  contributingFactors: z.string().optional().default("")
});
var fiveWhysSchema = z.object({
  why1: z.string().min(3, "Why 1 is required"),
  why2: z.string().optional().default(""),
  why3: z.string().optional().default(""),
  why4: z.string().optional().default(""),
  why5: z.string().optional().default(""),
  finalRootCause: z.string().min(3, "Final root cause is required")
});
var fishboneCauseSchema = z.object({
  category: z.enum(["Man", "Machine", "Method", "Material", "Measurement", "Environment"]),
  causeText: z.string().min(2, "Cause description is required"),
  subCauseText: z.string().optional().default(""),
  isPrimaryRoot: z.boolean().optional().default(false)
});
var capaSchema = z.object({
  capaCode: z.string().min(2, "CAPA ID is required"),
  incidentId: z.coerce.number().int().positive("Incident is required"),
  rootCause: z.string().min(3, "Root cause is required"),
  actionDescription: z.string().min(3, "Action description is required"),
  actionType: z.enum(["Corrective Action", "Preventive Action"]),
  responsiblePic: z.string().min(2, "Responsible PIC is required"),
  departmentName: z.string().min(2, "Department is required"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
  completionDate: z.string().nullable().optional(),
  actionStatus: z.enum(["Open", "In Progress", "Waiting Verification", "Verified", "Rejected / Reopened"]).optional(),
  completionNotes: z.string().optional().default("")
});

// server/middleware/auth.ts
import jwt from "jsonwebtoken";
function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}
async function authenticateJwt(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : void 0;
  const rawToken = header && header.startsWith("Bearer ") ? header.slice(7).trim() : queryToken;
  if (!rawToken) {
    res.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }
  try {
    const payload = jwt.verify(rawToken, env.jwtSecret);
    const repo = getRepository();
    const user = await repo.findUserById(Number(payload.sub));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "User account is inactive or no longer exists." });
      return;
    }
    const { passwordHash: _ph, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session token." });
  }
}
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role}.`
      });
      return;
    }
    next();
  };
}

// server/middleware/upload.ts
import crypto from "crypto";
import fs2 from "fs";
import multer from "multer";
import path3 from "path";
fs2.mkdirSync(env.uploadDir, { recursive: true });
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf"
]);
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".pdf"]);
var storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs2.mkdirSync(env.uploadDir, { recursive: true });
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path3.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, unique);
  }
});
var evidenceUpload = multer({
  storage,
  limits: {
    fileSize: env.maxUploadSizeBytes
  },
  fileFilter: (_req, file, cb) => {
    const ext = path3.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error("Unsupported file type. Only JPG, JPEG, PNG, and PDF files are allowed."));
      return;
    }
    cb(null, true);
  }
});

// server/routes/api.ts
var apiRouter = Router();
function parseSectionFilter(prefix, query) {
  const month = typeof query[`${prefix}Month`] === "string" ? query[`${prefix}Month`] : "ALL";
  const companyId = typeof query[`${prefix}CompanyId`] === "string" ? query[`${prefix}CompanyId`] : "ALL";
  const locationId = typeof query[`${prefix}LocationId`] === "string" ? query[`${prefix}LocationId`] : "ALL";
  const shift = typeof query[`${prefix}Shift`] === "string" ? query[`${prefix}Shift`] : "ALL";
  return { month, companyId, locationId, shift };
}
function sendValidationError(res, err) {
  res.status(400).json({
    error: "Validation failed",
    details: err instanceof Error ? err.message : "Invalid payload"
  });
}
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, status: getSystemStatus(), timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
apiRouter.get("/system/status", (_req, res) => {
  res.json(getSystemStatus());
});
apiRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid credentials format" });
    return;
  }
  const repo = getRepository();
  const user = await repo.findUserByEmail(parsed.data.email);
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  const valid = await bcrypt2.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  await repo.touchUserLogin(user.id);
  const { passwordHash: _ph, ...safeUser } = user;
  const token = signAuthToken(safeUser);
  await repo.appendAuditLog({
    userEmail: safeUser.email,
    userRole: safeUser.role,
    action: "USER_LOGIN",
    entityType: "AUTH",
    entityId: safeUser.userCode,
    summary: `${safeUser.fullName} (${safeUser.role}) signed in.`
  });
  res.json({ token, user: safeUser, systemStatus: getSystemStatus() });
});
apiRouter.post("/auth/demo-login", async (req, res) => {
  const status = getSystemStatus();
  if (status.mode !== "DEMO_STORE") {
    res.status(403).json({ error: "Demo quick login is disabled when connected to production MySQL." });
    return;
  }
  const role = req.body?.role;
  const emailMap = {
    ADMIN: "admin@ohsexpert.io",
    HSE_OFFICER: "hse@ohsexpert.io",
    MANAGEMENT: "management@ohsexpert.io"
  };
  const targetEmail = emailMap[role || "ADMIN"] || emailMap.ADMIN;
  const repo = getRepository();
  const user = await repo.findUserByEmail(targetEmail);
  if (!user || !user.isActive) {
    res.status(404).json({ error: "Demo account not found." });
    return;
  }
  const { passwordHash: _ph, ...safeUser } = user;
  const token = signAuthToken(safeUser);
  res.json({ token, user: safeUser, systemStatus: status });
});
apiRouter.get("/auth/me", authenticateJwt, (req, res) => {
  res.json({ user: req.user, systemStatus: getSystemStatus() });
});
apiRouter.get("/master", authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  const master = await repo.getMasterData();
  res.json(master);
});
apiRouter.post("/master/companies", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const { companyCode, name, industry } = req.body || {};
  if (!companyCode || !name) {
    res.status(400).json({ error: "companyCode and name are required" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createCompany({ companyCode, name, industry: industry || "" });
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_COMPANY",
    entityType: "COMPANY",
    entityId: created.companyCode,
    summary: `Created company ${created.name}`
  });
  res.status(201).json(created);
});
apiRouter.post("/master/departments", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const { companyId, departmentCode, name } = req.body || {};
  if (!companyId || !departmentCode || !name) {
    res.status(400).json({ error: "companyId, departmentCode, and name are required" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createDepartment({ companyId: Number(companyId), departmentCode, name });
  res.status(201).json(created);
});
apiRouter.post("/master/locations", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const { companyId, locationCode, name, siteArea } = req.body || {};
  if (!companyId || !locationCode || !name) {
    res.status(400).json({ error: "companyId, locationCode, and name are required" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createLocation({
    companyId: Number(companyId),
    locationCode,
    name,
    siteArea: siteArea || ""
  });
  res.status(201).json(created);
});
apiRouter.post("/master/employees", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const { employeeCode, fullName, companyId, departmentId, locationId, jobPosition, shift } = req.body || {};
  if (!employeeCode || !fullName || !companyId || !jobPosition) {
    res.status(400).json({ error: "employeeCode, fullName, companyId, and jobPosition are required" });
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
    shift: shift || "Pagi"
  });
  res.status(201).json(created);
});
apiRouter.put("/master/clinical-ranges", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const repo = getRepository();
  const updated = await repo.updateClinicalRanges(req.body, req.user.id);
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_CLINICAL_RANGES",
    entityType: "CLINICAL_CONFIG",
    entityId: "DEFAULT",
    summary: "Updated clinical reference ranges and reclassified medical exams."
  });
  res.json(updated);
});
apiRouter.get("/users", authenticateJwt, requireRoles("ADMIN"), async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listUsers());
});
apiRouter.post("/users", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const { userCode, fullName, email, password, role, departmentName } = req.body || {};
  if (!userCode || !fullName || !email || !password || !role) {
    res.status(400).json({ error: "userCode, fullName, email, password, and role are required." });
    return;
  }
  const repo = getRepository();
  const existing = await repo.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }
  const passwordHash = await bcrypt2.hash(password, 10);
  const created = await repo.createUser({
    userCode,
    fullName,
    email,
    passwordHash,
    role,
    departmentName: departmentName || "HSE"
  });
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_USER",
    entityType: "USER",
    entityId: created.userCode,
    summary: `Created user ${created.email} with role ${created.role}`
  });
  res.status(201).json(created);
});
apiRouter.patch("/users/:id", authenticateJwt, requireRoles("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const { isActive, role } = req.body || {};
  const repo = getRepository();
  const updated = await repo.updateUserStatus(id, Boolean(isActive), role);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_USER",
    entityType: "USER",
    entityId: updated.userCode,
    summary: `Updated user ${updated.email} (active=${updated.isActive}, role=${updated.role})`
  });
  res.json(updated);
});
apiRouter.get("/dashboard", authenticateJwt, async (req, res) => {
  const repo = getRepository();
  const filters = {
    visits: parseSectionFilter("v", req.query),
    exams: parseSectionFilter("e", req.query),
    incidents: parseSectionFilter("i", req.query)
  };
  const [clinicVisits, medicalExams, incidents, capas, investigations] = await Promise.all([
    repo.listClinicVisits(),
    repo.listMedicalExams(),
    repo.listIncidents(),
    repo.listCapas(),
    repo.listInvestigations()
  ]);
  const includeMedicalExams = ["ADMIN", "HSE_OFFICER", "MANAGEMENT"].includes(req.user.role);
  const summary = aggregateDashboardData({
    clinicVisits,
    medicalExams,
    incidents,
    capas,
    investigations,
    filters,
    includeMedicalExams
  });
  res.json({
    summary,
    recentIncidents: incidents,
    capas
  });
});
apiRouter.get("/clinic-visits", authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listClinicVisits());
});
apiRouter.post("/clinic-visits", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const parsed = clinicVisitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid clinic visit input" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createClinicVisit(
    {
      ...parsed.data,
      pakClassification: parsed.data.pakClassification || null
    },
    req.user.id
  );
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_CLINIC_VISIT",
    entityType: "CLINIC_VISIT",
    entityId: created.visitCode,
    summary: `Logged clinic visit ${created.visitCode} for ${created.employeeName}`
  });
  res.status(201).json(created);
});
apiRouter.put("/clinic-visits/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = clinicVisitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid clinic visit input" });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateClinicVisit(id, {
    ...parsed.data,
    pakClassification: parsed.data.pakClassification || null
  });
  if (!updated) {
    res.status(404).json({ error: "Clinic visit not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_CLINIC_VISIT",
    entityType: "CLINIC_VISIT",
    entityId: updated.visitCode,
    summary: `Updated clinic visit ${updated.visitCode}`
  });
  res.json(updated);
});
apiRouter.delete("/clinic-visits/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteClinicVisit(id);
  if (!deleted) {
    res.status(404).json({ error: "Clinic visit not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "DELETE_CLINIC_VISIT",
    entityType: "CLINIC_VISIT",
    entityId: String(id),
    summary: `Deleted clinic visit record #${id}`
  });
  res.json({ ok: true });
});
apiRouter.get("/medical-examinations", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER", "MANAGEMENT"), async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listMedicalExams());
});
apiRouter.post("/medical-examinations", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const parsed = medicalExamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid medical exam input" });
    return;
  }
  const repo = getRepository();
  const { clinicalRanges } = await repo.getMasterData();
  const bmi = calculateBmi(parsed.data.weightKg, parsed.data.heightM);
  const bmiCategory = classifyBmi(bmi, clinicalRanges);
  const glucoseCategory = classifyBloodGlucose(parsed.data.bloodGlucose, clinicalRanges);
  const cholesterolCategory = classifyCholesterol(parsed.data.totalCholesterol, clinicalRanges);
  const uricAcidCategory = classifyUricAcid(parsed.data.uricAcid, clinicalRanges);
  const medicalStatus = parsed.data.medicalStatus || deriveMedicalStatus({ bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory });
  const created = await repo.createMedicalExam(
    {
      ...parsed.data,
      bmi,
      bmiCategory,
      glucoseCategory,
      cholesterolCategory,
      uricAcidCategory,
      medicalStatus
    },
    req.user.id
  );
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_MEDICAL_EXAM",
    entityType: "MEDICAL_EXAM",
    entityId: created.examCode,
    summary: `Recorded medical exam ${created.examCode} (BMI ${created.bmi}, Status: ${created.medicalStatus})`
  });
  res.status(201).json(created);
});
apiRouter.put("/medical-examinations/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = medicalExamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid medical exam input" });
    return;
  }
  const repo = getRepository();
  const { clinicalRanges } = await repo.getMasterData();
  const bmi = calculateBmi(parsed.data.weightKg, parsed.data.heightM);
  const bmiCategory = classifyBmi(bmi, clinicalRanges);
  const glucoseCategory = classifyBloodGlucose(parsed.data.bloodGlucose, clinicalRanges);
  const cholesterolCategory = classifyCholesterol(parsed.data.totalCholesterol, clinicalRanges);
  const uricAcidCategory = classifyUricAcid(parsed.data.uricAcid, clinicalRanges);
  const medicalStatus = parsed.data.medicalStatus || deriveMedicalStatus({ bmiCategory, glucoseCategory, cholesterolCategory, uricAcidCategory });
  const updated = await repo.updateMedicalExam(id, {
    ...parsed.data,
    bmi,
    bmiCategory,
    glucoseCategory,
    cholesterolCategory,
    uricAcidCategory,
    medicalStatus
  });
  if (!updated) {
    res.status(404).json({ error: "Medical examination not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_MEDICAL_EXAM",
    entityType: "MEDICAL_EXAM",
    entityId: updated.examCode,
    summary: `Updated medical exam ${updated.examCode}`
  });
  res.json(updated);
});
apiRouter.delete("/medical-examinations/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteMedicalExam(id);
  if (!deleted) {
    res.status(404).json({ error: "Medical examination not found" });
    return;
  }
  res.json({ ok: true });
});
apiRouter.get("/incidents", authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listIncidents());
});
apiRouter.get("/incidents/:id/detail", authenticateJwt, async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const bundle = await repo.getIncidentDetail(id);
  if (!bundle) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  const closureGate = evaluateIncidentClosureGate(bundle);
  res.json({ ...bundle, closureGate });
});
apiRouter.post("/incidents", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid incident data" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createIncident(parsed.data, req.user.id);
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_INCIDENT",
    entityType: "INCIDENT",
    entityId: created.incidentCode,
    summary: `Reported workplace incident ${created.incidentCode} (${created.incidentCategory})`
  });
  res.status(201).json(created);
});
apiRouter.put("/incidents/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid incident data" });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateIncident(id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_INCIDENT",
    entityType: "INCIDENT",
    entityId: updated.incidentCode,
    summary: `Updated incident report ${updated.incidentCode}`
  });
  res.json(updated);
});
apiRouter.delete("/incidents/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteIncident(id);
  if (!deleted) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "DELETE_INCIDENT",
    entityType: "INCIDENT",
    entityId: String(id),
    summary: `Deleted incident #${id}`
  });
  res.json({ ok: true });
});
apiRouter.post(
  "/incidents/:id/evidence",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  (req, res, next) => {
    evidenceUpload.single("file")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || "File upload failed" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const incidentId = Number(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: "No file attached" });
      return;
    }
    const repo = getRepository();
    const incident = await repo.getIncidentById(incidentId);
    if (!incident) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    const evidenceType = req.file.mimetype === "application/pdf" ? "DOCUMENT" : "PHOTO";
    const saved = await repo.addIncidentEvidence(incidentId, {
      evidenceType,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      url: `/api/evidence/file/${req.file.filename}`,
      uploadedByName: req.user.fullName
    });
    await repo.appendAuditLog({
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "UPLOAD_INCIDENT_EVIDENCE",
      entityType: "INCIDENT",
      entityId: incident.incidentCode,
      summary: `Uploaded ${evidenceType} evidence (${req.file.originalname}) to ${incident.incidentCode}`
    });
    res.status(201).json(saved);
  }
);
apiRouter.put(
  "/incidents/:id/investigation",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  async (req, res) => {
    const incidentId = Number(req.params.id);
    const parsed = investigationSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]);
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    const saved = await repo.upsertInvestigation(incidentId, parsed.data, req.user.id);
    await repo.appendAuditLog({
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "SAVE_INVESTIGATION",
      entityType: "INCIDENT",
      entityId: inc.incidentCode,
      summary: `Saved investigation ${saved.investigationCode} for ${inc.incidentCode}`
    });
    res.json(saved);
  }
);
apiRouter.put(
  "/incidents/:id/five-whys",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  async (req, res) => {
    const incidentId = Number(req.params.id);
    const parsed = fiveWhysSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid Five Whys data" });
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    const saved = await repo.upsertFiveWhys(incidentId, parsed.data, req.user.id);
    await repo.appendAuditLog({
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "SAVE_FIVE_WHYS",
      entityType: "INCIDENT",
      entityId: inc.incidentCode,
      summary: `Documented Five Whys RCA for ${inc.incidentCode}`
    });
    res.json(saved);
  }
);
apiRouter.post(
  "/incidents/:id/fishbone",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  async (req, res) => {
    const incidentId = Number(req.params.id);
    const parsed = fishboneCauseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid fishbone cause" });
      return;
    }
    const repo = getRepository();
    const inc = await repo.getIncidentById(incidentId);
    if (!inc) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    const saved = await repo.addFishboneCause(incidentId, parsed.data, req.user.id);
    await repo.appendAuditLog({
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "ADD_FISHBONE_CAUSE",
      entityType: "INCIDENT",
      entityId: inc.incidentCode,
      summary: `Added 6M Fishbone cause [${saved.category}] to ${inc.incidentCode}`
    });
    res.status(201).json(saved);
  }
);
apiRouter.put(
  "/fishbone/:causeId",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  async (req, res) => {
    const causeId = Number(req.params.causeId);
    const parsed = fishboneCauseSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid fishbone update" });
      return;
    }
    const repo = getRepository();
    const updated = await repo.updateFishboneCause(causeId, parsed.data);
    if (!updated) {
      res.status(404).json({ error: "Fishbone cause not found" });
      return;
    }
    res.json(updated);
  }
);
apiRouter.delete(
  "/fishbone/:causeId",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  async (req, res) => {
    const causeId = Number(req.params.causeId);
    const repo = getRepository();
    const deleted = await repo.deleteFishboneCause(causeId);
    if (!deleted) {
      res.status(404).json({ error: "Fishbone cause not found" });
      return;
    }
    res.json({ ok: true });
  }
);
apiRouter.get("/capas", authenticateJwt, async (_req, res) => {
  const repo = getRepository();
  res.json(await repo.listCapas());
});
apiRouter.post("/capas", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const parsed = capaSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid CAPA data" });
    return;
  }
  const repo = getRepository();
  const created = await repo.createCapa(
    {
      ...parsed.data,
      completionDate: parsed.data.completionDate || null,
      actionStatus: parsed.data.actionStatus || "Open"
    },
    req.user.id
  );
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CREATE_CAPA",
    entityType: "CAPA",
    entityId: created.capaCode,
    summary: `Created ${created.actionType} ${created.capaCode} for ${created.incidentCode}`
  });
  res.status(201).json(created);
});
apiRouter.put("/capas/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = capaSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid CAPA update" });
    return;
  }
  const repo = getRepository();
  const updated = await repo.updateCapa(id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "CAPA record not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "UPDATE_CAPA",
    entityType: "CAPA",
    entityId: updated.capaCode,
    summary: `Updated ${updated.capaCode} status to ${updated.actionStatus}`
  });
  res.json(updated);
});
apiRouter.delete("/capas/:id", authenticateJwt, requireRoles("ADMIN", "HSE_OFFICER"), async (req, res) => {
  const id = Number(req.params.id);
  const repo = getRepository();
  const deleted = await repo.deleteCapa(id);
  if (!deleted) {
    res.status(404).json({ error: "CAPA record not found" });
    return;
  }
  res.json({ ok: true });
});
apiRouter.post(
  "/capas/:id/evidence",
  authenticateJwt,
  requireRoles("ADMIN", "HSE_OFFICER"),
  (req, res, next) => {
    evidenceUpload.single("file")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || "File upload failed" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const capaId = Number(req.params.id);
    if (!req.file) {
      res.status(400).json({ error: "No file attached" });
      return;
    }
    const repo = getRepository();
    const capa = await repo.getCapaById(capaId);
    if (!capa) {
      res.status(404).json({ error: "CAPA record not found" });
      return;
    }
    const saved = await repo.addCapaEvidence(capaId, {
      evidenceType: req.file.mimetype === "application/pdf" ? "DOCUMENT" : "PHOTO",
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      url: `/api/evidence/file/${req.file.filename}`,
      uploadedByName: req.user.fullName
    });
    await repo.appendAuditLog({
      userEmail: req.user.email,
      userRole: req.user.role,
      action: "UPLOAD_CAPA_EVIDENCE",
      entityType: "CAPA",
      entityId: capa.capaCode,
      summary: `Uploaded completion evidence (${req.file.originalname}) for ${capa.capaCode}`
    });
    res.status(201).json(saved);
  }
);
apiRouter.post("/capas/:id/verify", authenticateJwt, requireRoles("MANAGEMENT", "ADMIN"), async (req, res) => {
  const capaId = Number(req.params.id);
  const { decision, remarks } = req.body || {};
  if (!["APPROVED", "REJECTED", "REOPENED"].includes(decision) || !remarks?.trim()) {
    res.status(400).json({ error: "Valid decision (APPROVED/REJECTED/REOPENED) and remarks are required." });
    return;
  }
  const repo = getRepository();
  const updated = await repo.verifyCapa({
    capaId,
    decision,
    remarks: remarks.trim(),
    user: req.user
  });
  if (!updated) {
    res.status(404).json({ error: "CAPA record not found" });
    return;
  }
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "VERIFY_CAPA",
    entityType: "CAPA",
    entityId: updated.capaCode,
    summary: `${decision} CAPA ${updated.capaCode}: ${remarks.trim()}`
  });
  res.json(updated);
});
apiRouter.post("/incidents/:id/close", authenticateJwt, requireRoles("MANAGEMENT", "ADMIN"), async (req, res) => {
  const incidentId = Number(req.params.id);
  const { remarks } = req.body || {};
  if (!remarks?.trim()) {
    res.status(400).json({ error: "Closure remarks are required." });
    return;
  }
  const repo = getRepository();
  const detail = await repo.getIncidentDetail(incidentId);
  if (!detail) {
    res.status(404).json({ error: "Incident not found" });
    return;
  }
  const gate = evaluateIncidentClosureGate(detail);
  if (!gate.canClose) {
    res.status(422).json({
      error: "Incident closure blocked by governance rules.",
      reasons: gate.reasons
    });
    return;
  }
  const closed = await repo.closeIncident({
    incidentId,
    remarks: remarks.trim(),
    user: req.user
  });
  await repo.appendAuditLog({
    userEmail: req.user.email,
    userRole: req.user.role,
    action: "CLOSE_INCIDENT",
    entityType: "INCIDENT",
    entityId: detail.incident.incidentCode,
    summary: `Closed incident ${detail.incident.incidentCode}: ${remarks.trim()}`
  });
  res.json(closed);
});
apiRouter.get("/audit-logs", authenticateJwt, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const repo = getRepository();
  res.json(await repo.listAuditLogs(Math.min(limit, 300)));
});
apiRouter.get("/evidence/file/:storedFilename", authenticateJwt, (req, res) => {
  const safeName = path4.basename(String(req.params.storedFilename));
  const fullPath = path4.resolve(env.uploadDir, safeName);
  if (!fullPath.startsWith(env.uploadDir) || !fs3.existsSync(fullPath)) {
    res.status(404).json({ error: "Evidence file not found" });
    return;
  }
  res.sendFile(fullPath);
});

// server.ts
async function bootstrap() {
  await initializeDatabaseAdapter();
  const status = getSystemStatus();
  console.log(`[OHS EXPERT] Database mode: ${status.mode} \u2014 ${status.message}`);
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", apiRouter);
  if (env.nodeEnv !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path5.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path5.join(distDir, "index.html"));
    });
  }
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[OHS EXPERT] Server listening on http://localhost:${env.port}`);
  });
}
bootstrap().catch((err) => {
  console.error("[OHS EXPERT] Failed to start server:", err);
  process.exit(1);
});
