import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  Lock,
  Paperclip,
  SearchCode,
  Upload,
} from 'lucide-react';
import { FishboneDiagram } from '../components/investigation/FishboneDiagram';
import { useAuth } from '../context/AuthContext';
import { api, type IncidentDetailResponse } from '../services/api';
import type { Incident } from '../shared/types';

type InvTab = 'DETAILS' | 'FIVE_WHYS' | 'FISHBONE' | 'CLOSURE';

export function InvestigationPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canInvestigate = user?.role === 'ADMIN' || user?.role === 'HSE_OFFICER';
  const canClose = user?.role === 'ADMIN' || user?.role === 'MANAGEMENT';

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<IncidentDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<InvTab>('DETAILS');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [closureRemarks, setClosureRemarks] = useState('');

  // Investigation Form State
  const [invForm, setInvForm] = useState({
    investigationCode: '',
    investigationDate: new Date().toISOString().slice(0, 10),
    investigationLeader: '',
    investigationTeam: '',
    witnessStatements: '',
    incidentChronology: '',
    unsafeAct: '',
    unsafeCondition: '',
    immediateCause: '',
    contributingFactors: '',
  });

  // Five Whys State
  const [whysForm, setWhysForm] = useState({
    why1: '',
    why2: '',
    why3: '',
    why4: '',
    why5: '',
    finalRootCause: '',
  });

  const loadIncidentsList = useCallback(async () => {
    const list = await api.listIncidents();
    setIncidents(list);
    const paramId = Number(searchParams.get('incidentId'));
    if (paramId && list.some((i) => i.id === paramId)) {
      setSelectedId(paramId);
    } else if (!selectedId && list.length > 0) {
      // Pick first unclosed or first overall
      const activeInc = list.find((i) => i.id === 4) || list[0];
      setSelectedId(activeInc.id);
    }
  }, [searchParams, selectedId]);

  const loadDetail = useCallback(async (incId: number) => {
    const data = await api.getIncidentDetail(incId);
    setDetail(data);
    if (data.investigation) {
      setInvForm({
        investigationCode: data.investigation.investigationCode,
        investigationDate: data.investigation.investigationDate,
        investigationLeader: data.investigation.investigationLeader,
        investigationTeam: data.investigation.investigationTeam,
        witnessStatements: data.investigation.witnessStatements,
        incidentChronology: data.investigation.incidentChronology,
        unsafeAct: data.investigation.unsafeAct,
        unsafeCondition: data.investigation.unsafeCondition,
        immediateCause: data.investigation.immediateCause,
        contributingFactors: data.investigation.contributingFactors,
      });
    } else {
      setInvForm({
        investigationCode: `INV-${data.incident.incidentCode.replace('INC-', '')}`,
        investigationDate: new Date().toISOString().slice(0, 10),
        investigationLeader: user?.fullName || '',
        investigationTeam: '',
        witnessStatements: data.incident.witnessInfo || '',
        incidentChronology: '',
        unsafeAct: '',
        unsafeCondition: '',
        immediateCause: '',
        contributingFactors: '',
      });
    }

    if (data.fiveWhys) {
      setWhysForm({
        why1: data.fiveWhys.why1,
        why2: data.fiveWhys.why2,
        why3: data.fiveWhys.why3,
        why4: data.fiveWhys.why4,
        why5: data.fiveWhys.why5,
        finalRootCause: data.fiveWhys.finalRootCause,
      });
    } else {
      setWhysForm({
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        finalRootCause: '',
      });
    }
  }, [user?.fullName]);

  useEffect(() => {
    loadIncidentsList();
  }, [loadIncidentsList]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId, loadDetail]);

  const handleSelectIncident = (id: number) => {
    setSelectedId(id);
    setSearchParams({ incidentId: String(id) });
    setFeedback(null);
  };

  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setFeedback(null);
    try {
      await api.saveInvestigation(selectedId, invForm);
      await loadDetail(selectedId);
      await loadIncidentsList();
      setFeedback({ type: 'success', text: `Saved investigation ${invForm.investigationCode}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleSaveFiveWhys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setFeedback(null);
    try {
      await api.saveFiveWhys(selectedId, whysForm);
      await loadDetail(selectedId);
      setFeedback({ type: 'success', text: 'Saved Five Whys Root Cause Analysis.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const handleEvidenceUpload = async (file: File | undefined) => {
    if (!file || !selectedId) return;
    setFeedback(null);
    try {
      await api.uploadIncidentEvidence(selectedId, file);
      await loadDetail(selectedId);
      setFeedback({ type: 'success', text: `Uploaded evidence file: ${file.name}` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const handleCloseIncident = async () => {
    if (!selectedId || !closureRemarks.trim()) return;
    setFeedback(null);
    try {
      await api.closeIncident(selectedId, closureRemarks);
      setClosureRemarks('');
      await loadDetail(selectedId);
      await loadIncidentsList();
      setFeedback({ type: 'success', text: 'Incident officially verified and closed.' });
    } catch (err) {
      const e = err as Error & { reasons?: string[] };
      setFeedback({
        type: 'error',
        text: e.reasons ? `${e.message} ${e.reasons.join(' ')}` : e.message,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <SearchCode className="w-5 h-5 text-[#159EBD]" />
              <span>Accident Investigation & Root Cause Analysis</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Conduct investigation chronology, interactive Five Whys, 6M Fishbone diagram, and closure verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="select-incident-inv" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Active Incident:
            </label>
            <select
              id="select-incident-inv"
              value={selectedId ?? ''}
              onChange={(e) => handleSelectIncident(Number(e.target.value))}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 min-w-[260px]"
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.incidentCode} · {inc.employeeName} ({inc.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {detail && (
          <>
            {/* Incident Context Summary */}
            <div className="mt-4 p-4 rounded-xl bg-[#DDF6FC]/55 border border-[#BDEFFA] grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-500 font-semibold">Incident & Date</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">
                  {detail.incident.incidentCode} · {detail.incident.incidentDate}
                </div>
                <div className="text-slate-600">
                  {detail.incident.companyName} · {detail.incident.locationName}
                </div>
              </div>
              <div>
                <div className="text-slate-500 font-semibold">Category & Severity</div>
                <div className="font-bold text-slate-900 mt-0.5">{detail.incident.incidentCategory}</div>
                <div className="text-slate-600">
                  {detail.incident.severity} · Body Part: {detail.incident.affectedBodyPart}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-slate-500 font-semibold">Summary & Immediate Actions</div>
                <div className="text-slate-900 mt-0.5">{detail.incident.incidentDescription}</div>
                <div className="text-slate-600 text-[11px] mt-0.5">
                  Immediate Action: {detail.incident.immediateActions}
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 mt-4" role="tablist">
              {[
                { id: 'DETAILS', label: 'A. Investigation Details' },
                { id: 'FIVE_WHYS', label: 'B. Five Whys Analysis' },
                { id: 'FISHBONE', label: `C. Fishbone Diagram 6M (${detail.fishboneCauses.length})` },
                { id: 'CLOSURE', label: `D. CAPA & Closure Gate (${detail.capas.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  onClick={() => setActiveTab(t.id as InvTab)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-[#159EBD] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {feedback && (
              <div
                role="status"
                className={`mt-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* TAB A: INVESTIGATION DETAILS + EVIDENCE */}
            {activeTab === 'DETAILS' && (
              <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
                <form onSubmit={handleSaveInvestigation} className="xl:col-span-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="inv-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Investigation ID
                      </label>
                      <input
                        id="inv-code"
                        required
                        value={invForm.investigationCode}
                        onChange={(e) => setInvForm({ ...invForm, investigationCode: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Investigation Date
                      </label>
                      <input
                        id="inv-date"
                        type="date"
                        required
                        value={invForm.investigationDate}
                        onChange={(e) => setInvForm({ ...invForm, investigationDate: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-leader" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Investigation Leader
                      </label>
                      <input
                        id="inv-leader"
                        required
                        value={invForm.investigationLeader}
                        onChange={(e) => setInvForm({ ...invForm, investigationLeader: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="inv-team" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Investigation Team
                    </label>
                    <input
                      id="inv-team"
                      required
                      placeholder="HSE Officer, Area Supervisor, Maintenance Engineer"
                      value={invForm.investigationTeam}
                      onChange={(e) => setInvForm({ ...invForm, investigationTeam: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="inv-chron" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Incident Chronology
                    </label>
                    <textarea
                      id="inv-chron"
                      rows={3}
                      required
                      placeholder="Timestamped sequence of events leading up to and following the incident..."
                      value={invForm.incidentChronology}
                      onChange={(e) => setInvForm({ ...invForm, incidentChronology: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="inv-act" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Unsafe Act
                      </label>
                      <input
                        id="inv-act"
                        value={invForm.unsafeAct}
                        onChange={(e) => setInvForm({ ...invForm, unsafeAct: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-cond" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Unsafe Condition
                      </label>
                      <input
                        id="inv-cond"
                        value={invForm.unsafeCondition}
                        onChange={(e) => setInvForm({ ...invForm, unsafeCondition: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-imm" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Immediate Cause
                      </label>
                      <input
                        id="inv-imm"
                        required
                        value={invForm.immediateCause}
                        onChange={(e) => setInvForm({ ...invForm, immediateCause: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-contrib" className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Contributing Factors
                      </label>
                      <input
                        id="inv-contrib"
                        value={invForm.contributingFactors}
                        onChange={(e) => setInvForm({ ...invForm, contributingFactors: e.target.value })}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="inv-wit" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Witness Statements
                    </label>
                    <textarea
                      id="inv-wit"
                      rows={2}
                      value={invForm.witnessStatements}
                      onChange={(e) => setInvForm({ ...invForm, witnessStatements: e.target.value })}
                      className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  {canInvestigate && (
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
                    >
                      Save Investigation Details
                    </button>
                  )}
                </form>

                {/* Incident Evidence Panel */}
                <div className="xl:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-[#159EBD]" />
                      <span>Incident Evidence</span>
                    </h2>
                    <span className="text-xs font-mono text-slate-500">
                      {detail.incident.evidence.length} file(s)
                    </span>
                  </div>

                  {canInvestigate && (
                    <label
                      htmlFor="inv-evidence-upload"
                      className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#159EBD] bg-white hover:bg-[#DDF6FC]/40 cursor-pointer text-xs font-semibold text-[#0F4761]"
                    >
                      <Upload className="w-4 h-4 text-[#159EBD]" />
                      <span>Upload Photo / PDF Evidence</span>
                      <input
                        id="inv-evidence-upload"
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="sr-only"
                        onChange={(e) => handleEvidenceUpload(e.target.files?.[0])}
                      />
                    </label>
                  )}

                  <ul className="space-y-2">
                    {detail.incident.evidence.length === 0 ? (
                      <li className="text-xs text-slate-400 italic py-4 text-center">
                        No photos or supporting documents uploaded yet.
                      </li>
                    ) : (
                      detail.incident.evidence.map((ev) => (
                        <li
                          key={ev.id}
                          className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {ev.originalFilename}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {ev.evidenceType} · {(ev.fileSizeBytes / 1024).toFixed(1)} KB
                            </div>
                          </div>
                          <a
                            href={api.getEvidenceDownloadUrl(ev.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#DDF6FC] text-[#0F4761] font-semibold shrink-0"
                          >
                            Open
                          </a>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB B: INTERACTIVE FIVE WHYS ANALYSIS */}
            {activeTab === 'FIVE_WHYS' && (
              <form onSubmit={handleSaveFiveWhys} className="mt-5 max-w-3xl space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  Trace causal layers sequentially from the direct event symptom down to the systemic root cause.
                </div>

                {[
                  { key: 'why1', label: 'Why 1 (Direct Event Cause)', required: true },
                  { key: 'why2', label: 'Why 2 (System / Process Layer)', required: false },
                  { key: 'why3', label: 'Why 3 (Control / Procedure Gap)', required: false },
                  { key: 'why4', label: 'Why 4 (Management / Resource Factor)', required: false },
                  { key: 'why5', label: 'Why 5 (Deepest Systemic Root)', required: false },
                ].map((step, idx) => (
                  <div key={step.key} className="flex flex-col items-center">
                    <div className="w-full bg-white rounded-xl border border-slate-200 p-3 shadow-2xs">
                      <label
                        htmlFor={`fw-${step.key}`}
                        className="block text-xs font-bold text-[#0F4761] mb-1"
                      >
                        {step.label}
                      </label>
                      <input
                        id={`fw-${step.key}`}
                        required={step.required}
                        placeholder={`Enter causal explanation for Why ${idx + 1}...`}
                        value={whysForm[step.key as keyof typeof whysForm]}
                        onChange={(e) =>
                          setWhysForm({ ...whysForm, [step.key]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                      />
                    </div>
                    <ArrowDown className="w-4 h-4 text-[#159EBD] my-1" />
                  </div>
                ))}

                <div className="bg-[#DDF6FC]/60 rounded-xl border-2 border-[#159EBD] p-4">
                  <label
                    htmlFor="fw-final"
                    className="block text-xs font-extrabold text-[#0F4761] mb-1"
                  >
                    Final Root Cause Statement
                  </label>
                  <textarea
                    id="fw-final"
                    rows={2}
                    required
                    placeholder="Synthesize the systemic root cause to drive Corrective & Preventive Actions..."
                    value={whysForm.finalRootCause}
                    onChange={(e) => setWhysForm({ ...whysForm, finalRootCause: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                {canInvestigate && (
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
                  >
                    Save Five Whys Analysis
                  </button>
                )}
              </form>
            )}

            {/* TAB C: INTERACTIVE 6M FISHBONE DIAGRAM */}
            {activeTab === 'FISHBONE' && (
              <div className="mt-5">
                <FishboneDiagram
                  incidentCode={detail.incident.incidentCode}
                  incidentTitle={detail.incident.incidentDescription}
                  causes={detail.fishboneCauses}
                  canEdit={canInvestigate}
                  onAddCause={async (payload) => {
                    await api.addFishboneCause(detail.incident.id, payload);
                    await loadDetail(detail.incident.id);
                    setFeedback({ type: 'success', text: `Added cause to ${payload.category} branch.` });
                  }}
                  onUpdateCause={async (causeId, payload) => {
                    await api.updateFishboneCause(causeId, payload);
                    await loadDetail(detail.incident.id);
                    setFeedback({ type: 'success', text: 'Updated fishbone cause.' });
                  }}
                  onDeleteCause={async (causeId) => {
                    await api.deleteFishboneCause(causeId);
                    await loadDetail(detail.incident.id);
                    setFeedback({ type: 'success', text: 'Removed fishbone cause.' });
                  }}
                />
              </div>
            )}

            {/* TAB D: CAPA SUMMARY & CLOSURE GATE */}
            {activeTab === 'CLOSURE' && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-[#159EBD]" />
                      <span>Linked CAPA Actions ({detail.capas.length})</span>
                    </h2>
                    <Link
                      to={`/capa?incidentId=${detail.incident.id}`}
                      className="text-xs font-bold text-[#159EBD] hover:underline"
                    >
                      Manage CAPA & Verification →
                    </Link>
                  </div>

                  {detail.capas.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      No CAPA actions have been assigned to this incident yet.
                    </div>
                  ) : (
                    detail.capas.map((c) => (
                      <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-slate-900">{c.capaCode}</span>
                          <span
                            className={`font-bold ${
                              c.effectiveStatus === 'Verified'
                                ? 'text-emerald-700'
                                : c.effectiveStatus === 'Overdue'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            {c.effectiveStatus}
                          </span>
                        </div>
                        <div className="font-medium text-slate-800 mt-1">{c.actionDescription}</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          PIC: {c.responsiblePic} · Due: {c.dueDate} · Type: {c.actionType}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Closure Governance Panel */}
                <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-[#159EBD]" />
                    <span>Incident Closure Verification Gate</span>
                  </h2>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      {detail.investigation ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>Mandatory Investigation Details completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {detail.fiveWhys?.finalRootCause || detail.fishboneCauses.length > 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>Root Cause Analysis (Five Whys or 6M Fishbone) documented</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {detail.capas.length > 0 &&
                      detail.capas.every((c) => c.actionStatus === 'Verified') ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>All required CAPA actions verified</span>
                    </div>
                  </div>

                  {!detail.closureGate.canClose && detail.incident.status !== 'Closed' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Closure Blocked:</span>
                      </div>
                      {detail.closureGate.reasons.map((r) => (
                        <div key={r}>• {r}</div>
                      ))}
                    </div>
                  )}

                  {detail.incident.status === 'Closed' ? (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <strong>Closed</strong> by {detail.incident.closedByName} on{' '}
                      {detail.incident.closedAt?.slice(0, 10)}.
                    </div>
                  ) : canClose ? (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <label htmlFor="closure-remarks" className="block text-[11px] font-semibold text-slate-700">
                        Management Closure Approval Remarks
                      </label>
                      <textarea
                        id="closure-remarks"
                        rows={2}
                        placeholder="Final closure verification notes..."
                        value={closureRemarks}
                        onChange={(e) => setClosureRemarks(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        disabled={!detail.closureGate.canClose || !closureRemarks.trim()}
                        onClick={handleCloseIncident}
                        className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                      >
                        Approve & Close Incident
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Management or Admin role required to approve final incident closure.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
