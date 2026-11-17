import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ClipboardCheck,
  Database,
  FileBarChart2,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  SearchCode,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<'ADMIN' | 'HSE_OFFICER' | 'MANAGEMENT'>;
  primary?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, primary: true },
  { to: '/input', label: 'Input Dashboard', icon: FilePlus2, primary: true },
  { to: '/investigations', label: 'Investigations & RCA', icon: SearchCode },
  { to: '/capa', label: 'CAPA & Verification', icon: ClipboardCheck },
  { to: '/reports', label: 'Reports & Export', icon: FileBarChart2 },
  { to: '/admin', label: 'Admin & Master Data', icon: Settings, roles: ['ADMIN'] },
];

export function Layout() {
  const { user, systemStatus, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const pageTitle =
    visibleItems.find((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    )?.label || 'OHS EXPERT';

  return (
    <div className="min-h-screen bg-[#E5E7EB] text-[#1F2937] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="no-print lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#159EBD] text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 whitespace-nowrap">
            OHS EXPERT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 truncate max-w-[140px]">
            {pageTitle}
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 bg-slate-900/30 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed lg:sticky top-0 left-0 z-40 h-screen w-[240px] shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 flex flex-col gap-5 overflow-y-auto">
          {/* Brand Lockup */}
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-9 h-9 rounded-xl bg-[#159EBD] text-white flex items-center justify-center shadow-sm shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-base tracking-tight text-slate-900 leading-tight whitespace-nowrap">
                OHS EXPERT
              </div>
              <div className="text-[11px] font-medium text-slate-500 truncate">
                Occupational Health & Safety
              </div>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav aria-label="Main navigation" className="flex flex-col gap-1">
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 tracking-wide">
              Core Workspace
            </div>
            {visibleItems
              .filter((i) => i.primary)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#159EBD] text-white shadow-sm'
                          : 'text-slate-700 hover:bg-[#DDF6FC]/60 hover:text-[#0F4761]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

            <div className="px-2 pt-4 pb-1 text-[11px] font-semibold text-slate-400 tracking-wide">
              Safety Workflows
            </div>
            {visibleItems
              .filter((i) => !i.primary)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#DDF6FC] text-[#0F4761] font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
          </nav>
        </div>

        {/* User Profile & Data Mode Footer */}
        <div className="p-4 border-t border-slate-200 flex flex-col gap-3 bg-slate-50/70">
          {systemStatus && (
            <div className="flex items-start gap-2 text-[11px] text-slate-600 px-1">
              <Database className="w-3.5 h-3.5 text-[#159EBD] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-semibold text-slate-800">
                  {systemStatus.mode === 'MYSQL' ? 'MySQL Connected' : 'Demo Store Active'}
                </span>
                <div className="text-slate-500">
                  {systemStatus.mode === 'MYSQL'
                    ? 'Live relational storage'
                    : 'Configure DB_HOST for MySQL'}
                </div>
              </div>
            </div>
          )}

          {user && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{user.fullName}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {user.role.replace('_', ' ')} · {user.departmentName}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-5">
        <Outlet />
      </main>
    </div>
  );
}
