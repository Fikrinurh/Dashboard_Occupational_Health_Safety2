import React, { useState } from 'react';
import { Edit3, Plus, Star, Trash2, X } from 'lucide-react';
import type { FishboneCategory, FishboneCause } from '../../shared/types';

interface FishboneDiagramProps {
  incidentCode: string;
  incidentTitle: string;
  causes: FishboneCause[];
  canEdit: boolean;
  onAddCause: (payload: {
    category: FishboneCategory;
    causeText: string;
    subCauseText: string;
    isPrimaryRoot: boolean;
  }) => Promise<void>;
  onUpdateCause: (
    causeId: number,
    payload: {
      category: FishboneCategory;
      causeText: string;
      subCauseText: string;
      isPrimaryRoot: boolean;
    },
  ) => Promise<void>;
  onDeleteCause: (causeId: number) => Promise<void>;
}

const TOP_CATEGORIES: { key: FishboneCategory; label: string; color: string }[] = [
  { key: 'Man', label: 'Man (Personnel)', color: '#159EBD' },
  { key: 'Machine', label: 'Machine (Equipment)', color: '#0F4761' },
  { key: 'Method', label: 'Method (Procedure)', color: '#D97706' },
];

const BOTTOM_CATEGORIES: { key: FishboneCategory; label: string; color: string }[] = [
  { key: 'Material', label: 'Material', color: '#16A34A' },
  { key: 'Measurement', label: 'Measurement', color: '#7C3AED' },
  { key: 'Environment', label: 'Mother Nature / Environment', color: '#DC2626' },
];

const ALL_CATEGORIES: FishboneCategory[] = [
  'Man',
  'Machine',
  'Method',
  'Material',
  'Measurement',
  'Environment',
];

export function FishboneDiagram({
  incidentCode,
  incidentTitle,
  causes,
  canEdit,
  onAddCause,
  onUpdateCause,
  onDeleteCause,
}: FishboneDiagramProps) {
  const [selectedCategory, setSelectedCategory] = useState<FishboneCategory>('Man');
  const [editingCause, setEditingCause] = useState<FishboneCause | null>(null);
  const [causeText, setCauseText] = useState('');
  const [subCauseText, setSubCauseText] = useState('');
  const [isPrimaryRoot, setIsPrimaryRoot] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAddForCategory = (cat: FishboneCategory) => {
    setEditingCause(null);
    setSelectedCategory(cat);
    setCauseText('');
    setSubCauseText('');
    setIsPrimaryRoot(false);
  };

  const openEdit = (cause: FishboneCause) => {
    setEditingCause(cause);
    setSelectedCategory(cause.category);
    setCauseText(cause.causeText);
    setSubCauseText(cause.subCauseText || '');
    setIsPrimaryRoot(cause.isPrimaryRoot);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!causeText.trim()) return;
    setSaving(true);
    try {
      if (editingCause) {
        await onUpdateCause(editingCause.id, {
          category: selectedCategory,
          causeText: causeText.trim(),
          subCauseText: subCauseText.trim(),
          isPrimaryRoot,
        });
        setEditingCause(null);
      } else {
        await onAddCause({
          category: selectedCategory,
          causeText: causeText.trim(),
          subCauseText: subCauseText.trim(),
          isPrimaryRoot,
        });
      }
      setCauseText('');
      setSubCauseText('');
      setIsPrimaryRoot(false);
    } finally {
      setSaving(false);
    }
  };

  const renderCategoryColumn = (
    cat: { key: FishboneCategory; label: string; color: string },
    position: 'top' | 'bottom',
  ) => {
    const items = causes.filter((c) => c.category === cat.key);
    return (
      <div
        key={cat.key}
        className={`flex flex-col ${
          position === 'top' ? 'justify-end' : 'justify-start'
        } bg-white rounded-xl border border-slate-200 shadow-2xs p-3 relative`}
      >
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
          <button
            type="button"
            onClick={() => openAddForCategory(cat.key)}
            className="text-left text-xs font-extrabold tracking-tight hover:underline"
            style={{ color: cat.color }}
          >
            {cat.label}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => openAddForCategory(cat.key)}
              aria-label={`Add cause to ${cat.key}`}
              className="p-1 rounded-md bg-slate-100 hover:bg-[#DDF6FC] text-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <ul className="space-y-1.5 min-h-[76px]">
          {items.length === 0 ? (
            <li className="text-[11px] text-slate-400 italic py-2">
              No {cat.key} causes added yet.
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-1.5 ${
                  item.isPrimaryRoot
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 leading-snug flex items-center gap-1">
                    {item.isPrimaryRoot && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                    <span>{item.causeText}</span>
                  </div>
                  {item.subCauseText && (
                    <div className="text-[11px] text-slate-500 mt-0.5">↳ {item.subCauseText}</div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit cause ${item.causeText}`}
                      onClick={() => openEdit(item)}
                      className="p-1 rounded hover:bg-white text-[#159EBD]"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete cause ${item.causeText}`}
                      onClick={() => onDeleteCause(item.id)}
                      className="p-1 rounded hover:bg-white text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Interactive Visual Ishikawa 6M Diagram Canvas */}
      <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 p-4 overflow-x-auto">
        <div className="min-w-[820px]">
          {/* Top 3M Branches (Man, Machine, Method) */}
          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-9 grid grid-cols-3 gap-4">
              {TOP_CATEGORIES.map((cat) => renderCategoryColumn(cat, 'top'))}
            </div>
            <div className="col-span-3" />
          </div>

          {/* Central SVG Spine & Diagonal 6M Bones pointing to Effect Head */}
          <svg
            viewBox="0 0 1000 110"
            className="w-full h-[88px] my-0.5"
            role="img"
            aria-label="Ishikawa 6M Fishbone Spine Diagram"
          >
            {/* Top Diagonal Ribs */}
            <line x1="125" y1="0" x2="210" y2="55" stroke="#159EBD" strokeWidth="3" />
            <line x1="375" y1="0" x2="460" y2="55" stroke="#0F4761" strokeWidth="3" />
            <line x1="625" y1="0" x2="710" y2="55" stroke="#D97706" strokeWidth="3" />

            {/* Bottom Diagonal Ribs */}
            <line x1="125" y1="110" x2="210" y2="55" stroke="#16A34A" strokeWidth="3" />
            <line x1="375" y1="110" x2="460" y2="55" stroke="#7C3AED" strokeWidth="3" />
            <line x1="625" y1="110" x2="710" y2="55" stroke="#DC2626" strokeWidth="3" />

            {/* Main Horizontal Spine */}
            <line x1="40" y1="55" x2="770" y2="55" stroke="#0F4761" strokeWidth="4" />
            <polygon points="770,45 792,55 770,65" fill="#0F4761" />

            {/* Incident Effect Head Box */}
            <rect
              x="795"
              y="14"
              width="200"
              height="82"
              rx="12"
              fill="#0F4761"
              stroke="#159EBD"
              strokeWidth="2.5"
            />
            <text
              x="895"
              y="40"
              textAnchor="middle"
              fill="#BDEFFA"
              fontSize="12"
              fontWeight="700"
            >
              EFFECT / INCIDENT
            </text>
            <text
              x="895"
              y="60"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="14"
              fontWeight="800"
            >
              {incidentCode}
            </text>
            <text
              x="895"
              y="79"
              textAnchor="middle"
              fill="#E2E8F0"
              fontSize="10.5"
            >
              {incidentTitle.slice(0, 28)}
              {incidentTitle.length > 28 ? '...' : ''}
            </text>
          </svg>

          {/* Bottom 3M Branches (Material, Measurement, Environment) */}
          <div className="grid grid-cols-12 gap-4 items-start">
            <div className="col-span-9 grid grid-cols-3 gap-4">
              {BOTTOM_CATEGORIES.map((cat) => renderCategoryColumn(cat, 'bottom'))}
            </div>
            <div className="col-span-3 flex items-center justify-center pt-4">
              <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl p-3">
                Click <strong>+</strong> on any 6M category branch to attach causes, mark primary
                root causes with ★, or edit/delete directly.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Cause Controls */}
      {canEdit && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="md:col-span-2">
            <label htmlFor="fb-cat" className="block text-[11px] font-semibold text-slate-700 mb-1">
              6M Category
            </label>
            <select
              id="fb-cat"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as FishboneCategory)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'Environment' ? 'Mother Nature / Environment' : c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label htmlFor="fb-cause" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Cause Description
            </label>
            <input
              id="fb-cause"
              required
              placeholder="Enter contributing cause for selected 6M bone..."
              value={causeText}
              onChange={(e) => setCauseText(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="fb-sub" className="block text-[11px] font-semibold text-slate-700 mb-1">
              Sub-Cause (Optional)
            </label>
            <input
              id="fb-sub"
              placeholder="Underlying detail..."
              value={subCauseText}
              onChange={(e) => setSubCauseText(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimaryRoot}
                onChange={(e) => setIsPrimaryRoot(e.target.checked)}
                className="rounded border-slate-300 text-[#159EBD]"
              />
              <span>Primary Root</span>
            </label>
            <div className="flex items-center gap-1.5">
              {editingCause && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCause(null);
                    setCauseText('');
                    setSubCauseText('');
                  }}
                  aria-label="Cancel cause edit"
                  className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold whitespace-nowrap"
              >
                {editingCause ? 'Update Cause' : 'Add to Fishbone'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
