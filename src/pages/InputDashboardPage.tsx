import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  FilePlus2,
  Paperclip,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  calculateBmi,
  classifyBloodGlucose,
  classifyBmi,
  classifyCholesterol,
  classifyUricAcid,
  DEFAULT_CLINICAL_RANGES,
  deriveMedicalStatus,
} from '../shared/ohsLogic';
import type { ClinicVisit, Incident, MedicalExamination } from '../shared/types';

type InputTab = 'CLINIC' | 'MEDICAL' | 'ACCIDENT';

const GENERAL_DIAGNOSES = [
  'Influenza',
  'Pharyngitis',
  'Hypertension',
  'Tonsillitis',
  'Migraine',
  'Gastritis',
  'Hypotension',
];

const PAK_CLASSIFICATIONS = [
  '',
  'Contact Dermatitis',
  'Heat Stress / Heat Stroke',
  'Heavy Metal Poisoning',
  'Noise Induced Hearing Loss (NIHL)',
];

const BODY_PARTS = [
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
];

export function InputDashboardPage() {
  const { user, masterData } = useAuth();
  const navigate = useNavigate();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HSE_OFFICER';

  const [activeTab, setActiveTab] = useState<InputTab>('CLINIC');
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [exams, setExams] = useState<MedicalExamination[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detailModal, setDetailModal] = useState<{ title: string; rows: [string, string][] } | null>(
    null,
  );

  // Clinic Visit Form State
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [visitForm, setVisitForm] = useState({
    visitCode: `CV-2026-${String(Math.floor(100 + Math.random() * 899))}`,
    employeeCode: 'EMP-1001',
    employeeName: 'Budi Santoso',
    companyId: 1,
    departmentName: 'Plant Operations',
    locationId: 1,
    shift: 'Pagi' as 'Pagi' | 'Siang' | 'Malam',
    visitDate: new Date().toISOString().slice(0, 10),
    visitType: 'New' as 'New' | 'Follow-up',
    generalDiagnosis: 'Influenza',
    pakClassification: '',
    symptoms: '',
    treatment: '',
    medicalOfficer: 'Dr. Nadia Kusuma',
    notes: '',
  });

  // Medical Exam Form State
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [examForm, setExamForm] = useState({
    examCode: `ME-2026-${String(Math.floor(100 + Math.random() * 899))}`,
    employeeCode: 'EMP-1001',
    employeeName: 'Budi Santoso',
    companyId: 1,
    departmentName: 'Plant Operations',
    locationId: 1,
    shift: 'Pagi' as 'Pagi' | 'Siang' | 'Malam',
    examDate: new Date().toISOString().slice(0, 10),
    examType: 'Daily / Periodic Exam' as MedicalExamination['examType'],
    heightM: 1.75,
    weightKg: 72,
    bloodPressure: '120/80',
    bloodGlucose: 95,
    totalCholesterol: 185,
    uricAcid: 5.8,
    medicalStatus: '' as '' | MedicalExamination['medicalStatus'],
    recommendations: '',
    medicalOfficer: 'Dr. Nadia Kusuma',
  });

  // Workplace Accident Form State
  const [editingIncidentId, setEditingIncidentId] = useState<number | null>(null);
  const [incidentForm, setIncidentForm] = useState({
    incidentCode: `INC-2026-${String(Math.floor(100 + Math.random() * 899))}`,
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentTime: '09:30',
    companyId: 1,
    departmentName: 'Plant Operations',
    locationId: 1,
    shift: 'Pagi' as 'Pagi' | 'Siang' | 'Malam',
    employeeCode: 'EMP-1001',
    employeeName: 'Budi Santoso',
    jobPosition: 'Operator',
    incidentCategory: 'First Aid Case (FAC)' as Incident['incidentCategory'],
    workRelatedStatus: 'Work-Related' as Incident['workRelatedStatus'],
    severity: 'Medium' as Incident['severity'],
    incidentDescription: '',
    injuryDescription: '',
    affectedBodyPart: 'Hands' as Incident['affectedBodyPart'],
    injuryType: 'Abrasion / Laceration',
    immediateActions: '',
    witnessInfo: '',
  });
  const [pendingEvidenceFile, setPendingEvidenceFile] = useState<File | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [v, e, i] = await Promise.all([
        api.listClinicVisits(),
        api.listMedicalExams(),
        api.listIncidents(),
      ]);
      setVisits(v);
      setExams(e);
      setIncidents(i);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to load records',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Auto-calculated BMI & live clinical classification preview
  const ranges = masterData?.clinicalRanges ?? DEFAULT_CLINICAL_RANGES;
  const computedBmi = calculateBmi(Number(examForm.weightKg), Number(examForm.heightM));
  const computedBmiCat = computedBmi > 0 ? classifyBmi(computedBmi, ranges) : '—';
  const computedGlucoseCat = classifyBloodGlucose(Number(examForm.bloodGlucose) || 0, ranges);
  const computedCholCat = classifyCholesterol(Number(examForm.totalCholesterol) || 0, ranges);
  const computedUricCat = classifyUricAcid(Number(examForm.uricAcid) || 0, ranges);
  const autoMedicalStatus = deriveMedicalStatus({
    bmiCategory: computedBmiCat,
    glucoseCategory: computedGlucoseCat,
    cholesterolCategory: computedCholCat,
    uricAcidCategory: computedUricCat,
  });

  const handleEmployeePick = (
    empCode: string,
    target: 'CLINIC' | 'MEDICAL' | 'ACCIDENT',
  ) => {
    const emp = masterData?.employees.find((e) => e.employeeCode === empCode);
    if (!emp) return;
    if (target === 'CLINIC') {
      setVisitForm((prev) => ({
        ...prev,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        companyId: emp.companyId,
        departmentName: emp.departmentName,
        locationId: emp.locationId,
        shift: emp.shift,
      }));
    } else if (target === 'MEDICAL') {
      setExamForm((prev) => ({
        ...prev,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        companyId: emp.companyId,
        departmentName: emp.departmentName,
        locationId: emp.locationId,
        shift: emp.shift,
      }));
    } else {
      setIncidentForm((prev) => ({
        ...prev,
        employeeCode: emp.employeeCode,
        employeeName: emp.fullName,
        companyId: emp.companyId,
        departmentName: emp.departmentName,
        locationId: emp.locationId,
        shift: emp.shift,
        jobPosition: emp.jobPosition,
      }));
    }
  };

  const resetVisitForm = () => {
    setEditingVisitId(null);
    setVisitForm((prev) => ({
      ...prev,
      visitCode: `CV-2026-${String(Math.floor(100 + Math.random() * 899))}`,
      symptoms: '',
      treatment: '',
      notes: '',
    }));
  };

  const resetExamForm = () => {
    setEditingExamId(null);
    setExamForm((prev) => ({
      ...prev,
      examCode: `ME-2026-${String(Math.floor(100 + Math.random() * 899))}`,
      medicalStatus: '',
      recommendations: '',
    }));
  };

  const resetIncidentForm = () => {
    setEditingIncidentId(null);
    setPendingEvidenceFile(null);
    setIncidentForm((prev) => ({
      ...prev,
      incidentCode: `INC-2026-${String(Math.floor(100 + Math.random() * 899))}`,
      incidentDescription: '',
      injuryDescription: '',
      immediateActions: '',
      witnessInfo: '',
    }));
  };

  // Submit Handlers
  const saveClinicVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const payload = {
        ...visitForm,
        pakClassification: visitForm.pakClassification || null,
      };
      if (editingVisitId) {
        await api.updateClinicVisit(editingVisitId, payload);
        setFeedback({ type: 'success', text: `Updated clinic visit ${visitForm.visitCode}.` });
      } else {
        await api.createClinicVisit(payload);
        setFeedback({ type: 'success', text: `Saved clinic visit ${visitForm.visitCode}.` });
      }
      resetVisitForm();
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const saveMedicalExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const payload = {
        ...examForm,
        medicalStatus: examForm.medicalStatus || autoMedicalStatus,
      };
      if (editingExamId) {
        await api.updateMedicalExam(editingExamId, payload);
        setFeedback({ type: 'success', text: `Updated medical examination ${examForm.examCode}.` });
      } else {
        await api.createMedicalExam(payload);
        setFeedback({ type: 'success', text: `Saved medical examination ${examForm.examCode}.` });
      }
      resetExamForm();
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const saveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      let saved: Incident;
      if (editingIncidentId) {
        saved = await api.updateIncident(editingIncidentId, incidentForm);
        setFeedback({ type: 'success', text: `Updated incident ${saved.incidentCode}.` });
      } else {
        saved = await api.createIncident(incidentForm);
        setFeedback({ type: 'success', text: `Reported workplace incident ${saved.incidentCode}.` });
      }
      if (pendingEvidenceFile) {
        await api.uploadIncidentEvidence(saved.id, pendingEvidenceFile);
        setFeedback({
          type: 'success',
          text: `Saved incident ${saved.incidentCode} with uploaded evidence (${pendingEvidenceFile.name}).`,
        });
      }
      resetIncidentForm();
      await loadAll();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const companies = masterData?.companies ?? [];
  const locations = masterData?.locations ?? [];
  const employees = masterData?.employees ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <FilePlus2 className="w-5 h-5 text-[#159EBD]" />
              <span>Input Dashboard — Operational Data Management</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              All entries validate server-side and immediately synchronize with the Monitoring Dashboard.
            </p>
          </div>
          {!canEdit && (
            <div className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              Read-Only Mode ({user?.role}): Only HSE Officer or Admin can create/modify records.
            </div>
          )}
        </div>

        {/* Modular Form Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'CLINIC'}
            onClick={() => setActiveTab('CLINIC')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'CLINIC'
                ? 'bg-[#159EBD] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            A. Clinic Visits ({visits.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'MEDICAL'}
            onClick={() => setActiveTab('MEDICAL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'MEDICAL'
                ? 'bg-[#159EBD] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            B. Medical Examinations ({exams.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'ACCIDENT'}
            onClick={() => setActiveTab('ACCIDENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'ACCIDENT'
                ? 'bg-[#159EBD] text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            C. Workplace Accidents ({incidents.length})
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB A: CLINIC VISIT FORM */}
        {activeTab === 'CLINIC' && (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <form onSubmit={saveClinicVisit} className="xl:col-span-5 space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingVisitId ? 'Edit Clinic Visit' : 'Log Clinic Visit'}
                </h2>
                {employees.length > 0 && (
                  <select
                    aria-label="Quick fill employee"
                    onChange={(e) => handleEmployeePick(e.target.value, 'CLINIC')}
                    defaultValue=""
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="" disabled>
                      Auto-fill Employee...
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employeeCode}>
                        {emp.employeeCode} — {emp.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cv-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Visit ID
                  </label>
                  <input
                    id="cv-code"
                    required
                    value={visitForm.visitCode}
                    onChange={(e) => setVisitForm({ ...visitForm, visitCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="cv-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Visit Date
                  </label>
                  <input
                    id="cv-date"
                    type="date"
                    required
                    value={visitForm.visitDate}
                    onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="cv-emp-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    id="cv-emp-code"
                    required
                    value={visitForm.employeeCode}
                    onChange={(e) => setVisitForm({ ...visitForm, employeeCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="cv-emp-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee Name
                  </label>
                  <input
                    id="cv-emp-name"
                    required
                    value={visitForm.employeeName}
                    onChange={(e) => setVisitForm({ ...visitForm, employeeName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cv-company" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Company
                  </label>
                  <select
                    id="cv-company"
                    value={visitForm.companyId}
                    onChange={(e) => setVisitForm({ ...visitForm, companyId: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cv-dept" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    id="cv-dept"
                    required
                    value={visitForm.departmentName}
                    onChange={(e) => setVisitForm({ ...visitForm, departmentName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cv-loc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Location
                  </label>
                  <select
                    id="cv-loc"
                    value={visitForm.locationId}
                    onChange={(e) => setVisitForm({ ...visitForm, locationId: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cv-shift" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Shift
                  </label>
                  <select
                    id="cv-shift"
                    value={visitForm.shift}
                    onChange={(e) =>
                      setVisitForm({ ...visitForm, shift: e.target.value as 'Pagi' | 'Siang' | 'Malam' })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Pagi">Pagi</option>
                    <option value="Siang">Siang</option>
                    <option value="Malam">Malam</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cv-type" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Visit Type
                  </label>
                  <select
                    id="cv-type"
                    value={visitForm.visitType}
                    onChange={(e) =>
                      setVisitForm({ ...visitForm, visitType: e.target.value as 'New' | 'Follow-up' })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="New">New</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cv-gen" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    General Diagnosis
                  </label>
                  <select
                    id="cv-gen"
                    value={visitForm.generalDiagnosis}
                    onChange={(e) => setVisitForm({ ...visitForm, generalDiagnosis: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {GENERAL_DIAGNOSES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor="cv-pak" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Occupational Disease Classification (PAK)
                  </label>
                  <select
                    id="cv-pak"
                    value={visitForm.pakClassification}
                    onChange={(e) => setVisitForm({ ...visitForm, pakClassification: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {PAK_CLASSIFICATIONS.map((p) => (
                      <option key={p || 'none'} value={p}>
                        {p || 'None (Non-Occupational)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor="cv-symp" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Symptoms
                  </label>
                  <input
                    id="cv-symp"
                    required
                    placeholder="e.g. Fever, sore throat, headache"
                    value={visitForm.symptoms}
                    onChange={(e) => setVisitForm({ ...visitForm, symptoms: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="cv-treat" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Treatment
                  </label>
                  <input
                    id="cv-treat"
                    required
                    placeholder="e.g. Antipyretic, hydration, 24h rest"
                    value={visitForm.treatment}
                    onChange={(e) => setVisitForm({ ...visitForm, treatment: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cv-officer" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Medical Officer
                  </label>
                  <input
                    id="cv-officer"
                    required
                    value={visitForm.medicalOfficer}
                    onChange={(e) => setVisitForm({ ...visitForm, medicalOfficer: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="cv-notes" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Notes
                  </label>
                  <input
                    id="cv-notes"
                    value={visitForm.notes}
                    onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!canEdit}
                  className="px-4 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold disabled:opacity-50"
                >
                  {editingVisitId ? 'Update Visit' : 'Save Clinic Visit'}
                </button>
                <button
                  type="button"
                  onClick={resetVisitForm}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Clinic Visits Table */}
            <div className="xl:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Visit ID</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Diagnosis</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Loading records...
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold tabular-nums whitespace-nowrap">
                          {v.visitCode}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">{v.visitDate}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{v.employeeName}</div>
                          <div className="text-[11px] text-slate-500">
                            {v.companyName} · {v.locationName} ({v.shift})
                          </div>
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#159EBD]">{v.visitType}</td>
                        <td className="py-2 px-3">
                          <div>{v.generalDiagnosis}</div>
                          {v.pakClassification && (
                            <div className="text-[11px] text-amber-700 font-medium">
                              PAK: {v.pakClassification}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`View detail ${v.visitCode}`}
                              onClick={() =>
                                setDetailModal({
                                  title: `Clinic Visit ${v.visitCode}`,
                                  rows: [
                                    ['Employee', `${v.employeeName} (${v.employeeCode})`],
                                    ['Company / Location', `${v.companyName} · ${v.locationName} (${v.shift})`],
                                    ['Date & Type', `${v.visitDate} · ${v.visitType}`],
                                    ['General Diagnosis', v.generalDiagnosis],
                                    ['PAK Classification', v.pakClassification || 'None'],
                                    ['Symptoms', v.symptoms],
                                    ['Treatment', v.treatment],
                                    ['Medical Officer', v.medicalOfficer],
                                    ['Notes', v.notes || '—'],
                                  ],
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  aria-label={`Edit ${v.visitCode}`}
                                  onClick={() => {
                                    setEditingVisitId(v.id);
                                    setVisitForm({
                                      visitCode: v.visitCode,
                                      employeeCode: v.employeeCode,
                                      employeeName: v.employeeName,
                                      companyId: v.companyId,
                                      departmentName: v.departmentName,
                                      locationId: v.locationId,
                                      shift: v.shift,
                                      visitDate: v.visitDate,
                                      visitType: v.visitType,
                                      generalDiagnosis: v.generalDiagnosis,
                                      pakClassification: v.pakClassification || '',
                                      symptoms: v.symptoms,
                                      treatment: v.treatment,
                                      medicalOfficer: v.medicalOfficer,
                                      notes: v.notes,
                                    });
                                  }}
                                  className="p-1.5 rounded-lg text-[#159EBD] hover:bg-[#DDF6FC]"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${v.visitCode}`}
                                  onClick={async () => {
                                    await api.deleteClinicVisit(v.id);
                                    await loadAll();
                                  }}
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB B: MEDICAL EXAMINATION FORM (with automatic BMI) */}
        {activeTab === 'MEDICAL' && (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <form onSubmit={saveMedicalExam} className="xl:col-span-5 space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-[#159EBD]" />
                  <span>{editingExamId ? 'Edit Medical Exam' : 'Record Medical Examination'}</span>
                </h2>
                {employees.length > 0 && (
                  <select
                    aria-label="Auto-fill employee for medical exam"
                    onChange={(e) => handleEmployeePick(e.target.value, 'MEDICAL')}
                    defaultValue=""
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="" disabled>
                      Auto-fill Employee...
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employeeCode}>
                        {emp.employeeCode} — {emp.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="me-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Examination ID
                  </label>
                  <input
                    id="me-code"
                    required
                    value={examForm.examCode}
                    onChange={(e) => setExamForm({ ...examForm, examCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="me-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Examination Date
                  </label>
                  <input
                    id="me-date"
                    type="date"
                    required
                    value={examForm.examDate}
                    onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="me-emp-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    id="me-emp-code"
                    required
                    value={examForm.employeeCode}
                    onChange={(e) => setExamForm({ ...examForm, employeeCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="me-emp-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee Name
                  </label>
                  <input
                    id="me-emp-name"
                    required
                    value={examForm.employeeName}
                    onChange={(e) => setExamForm({ ...examForm, employeeName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="me-company" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Company
                  </label>
                  <select
                    id="me-company"
                    value={examForm.companyId}
                    onChange={(e) => setExamForm({ ...examForm, companyId: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="me-type" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Examination Type
                  </label>
                  <select
                    id="me-type"
                    value={examForm.examType}
                    onChange={(e) =>
                      setExamForm({ ...examForm, examType: e.target.value as MedicalExamination['examType'] })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Workplace Accident">Workplace Accident</option>
                    <option value="Clinic Visit">Clinic Visit</option>
                    <option value="Daily / Periodic Exam">Daily / Periodic Exam</option>
                    <option value="Special Exam">Special Exam</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="me-height" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Height (m)
                  </label>
                  <input
                    id="me-height"
                    type="number"
                    step="0.01"
                    min="0.8"
                    max="2.5"
                    required
                    value={examForm.heightM}
                    onChange={(e) => setExamForm({ ...examForm, heightM: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="me-weight" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    id="me-weight"
                    type="number"
                    step="0.1"
                    min="25"
                    max="300"
                    required
                    value={examForm.weightKg}
                    onChange={(e) => setExamForm({ ...examForm, weightKg: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                </div>

                {/* Auto-calculated BMI readout */}
                <div className="col-span-2 p-2.5 rounded-xl bg-[#DDF6FC] border border-[#159EBD]/40 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-[#0F4761]">
                      Auto-Calculated BMI = Weight (kg) / Height (m)²
                    </div>
                    <div className="text-xs text-slate-700">
                      Classification: <strong>{computedBmiCat}</strong>
                    </div>
                  </div>
                  <div
                    data-testid="auto-bmi-value"
                    className="text-2xl font-black font-mono tabular-nums text-[#0F4761]"
                  >
                    {computedBmi}
                  </div>
                </div>

                <div>
                  <label htmlFor="me-bp" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Blood Pressure
                  </label>
                  <input
                    id="me-bp"
                    required
                    placeholder="120/80"
                    value={examForm.bloodPressure}
                    onChange={(e) => setExamForm({ ...examForm, bloodPressure: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="me-glucose" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Blood Glucose (mg/dL) · {computedGlucoseCat}
                  </label>
                  <input
                    id="me-glucose"
                    type="number"
                    required
                    value={examForm.bloodGlucose}
                    onChange={(e) => setExamForm({ ...examForm, bloodGlucose: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="me-chol" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Total Cholesterol · {computedCholCat}
                  </label>
                  <input
                    id="me-chol"
                    type="number"
                    required
                    value={examForm.totalCholesterol}
                    onChange={(e) => setExamForm({ ...examForm, totalCholesterol: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="me-uric" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Uric Acid (mg/dL) · {computedUricCat}
                  </label>
                  <input
                    id="me-uric"
                    type="number"
                    step="0.1"
                    required
                    value={examForm.uricAcid}
                    onChange={(e) => setExamForm({ ...examForm, uricAcid: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="me-status" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Medical Status (Auto: {autoMedicalStatus})
                  </label>
                  <select
                    id="me-status"
                    value={examForm.medicalStatus}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        medicalStatus: e.target.value as '' | MedicalExamination['medicalStatus'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Auto ({autoMedicalStatus})</option>
                    <option value="Fit">Fit</option>
                    <option value="Fit with Note">Fit with Note</option>
                    <option value="Follow-up Required">Follow-up Required</option>
                    <option value="Unfit">Unfit</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="me-officer" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Medical Officer
                  </label>
                  <input
                    id="me-officer"
                    required
                    value={examForm.medicalOfficer}
                    onChange={(e) => setExamForm({ ...examForm, medicalOfficer: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="me-rec" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Recommendations
                  </label>
                  <input
                    id="me-rec"
                    placeholder="Clinical dietary or fitness follow-up recommendations"
                    value={examForm.recommendations}
                    onChange={(e) => setExamForm({ ...examForm, recommendations: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!canEdit}
                  className="px-4 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold disabled:opacity-50"
                >
                  {editingExamId ? 'Update Examination' : 'Save Medical Exam'}
                </button>
                <button
                  type="button"
                  onClick={resetExamForm}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Medical Exam Table */}
            <div className="xl:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Exam ID</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">BMI</th>
                    <th className="py-2.5 px-3">Glucose / Chol / UA</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exams.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold tabular-nums whitespace-nowrap">
                        {ex.examCode}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">{ex.examDate}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{ex.employeeName}</div>
                        <div className="text-[11px] text-slate-500">{ex.examType}</div>
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums">
                        <span className="font-bold">{ex.bmi}</span>
                        <div className="text-[10px] text-slate-500">{ex.bmiCategory}</div>
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums text-[11px]">
                        {ex.bloodGlucose} · {ex.totalCholesterol} · {ex.uricAcid}
                      </td>
                      <td className="py-2 px-3 font-semibold whitespace-nowrap">
                        <span
                          className={
                            ex.medicalStatus === 'Fit'
                              ? 'text-emerald-700'
                              : ex.medicalStatus === 'Fit with Note'
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }
                        >
                          {ex.medicalStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`View detail ${ex.examCode}`}
                            onClick={() =>
                              setDetailModal({
                                title: `Medical Exam ${ex.examCode}`,
                                rows: [
                                  ['Employee', `${ex.employeeName} (${ex.employeeCode})`],
                                  ['Exam Type & Date', `${ex.examType} · ${ex.examDate}`],
                                  ['Height / Weight / BMI', `${ex.heightM} m / ${ex.weightKg} kg → BMI ${ex.bmi} (${ex.bmiCategory})`],
                                  ['Blood Pressure', ex.bloodPressure],
                                  ['Blood Glucose', `${ex.bloodGlucose} mg/dL (${ex.glucoseCategory})`],
                                  ['Cholesterol', `${ex.totalCholesterol} mg/dL (${ex.cholesterolCategory})`],
                                  ['Uric Acid', `${ex.uricAcid} mg/dL (${ex.uricAcidCategory})`],
                                  ['Medical Status', ex.medicalStatus],
                                  ['Recommendations', ex.recommendations || '—'],
                                ],
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                aria-label={`Edit ${ex.examCode}`}
                                onClick={() => {
                                  setEditingExamId(ex.id);
                                  setExamForm({
                                    examCode: ex.examCode,
                                    employeeCode: ex.employeeCode,
                                    employeeName: ex.employeeName,
                                    companyId: ex.companyId,
                                    departmentName: ex.departmentName,
                                    locationId: ex.locationId,
                                    shift: ex.shift,
                                    examDate: ex.examDate,
                                    examType: ex.examType,
                                    heightM: ex.heightM,
                                    weightKg: ex.weightKg,
                                    bloodPressure: ex.bloodPressure,
                                    bloodGlucose: ex.bloodGlucose,
                                    totalCholesterol: ex.totalCholesterol,
                                    uricAcid: ex.uricAcid,
                                    medicalStatus: ex.medicalStatus,
                                    recommendations: ex.recommendations,
                                    medicalOfficer: ex.medicalOfficer,
                                  });
                                }}
                                className="p-1.5 rounded-lg text-[#159EBD] hover:bg-[#DDF6FC]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${ex.examCode}`}
                                onClick={async () => {
                                  await api.deleteMedicalExam(ex.id);
                                  await loadAll();
                                }}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB C: WORKPLACE ACCIDENT FORM */}
        {activeTab === 'ACCIDENT' && (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
            <form onSubmit={saveIncident} className="xl:col-span-5 space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {editingIncidentId ? 'Edit Incident Report' : 'Report Workplace Accident'}
                </h2>
                {employees.length > 0 && (
                  <select
                    aria-label="Auto-fill employee for incident"
                    onChange={(e) => handleEmployeePick(e.target.value, 'ACCIDENT')}
                    defaultValue=""
                    className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                  >
                    <option value="" disabled>
                      Auto-fill Employee...
                    </option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.employeeCode}>
                        {emp.employeeCode} — {emp.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inc-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Incident ID
                  </label>
                  <input
                    id="inc-code"
                    required
                    value={incidentForm.incidentCode}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor="inc-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Date
                    </label>
                    <input
                      id="inc-date"
                      type="date"
                      required
                      value={incidentForm.incidentDate}
                      onChange={(e) => setIncidentForm({ ...incidentForm, incidentDate: e.target.value })}
                      className="w-full px-1.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="inc-time" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Time
                    </label>
                    <input
                      id="inc-time"
                      type="time"
                      required
                      value={incidentForm.incidentTime}
                      onChange={(e) => setIncidentForm({ ...incidentForm, incidentTime: e.target.value })}
                      className="w-full px-1.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="inc-company" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Company
                  </label>
                  <select
                    id="inc-company"
                    value={incidentForm.companyId}
                    onChange={(e) => setIncidentForm({ ...incidentForm, companyId: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-loc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Location
                  </label>
                  <select
                    id="inc-loc"
                    value={incidentForm.locationId}
                    onChange={(e) => setIncidentForm({ ...incidentForm, locationId: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-emp-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee ID
                  </label>
                  <input
                    id="inc-emp-code"
                    required
                    value={incidentForm.employeeCode}
                    onChange={(e) => setIncidentForm({ ...incidentForm, employeeCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="inc-emp-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Employee Name
                  </label>
                  <input
                    id="inc-emp-name"
                    required
                    value={incidentForm.employeeName}
                    onChange={(e) => setIncidentForm({ ...incidentForm, employeeName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="inc-pos" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Job Position
                  </label>
                  <input
                    id="inc-pos"
                    required
                    value={incidentForm.jobPosition}
                    onChange={(e) => setIncidentForm({ ...incidentForm, jobPosition: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="inc-shift" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Shift
                  </label>
                  <select
                    id="inc-shift"
                    value={incidentForm.shift}
                    onChange={(e) =>
                      setIncidentForm({ ...incidentForm, shift: e.target.value as 'Pagi' | 'Siang' | 'Malam' })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Pagi">Pagi</option>
                    <option value="Siang">Siang</option>
                    <option value="Malam">Malam</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-cat" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Incident Category
                  </label>
                  <select
                    id="inc-cat"
                    value={incidentForm.incidentCategory}
                    onChange={(e) =>
                      setIncidentForm({
                        ...incidentForm,
                        incidentCategory: e.target.value as Incident['incidentCategory'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Fatality">Fatality</option>
                    <option value="First Aid Case (FAC)">First Aid Case (FAC)</option>
                    <option value="Lost Time Injury (LTI)">Lost Time Injury (LTI)</option>
                    <option value="Medical Treatment Case (MTC)">Medical Treatment Case (MTC)</option>
                    <option value="Restricted Work Case (RWC)">Restricted Work Case (RWC)</option>
                    <option value="Near Miss">Near Miss</option>
                    <option value="Property Damage">Property Damage</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-wr" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Work-Related Status
                  </label>
                  <select
                    id="inc-wr"
                    value={incidentForm.workRelatedStatus}
                    onChange={(e) =>
                      setIncidentForm({
                        ...incidentForm,
                        workRelatedStatus: e.target.value as Incident['workRelatedStatus'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Work-Related">Work-Related</option>
                    <option value="Non-Work-Related">Non-Work-Related</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-sev" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Severity
                  </label>
                  <select
                    id="inc-sev"
                    value={incidentForm.severity}
                    onChange={(e) =>
                      setIncidentForm({ ...incidentForm, severity: e.target.value as Incident['severity'] })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="inc-bp" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Affected Body Part
                  </label>
                  <select
                    id="inc-bp"
                    value={incidentForm.affectedBodyPart}
                    onChange={(e) =>
                      setIncidentForm({
                        ...incidentForm,
                        affectedBodyPart: e.target.value as Incident['affectedBodyPart'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {BODY_PARTS.map((bp) => (
                      <option key={bp} value={bp}>
                        {bp}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor="inc-desc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Incident Description
                  </label>
                  <textarea
                    id="inc-desc"
                    rows={2}
                    required
                    placeholder="Describe what occurred, equipment involved, and sequence..."
                    value={incidentForm.incidentDescription}
                    onChange={(e) => setIncidentForm({ ...incidentForm, incidentDescription: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="inc-inj-desc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Injury Description
                  </label>
                  <input
                    id="inc-inj-desc"
                    value={incidentForm.injuryDescription}
                    onChange={(e) => setIncidentForm({ ...incidentForm, injuryDescription: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="inc-inj-type" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Injury Type
                  </label>
                  <input
                    id="inc-inj-type"
                    value={incidentForm.injuryType}
                    onChange={(e) => setIncidentForm({ ...incidentForm, injuryType: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inc-imm" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Immediate Actions
                  </label>
                  <input
                    id="inc-imm"
                    required
                    placeholder="First aid, area isolation, supervisor notification..."
                    value={incidentForm.immediateActions}
                    onChange={(e) => setIncidentForm({ ...incidentForm, immediateActions: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inc-wit" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Witness Information
                  </label>
                  <input
                    id="inc-wit"
                    placeholder="Names & roles of witnesses"
                    value={incidentForm.witnessInfo}
                    onChange={(e) => setIncidentForm({ ...incidentForm, witnessInfo: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="inc-file" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Photo / Supporting Document Evidence (JPG, PNG, PDF max 10MB)
                  </label>
                  <label
                    htmlFor="inc-file"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-white hover:border-[#159EBD] cursor-pointer text-xs text-slate-600"
                  >
                    <Upload className="w-4 h-4 text-[#159EBD]" />
                    <span className="truncate">
                      {pendingEvidenceFile ? pendingEvidenceFile.name : 'Choose JPG, PNG, or PDF file...'}
                    </span>
                    <input
                      id="inc-file"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="sr-only"
                      onChange={(e) => setPendingEvidenceFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!canEdit}
                  className="px-4 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold disabled:opacity-50"
                >
                  {editingIncidentId ? 'Update Incident' : 'Save Incident'}
                </button>
                <button
                  type="button"
                  onClick={resetIncidentForm}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>

            {/* Incidents Table */}
            <div className="xl:col-span-7 overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Incident ID</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee & Site</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold tabular-nums whitespace-nowrap">
                        <div>{inc.incidentCode}</div>
                        {inc.evidence.length > 0 && (
                          <div className="text-[10px] text-[#159EBD] flex items-center gap-0.5">
                            <Paperclip className="w-3 h-3" />
                            <span>{inc.evidence.length} file(s)</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">{inc.incidentDate}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{inc.employeeName}</div>
                        <div className="text-[11px] text-slate-500">
                          {inc.companyName} · {inc.locationName}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div>{inc.incidentCategory}</div>
                        <div className="text-[11px] text-slate-500">
                          {inc.affectedBodyPart} · {inc.workRelatedStatus}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-semibold whitespace-nowrap">{inc.status}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`View detail ${inc.incidentCode}`}
                            onClick={() => navigate(`/investigations?incidentId=${inc.id}`)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                            title="Open Investigation & RCA"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                aria-label={`Edit ${inc.incidentCode}`}
                                onClick={() => {
                                  setEditingIncidentId(inc.id);
                                  setIncidentForm({
                                    incidentCode: inc.incidentCode,
                                    incidentDate: inc.incidentDate,
                                    incidentTime: inc.incidentTime.slice(0, 5),
                                    companyId: inc.companyId,
                                    departmentName: inc.departmentName,
                                    locationId: inc.locationId,
                                    shift: inc.shift,
                                    employeeCode: inc.employeeCode,
                                    employeeName: inc.employeeName,
                                    jobPosition: inc.jobPosition,
                                    incidentCategory: inc.incidentCategory,
                                    workRelatedStatus: inc.workRelatedStatus,
                                    severity: inc.severity,
                                    incidentDescription: inc.incidentDescription,
                                    injuryDescription: inc.injuryDescription,
                                    affectedBodyPart: inc.affectedBodyPart,
                                    injuryType: inc.injuryType,
                                    immediateActions: inc.immediateActions,
                                    witnessInfo: inc.witnessInfo,
                                  });
                                }}
                                className="p-1.5 rounded-lg text-[#159EBD] hover:bg-[#DDF6FC]"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${inc.incidentCode}`}
                                onClick={async () => {
                                  await api.deleteIncident(inc.id);
                                  await loadAll();
                                }}
                                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* View Detail Modal */}
      {detailModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={detailModal.title}
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">{detailModal.title}</h3>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                aria-label="Close detail modal"
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-xs">
              {detailModal.rows.map(([label, val]) => (
                <div key={label} className="grid grid-cols-3 gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="font-semibold text-slate-500">{label}</div>
                  <div className="col-span-2 text-slate-900">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
