/**
 * KPS Monitor Controller
 * Developer health/status portal — secured by monitor key
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { pool, executeQuery } from '../config/database';
import { getVersionFromPackageJson } from '../config/env';
import { logger } from '../config/logger';

const MONITOR_KEY = 'dannel_monitor_kps_2026';
const LOG_DIR = path.join(__dirname, '../../logs');
const MAX_LOG_LINES = 80;

function readLastLines(filePath: string, maxLines: number): any[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines
      .slice(-maxLines)
      .reverse()
      .map(line => {
        try { return JSON.parse(line); } catch { return { raw: line }; }
      });
  } catch {
    return [];
  }
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export const getMonitorData = async (req: Request, res: Response): Promise<void> => {
  // Key check
  const key = req.query.key as string;
  if (key !== MONITOR_KEY) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  const startTime = Date.now();

  try {
    // ── 1. API Process info ──────────────────────────────────────
    const memUsage = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    const processInfo = {
      version: getVersionFromPackageJson(),
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.floor(uptimeSeconds),
      uptime_human: formatUptime(uptimeSeconds),
      memory: {
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss_mb: Math.round(memUsage.rss / 1024 / 1024),
        external_mb: Math.round(memUsage.external / 1024 / 1024),
      },
      pid: process.pid,
    };

    // ── 2. Database health ───────────────────────────────────────
    let dbStatus = 'healthy';
    let dbVersion = 'unknown';
    let dbLatencyMs = 0;
    let dbError: string | null = null;

    try {
      const dbStart = Date.now();
      const conn = await pool.getConnection();
      const [versionRows]: any = await conn.execute('SELECT VERSION() as v');
      conn.release();
      dbLatencyMs = Date.now() - dbStart;
      dbVersion = versionRows[0]?.v || 'unknown';
    } catch (e: any) {
      dbStatus = 'error';
      dbError = e.message;
    }

    // ── 3. Key database counts ───────────────────────────────────
    let dbCounts: any = {};
    let recentReports: any[] = [];
    let activeSessions = 0;
    let recentLogins: any[] = [];
    let reportsByStatus: any[] = [];
    let tableStats: any[] = [];

    try {
      // Core counts
      const counts = await executeQuery<any>(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) as total_users,
          (SELECT COUNT(*) FROM users WHERE status = 'active' AND deleted_at IS NULL) as active_users,
          (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) as total_clients,
          (SELECT COUNT(*) FROM clients WHERE status = 'active' AND deleted_at IS NULL) as active_clients,
          (SELECT COUNT(*) FROM reports) as total_reports,
          (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
          (SELECT COUNT(*) FROM reports WHERE status = 'approved') as approved_reports,
          (SELECT COUNT(*) FROM reports WHERE status = 'declined') as declined_reports,
          (SELECT COUNT(*) FROM reports WHERE status = 'draft') as draft_reports,
          (SELECT COUNT(*) FROM reports WHERE status = 'archived') as archived_reports,
          (SELECT COUNT(*) FROM reports WHERE service_date >= CURDATE() - INTERVAL 7 DAY) as reports_last_7d,
          (SELECT COUNT(*) FROM reports WHERE service_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) as reports_this_month,
          (SELECT COUNT(*) FROM bait_stations) as total_bait_stations,
          (SELECT COUNT(*) FROM insect_monitors) as total_insect_monitors,
          (SELECT COUNT(*) FROM chemicals WHERE status = 'active' AND deleted_at IS NULL) as active_chemicals,
          (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()) as active_sessions
      `);
      dbCounts = counts[0] || {};
      activeSessions = dbCounts.active_sessions || 0;

      // Reports by status (for chart)
      reportsByStatus = await executeQuery<any>(`
        SELECT status, COUNT(*) as count FROM reports GROUP BY status ORDER BY count DESC
      `);

      // Recent reports (last 10)
      recentReports = await executeQuery<any>(`
        SELECT r.id, r.status, r.report_type, r.service_date, r.submitted_at,
               c.company_name, u.name as pco_name
        FROM reports r
        LEFT JOIN clients c ON c.id = r.client_id
        LEFT JOIN users u ON u.id = r.pco_id
        ORDER BY r.id DESC LIMIT 10
      `);

      // Recent login attempts (last 20)
      recentLogins = await executeQuery<any>(`
        SELECT pco_number, success, failure_reason as event_type, ip_address, attempt_time as created_at
        FROM login_attempts
        ORDER BY attempt_time DESC LIMIT 20
      `).catch(() => []);

      // Table row counts
      tableStats = await executeQuery<any>(`
        SELECT table_name, table_rows, 
               ROUND((data_length + index_length) / 1024, 1) as size_kb
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_rows DESC
      `);

    } catch (e: any) {
      logger.error('Monitor DB query error', { error: e.message });
    }

    // ── 4. Recent error logs ─────────────────────────────────────
    const errorLogs = readLastLines(path.join(LOG_DIR, 'error.log'), MAX_LOG_LINES);
    const combinedLogs = readLastLines(path.join(LOG_DIR, 'combined.log'), MAX_LOG_LINES);

    // ── 5. Response time for this call ───────────────────────────
    const responseTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      response_time_ms: responseTimeMs,
      api: processInfo,
      database: {
        status: dbStatus,
        version: dbVersion,
        latency_ms: dbLatencyMs,
        error: dbError,
      },
      stats: {
        ...dbCounts,
        active_sessions: activeSessions,
        reports_by_status: reportsByStatus,
      },
      recent_reports: recentReports,
      recent_logins: recentLogins,
      table_stats: tableStats,
      logs: {
        errors: errorLogs,
        combined: combinedLogs,
      },
    });

  } catch (error: any) {
    logger.error('Monitor endpoint error', { error: error.message });
    res.status(500).json({ success: false, message: 'Monitor error', error: error.message });
  }
};
