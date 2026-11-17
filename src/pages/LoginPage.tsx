import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Activity, Database, Lock, Mail, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../shared/types';
import { loginSchema } from '../shared/validation';

interface LoginFormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login, demoLogin, systemStatus } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoAccess = async (role: UserRole) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await demoLogin(role);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Brand & System Overview Column */}
        <div className="bg-gradient-to-br from-[#0F4761] via-[#159EBD] to-[#2BB3D0] text-white p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">OHS EXPERT</h1>
                <p className="text-xs text-[#DDF6FC]">
                  Occupational Health & Safety Management System
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold leading-snug mb-3">
              Enterprise Health Monitoring, RCA & CAPA Governance
            </h2>
            <p className="text-sm text-[#DDF6FC] leading-relaxed">
              Centralized clinical visit tracking, medical examination reference classification,
              workplace incident investigation (Five Whys & 6M Fishbone), CAPA workflows, and
              management verification.
            </p>
          </div>

          <div className="mt-8 pt-5 border-t border-white/20 text-xs space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#BDEFFA] shrink-0" />
              <span>
                Storage Mode:{' '}
                <strong className="font-semibold">
                  {systemStatus?.mode === 'MYSQL' ? 'MySQL Production Pool' : 'Demo Store (MySQL not configured)'}
                </strong>
              </span>
            </div>
            <p className="text-[#DDF6FC]/90 leading-relaxed">
              {systemStatus?.message || 'Checking server database connectivity...'}
            </p>
          </div>
        </div>

        {/* Sign-In Form Column */}
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Sign in to OHS EXPERT</h2>
            <p className="text-sm text-slate-500 mt-1">
              Medical examination records and investigation controls are protected by role-based
              access control.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@ohsexpert.io"
                  {...register('email')}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#159EBD] focus:border-[#159EBD]"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#159EBD] focus:border-[#159EBD]"
                />
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#159EBD] hover:bg-[#0F4761] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {systemStatus?.mode === 'DEMO_STORE' && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#159EBD]" />
                <span>Quick Demo Access (Non-Production Demo Mode)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoAccess('ADMIN')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#DDF6FC] hover:border-[#159EBD] text-left transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#159EBD]" />
                    <span>Admin</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Full Access</div>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoAccess('HSE_OFFICER')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#DDF6FC] hover:border-[#159EBD] text-left transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900">HSE Officer</div>
                  <div className="text-[11px] text-slate-500">Inputs & RCA</div>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoAccess('MANAGEMENT')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#DDF6FC] hover:border-[#159EBD] text-left transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900">Management</div>
                  <div className="text-[11px] text-slate-500">Verify & Close</div>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Demo credentials: admin@ohsexpert.io / hse@ohsexpert.io / management@ohsexpert.io
                (Password: OhsExpert2026!)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
