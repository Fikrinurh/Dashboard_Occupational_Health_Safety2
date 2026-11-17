import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bone,
  CheckCircle2,
  ClipboardList,
  Droplets,
  ExternalLink,
  FileText,
  FolderCheck,
  Hand,
  HeartPulse,
  Scale,
  Search,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnatomicalBodySilhouette,
  DonutWithCenterIcon,
  TrendLineWithRegression,
} from '../components/dashboard/DashboardCharts';
import { FilterPanel } from '../components/dashboard/FilterPanel';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { DashboardFilters, DashboardSummary, Incident } from '../shared/types';

const INITIAL_FILTERS: DashboardFilters = {
  visits: { month: 'ALL', companyId: 'ALL', locationId: 'ALL', shift: 'ALL' },
  exams: { month: 'ALL', companyId: 'ALL', locationId: 'ALL', shift: 'ALL' },
  incidents: { month: 'ALL', companyId: 'ALL', locationId: 'ALL', shift: 'ALL' },
};

export function DashboardPage() {
  const { masterData, systemStatus } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getDashboard(filters)
      .then((res) => {
        if (!active) return;
        setSummary(res.summary);
        setIncidents(res.recentIncidents);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  const filteredTableIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const hay = `${inc.incidentCode} ${inc.employeeName} ${inc.companyName} ${inc.locationName} ${inc.incidentCategory} ${inc.affectedBodyPart}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, tableSearch]);

  const highlightedParts = useMemo(
    () => summary?.incidents.bodyParts.map((b) => b.name) ?? [],
    [summary],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Main Reference Dashboard Container */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-3 sm:p-4 lg:p-5">
        <div className="flex flex-col xl:flex-row gap-4 lg:gap-5 items-stretch">
          {/* Left Vertical 3-Section Filter Panel */}
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            companies={masterData?.companies ?? []}
            locations={masterData?.locations ?? []}
          />

          {/* Right Main Analytics Sections */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Reference Header Row */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight text-slate-900 leading-tight">
                  Occupational Health Monitoring Dashboard
                </h1>
                <div className="text-base sm:text-lg font-bold italic text-[#159EBD] leading-snug">
                  (Health Occupational)
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-extrabold text-slate-900">OHS EXPERT</div>
                    <div className="text-[10px] font-medium text-slate-500">
                      {systemStatus?.mode === 'MYSQL' ? 'MySQL Live Data' : 'Demo Store Mode'}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                {error}
              </div>
            )}

            {/* SECTION A: CLINIC VISITS */}
            <section
              aria-label="Clinic Visits"
              className="rounded-2xl bg-gradient-to-r from-[#DDF6FC] via-[#E8F9FD] to-[#F2FCFE] border border-[#BDEFFA] shadow-sm p-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Left KPI Summary */}
                <div className="lg:col-span-2 flex flex-col items-center lg:items-start text-center lg:text-left">
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0F4761] leading-tight">
                    Clinic Visits
                  </h2>
                  <div className="text-xs font-semibold text-slate-600 mt-0.5">Total Visits</div>
                  <div
                    data-testid="total-clinic-visits"
                    className="text-5xl font-black text-slate-900 tabular-nums tracking-tight my-1"
                  >
                    {loading || !summary ? '—' : summary.clinicVisits.total}
                  </div>
                  <div className="w-full max-w-[168px] border-t-2 border-slate-800 pt-2 mt-1 grid grid-cols-2 gap-2 text-center">
                    <div>
                      <div className="text-[10px] font-extrabold text-[#159EBD] whitespace-nowrap">NEW</div>
                      <div className="text-xl font-black text-slate-900 tabular-nums">
                        {loading || !summary ? '—' : summary.clinicVisits.newVisits}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold text-red-600 whitespace-nowrap">FOLLOW-UP</div>
                      <div className="text-xl font-black text-slate-900 tabular-nums">
                        {loading || !summary ? '—' : summary.clinicVisits.followUpVisits}
                      </div>
                    </div>
                  </div>
                </div>

                {/* General Diagnosis Donut */}
                <div className="lg:col-span-3">
                  <DonutWithCenterIcon
                    title="General Diagnosis"
                    data={summary?.clinicVisits.generalDiagnosis ?? []}
                    centerIcon={<HeartPulse className="w-4 h-4 text-[#159EBD]" />}
                    size={104}
                  />
                </div>

                {/* PAK Diagnosis Donut */}
                <div className="lg:col-span-4">
                  <DonutWithCenterIcon
                    title="Occupational Disease (PAK)"
                    data={summary?.clinicVisits.pakDiagnosis ?? []}
                    centerIcon={<Hand className="w-4 h-4 text-[#159EBD]" />}
                    size={104}
                  />
                </div>

                {/* Visit Trend Line Chart */}
                <div className="lg:col-span-3">
                  <TrendLineWithRegression
                    title="Visit Trend"
                    data={summary?.clinicVisits.trend ?? []}
                    height={144}
                  />
                </div>
              </div>
            </section>

            {/* SECTION B: MEDICAL EXAMINATIONS */}
            <section
              aria-label="Medical Examinations"
              className="rounded-2xl bg-gradient-to-r from-[#BDEFFA] via-[#D3F4FC] to-[#E6F9FE] border border-[#9FE4F7] shadow-sm p-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Exam Trend Line */}
                <div className="lg:col-span-3 flex flex-col">
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0F4761] leading-tight mb-1">
                    Medical Examinations
                  </h2>
                  <TrendLineWithRegression
                    title="Examination Trend"
                    data={summary?.medicalExams.trend ?? []}
                    height={150}
                  />
                </div>

                {/* Examination Reasons Vertical Bar Chart */}
                <div className="lg:col-span-3 flex flex-col min-w-0">
                  <div className="text-xs sm:text-[13px] font-bold text-[#0F4761] text-center mb-1">
                    Examination Reasons
                  </div>
                  <div style={{ width: '100%', height: 175 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={summary?.medicalExams.reasons ?? []}
                        margin={{ top: 18, right: 8, left: -24, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 71, 97, 0.14)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 9, fill: '#334155', fontWeight: 600 }}
                          interval={0}
                          tickFormatter={(v: string) =>
                            v === 'Workplace Accident'
                              ? 'Accident'
                              : v === 'Daily / Periodic Exam'
                              ? 'Periodic'
                              : v === 'Clinic Visit'
                              ? 'Clinic'
                              : 'Special'
                          }
                          axisLine={{ stroke: 'rgba(15, 71, 97, 0.25)' }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fill: '#475569' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: '11px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                          {(summary?.medicalExams.reasons ?? []).map((entry, idx) => (
                            <Cell key={`reason-${idx}`} fill={entry.color} />
                          ))}
                          <LabelList
                            dataKey="count"
                            position="top"
                            style={{ fontSize: 10, fontWeight: 700, fill: '#0F4761' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2x2 Grid of Clinical Donuts */}
                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DonutWithCenterIcon
                    title="Body Mass Index"
                    data={summary?.medicalExams.bmi ?? []}
                    centerIcon={<Scale className="w-4 h-4 text-[#159EBD]" />}
                    size={94}
                  />
                  <DonutWithCenterIcon
                    title="Blood Glucose"
                    data={summary?.medicalExams.glucose ?? []}
                    centerIcon={<Droplets className="w-4 h-4 text-[#159EBD]" />}
                    size={94}
                  />
                  <DonutWithCenterIcon
                    title="Cholesterol Status"
                    data={summary?.medicalExams.cholesterol ?? []}
                    centerIcon={<Activity className="w-4 h-4 text-[#159EBD]" />}
                    size={94}
                  />
                  <DonutWithCenterIcon
                    title="Uric Acid"
                    data={summary?.medicalExams.uricAcid ?? []}
                    centerIcon={<Bone className="w-4 h-4 text-[#159EBD]" />}
                    size={94}
                  />
                </div>
              </div>
            </section>

            {/* SECTION C: WORKPLACE ACCIDENTS - INCIDENT LOG */}
            <section
              aria-label="Workplace Accidents Incident Log"
              className="rounded-2xl bg-gradient-to-r from-[#77D5F0] via-[#90DFF5] to-[#B0E9F9] border border-[#5FC6E6] shadow-sm p-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                {/* Total Incidents + Work-Related Split + Categories */}
                <div className="lg:col-span-5 flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-[#0F4761]">
                      Workplace Accidents
                    </h2>
                    <span className="text-sm font-bold italic text-[#0F4761]/85">
                      (Incident Log)
                    </span>
                  </div>

                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Big Total Number */}
                    <div className="col-span-4 flex flex-col items-center lg:items-start">
                      <div className="text-xs font-bold text-[#0F4761]">Total Incidents</div>
                      <div
                        data-testid="total-incidents"
                        className="text-5xl font-black text-white drop-shadow-xs tabular-nums tracking-tight"
                      >
                        {loading || !summary ? '—' : summary.incidents.total}
                      </div>
                    </div>

                    {/* Two Mini Charts: Work-Related Split & Categories */}
                    <div className="col-span-8 flex flex-col gap-1.5">
                      <div style={{ width: '100%', height: 68 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={summary?.incidents.workRelatedSplit ?? []}
                            margin={{ top: 2, right: 26, left: 4, bottom: 2 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis
                              type="category"
                              dataKey="name"
                              width={112}
                              tick={{ fontSize: 10, fill: '#0F4761', fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Bar dataKey="count" fill="#FFFFFF" radius={[0, 4, 4, 0]} maxBarSize={14} isAnimationActive={false}>
                              <LabelList
                                dataKey="count"
                                position="right"
                                style={{ fontSize: 10, fontWeight: 800, fill: '#0F4761' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ width: '100%', height: 92 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={summary?.incidents.categories ?? []}
                            margin={{ top: 14, right: 6, left: -26, bottom: 2 }}
                          >
                            <XAxis
                              dataKey="shortName"
                              interval={0}
                              tickFormatter={(v: string) =>
                                v === 'Fatality'
                                  ? 'Fat'
                                  : v === 'Near Miss'
                                  ? 'NM'
                                  : v === 'Property'
                                  ? 'Prop'
                                  : v
                              }
                              tick={{ fontSize: 8.5, fill: '#0F4761', fontWeight: 700 }}
                              axisLine={{ stroke: 'rgba(15, 71, 97, 0.3)' }}
                              tickLine={false}
                            />
                            <YAxis
                              allowDecimals={false}
                              domain={[0, (dataMax: number) => Math.max(dataMax + 2, 4)]}
                              tick={{ fontSize: 9, fill: '#0F4761' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                fontSize: '11px',
                                borderRadius: '8px',
                                border: '1px solid #CBD5E1',
                              }}
                            />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                              {(summary?.incidents.categories ?? []).map((c, idx) => (
                                <Cell key={`cat-${idx}`} fill={c.color} />
                              ))}
                              <LabelList
                                dataKey="count"
                                position="top"
                                style={{ fontSize: 9, fontWeight: 800, fill: '#0F4761' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anatomical Body Parts Diagram + Donut */}
                <div className="lg:col-span-4 flex items-center justify-center gap-1">
                  <AnatomicalBodySilhouette highlightedParts={highlightedParts} />
                  <DonutWithCenterIcon
                    title="Affected Body Parts"
                    data={summary?.incidents.bodyParts ?? []}
                    centerIcon={<Stethoscope className="w-4 h-4 text-[#0F4761]" />}
                    size={96}
                    legendCols={2}
                  />
                </div>

                {/* Incident Trend Line Chart */}
                <div className="lg:col-span-3">
                  <TrendLineWithRegression
                    title="Incident Trend"
                    data={summary?.incidents.trend ?? []}
                    height={148}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Additional KPI Strip (Workflow & CAPA Governance) */}
      <section aria-label="Investigation and CAPA KPIs" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Open Investigations',
            value: summary?.workflowKpis.openInvestigations ?? 0,
            icon: ShieldAlert,
            color: 'text-[#159EBD]',
            bg: 'bg-[#DDF6FC]',
          },
          {
            label: 'CAPA In Progress',
            value: summary?.workflowKpis.capaInProgress ?? 0,
            icon: ClipboardList,
            color: 'text-amber-700',
            bg: 'bg-amber-50',
          },
          {
            label: 'Overdue CAPA',
            value: summary?.workflowKpis.overdueCapa ?? 0,
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
          {
            label: 'Waiting Verification',
            value: summary?.workflowKpis.waitingVerification ?? 0,
            icon: Activity,
            color: 'text-sky-700',
            bg: 'bg-sky-50',
          },
          {
            label: 'Verified CAPA',
            value: summary?.workflowKpis.verifiedCapa ?? 0,
            icon: CheckCircle2,
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Closed Incidents',
            value: summary?.workflowKpis.closedIncidents ?? 0,
            icon: FolderCheck,
            color: 'text-slate-700',
            bg: 'bg-slate-100',
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 truncate">{kpi.label}</div>
                <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {loading ? '—' : kpi.value}
                </div>
              </div>
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </section>

      {/* Incident Monitoring Table */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Incident Monitoring Log</h2>
            <p className="text-xs text-slate-500">
              Select any incident to conduct Investigation, Five Whys, 6M Fishbone RCA, or CAPA Verification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search incidents"
                placeholder="Search ID, worker, company..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#159EBD]"
              />
            </div>
            <select
              aria-label="Filter incidents by workflow status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#159EBD]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="CAPA In Progress">CAPA In Progress</option>
              <option value="Waiting Verification">Waiting Verification</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 whitespace-nowrap">Incident ID</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Company / Site</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Employee</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Category</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Body Part</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Severity</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTableIncidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No workplace incidents match the current search filter.
                  </td>
                </tr>
              ) : (
                filteredTableIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[#DDF6FC]/35 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {inc.incidentCode}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                      {inc.incidentDate}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {inc.companyName} · {inc.locationName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium whitespace-nowrap">
                      {inc.employeeName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {inc.incidentCategory}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {inc.affectedBodyPart}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          inc.severity === 'Critical' || inc.severity === 'High'
                            ? 'text-red-600'
                            : inc.severity === 'Medium'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          inc.status === 'Closed'
                            ? 'text-emerald-700'
                            : inc.status === 'Waiting Verification'
                            ? 'text-sky-700'
                            : inc.status === 'Open'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigate(`/investigations?incidentId=${inc.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#159EBD] hover:bg-[#0F4761] text-white font-semibold transition-colors"
                      >
                        <span>Investigate</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
