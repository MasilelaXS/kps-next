"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentController = void 0;
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
class AssignmentController {
    static async getAssignmentList(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { page = 1, limit = 25, pco_id, client_id, status = 'active' } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            let whereConditions = [];
            let queryParams = [];
            if (pco_id) {
                whereConditions.push('ca.pco_id = ?');
                queryParams.push(pco_id);
            }
            if (client_id) {
                whereConditions.push('ca.client_id = ?');
                queryParams.push(client_id);
            }
            if (status !== 'all') {
                whereConditions.push('ca.status = ?');
                queryParams.push(status);
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const countQuery = `
        SELECT COUNT(*) as total
        FROM client_pco_assignments ca
        ${whereClause}
      `;
            const countResult = await (0, database_1.executeQuerySingle)(countQuery, queryParams);
            const totalAssignments = countResult?.total || 0;
            const totalPages = Math.ceil(totalAssignments / limitNum);
            const assignmentsQuery = `
        SELECT 
          ca.id,
          ca.client_id,
          c.company_name as client_name,
          c.city as client_city,
          ca.pco_id,
          u.name as pco_name,
          u.pco_number,
          ca.assigned_at,
          ab.name as assigned_by_name,
          ca.unassigned_at,
          ub.name as unassigned_by_name,
          ca.status,
          (SELECT COUNT(*) FROM reports WHERE client_id = ca.client_id AND pco_id = ca.pco_id) as report_count
        FROM client_pco_assignments ca
        JOIN clients c ON ca.client_id = c.id
        JOIN users u ON ca.pco_id = u.id
        JOIN users ab ON ca.assigned_by = ab.id
        LEFT JOIN users ub ON ca.unassigned_by = ub.id
        ${whereClause}
        ORDER BY ca.assigned_at DESC
        LIMIT ? OFFSET ?
      `;
            const assignments = await (0, database_1.executeQuery)(assignmentsQuery, [...queryParams, limitNum, offset]);
            const pagination = {
                current_page: pageNum,
                total_pages: totalPages,
                total_assignments: totalAssignments,
                per_page: limitNum,
                has_next: pageNum < totalPages,
                has_prev: pageNum > 1
            };
            res.json({
                success: true,
                data: {
                    assignments,
                    pagination,
                    filters: {
                        pco_id: pco_id || null,
                        client_id: client_id || null,
                        status: status || 'active'
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get assignment list error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve assignments'
            });
        }
    }
    static async getAssignmentStats(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const totalAssignments = await (0, database_1.executeQuerySingle)(`
        SELECT COUNT(*) as count FROM client_pco_assignments WHERE status = 'active'
      `);
            const unassignedClients = await (0, database_1.executeQuerySingle)(`
        SELECT COUNT(*) as count 
        FROM clients c
        LEFT JOIN client_pco_assignments ca ON c.id = ca.client_id AND ca.status = 'active'
        WHERE ca.id IS NULL AND c.status = 'active'
      `);
            const pcoWorkload = await (0, database_1.executeQuery)(`
        SELECT 
          u.id as pco_id,
          u.name as pco_name,
          u.pco_number,
          u.role,
          COUNT(ca.id) as client_count,
          (SELECT COUNT(*) FROM reports WHERE pco_id = u.id) as total_reports,
          (SELECT COUNT(*) FROM reports WHERE pco_id = u.id 
           AND service_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as reports_last_30_days
        FROM users u
        LEFT JOIN client_pco_assignments ca ON u.id = ca.pco_id AND ca.status = 'active'
        WHERE u.role IN ('pco', 'admin', 'both') AND u.status = 'active'
        GROUP BY u.id, u.role
        ORDER BY client_count DESC
      `);
            const avgWorkload = pcoWorkload.length > 0
                ? pcoWorkload.reduce((sum, pco) => sum + pco.client_count, 0) / pcoWorkload.length
                : 0;
            const assignmentTrend = await (0, database_1.executeQuery)(`
        SELECT 
          DATE(assigned_at) as date,
          COUNT(*) as assignments
        FROM client_pco_assignments
        WHERE assigned_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(assigned_at)
        ORDER BY date DESC
      `);
            res.json({
                success: true,
                data: {
                    summary: {
                        total_active_assignments: totalAssignments?.count || 0,
                        unassigned_clients: unassignedClients?.count || 0,
                        total_pcos: pcoWorkload.length,
                        average_clients_per_pco: Math.round(avgWorkload * 100) / 100
                    },
                    pco_workload: pcoWorkload,
                    assignment_trend: assignmentTrend
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get assignment stats error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve assignment statistics'
            });
        }
    }
    static async bulkAssignClients(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { pco_id, client_ids } = req.body;
            const pco = await (0, database_1.executeQuerySingle)('SELECT id, name, role FROM users WHERE id = ? AND status = "active"', [pco_id]);
            if (!pco) {
                res.status(404).json({
                    success: false,
                    message: 'PCO not found or inactive'
                });
                return;
            }
            if (pco.role !== 'pco' && pco.role !== 'admin' && pco.role !== 'both') {
                res.status(400).json({
                    success: false,
                    message: 'User must have PCO or Admin role'
                });
                return;
            }
            const placeholders = client_ids.map(() => '?').join(',');
            const clients = await (0, database_1.executeQuery)(`SELECT id, company_name FROM clients WHERE id IN (${placeholders}) AND status = 'active'`, client_ids);
            if (clients.length !== client_ids.length) {
                res.status(400).json({
                    success: false,
                    message: 'Some clients not found or inactive'
                });
                return;
            }
            const existingAssignments = await (0, database_1.executeQuery)(`SELECT client_id, pco_id FROM client_pco_assignments 
         WHERE client_id IN (${placeholders}) AND status = 'active'`, client_ids);
            const conflicts = [];
            const assignable = [];
            for (const clientId of client_ids) {
                const existing = existingAssignments.find((a) => a.client_id === clientId);
                if (existing && existing.pco_id !== pco_id) {
                    const client = clients.find((c) => c.id === clientId);
                    conflicts.push({
                        client_id: clientId,
                        client_name: client?.company_name,
                        current_pco_id: existing.pco_id
                    });
                }
                else if (!existing) {
                    assignable.push(clientId);
                }
            }
            if (conflicts.length > 0) {
                res.status(409).json({
                    success: false,
                    message: 'Some clients already have active PCO assignments',
                    conflicts,
                    suggestion: 'Unassign existing PCOs first or use force parameter'
                });
                return;
            }
            const assignmentPromises = assignable.map(clientId => (0, database_1.executeQuery)(`INSERT INTO client_pco_assignments (client_id, pco_id, assigned_by, status)
           VALUES (?, ?, ?, 'active')`, [clientId, pco_id, req.user.id]));
            await Promise.all(assignmentPromises);
            logger_1.logger.info('Bulk assignment completed', {
                pco_id,
                client_count: assignable.length,
                assigned_by: req.user.id
            });
            res.status(201).json({
                success: true,
                message: `Successfully assigned ${assignable.length} client(s) to PCO`,
                data: {
                    pco_id,
                    pco_name: pco.name,
                    assigned_count: assignable.length,
                    skipped_count: client_ids.length - assignable.length
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk assign error', {
                error: error instanceof Error ? error.message : error,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to perform bulk assignment'
            });
        }
    }
    static async bulkUnassignClients(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { assignment_ids } = req.body;
            const placeholders = assignment_ids.map(() => '?').join(',');
            const assignments = await (0, database_1.executeQuery)(`SELECT ca.id, ca.client_id, c.company_name, ca.pco_id, u.name as pco_name
         FROM client_pco_assignments ca
         JOIN clients c ON ca.client_id = c.id
         JOIN users u ON ca.pco_id = u.id
         WHERE ca.id IN (${placeholders}) AND ca.status = 'active'`, assignment_ids);
            if (assignments.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'No active assignments found'
                });
                return;
            }
            const clientIds = assignments.map((a) => a.client_id);
            const clientPlaceholders = clientIds.map(() => '?').join(',');
            await (0, database_1.executeQuery)(`DELETE FROM client_pco_assignments 
         WHERE client_id IN (${clientPlaceholders}) AND status = 'inactive'`, clientIds);
            const updateParams = [req.user.id, ...assignment_ids];
            await (0, database_1.executeQuery)(`UPDATE client_pco_assignments 
         SET status = 'inactive', 
             unassigned_at = NOW(), 
             unassigned_by = ?
         WHERE id IN (${placeholders}) AND status = 'active'`, updateParams);
            logger_1.logger.info('Bulk unassignment completed', {
                assignment_count: assignments.length,
                unassigned_by: req.user.id
            });
            res.json({
                success: true,
                message: `Successfully unassigned ${assignments.length} client(s)`,
                data: {
                    unassigned_count: assignments.length,
                    assignments: assignments.map((a) => ({
                        assignment_id: a.id,
                        client_name: a.company_name,
                        pco_name: a.pco_name
                    }))
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Bulk unassign error', {
                error: error instanceof Error ? error.message : error,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to perform bulk unassignment'
            });
        }
    }
    static async getWorkloadBalance(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const pcos = await (0, database_1.executeQuery)(`
        SELECT 
          u.id,
          u.name,
          u.pco_number,
          u.role,
          COUNT(ca.id) as current_clients
        FROM users u
        LEFT JOIN client_pco_assignments ca ON u.id = ca.pco_id AND ca.status = 'active'
        WHERE u.role IN ('pco', 'admin', 'both') AND u.status = 'active'
        GROUP BY u.id, u.role
        ORDER BY current_clients ASC
      `);
            const unassignedClients = await (0, database_1.executeQuery)(`
        SELECT c.id, c.company_name, c.city
        FROM clients c
        LEFT JOIN client_pco_assignments ca ON c.id = ca.client_id AND ca.status = 'active'
        WHERE ca.id IS NULL AND c.status = 'active'
        ORDER BY c.company_name
      `);
            if (pcos.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'No active PCOs available'
                });
                return;
            }
            const totalClients = pcos.reduce((sum, pco) => sum + pco.current_clients, 0) + unassignedClients.length;
            const idealPerPco = Math.ceil(totalClients / pcos.length);
            const suggestions = [];
            let pcoIndex = 0;
            for (const client of unassignedClients) {
                const pco = pcos[pcoIndex % pcos.length];
                suggestions.push({
                    client_id: client.id,
                    client_name: client.company_name,
                    client_city: client.city,
                    suggested_pco_id: pco.id,
                    suggested_pco_name: pco.name,
                    pco_current_load: pco.current_clients,
                    reason: 'Balancing workload across PCOs'
                });
                pco.current_clients++;
                pcoIndex++;
            }
            const overloaded = pcos.filter((pco) => pco.current_clients > idealPerPco + 2);
            const underloaded = pcos.filter((pco) => pco.current_clients < idealPerPco - 2);
            res.json({
                success: true,
                data: {
                    summary: {
                        total_pcos: pcos.length,
                        total_clients: totalClients,
                        unassigned_clients: unassignedClients.length,
                        ideal_clients_per_pco: idealPerPco,
                        overloaded_pcos: overloaded.length,
                        underloaded_pcos: underloaded.length
                    },
                    pco_workload: pcos,
                    suggestions,
                    balance_issues: {
                        overloaded: overloaded.map((pco) => ({
                            pco_id: pco.id,
                            pco_name: pco.name,
                            current_clients: pco.current_clients,
                            excess: pco.current_clients - idealPerPco
                        })),
                        underloaded: underloaded.map((pco) => ({
                            pco_id: pco.id,
                            pco_name: pco.name,
                            current_clients: pco.current_clients,
                            deficit: idealPerPco - pco.current_clients
                        }))
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get workload balance error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to calculate workload balance'
            });
        }
    }
    static async getPCOAssignments(req, res) {
        try {
            const pcoId = req.user.id;
            const query = `
        SELECT 
          ca.id as assignment_id,
          ca.client_id,
          c.company_name as client_name,
          c.company_number,
          c.address_line1,
          c.address_line2,
          c.city,
          c.state,
          c.postal_code,
          c.country,
          c.total_bait_stations_inside,
          c.total_bait_stations_outside,
          c.total_insect_monitors_light,
          c.total_insect_monitors_box,
          c.status as client_status,
          ca.assigned_at
        FROM client_pco_assignments ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.pco_id = ? AND ca.status = 'active'
        ORDER BY c.company_name ASC
      `;
            const assignments = await (0, database_1.executeQuery)(query, [pcoId]);
            res.json({
                success: true,
                data: assignments,
                total: Array.isArray(assignments) ? assignments.length : 0
            });
        }
        catch (error) {
            logger_1.logger.error('Get PCO assignments error', {
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve assignments',
                error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            });
        }
    }
}
exports.AssignmentController = AssignmentController;
exports.default = AssignmentController;
//# sourceMappingURL=assignmentController.js.map