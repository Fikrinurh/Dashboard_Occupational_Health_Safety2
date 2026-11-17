import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  History,
  Paperclip,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { AuditLog, CapaAction, Incident } from '../shared/types';

export function CapaVerificationPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canManageCapa = user?.role === 'ADMIN' || user?.role === 'HSE_OFFICER';
  const canVerify = user?.role === 'ADMIN' || user?.role === 'MANAGEMENT';

  const [capas, setCapas] = useState<CapaAction[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [verifyTarget, setVerifyTarget] = useState<CapaAction | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState('');

  const defaultIncidentId = Number(searchParams.get('incidentId')) || 4;
  const [form, setForm] = useState({
    capaCode: `CAPA-2026-${String(Math.floor(100 + Math.random() * 899))}`,
    incidentId: defaultIncidentId,
    rootCause: '',
    actionDescription: '',
    actionType: 'Corrective Action' as CapaAction['actionType'],
    responsiblePic: '',
    departmentName: 'Plant Operations',
    priority: 'High' as CapaAction['priority'],
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    actionStatus: 'Open' as CapaAction['actionStatus'],
    completionNotes: '',
  });

  const loadData = useCallback(async () => {
    const [cList, iList, logs] = await Promise.all([
      api.listCapas(),
      api.listIncidents(),
      api.listAuditLogs(50),
    ]);
    setCapas(cList);
    setIncidents(iList);
    setAuditLogs(logs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const created = await api.createCapa(form);
      setForm((prev) => ({
        ...prev,
        capaCode: `CAPA-2026-${String(Math.floor(100 + Math.random() * 899))}`,
        actionDescription: '',
        completionNotes: '',
      }));
      await loadData();
      setFeedback({ type: 'success', text: `Created CAPA ${created.capaCode}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create CAPA' });
    }
  };

  const handleAdvanceStatus = async (capa: CapaAction, nextStatus: CapaAction['actionStatus']) => {
    setFeedback(null);
    try {
      await api.updateCapa(capa.id, {
        actionStatus: nextStatus,
        completionDate:
          nextStatus === 'Waiting Verification' ? new Date().toISOString().slice(0, 10) : null,
      });
      await loadData();
      setFeedback({ type: 'success', text: `${capa.capaCode} moved to ${nextStatus}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Update failed' });
    }
  };

  const handleEvidenceUpload = async (capaId: number, file: File | undefined) => {
    if (!file) return;
    setFeedback(null);
    try {
      await api.uploadCapaEvidence(capaId, file);
      await loadData();
      setFeedback({ type: 'success', text: `Attached evidence ${file.name}.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    }
  };

  const handleVerifyDecision = async (decision: 'APPROVED' | 'REJECTED' | 'REOPENED') => {
    if (!verifyTarget || !verifyRemarks.trim()) return;
    setFeedback(null);
    try {
      await api.verifyCapa(verifyTarget.id, decision, verifyRemarks.trim());
      setVerifyTarget(null);
      setVerifyRemarks('');
      await loadData();
      setFeedback({ type: 'success', text: `CAPA verification recorded (${decision}).` });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Verification failed' });
    }
  };

  const filteredCapas = capas.filter((c) => {
    if (statusFilter === 'ALL') return true;
    return c.effectiveStatus === statusFilter;
  });

  const overdueCount = capas.filter((c) => c.effectiveStatus === 'Overdue').length;
  const waitingCount = capas.filter((c) => c.actionStatus === 'Waiting Verification').length;
  const verifiedCount = capas.filter((c) => c.actionStatus === 'Verified').length;

  return (
    <div className="flex flex-col gap-5">
      {/* CAPA Overview Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#159EBD]" />
              <span>CAPA Management & Verification Workflow</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track Corrective & Preventive Actions, automatic overdue detection, completion evidence, and management sign-off.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs tabular-nums">
            <span className="font-semibold text-red-600">{overdueCount} Overdue</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-sky-700">{waitingCount} Waiting Verification</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-emerald-700">{verifiedCount} Verified</span>
          </div>
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

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Create CAPA Form */}
          {canManageCapa && (
            <form
              onSubmit={handleCreateCapa}
              className="xl:col-span-4 bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <h2 className="text-sm font-bold text-slate-900">Create CAPA Action</h2>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="capa-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    CAPA ID
                  </label>
                  <input
                    id="capa-code"
                    required
                    value={form.capaCode}
                    onChange={(e) => setForm({ ...form, capaCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="capa-inc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Linked Incident
                  </label>
                  <select
                    id="capa-inc"
                    value={form.incidentId}
                    onChange={(e) => setForm({ ...form, incidentId: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {incidents.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.incidentCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor="capa-rc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Root Cause Reference
                  </label>
                  <input
                    id="capa-rc"
                    required
                    placeholder="Summarized root cause from Five Whys / Fishbone"
                    value={form.rootCause}
                    onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="capa-desc" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Action Description
                  </label>
                  <textarea
                    id="capa-desc"
                    rows={2}
                    required
                    placeholder="Specific corrective or preventive control measure..."
                    value={form.actionDescription}
                    onChange={(e) => setForm({ ...form, actionDescription: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="capa-type" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Action Type
                  </label>
                  <select
                    id="capa-type"
                    value={form.actionType}
                    onChange={(e) =>
                      setForm({ ...form, actionType: e.target.value as CapaAction['actionType'] })
                    }
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Corrective Action">Corrective Action</option>
                    <option value="Preventive Action">Preventive Action</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="capa-prio" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    id="capa-prio"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value as CapaAction['priority'] })
                    }
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="capa-pic" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Responsible PIC
                  </label>
                  <input
                    id="capa-pic"
                    required
                    placeholder="Name of PIC"
                    value={form.responsiblePic}
                    onChange={(e) => setForm({ ...form, responsiblePic: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="capa-dept" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    id="capa-dept"
                    required
                    value={form.departmentName}
                    onChange={(e) => setForm({ ...form, departmentName: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="capa-start" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    id="capa-start"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="capa-due" className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    id="capa-due"
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
              >
                Create CAPA Action
              </button>
            </form>
          )}

          {/* CAPA Monitoring Table */}
          <div className={canManageCapa ? 'xl:col-span-8' : 'xl:col-span-12'}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-slate-900">CAPA Monitoring Table</h2>
              <select
                aria-label="Filter CAPA status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">All CAPAs</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Overdue">Overdue</option>
                <option value="Waiting Verification">Waiting Verification</option>
                <option value="Verified">Verified</option>
                <option value="Rejected / Reopened">Rejected / Reopened</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">CAPA / Incident</th>
                    <th className="py-2.5 px-3">Action & PIC</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Evidence</th>
                    <th className="py-2.5 px-3 text-right">Workflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCapas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">{c.capaCode}</div>
                        <div className="text-[11px] font-mono text-[#159EBD]">{c.incidentCode}</div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[260px]">
                        <div className="font-medium text-slate-900">{c.actionDescription}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.actionType} · PIC: {c.responsiblePic} ({c.departmentName})
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">
                        <div>{c.dueDate}</div>
                        {c.effectiveStatus === 'Overdue' && (
                          <div className="text-[10px] font-bold text-red-600 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            <span>OVERDUE</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        <span
                          className={
                            c.effectiveStatus === 'Verified'
                              ? 'text-emerald-700'
                              : c.effectiveStatus === 'Overdue' || c.effectiveStatus === 'Rejected / Reopened'
                              ? 'text-red-600'
                              : c.effectiveStatus === 'Waiting Verification'
                              ? 'text-sky-700'
                              : 'text-amber-700'
                          }
                        >
                          {c.effectiveStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          {c.evidence.map((ev) => (
                            <a
                              key={ev.id}
                              href={api.getEvidenceDownloadUrl(ev.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#159EBD] hover:underline"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate max-w-[100px]">{ev.originalFilename}</span>
                            </a>
                          ))}
                          {canManageCapa && c.actionStatus !== 'Verified' && (
                            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#159EBD] cursor-pointer">
                              <Upload className="w-3 h-3" />
                              <span>Attach</span>
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                className="sr-only"
                                onChange={(e) => handleEvidenceUpload(c.id, e.target.files?.[0])}
                              />
                            </label>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {canManageCapa &&
                            (c.actionStatus === 'Open' ||
                              c.actionStatus === 'In Progress' ||
                              c.actionStatus === 'Rejected / Reopened') && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(c, 'Waiting Verification')}
                                className="px-2 py-1 rounded-lg bg-[#159EBD] hover:bg-[#0F4761] text-white font-semibold"
                              >
                                Submit Verification
                              </button>
                            )}
                          {canVerify && c.actionStatus === 'Waiting Verification' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerifyTarget(c);
                                setVerifyRemarks('');
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            >
                              Verify
                            </button>
                          )}
                          {canManageCapa && c.actionStatus !== 'Verified' && (
                            <button
                              type="button"
                              aria-label={`Delete ${c.capaCode}`}
                              onClick={async () => {
                                await api.deleteCapa(c.id);
                                await loadData();
                              }}
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-[#159EBD]" />
          <span>System Audit Trail</span>
        </h2>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Entity</th>
                <th className="py-2 px-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {log.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{log.userEmail}</span>{' '}
                    <span className="text-slate-400">({log.userRole})</span>
                  </td>
                  <td className="py-2 px-3 font-mono font-semibold text-[#0F4761] whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2 px-3 font-mono whitespace-nowrap">
                    {log.entityType} · {log.entityId}
                  </td>
                  <td className="py-2 px-3 text-slate-700">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Decision Modal */}
      {verifyTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Verify ${verifyTarget.capaCode}`}
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-[#159EBD]" />
              <span>Verify CAPA {verifyTarget.capaCode}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-semibold text-slate-900">{verifyTarget.actionDescription}</div>
              <div className="text-slate-500">
                PIC: {verifyTarget.responsiblePic} · Notes: {verifyTarget.completionNotes || 'None'}
              </div>
            </div>
            <div>
              <label htmlFor="verify-remarks" className="block text-xs font-semibold text-slate-700 mb-1">
                Verification Remarks (Required)
              </label>
              <textarea
                id="verify-remarks"
                rows={3}
                placeholder="Document field inspection findings or reason for rejection..."
                value={verifyRemarks}
                onChange={(e) => setVerifyRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVerifyTarget(null)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!verifyRemarks.trim()}
                onClick={() => handleVerifyDecision('REJECTED')}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                disabled={!verifyRemarks.trim()}
                onClick={() => handleVerifyDecision('REOPENED')}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen</span>
              </button>
              <button
                type="button"
                disabled={!verifyRemarks.trim()}
                onClick={() => handleVerifyDecision('APPROVED')}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
