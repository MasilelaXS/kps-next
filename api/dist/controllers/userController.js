"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const auth_1 = require("../middleware/auth");
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const generatePcoNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp}${random}`;
};
class UserController {
    static async getUserList(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { page = 1, limit = 25, role, status, search } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            let whereConditions = [];
            let queryParams = [];
            if (role && role !== 'all') {
                if (role === 'pco') {
                    whereConditions.push('(role = ? OR role = ?)');
                    queryParams.push('pco', 'both');
                }
                else if (role === 'admin') {
                    whereConditions.push('(role = ? OR role = ?)');
                    queryParams.push('admin', 'both');
                }
                else {
                    whereConditions.push('role = ?');
                    queryParams.push(role);
                }
            }
            if (status && status !== 'all') {
                whereConditions.push('status = ?');
                queryParams.push(status);
            }
            if (search) {
                whereConditions.push('(name LIKE ? OR pco_number LIKE ? OR email LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm);
            }
            whereConditions.push('deleted_at IS NULL');
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const countQuery = `
        SELECT COUNT(*) as total
        FROM users
        ${whereClause}
      `;
            const countResult = await (0, database_1.executeQuerySingle)(countQuery, queryParams);
            const totalUsers = countResult?.total || 0;
            const totalPages = Math.ceil(totalUsers / limitNum);
            const usersQuery = `
        SELECT 
          id,
          pco_number,
          name,
          email,
          phone,
          role,
          status,
          created_at,
          updated_at,
          (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = users.id AND status = 'active') as active_assignments
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
            const users = await (0, database_1.executeQuery)(usersQuery, [...queryParams, limitNum, offset]);
            const pagination = {
                current_page: pageNum,
                total_pages: totalPages,
                total_users: totalUsers,
                per_page: limitNum,
                has_next: pageNum < totalPages,
                has_prev: pageNum > 1
            };
            res.json({
                success: true,
                data: {
                    users,
                    pagination,
                    filters: {
                        role: role || 'all',
                        status: status || 'all',
                        search: search || ''
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get user list error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve users'
            });
        }
    }
    static async createUser(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { pco_number, name, email, phone, role, password } = req.body;
            if (pco_number) {
                const existingPcoNumber = await (0, database_1.executeQuerySingle)('SELECT id FROM users WHERE pco_number = ? AND deleted_at IS NULL', [pco_number]);
                if (existingPcoNumber) {
                    res.status(409).json({
                        success: false,
                        message: `PCO number ${pco_number} already exists`
                    });
                    return;
                }
            }
            const existingEmail = await (0, database_1.executeQuerySingle)('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
            if (existingEmail) {
                res.status(409).json({
                    success: false,
                    message: `Email ${email} already exists`
                });
                return;
            }
            const finalPcoNumber = pco_number || generatePcoNumber();
            const saltRounds = 10;
            const password_hash = await bcrypt_1.default.hash(password, saltRounds);
            const insertQuery = `
        INSERT INTO users (
          pco_number, 
          name, 
          email, 
          phone, 
          password_hash, 
          role, 
          status
        ) VALUES (?, ?, ?, ?, ?, ?, 'active')
      `;
            const result = await (0, database_1.executeQuery)(insertQuery, [
                finalPcoNumber,
                name,
                email,
                phone || null,
                password_hash,
                role || 'pco'
            ]);
            const newUser = await (0, database_1.executeQuerySingle)('SELECT id, pco_number, name, email, phone, role, status, created_at FROM users WHERE id = ?', [result.insertId]);
            logger_1.logger.info('New user created', {
                user_id: newUser.id,
                pco_number: finalPcoNumber,
                name,
                role: role || 'pco',
                created_by: req.user.id
            });
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: newUser
            });
        }
        catch (error) {
            logger_1.logger.error('Create user error', {
                error: error instanceof Error ? error.message : error,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    }
    static async getUserById(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const user = await (0, database_1.executeQuerySingle)(`
        SELECT 
          u.id,
          u.pco_number,
          u.name,
          u.email,
          u.phone,
          u.role,
          u.status,
          u.created_at,
          u.updated_at,
          u.failed_login_attempts,
          u.locked_until,
          u.account_locked_at,
          (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = u.id AND status = 'active') as active_assignments,
          (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = u.id) as total_assignments,
          (SELECT COUNT(*) FROM reports WHERE pco_id = u.id) as total_reports,
          (SELECT MAX(created_at) FROM reports WHERE pco_id = u.id) as last_report_date
        FROM users u
        WHERE u.id = ? AND u.deleted_at IS NULL
      `, [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            const recentAssignments = await (0, database_1.executeQuery)(`
        SELECT 
          c.id as client_id,
          c.company_name,
          c.city,
          ca.assigned_at,
          ca.status as assignment_status
        FROM client_pco_assignments ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.pco_id = ?
        ORDER BY ca.assigned_at DESC
        LIMIT 5
      `, [id]);
            res.json({
                success: true,
                data: {
                    user,
                    recent_assignments: recentAssignments
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get user by ID error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve user'
            });
        }
    }
    static async updateUser(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { name, email, phone, role } = req.body;
            const existingUser = await (0, database_1.executeQuerySingle)('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!existingUser) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            if (email && email !== existingUser.email) {
                const emailConflict = await (0, database_1.executeQuerySingle)('SELECT id FROM users WHERE email = ? AND id != ? AND deleted_at IS NULL', [email, id]);
                if (emailConflict) {
                    res.status(409).json({
                        success: false,
                        message: `Email ${email} already exists`
                    });
                    return;
                }
            }
            const updateQuery = `
        UPDATE users 
        SET name = ?, email = ?, phone = ?, role = ?, updated_at = NOW()
        WHERE id = ?
      `;
            await (0, database_1.executeQuery)(updateQuery, [
                name || existingUser.name,
                email || existingUser.email,
                phone !== undefined ? phone : existingUser.phone,
                role || existingUser.role,
                id
            ]);
            const updatedUser = await (0, database_1.executeQuerySingle)('SELECT id, pco_number, name, email, phone, role, status, created_at, updated_at FROM users WHERE id = ?', [id]);
            logger_1.logger.info('User updated', {
                user_id: id,
                updated_fields: { name, email, phone, role },
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: 'User updated successfully',
                data: updatedUser
            });
        }
        catch (error) {
            logger_1.logger.error('Update user error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update user'
            });
        }
    }
    static async deleteUser(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const user = await (0, database_1.executeQuerySingle)('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            if (parseInt(id) === req.user.id) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot delete your own account'
                });
                return;
            }
            const activeAssignments = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM client_pco_assignments WHERE pco_id = ? AND status = "active"', [id]);
            if (activeAssignments?.count > 0) {
                res.status(400).json({
                    success: false,
                    message: `Cannot delete user with ${activeAssignments.count} active client assignments. Please unassign clients first.`,
                    data: {
                        active_assignments: activeAssignments.count
                    }
                });
                return;
            }
            await (0, database_1.executeQuery)('UPDATE users SET deleted_at = NOW(), status = "inactive" WHERE id = ?', [id]);
            logger_1.logger.info('User soft deleted', {
                deleted_user_id: id,
                deleted_user_name: user.name,
                deleted_by: req.user.id
            });
            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Delete user error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to delete user'
            });
        }
    }
    static async updateUserStatus(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { status } = req.body;
            const user = await (0, database_1.executeQuerySingle)('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            if (parseInt(id) === req.user.id && status === 'inactive') {
                res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate your own account'
                });
                return;
            }
            if (status === 'inactive') {
                await (0, database_1.executeQuery)('UPDATE client_pco_assignments SET status = "inactive", unassigned_at = NOW(), unassigned_by = ? WHERE pco_id = ? AND status = "active"', [req.user.id, id]);
            }
            await (0, database_1.executeQuery)('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
            logger_1.logger.info('User status updated', {
                user_id: id,
                old_status: user.status,
                new_status: status,
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`
            });
        }
        catch (error) {
            logger_1.logger.error('Update user status error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update user status'
            });
        }
    }
    static async resetUserPassword(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { new_password } = req.body;
            const user = await (0, database_1.executeQuerySingle)('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            const saltRounds = 10;
            const password_hash = await bcrypt_1.default.hash(new_password, saltRounds);
            await (0, database_1.executeQuery)(`
        UPDATE users 
        SET password_hash = ?, 
            failed_login_attempts = 0, 
            locked_until = NULL, 
            account_locked_at = NULL,
            updated_at = NOW()
        WHERE id = ?
      `, [password_hash, id]);
            logger_1.logger.info('User password reset by admin', {
                user_id: id,
                user_name: user.name,
                reset_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        }
        catch (error) {
            logger_1.logger.error('Reset user password error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to reset password'
            });
        }
    }
    static async getUserAssignments(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { status = 'all' } = req.query;
            const user = await (0, database_1.executeQuerySingle)('SELECT id, name, pco_number FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            let query = `
        SELECT 
          ca.id as assignment_id,
          c.id as client_id,
          c.company_name,
          c.address_line1,
          c.city,
          c.state,
          ca.status as assignment_status,
          ca.assigned_at,
          ca.unassigned_at,
          (SELECT COUNT(*) FROM reports WHERE client_id = c.id AND pco_id = ?) as total_reports,
          (SELECT MAX(service_date) FROM reports WHERE client_id = c.id AND pco_id = ?) as last_service_date
        FROM client_pco_assignments ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.pco_id = ?
      `;
            const queryParams = [id, id, id];
            if (status !== 'all') {
                query += ' AND ca.status = ?';
                queryParams.push(status);
            }
            query += ' ORDER BY ca.assigned_at DESC';
            const assignments = await (0, database_1.executeQuery)(query, queryParams);
            res.json({
                success: true,
                data: {
                    user,
                    assignments,
                    summary: {
                        total_assignments: assignments.length,
                        active_assignments: assignments.filter((a) => a.assignment_status === 'active').length,
                        inactive_assignments: assignments.filter((a) => a.assignment_status === 'inactive').length
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get user assignments error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve user assignments'
            });
        }
    }
    static async unassignAllClients(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const user = await (0, database_1.executeQuerySingle)('SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }
            const activeCount = await (0, database_1.executeQuerySingle)('SELECT COUNT(*) as count FROM client_pco_assignments WHERE pco_id = ? AND status = "active"', [id]);
            if (activeCount?.count === 0) {
                res.status(400).json({
                    success: false,
                    message: 'User has no active client assignments'
                });
                return;
            }
            await (0, database_1.executeQuery)(`
        UPDATE client_pco_assignments 
        SET status = 'inactive', unassigned_at = NOW(), unassigned_by = ?
        WHERE pco_id = ? AND status = 'active'
      `, [req.user.id, id]);
            logger_1.logger.info('User unassigned from all clients', {
                user_id: id,
                user_name: user.name,
                assignments_removed: activeCount.count,
                unassigned_by: req.user.id
            });
            res.json({
                success: true,
                message: `Successfully unassigned user from ${activeCount.count} client(s)`,
                data: {
                    unassigned_count: activeCount.count
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Unassign all clients error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to unassign user from clients'
            });
        }
    }
    static async searchUsers(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { q, role, status, limit = 10 } = req.query;
            if (!q || q.length < 2) {
                res.status(400).json({
                    success: false,
                    message: 'Search query must be at least 2 characters'
                });
                return;
            }
            let query = `
        SELECT 
          id,
          pco_number,
          name,
          email,
          role,
          status,
          (SELECT COUNT(*) FROM client_pco_assignments WHERE pco_id = users.id AND status = 'active') as active_assignments
        FROM users
        WHERE deleted_at IS NULL
        AND (name LIKE ? OR pco_number LIKE ? OR email LIKE ?)
      `;
            const searchTerm = `%${q}%`;
            let queryParams = [searchTerm, searchTerm, searchTerm];
            if (role && role !== 'all') {
                if (role === 'pco') {
                    query += ' AND (role = ? OR role = ?)';
                    queryParams.push('pco', 'both');
                }
                else if (role === 'admin') {
                    query += ' AND (role = ? OR role = ?)';
                    queryParams.push('admin', 'both');
                }
                else {
                    query += ' AND role = ?';
                    queryParams.push(role);
                }
            }
            if (status && status !== 'all') {
                query += ' AND status = ?';
                queryParams.push(status);
            }
            query += ' ORDER BY name ASC LIMIT ?';
            queryParams.push(limit);
            const users = await (0, database_1.executeQuery)(query, queryParams);
            res.json({
                success: true,
                data: {
                    users,
                    query: q,
                    total_results: users.length,
                    filters: {
                        role: role || 'all',
                        status: status || 'all'
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Search users error', {
                error: error instanceof Error ? error.message : error,
                search_query: req.query.q,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to search users'
            });
        }
    }
}
exports.UserController = UserController;
exports.default = UserController;
//# sourceMappingURL=userController.js.map