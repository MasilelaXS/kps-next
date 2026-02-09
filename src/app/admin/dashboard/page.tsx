'use client';

import { useEffect, useMemo, useState } from 'react';
import { Space_Grotesk } from 'next/font/google';
import DashboardLayout from '@/components/DashboardLayout';
import Loading from '@/components/Loading';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  TrendingUp,
  Users
} from 'lucide-react';
import { buildApiUrl } from '@/lib/api';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700']
});

interface OverviewResponse {
  summary: {
    total_clients: number;
    active_pcos: number;
    pending_reports: number;
    approved_total: number;
    approved_this_month: number;
  };
  flow: Array<{ date: string; approved: number; pending: number; declined: number }>;
  recent_approvals: Array<{
    report_id: number;
    reviewed_at: string;
    report_type: string;
    client_name: string;
    pco_name: string;
  }>;
}

interface FlowBucket {
  date: string;
  approved: number;
  pending: number;
  declined: number;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const token = localStorage.getItem('kps_token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch(buildApiUrl('/api/admin/dashboard/overview'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard overview');
        }

        const payload = await response.json();
        if (payload.success) {
          setOverview(payload.data);
        }
      } catch (error) {
        console.error('Dashboard overview error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  const flowBuckets = useMemo<FlowBucket[]>(() => overview?.flow || [], [overview]);

  const formatDateLabel = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric'
    });

  const formatTimeAgo = (value: string) => {
    const diffMs = Date.now() - new Date(value).getTime();
    if (diffMs <= 0) return 'just now';
    const minutes = Math.round(diffMs / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loading size="lg" text="Loading dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={spaceGrotesk.className}>
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.28),_transparent_55%),radial-gradient(circle_at_right,_rgba(59,130,246,0.28),_transparent_50%)] p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Dashboard overview
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Admin Command Center</h2>
            <p className="text-sm md:text-base text-slate-600">
              Live signal across approvals, workload, and customer coverage.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/40 bg-white/70 p-3 text-sm shadow-sm">
              <div className="text-xs uppercase text-slate-500">Approved this month</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {overview?.summary.approved_this_month || 0}
              </div>
            </div>
            <div className="rounded-xl border border-white/40 bg-white/70 p-3 text-sm shadow-sm">
              <div className="text-xs uppercase text-slate-500">Pending review</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {overview?.summary.pending_reports || 0}
              </div>
            </div>
            <div className="rounded-xl border border-white/40 bg-white/70 p-3 text-sm shadow-sm">
              <div className="text-xs uppercase text-slate-500">Active PCOs</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">
                {overview?.summary.active_pcos || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-blue-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Live</span>
              </span>
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{overview?.summary.total_clients || 0}</h3>
            <p className="text-gray-600 text-xs lg:text-sm">Total Clients</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-blue-600">Active</span>
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{overview?.summary.active_pcos || 0}</h3>
            <p className="text-gray-600 text-xs lg:text-sm">PCO Users</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-blue-600">Review</span>
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{overview?.summary.pending_reports || 0}</h3>
            <p className="text-gray-600 text-xs lg:text-sm">Pending Reports</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-purple-600">Approved</span>
            </div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{overview?.summary.approved_total || 0}</h3>
            <p className="text-gray-600 text-xs lg:text-sm">Approved Reports</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] mb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Report flow</p>
                <h3 className="text-lg font-semibold text-slate-900">Last 14 days</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="h-48">
              {flowBuckets.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                  No flow data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={flowBuckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="declinedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#475569" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#475569" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateLabel}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}
                      labelFormatter={(value) => formatDateLabel(String(value))}
                    />
                    <Area
                      type="monotone"
                      dataKey="declined"
                      stackId="reports"
                      stroke="#475569"
                      fill="url(#declinedGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="pending"
                      stackId="reports"
                      stroke="#60a5fa"
                      fill="url(#pendingGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="approved"
                      stackId="reports"
                      stroke="#7c3aed"
                      fill="url(#approvedGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-purple-500" />Approved</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-400" />Pending</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#475569]" />Declined</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest decisions</p>
                <h3 className="text-lg font-semibold text-slate-900">Recently approved</h3>
              </div>
              <Activity className="h-5 w-5 text-slate-500" />
            </div>
            <div className="space-y-3">
              {(overview?.recent_approvals || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  No approved reports available yet.
                </div>
              ) : (
                (overview?.recent_approvals || []).map((item) => (
                  <div key={item.report_id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.client_name}</div>
                        <div className="text-xs text-slate-500">PCO: {item.pco_name}</div>
                      </div>
                      <div className="text-xs text-slate-500">{formatTimeAgo(item.reviewed_at)}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">Approved</span>
                      <span className="text-slate-400">Report #{item.report_id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
