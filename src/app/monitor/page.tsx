'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity, Server, Database, Users, FileText, Shield, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Clock, Cpu, MemoryStick,
  Table, LogIn, TrendingUp, Layers, Bug, Terminal, ChevronDown, ChevronUp
} from 'lucide-react';

const MONITOR_KEY = 'dannel_monitor_kps_2026';

function getApiBase(): string {
  if (typeof window === 'undefined') return 'https://app.kpspestcontrol.co.za';
  const h = window.location.hostname;
  if (h.includes('kpspestcontrol.co.za') || h.includes('app.kpspestcontrol')) {
    return 'https://app.kpspestcontrol.co.za';
  }
  return 'http://localhost:3005';
}

function formatBytes(mb: number) {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
      ${ok ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} />
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }: {
  icon: any; label: string; value: any; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-900/30',
    green: 'text-green-400 bg-green-900/30',
    yellow: 'text-yellow-400 bg-yellow-900/30',
    red: 'text-red-400 bg-red-900/30',
    purple: 'text-purple-400 bg-purple-900/30',
    orange: 'text-orange-400 bg-orange-900/30',
    gray: 'text-gray-400 bg-gray-800/60',
    teal: 'text-teal-400 bg-teal-900/30',
  };
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-3 border border-gray-700">
      <div className={`p-2 rounded-lg ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{label}</p>
        <p className="text-xl font-bold text-white leading-tight">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs text-gray-500">{count} entries</span>
      )}
    </div>
  );
}

function LogPanel({ logs, title, icon: Icon }: { logs: any[]; title: string; icon: any }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? logs : logs.slice(0, 10);
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-200">{title}</span>
          <span className="text-xs text-gray-500">{logs.length} entries</span>
        </div>
        {logs.length > 10 && (
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            {expanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all</>}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="font-mono text-xs divide-y divide-gray-700/50 max-h-80 overflow-y-auto">
          {visible.map((log: any, i: number) => (
            <div key={i} className={`px-4 py-2 flex gap-3 hover:bg-gray-750 ${
              log.level === 'error' ? 'bg-red-950/20' :
              log.level === 'warn' ? 'bg-yellow-950/20' : ''
            }`}>
              <span className="text-gray-600 shrink-0 w-20 truncate">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
              </span>
              <span className={`shrink-0 w-10 font-bold ${
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warn' ? 'text-yellow-400' :
                log.level === 'info' ? 'text-blue-400' : 'text-gray-400'
              }`}>{log.level?.toUpperCase() || '—'}</span>
              <span className="text-gray-300 break-all">{log.message || log.raw || '—'}</span>
              {log.error && <span className="text-red-400 shrink-0 truncate max-w-xs">{log.error}</span>}
            </div>
          ))}
          {visible.length === 0 && (
            <div className="px-4 py-4 text-gray-500 text-center">No log entries</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MonitorContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${getApiBase()}/api/monitor?key=${MONITOR_KEY}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setCountdown(30);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (key !== MONITOR_KEY) return;
    fetchData();
  }, [fetchData, key]);

  useEffect(() => {
    if (key !== MONITOR_KEY) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchData, key]);

  // ── Wrong key ──
  if (key !== MONITOR_KEY) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">Valid monitor key required.</p>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        <span className="text-gray-300">Loading monitor data...</span>
      </div>
    );
  }

  // ── API error ──
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Failed to Connect</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <button onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const api = data?.api || {};
  const db = data?.database || {};
  const stats = data?.stats || {};
  const recentReports: any[] = data?.recent_reports || [];
  const recentLogins: any[] = data?.recent_logins || [];
  const tableSt: any[] = data?.table_stats || [];
  const errorLogs: any[] = data?.logs?.errors || [];
  const combinedLogs: any[] = data?.logs?.combined || [];
  const heapPct = api.memory ? Math.round(api.memory.heap_used_mb / api.memory.heap_total_mb * 100) : 0;

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending': return 'text-yellow-400 bg-yellow-900/40';
      case 'approved': return 'text-green-400 bg-green-900/40';
      case 'declined': return 'text-red-400 bg-red-900/40';
      case 'draft': return 'text-gray-300 bg-gray-700/60';
      case 'archived': return 'text-blue-400 bg-blue-900/40';
      default: return 'text-gray-400 bg-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-12">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-gray-900/95 border-b border-gray-800 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="font-bold text-white">KPS Monitor</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-mono">
            v{api.version || '—'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
            ${api.environment === 'production' ? 'bg-orange-900/60 text-orange-300' : 'bg-purple-900/60 text-purple-300'}`}>
            {api.environment || '—'}
          </span>
          <StatusBadge ok={db.status === 'healthy'} label={`DB ${db.status || '?'}`} />
          {/* Live dot */}
          <span className="flex items-center gap-1 text-xs text-green-400 ml-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            {lastRefresh && <span>Updated {timeAgo(lastRefresh.toISOString())}</span>}
            <span className="text-gray-600">Auto-refresh in {countdown}s</span>
            <button onClick={fetchData} disabled={refreshing}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 pt-6 space-y-6">

        {/* ── API + DB Health ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Health */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <SectionHeader icon={Server} title="API Process" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Uptime</span>
                <span className="text-white font-mono">{api.uptime_human || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Node.js</span>
                <span className="text-white font-mono">{api.node_version || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">PID</span>
                <span className="text-white font-mono">{api.pid || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Heap Used</span>
                <span className="text-white font-mono">
                  {api.memory ? `${formatBytes(api.memory.heap_used_mb)} / ${formatBytes(api.memory.heap_total_mb)} (${heapPct}%)` : '—'}
                </span>
              </div>
              {/* Heap bar */}
              {api.memory && (
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                  <div className={`h-1.5 rounded-full transition-all ${heapPct > 80 ? 'bg-red-500' : heapPct > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${heapPct}%` }} />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">RSS</span>
                <span className="text-white font-mono">{api.memory ? formatBytes(api.memory.rss_mb) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Response Time</span>
                <span className={`font-mono font-semibold ${
                  (data?.response_time_ms || 0) > 1000 ? 'text-red-400' :
                  (data?.response_time_ms || 0) > 300 ? 'text-yellow-400' : 'text-green-400'
                }`}>{data?.response_time_ms ?? '—'}ms</span>
              </div>
            </div>
          </div>

          {/* DB Health */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <SectionHeader icon={Database} title="Database" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status</span>
                <StatusBadge ok={db.status === 'healthy'} label={db.status === 'healthy' ? 'Healthy' : 'Error'} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Version</span>
                <span className="text-white font-mono">{db.version || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Latency</span>
                <span className={`font-mono font-semibold ${
                  (db.latency_ms || 0) > 500 ? 'text-red-400' :
                  (db.latency_ms || 0) > 100 ? 'text-yellow-400' : 'text-green-400'
                }`}>{db.latency_ms ?? '—'}ms</span>
              </div>
              {db.error && (
                <div className="mt-2 p-2 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300 font-mono break-all">
                  {db.error}
                </div>
              )}
              <div className="border-t border-gray-700 pt-2 mt-2">
                <div className="text-xs text-gray-500 mb-1">Active Sessions</div>
                <div className="text-2xl font-bold text-white">{stats.active_sessions ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Key Stats Grid ── */}
        <div>
          <SectionHeader icon={TrendingUp} title="Key Stats" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard icon={Users} label="Total Users" value={stats.total_users} sub={`${stats.active_users} active`} color="blue" />
            <StatCard icon={Layers} label="Clients" value={stats.total_clients} sub={`${stats.active_clients} active`} color="teal" />
            <StatCard icon={FileText} label="Total Reports" value={stats.total_reports} sub={`${stats.reports_this_month} this month`} color="purple" />
            <StatCard icon={Clock} label="Pending" value={stats.pending_reports} color="yellow" />
            <StatCard icon={CheckCircle} label="Approved" value={stats.approved_reports} color="green" />
            <StatCard icon={XCircle} label="Declined" value={stats.declined_reports} color="red" />
            <StatCard icon={FileText} label="Drafts" value={stats.draft_reports} color="gray" />
            <StatCard icon={FileText} label="Archived" value={stats.archived_reports} color="gray" />
            <StatCard icon={Activity} label="Last 7 Days" value={stats.reports_last_7d} color="orange" />
            <StatCard icon={Shield} label="Bait Stations" value={stats.total_bait_stations} color="blue" />
          </div>
        </div>

        {/* ── Reports by Status bar ── */}
        {stats.reports_by_status?.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <SectionHeader icon={TrendingUp} title="Reports by Status" />
            <div className="space-y-2">
              {stats.reports_by_status.map((r: any) => {
                const pct = Math.round((r.count / (stats.total_reports || 1)) * 100);
                const barColors: Record<string, string> = {
                  approved: 'bg-green-500',
                  pending: 'bg-yellow-500',
                  archived: 'bg-blue-500',
                  declined: 'bg-red-500',
                  draft: 'bg-gray-500',
                };
                return (
                  <div key={r.status} className="flex items-center gap-3 text-sm">
                    <span className="w-20 text-gray-400 capitalize text-xs">{r.status}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div className={`h-2 rounded-full ${barColors[r.status] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-gray-300 font-mono text-xs">{r.count}</span>
                    <span className="w-8 text-right text-gray-500 text-xs">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recent Reports ── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <SectionHeader icon={FileText} title="Recent Reports" count={recentReports.length} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">PCO</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Service Date</th>
                  <th className="px-4 py-2 text-left font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {recentReports.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-750">
                    <td className="px-4 py-2 font-mono text-gray-400">#{r.id}</td>
                    <td className="px-4 py-2 text-gray-200 max-w-32 truncate">{r.company_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-300">{r.pco_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-400 capitalize">{r.report_type?.replace('_', ' ') || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${statusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-400 font-mono">
                      {r.service_date ? new Date(r.service_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{r.submitted_at ? timeAgo(r.submitted_at) : '—'}</td>
                  </tr>
                ))}
                {recentReports.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-4 text-center text-gray-500">No reports</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Logins ── */}
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <SectionHeader icon={LogIn} title="Recent Login Attempts" count={recentLogins.length} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400">
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Event</th>
                  <th className="px-4 py-2 text-left font-medium">IP</th>
                  <th className="px-4 py-2 text-left font-medium">Result</th>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {recentLogins.map((l: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-750">
                    <td className="px-4 py-2 font-mono text-gray-300">{l.pco_number || '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{l.event_type || '—'}</td>
                    <td className="px-4 py-2 font-mono text-gray-500">{l.ip_address || '—'}</td>
                    <td className="px-4 py-2">
                      {l.success
                        ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" />OK</span>
                        : <span className="flex items-center gap-1 text-red-400"><XCircle className="w-3 h-3" />Failed</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-gray-500">{l.created_at ? timeAgo(l.created_at) : '—'}</td>
                  </tr>
                ))}
                {recentLogins.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500">No login records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Table Stats ── */}
        {tableSt.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700">
              <SectionHeader icon={Table} title="Database Tables" count={tableSt.length} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="px-4 py-2 text-left font-medium">Table</th>
                    <th className="px-4 py-2 text-right font-medium">Rows (est.)</th>
                    <th className="px-4 py-2 text-right font-medium">Size (KB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {tableSt.map((t: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-750">
                      <td className="px-4 py-2 font-mono text-gray-300">{t.TABLE_NAME || t.table_name}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-400">{Number(t.TABLE_ROWS ?? t.table_rows).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-500">{t.SIZE_KB ?? t.size_kb ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Logs ── */}
        <LogPanel logs={errorLogs} title="Error Log" icon={Bug} />
        <LogPanel logs={combinedLogs} title="Combined Log" icon={Terminal} />

        {/* Footer */}
        <div className="text-center text-xs text-gray-600 pt-2">
          KPS Pest Control — Developer Monitor Portal • Generated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}
        </div>

      </div>
    </div>
  );
}

export default function MonitorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
        <span className="text-gray-300">Loading...</span>
      </div>
    }>
      <MonitorContent />
    </Suspense>
  );
}
