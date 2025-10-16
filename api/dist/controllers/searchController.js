"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchChemicals = exports.searchClients = exports.searchUsers = exports.searchReports = exports.globalSearch = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const globalSearch = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: 'Search query parameter "q" is required'
            });
            return;
        }
        const searchTerm = q.trim();
        const searchPattern = `%${searchTerm}%`;
        const maxLimit = Math.min(parseInt(limit) || 20, 50);
        const [users, clients, reports, chemicals] = await Promise.all([
            (0, database_1.executeQuery)(`SELECT id, name as full_name, pco_number, email, role, status
         FROM users
         WHERE (name LIKE ? OR pco_number LIKE ? OR email LIKE ?)
         AND status = 'active' AND deleted_at IS NULL
         LIMIT ?`, [searchPattern, searchPattern, searchPattern, Math.floor(maxLimit / 4)]),
            (0, database_1.executeQuery)(`SELECT c.id, c.company_name, c.city, c.address_line1
         FROM clients c
         WHERE (c.company_name LIKE ? OR c.city LIKE ? OR c.address_line1 LIKE ?)
         AND c.status = 'active' AND c.deleted_at IS NULL
         LIMIT ?`, [searchPattern, searchPattern, searchPattern, Math.floor(maxLimit / 4)]),
            (0, database_1.executeQuery)(`SELECT r.id, r.service_date, r.status, c.company_name, u.name as pco_name
         FROM reports r
         JOIN clients c ON r.client_id = c.id
         JOIN users u ON r.pco_id = u.id
         WHERE (c.company_name LIKE ? OR u.name LIKE ?)
         LIMIT ?`, [searchPattern, searchPattern, Math.floor(maxLimit / 4)]),
            (0, database_1.executeQuery)(`SELECT id, name as product_name, active_ingredients, usage_type
         FROM chemicals
         WHERE (name LIKE ? OR active_ingredients LIKE ?)
         AND status = 'active' AND deleted_at IS NULL
         LIMIT ?`, [searchPattern, searchPattern, Math.floor(maxLimit / 4)])
        ]);
        const results = [];
        users.forEach((user) => {
            let relevance = 0;
            const searchLower = searchTerm.toLowerCase();
            if (user.full_name.toLowerCase().includes(searchLower))
                relevance += 10;
            if (user.pco_number && user.pco_number.toLowerCase().includes(searchLower))
                relevance += 8;
            if (user.email && user.email.toLowerCase().includes(searchLower))
                relevance += 6;
            results.push({
                type: 'user',
                id: user.id,
                title: user.full_name,
                subtitle: `${user.role} - ${user.pco_number || user.email}`,
                relevance
            });
        });
        clients.forEach((client) => {
            let relevance = 0;
            const searchLower = searchTerm.toLowerCase();
            if (client.company_name.toLowerCase().includes(searchLower))
                relevance += 10;
            if (client.city && client.city.toLowerCase().includes(searchLower))
                relevance += 7;
            if (client.address_line1 && client.address_line1.toLowerCase().includes(searchLower))
                relevance += 5;
            results.push({
                type: 'client',
                id: client.id,
                title: client.company_name,
                subtitle: `${client.city} - ${client.address_line1}`,
                relevance
            });
        });
        reports.forEach((report) => {
            let relevance = 0;
            const searchLower = searchTerm.toLowerCase();
            if (report.company_name && report.company_name.toLowerCase().includes(searchLower))
                relevance += 10;
            if (report.pco_name && report.pco_name.toLowerCase().includes(searchLower))
                relevance += 6;
            results.push({
                type: 'report',
                id: report.id,
                title: `Report #${report.id}`,
                subtitle: `${report.company_name} - ${report.service_date} (${report.status})`,
                relevance
            });
        });
        chemicals.forEach((chemical) => {
            let relevance = 0;
            const searchLower = searchTerm.toLowerCase();
            if (chemical.product_name.toLowerCase().includes(searchLower))
                relevance += 10;
            if (chemical.active_ingredients && chemical.active_ingredients.toLowerCase().includes(searchLower))
                relevance += 7;
            if (chemical.usage_type && chemical.usage_type.toLowerCase().includes(searchLower))
                relevance += 5;
            results.push({
                type: 'chemical',
                id: chemical.id,
                title: chemical.product_name,
                subtitle: `${chemical.active_ingredients || ''} - ${chemical.usage_type || ''}`,
                relevance
            });
        });
        results.sort((a, b) => b.relevance - a.relevance);
        logger_1.logger.info(`Global search completed: "${searchTerm}" (${results.length} results)`);
        res.json({
            success: true,
            data: {
                query: searchTerm,
                total: results.length,
                results: results.slice(0, maxLimit)
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error in global search:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform search'
        });
    }
};
exports.globalSearch = globalSearch;
const searchReports = async (req, res) => {
    try {
        const { q, status, pco_id, client_id, date_from, date_to, limit = 20 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        const conditions = ['1=1'];
        const params = [];
        if (q && typeof q === 'string' && q.trim().length > 0) {
            conditions.push('(c.company_name LIKE ? OR u.name LIKE ?)');
            const searchPattern = `%${q.trim()}%`;
            params.push(searchPattern, searchPattern);
        }
        if (status && typeof status === 'string') {
            conditions.push('r.status = ?');
            params.push(status);
        }
        if (pco_id) {
            conditions.push('r.pco_id = ?');
            params.push(parseInt(pco_id));
        }
        if (client_id) {
            conditions.push('r.client_id = ?');
            params.push(parseInt(client_id));
        }
        if (date_from) {
            conditions.push('r.service_date >= ?');
            params.push(date_from);
        }
        if (date_to) {
            conditions.push('r.service_date <= ?');
            params.push(date_to);
        }
        params.push(maxLimit);
        const query = `
      SELECT 
        r.id,
        r.service_date,
        r.status,
        r.report_type,
        r.created_at,
        c.company_name,
        u.name as pco_name,
        u.pco_number
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT ?
    `;
        const reports = await (0, database_1.executeQuery)(query, params);
        logger_1.logger.info(`Report search completed: ${reports.length} results`);
        res.json({
            success: true,
            data: {
                total: reports.length,
                reports
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error searching reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search reports'
        });
    }
};
exports.searchReports = searchReports;
const searchUsers = async (req, res) => {
    try {
        const { q, role, is_active, limit = 20 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        const conditions = ['1=1'];
        const params = [];
        if (q && typeof q === 'string' && q.trim().length > 0) {
            conditions.push('(name LIKE ? OR pco_number LIKE ? OR email LIKE ?)');
            const searchPattern = `%${q.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        if (role && typeof role === 'string') {
            conditions.push('role = ?');
            params.push(role);
        }
        if (is_active !== undefined) {
            conditions.push('status = ?');
            params.push(is_active === 'true' || is_active === '1' ? 'active' : 'inactive');
        }
        params.push(maxLimit);
        const query = `
      SELECT 
        id,
        name,
        pco_number,
        email,
        phone,
        role,
        status,
        created_at
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT ?
    `;
        const users = await (0, database_1.executeQuery)(query, params);
        logger_1.logger.info(`User search completed: ${users.length} results`);
        res.json({
            success: true,
            data: {
                total: users.length,
                users
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error searching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search users'
        });
    }
};
exports.searchUsers = searchUsers;
const searchClients = async (req, res) => {
    try {
        const { q, is_active, has_contract, limit = 20 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        const conditions = ['c.deleted_at IS NULL'];
        const params = [];
        if (q && typeof q === 'string' && q.trim().length > 0) {
            conditions.push('(c.company_name LIKE ? OR c.city LIKE ? OR c.address_line1 LIKE ?)');
            const searchPattern = `%${q.trim()}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        if (is_active !== undefined) {
            conditions.push('c.status = ?');
            params.push(is_active === 'true' || is_active === '1' ? 'active' : 'inactive');
        }
        params.push(maxLimit);
        const query = `
      SELECT 
        c.id,
        c.company_name,
        c.city,
        c.address_line1,
        c.status,
        c.created_at,
        GROUP_CONCAT(DISTINCT cc.name) as contact_names,
        GROUP_CONCAT(DISTINCT cc.phone) as contact_phones,
        GROUP_CONCAT(DISTINCT cc.email) as contact_emails
      FROM clients c
      LEFT JOIN client_contacts cc ON c.id = cc.client_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.company_name ASC
      LIMIT ?
    `;
        const clients = await (0, database_1.executeQuery)(query, params);
        logger_1.logger.info(`Client search completed: ${clients.length} results`);
        res.json({
            success: true,
            data: {
                total: clients.length,
                clients
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error searching clients:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search clients'
        });
    }
};
exports.searchClients = searchClients;
const searchChemicals = async (req, res) => {
    try {
        const { q, pest_type, is_active, limit = 20 } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 20, 100);
        const conditions = ['1=1'];
        const params = [];
        if (q && typeof q === 'string' && q.trim().length > 0) {
            conditions.push('(name LIKE ? OR active_ingredients LIKE ?)');
            const searchPattern = `%${q.trim()}%`;
            params.push(searchPattern, searchPattern);
        }
        if (pest_type && typeof pest_type === 'string') {
            conditions.push('usage_type = ?');
            params.push(pest_type);
        }
        if (is_active !== undefined) {
            conditions.push('status = ?');
            params.push(is_active === 'true' || is_active === '1' ? 'active' : 'inactive');
        }
        params.push(maxLimit);
        const query = `
      SELECT 
        id,
        name as product_name,
        active_ingredients,
        usage_type,
        quantity_unit,
        status,
        created_at
      FROM chemicals
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT ?
    `;
        const chemicals = await (0, database_1.executeQuery)(query, params);
        logger_1.logger.info(`Chemical search completed: ${chemicals.length} results`);
        res.json({
            success: true,
            data: {
                total: chemicals.length,
                chemicals
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error searching chemicals:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search chemicals'
        });
    }
};
exports.searchChemicals = searchChemicals;
//# sourceMappingURL=searchController.js.map