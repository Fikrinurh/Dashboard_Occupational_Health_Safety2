import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CheckCircle2, Settings, SlidersHorizontal, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { AuthUser, ClinicalReferenceRanges, UserRole } from '../shared/types';

export function AdminPage() {
  const { masterData, refreshMasterData } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    userCode: `USR-${Math.floor(100 + Math.random() * 899)}`,
    fullName: '',
    email: '',
    password: '',
    role: 'HSE_OFFICER' as UserRole,
    departmentName: 'Plant Safety',
  });

  const [newCompany, setNewCompany] = useState({
    companyCode: '',
    name: '',
    industry: '',
  });

  const [ranges, setRanges] = useState<ClinicalReferenceRanges | null>(null);

  const loadAdminData = useCallback(async () => {
    const uList = await api.listUsers();
    setUsers(uList);
    if (masterData?.clinicalRanges) {
      setRanges({ ...masterData.clinicalRanges });
    }
  }, [masterData?.clinicalRanges]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createUser(newUser);
    setNewUser({
      userCode: `USR-${Math.floor(100 + Math.random() * 899)}`,
      fullName: '',
      email: '',
      password: '',
      role: 'HSE_OFFICER',
      departmentName: 'Plant Safety',
    });
    await loadAdminData();
    setFeedback('Created new user account.');
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createCompany(newCompany);
    setNewCompany({ companyCode: '', name: '', industry: '' });
    await refreshMasterData();
    setFeedback('Added new company to master data.');
  };

  const handleSaveRanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ranges) return;
    await api.updateClinicalRanges(ranges);
    await refreshMasterData();
    setFeedback('Updated clinical reference ranges and reclassified medical exams.');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#159EBD]" />
            <span>Administration, Master Data & Clinical Thresholds</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Restricted to ADMIN role. Manage user access, companies, sites, and configurable clinical reference ranges.
          </p>
        </div>

        {feedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* User Management */}
        <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
          <form onSubmit={handleCreateUser} className="xl:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#159EBD]" />
              <span>Create User Account</span>
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">User ID</label>
                <input
                  required
                  value={newUser.userCode}
                  onChange={(e) => setNewUser({ ...newUser, userCode: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="HSE_OFFICER">HSE_OFFICER</option>
                  <option value="MANAGEMENT">MANAGEMENT</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
                <input
                  required
                  value={newUser.departmentName}
                  onChange={(e) => setNewUser({ ...newUser, departmentName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
            >
              Add User
            </button>
          </form>

          <div className="xl:col-span-8 border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Name & Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 px-3 font-mono font-semibold">{u.userCode}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-2 px-3 font-semibold text-[#0F4761]">{u.role}</td>
                    <td className="py-2 px-3">{u.departmentName}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateUserStatus(u.id, !u.isActive, u.role);
                          await loadAdminData();
                        }}
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Companies & Clinical Reference Ranges */}
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-5">
          <form onSubmit={handleCreateCompany} className="xl:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#159EBD]" />
              <span>Companies Master ({masterData?.companies.length ?? 0})</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <input
                required
                placeholder="Code (COMP-D)"
                value={newCompany.companyCode}
                onChange={(e) => setNewCompany({ ...newCompany, companyCode: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono"
              />
              <input
                required
                placeholder="Company Name"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
              <input
                placeholder="Industry"
                value={newCompany.industry}
                onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
            >
              Add Company
            </button>
            <ul className="divide-y divide-slate-200 text-xs bg-white rounded-lg border border-slate-200">
              {masterData?.companies.map((c) => (
                <li key={c.id} className="px-3 py-2 flex justify-between">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-slate-500 font-mono">{c.companyCode}</span>
                </li>
              ))}
            </ul>
          </form>

          {ranges && (
            <form onSubmit={handleSaveRanges} className="xl:col-span-7 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#159EBD]" />
                <span>Configurable Clinical Reference Ranges</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    BMI Underweight Max
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ranges.bmiUnderweightMax}
                    onChange={(e) => setRanges({ ...ranges, bmiUnderweightMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    BMI Normal Max
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ranges.bmiNormalMax}
                    onChange={(e) => setRanges({ ...ranges, bmiNormalMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    BMI Overweight Max
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={ranges.bmiOverweightMax}
                    onChange={(e) => setRanges({ ...ranges, bmiOverweightMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Glucose Normal Max
                  </label>
                  <input
                    type="number"
                    value={ranges.glucoseNormalMax}
                    onChange={(e) => setRanges({ ...ranges, glucoseNormalMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cholesterol Normal Max
                  </label>
                  <input
                    type="number"
                    value={ranges.cholesterolNormalMax}
                    onChange={(e) => setRanges({ ...ranges, cholesterolNormalMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Uric Acid Normal Max
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={ranges.uricAcidNormalMax}
                    onChange={(e) => setRanges({ ...ranges, uricAcidNormalMax: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-xs font-bold"
              >
                Save Clinical Thresholds & Reclassify
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
