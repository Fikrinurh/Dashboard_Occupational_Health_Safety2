import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Download, FileBarChart2, FileDown, Printer } from 'lucide-react';
import { api, type IncidentDetailResponse } from '../services/api';
import type { CapaAction, Incident, MedicalExamination } from '../shared/types';

type ReportType =
  | 'INVESTIGATION'
  | 'RCA'
  | 'CAPA'
  | 'MONTHLY_INCIDENT'
  | 'MEDICAL_SUMMARY';

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('INVESTIGATION');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [capas, setCapas] = useState<CapaAction[]>([]);
  const [exams, setExams] = useState<MedicalExamination[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<number>(4);
  const [detail, setDetail] = useState<IncidentDetailResponse | null>(null);

  useEffect(() => {
    Promise.all([api.listIncidents(), api.listCapas(), api.listMedicalExams()]).then(
      ([i, c, e]) => {
        setIncidents(i);
        setCapas(c);
        setExams(e);
        if (i.length > 0 && !i.some((x) => x.id === selectedIncidentId)) {
          setSelectedIncidentId(i[0].id);
        }
      },
    );
  }, [selectedIncidentId]);

  useEffect(() => {
    if (selectedIncidentId) {
      api.getIncidentDetail(selectedIncidentId).then(setDetail).catch(() => {});
    }
  }, [selectedIncidentId]);

  const handleExportCsv = () => {
    if (reportType === 'CAPA') {
      downloadCsv(
        'ohs-capa-report.csv',
        ['CAPA ID', 'Incident ID', 'Type', 'PIC', 'Due Date', 'Status', 'Description'],
        capas.map((c) => [
          c.capaCode,
          c.incidentCode,
          c.actionType,
          c.responsiblePic,
          c.dueDate,
          c.effectiveStatus,
          c.actionDescription,
        ]),
      );
    } else if (reportType === 'MEDICAL_SUMMARY') {
      downloadCsv(
        'ohs-medical-exam-summary.csv',
        ['Exam ID', 'Date', 'Employee', 'Company', 'Type', 'BMI', 'BMI Category', 'Glucose', 'Cholesterol', 'Uric Acid', 'Status'],
        exams.map((e) => [
          e.examCode,
          e.examDate,
          e.employeeName,
          e.companyName,
          e.examType,
          e.bmi,
          e.bmiCategory,
          e.bloodGlucose,
          e.totalCholesterol,
          e.uricAcid,
          e.medicalStatus,
        ]),
      );
    } else if (reportType === 'MONTHLY_INCIDENT') {
      downloadCsv(
        'ohs-monthly-incident-report.csv',
        ['Incident ID', 'Date', 'Company', 'Location', 'Employee', 'Category', 'Work-Related', 'Body Part', 'Severity', 'Status'],
        incidents.map((i) => [
          i.incidentCode,
          i.incidentDate,
          i.companyName,
          i.locationName,
          i.employeeName,
          i.incidentCategory,
          i.workRelatedStatus,
          i.affectedBodyPart,
          i.severity,
          i.status,
        ]),
      );
    } else if (detail) {
      downloadCsv(
        `ohs-${detail.incident.incidentCode}-rca.csv`,
        ['Section', 'Field', 'Value'],
        [
          ['Incident', 'Code', detail.incident.incidentCode],
          ['Incident', 'Description', detail.incident.incidentDescription],
          ['Investigation', 'Leader', detail.investigation?.investigationLeader || 'Pending'],
          ['Investigation', 'Immediate Cause', detail.investigation?.immediateCause || 'Pending'],
          ['Five Whys', 'Final Root Cause', detail.fiveWhys?.finalRootCause || 'Pending'],
          ...detail.fishboneCauses.map((fc) => ['Fishbone 6M', fc.category, fc.causeText]),
        ],
      );
    }
  };

  const handleGeneratePdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(15, 71, 97);
    doc.text('OHS EXPERT - Official Safety & Health Report', 40, 48);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Report Type: ${reportType} | Generated: ${new Date().toISOString().slice(0, 10)}`, 40, 66);

    doc.setTextColor(31, 41, 55);
    let y = 95;
    const writeLine = (text: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const wrapped = doc.splitTextToSize(text, 515);
      for (const line of wrapped) {
        if (y > 770) {
          doc.addPage();
          y = 50;
        }
        doc.text(line, 40, y);
        y += 15;
      }
    };

    if ((reportType === 'INVESTIGATION' || reportType === 'RCA') && detail) {
      writeLine(`Incident: ${detail.incident.incidentCode} (${detail.incident.incidentDate})`, true);
      writeLine(`Employee: ${detail.incident.employeeName} | Company: ${detail.incident.companyName}`);
      writeLine(`Category: ${detail.incident.incidentCategory} | Severity: ${detail.incident.severity}`);
      writeLine(`Description: ${detail.incident.incidentDescription}`);
      y += 8;
      writeLine('Investigation Findings:', true);
      writeLine(`Leader: ${detail.investigation?.investigationLeader || 'Not documented'}`);
      writeLine(`Immediate Cause: ${detail.investigation?.immediateCause || 'Not documented'}`);
      writeLine(`Chronology: ${detail.investigation?.incidentChronology || 'Not documented'}`);
      y += 8;
      writeLine('Five Whys & 6M Fishbone Root Cause Analysis:', true);
      writeLine(`Why 1: ${detail.fiveWhys?.why1 || '-'}`);
      writeLine(`Why 2: ${detail.fiveWhys?.why2 || '-'}`);
      writeLine(`Why 3: ${detail.fiveWhys?.why3 || '-'}`);
      writeLine(`Why 4: ${detail.fiveWhys?.why4 || '-'}`);
      writeLine(`Why 5: ${detail.fiveWhys?.why5 || '-'}`);
      writeLine(`Final Root Cause: ${detail.fiveWhys?.finalRootCause || 'Pending'}`, true);
      y += 6;
      for (const fc of detail.fishboneCauses) {
        writeLine(`[${fc.category}] ${fc.causeText}${fc.isPrimaryRoot ? ' (Primary Root)' : ''}`);
      }
    } else if (reportType === 'CAPA') {
      writeLine(`Corrective & Preventive Action Summary (${capas.length} records)`, true);
      y += 6;
      for (const c of capas) {
        writeLine(`${c.capaCode} [${c.effectiveStatus}] - ${c.incidentCode} | PIC: ${c.responsiblePic} | Due: ${c.dueDate}`, true);
        writeLine(`Action: ${c.actionDescription}`);
        y += 4;
      }
    } else if (reportType === 'MONTHLY_INCIDENT') {
      writeLine(`Workplace Incident Log Summary (${incidents.length} records)`, true);
      y += 6;
      for (const inc of incidents) {
        writeLine(`${inc.incidentCode} | ${inc.incidentDate} | ${inc.incidentCategory} | ${inc.status}`, true);
        writeLine(`${inc.companyName} (${inc.locationName}) - ${inc.incidentDescription}`);
      }
    } else {
      writeLine(`Medical Examination Clinical Summary (${exams.length} records)`, true);
      y += 6;
      for (const ex of exams) {
        writeLine(`${ex.examCode} | ${ex.examDate} | ${ex.employeeName} | BMI: ${ex.bmi} (${ex.bmiCategory}) | ${ex.medicalStatus}`);
      }
    }

    doc.save(`ohs-expert-${reportType.toLowerCase()}.pdf`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileBarChart2 className="w-5 h-5 text-[#159EBD]" />
              <span>OHS Reports, CSV & PDF Export</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate printable compliance reports, CSV datasets, and downloadable PDFs directly from active records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800"
            >
              <Download className="w-3.5 h-3.5 text-[#159EBD]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Report Selector */}
        <div className="no-print flex flex-wrap items-center gap-2 mt-4">
          {[
            { id: 'INVESTIGATION', label: 'Incident Investigation Report' },
            { id: 'RCA', label: 'Root Cause Analysis Report' },
            { id: 'CAPA', label: 'CAPA Report' },
            { id: 'MONTHLY_INCIDENT', label: 'Monthly Incident Report' },
            { id: 'MEDICAL_SUMMARY', label: 'Medical Examination Summary' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReportType(r.id as ReportType)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                reportType === r.id
                  ? 'bg-[#159EBD] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}

          {(reportType === 'INVESTIGATION' || reportType === 'RCA') && (
            <select
              aria-label="Select incident for report"
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(Number(e.target.value))}
              className="ml-auto px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50"
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  {inc.incidentCode} — {inc.employeeName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Printable Report Preview */}
        <div className="mt-5 p-6 rounded-xl border border-slate-200 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <div className="text-xs font-bold text-[#159EBD]">OHS EXPERT COMPLIANCE REPORT</div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {reportType === 'INVESTIGATION' && 'Incident Investigation Report'}
                {reportType === 'RCA' && 'Root Cause Analysis (Five Whys & 6M Fishbone) Report'}
                {reportType === 'CAPA' && 'Corrective & Preventive Action (CAPA) Register'}
                {reportType === 'MONTHLY_INCIDENT' && 'Monthly Workplace Incident Report'}
                {reportType === 'MEDICAL_SUMMARY' && 'Occupational Medical Examination Summary'}
              </h2>
            </div>
            <div className="text-xs font-mono text-slate-500">
              Generated {new Date().toISOString().slice(0, 10)}
            </div>
          </div>

          {(reportType === 'INVESTIGATION' || reportType === 'RCA') && detail && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div><strong>Incident ID:</strong> {detail.incident.incidentCode}</div>
                <div><strong>Date:</strong> {detail.incident.incidentDate}</div>
                <div><strong>Company:</strong> {detail.incident.companyName}</div>
                <div><strong>Status:</strong> {detail.incident.status}</div>
              </div>
              <div>
                <strong>Incident Summary:</strong> {detail.incident.incidentDescription}
              </div>
              <div>
                <strong>Investigation Leader & Team:</strong>{' '}
                {detail.investigation?.investigationLeader || 'Pending'} —{' '}
                {detail.investigation?.investigationTeam || 'Not recorded'}
              </div>
              <div>
                <strong>Immediate Cause:</strong>{' '}
                {detail.investigation?.immediateCause || 'Not recorded'}
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="font-bold text-slate-900 mb-1">Five Whys Chain</div>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>{detail.fiveWhys?.why1 || '—'}</li>
                  <li>{detail.fiveWhys?.why2 || '—'}</li>
                  <li>{detail.fiveWhys?.why3 || '—'}</li>
                  <li>{detail.fiveWhys?.why4 || '—'}</li>
                  <li>{detail.fiveWhys?.why5 || '—'}</li>
                </ol>
                <div className="mt-2 p-2.5 rounded-lg bg-[#DDF6FC] font-semibold text-[#0F4761]">
                  Final Root Cause: {detail.fiveWhys?.finalRootCause || 'Not documented'}
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="font-bold text-slate-900 mb-1">
                  6M Fishbone Causes ({detail.fishboneCauses.length})
                </div>
                <ul className="space-y-1">
                  {detail.fishboneCauses.map((fc) => (
                    <li key={fc.id}>
                      <strong>[{fc.category}]</strong> {fc.causeText}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {reportType === 'CAPA' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-2">CAPA ID</th>
                  <th className="py-2 px-2">Incident</th>
                  <th className="py-2 px-2">Description</th>
                  <th className="py-2 px-2">PIC</th>
                  <th className="py-2 px-2">Due Date</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {capas.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2 font-mono font-bold">{c.capaCode}</td>
                    <td className="py-2 px-2 font-mono">{c.incidentCode}</td>
                    <td className="py-2 px-2">{c.actionDescription}</td>
                    <td className="py-2 px-2">{c.responsiblePic}</td>
                    <td className="py-2 px-2 font-mono">{c.dueDate}</td>
                    <td className="py-2 px-2 font-semibold">{c.effectiveStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'MONTHLY_INCIDENT' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-2">Incident ID</th>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Company / Site</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2">Body Part</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td className="py-2 px-2 font-mono font-bold">{inc.incidentCode}</td>
                    <td className="py-2 px-2 font-mono">{inc.incidentDate}</td>
                    <td className="py-2 px-2">{inc.companyName} · {inc.locationName}</td>
                    <td className="py-2 px-2">{inc.incidentCategory}</td>
                    <td className="py-2 px-2">{inc.affectedBodyPart}</td>
                    <td className="py-2 px-2 font-semibold">{inc.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reportType === 'MEDICAL_SUMMARY' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2 px-2">Exam ID</th>
                  <th className="py-2 px-2">Date</th>
                  <th className="py-2 px-2">Employee</th>
                  <th className="py-2 px-2">BMI</th>
                  <th className="py-2 px-2">Glucose</th>
                  <th className="py-2 px-2">Cholesterol</th>
                  <th className="py-2 px-2">Uric Acid</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map((ex) => (
                  <tr key={ex.id}>
                    <td className="py-2 px-2 font-mono font-bold">{ex.examCode}</td>
                    <td className="py-2 px-2 font-mono">{ex.examDate}</td>
                    <td className="py-2 px-2">{ex.employeeName}</td>
                    <td className="py-2 px-2 font-mono">{ex.bmi} ({ex.bmiCategory})</td>
                    <td className="py-2 px-2 font-mono">{ex.bloodGlucose}</td>
                    <td className="py-2 px-2 font-mono">{ex.totalCholesterol}</td>
                    <td className="py-2 px-2 font-mono">{ex.uricAcid}</td>
                    <td className="py-2 px-2 font-semibold">{ex.medicalStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
