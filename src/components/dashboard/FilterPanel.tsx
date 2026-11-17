import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import type { Company, DashboardFilters, LocationItem, SectionFilter } from '../../shared/types';

interface FilterPanelProps {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  companies: Company[];
  locations: LocationItem[];
}

const MONTHS_2026 = [
  { code: 'ALL', label: 'ALL' },
  { code: '2026-01', label: 'JAN' },
  { code: '2026-02', label: 'FEB' },
  { code: '2026-03', label: 'MAR' },
  { code: '2026-04', label: 'APR' },
  { code: '2026-05', label: 'MAY' },
  { code: '2026-06', label: 'JUN' },
];

interface SectionFilterBlockProps {
  titleDate: string;
  accentBg: string;
  accentBorder: string;
  accentFill: string;
  filter: SectionFilter;
  onUpdate: (next: SectionFilter) => void;
  companies: Company[];
  locations: LocationItem[];
}

function SectionFilterBlock({
  titleDate,
  accentBg,
  accentBorder,
  accentFill,
  filter,
  onUpdate,
  companies,
  locations,
}: SectionFilterBlockProps) {
  const reset = () =>
    onUpdate({
      month: 'ALL',
      companyId: 'ALL',
      locationId: 'ALL',
      shift: 'ALL',
    });

  return (
    <div className="flex flex-col gap-2">
      {/* Date / Month Timeline Box */}
      <div className="bg-white rounded-md border border-slate-300 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200 bg-slate-50/70">
          <span className="text-xs font-bold text-slate-800">{titleDate}</span>
          <button
            type="button"
            onClick={reset}
            title={`Reset ${titleDate} filters`}
            aria-label={`Reset ${titleDate} filters`}
            className="text-slate-500 hover:text-slate-900 p-0.5 rounded"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-2 pt-1.5 pb-2">
          <div className="text-[10px] font-semibold text-slate-500 text-center mb-1 tabular-nums">
            2026
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {MONTHS_2026.map((m) => {
              const active = filter.month === m.code;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => onUpdate({ ...filter, month: m.code })}
                  className={`py-1 text-[10px] font-bold rounded-xs border transition-colors ${
                    active
                      ? `${accentFill} text-slate-900 ${accentBorder}`
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Company Box */}
      <div className="bg-white rounded-md border border-slate-300 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-200">
          <label
            htmlFor={`company-${titleDate}`}
            className="text-xs font-bold text-slate-800"
          >
            Company
          </label>
          <Filter className="w-3 h-3 text-slate-400" />
        </div>
        <div className="p-1.5">
          <select
            id={`company-${titleDate}`}
            value={filter.companyId}
            onChange={(e) => onUpdate({ ...filter, companyId: e.target.value })}
            className={`w-full text-xs font-semibold text-slate-900 px-2 py-1.5 rounded-xs border ${accentBorder} ${accentBg} focus:outline-none`}
          >
            <option value="ALL">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Location + Shift Side-by-Side Boxes */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-white rounded-md border border-slate-300 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200">
            <label
              htmlFor={`location-${titleDate}`}
              className="text-[11px] font-bold text-slate-800 truncate"
            >
              Location
            </label>
          </div>
          <div className="p-1">
            <select
              id={`location-${titleDate}`}
              value={filter.locationId}
              onChange={(e) => onUpdate({ ...filter, locationId: e.target.value })}
              className={`w-full text-[11px] font-semibold text-slate-900 px-1.5 py-1.5 rounded-xs border ${accentBorder} ${accentBg} focus:outline-none`}
            >
              <option value="ALL">All</option>
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-300 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200">
            <label
              htmlFor={`shift-${titleDate}`}
              className="text-[11px] font-bold text-slate-800 truncate"
            >
              Shift
            </label>
          </div>
          <div className="p-1">
            <select
              id={`shift-${titleDate}`}
              value={filter.shift}
              onChange={(e) => onUpdate({ ...filter, shift: e.target.value })}
              className={`w-full text-[11px] font-semibold text-slate-900 px-1.5 py-1.5 rounded-xs border ${accentBorder} ${accentBg} focus:outline-none`}
            >
              <option value="ALL">All</option>
              <option value="Pagi">Pagi</option>
              <option value="Siang">Siang</option>
              <option value="Malam">Malam</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilterPanel({ filters, onChange, companies, locations }: FilterPanelProps) {
  return (
    <aside
      aria-label="Dashboard Filters"
      className="w-full xl:w-[255px] shrink-0 flex flex-col gap-4"
    >
      {/* Block 1: Clinic Visits (Cyan Theme) */}
      <SectionFilterBlock
        titleDate="Visit Date"
        accentBg="bg-[#BDEFFA]/75"
        accentBorder="border-[#159EBD]/50"
        accentFill="bg-[#69C4DF]"
        filter={filters.visits}
        onUpdate={(visits) => onChange({ ...filters, visits })}
        companies={companies}
        locations={locations}
      />

      {/* Block 2: Medical Examinations (Peach/Amber Theme matching reference) */}
      <SectionFilterBlock
        titleDate="Exam Date"
        accentBg="bg-[#FAD8BF]/85"
        accentBorder="border-[#D98245]/50"
        accentFill="bg-[#EFA776]"
        filter={filters.exams}
        onUpdate={(exams) => onChange({ ...filters, exams })}
        companies={companies}
        locations={locations}
      />

      {/* Block 3: Workplace Accidents (Green Theme matching reference) */}
      <SectionFilterBlock
        titleDate="Incident Date"
        accentBg="bg-[#BBF7D0]/85"
        accentBorder="border-[#16A34A]/50"
        accentFill="bg-[#6ED37F]"
        filter={filters.incidents}
        onUpdate={(incidents) => onChange({ ...filters, incidents })}
        companies={companies}
        locations={locations}
      />
    </aside>
  );
}
