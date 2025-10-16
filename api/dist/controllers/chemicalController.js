"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChemicalController = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
class ChemicalController {
    static async getChemicalList(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { page = 1, limit = 25, usage_type, status, search } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            let whereConditions = [];
            let queryParams = [];
            if (usage_type && usage_type !== 'all') {
                whereConditions.push('usage_type = ?');
                queryParams.push(usage_type);
            }
            if (status && status !== 'all') {
                whereConditions.push('status = ?');
                queryParams.push(status);
            }
            if (search) {
                whereConditions.push('(name LIKE ? OR active_ingredients LIKE ?)');
                const searchTerm = `%${search}%`;
                queryParams.push(searchTerm, searchTerm);
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            const countQuery = `
        SELECT COUNT(*) as total
        FROM chemicals
        ${whereClause}
      `;
            const countResult = await (0, database_1.executeQuerySingle)(countQuery, queryParams);
            const totalChemicals = countResult?.total || 0;
            const totalPages = Math.ceil(totalChemicals / limitNum);
            const chemicalsQuery = `
        SELECT 
          c.*,
          0 as usage_count,
          0 as report_count
        FROM chemicals c
        ${whereClause}
        ORDER BY c.name ASC
        LIMIT ? OFFSET ?
      `;
            const chemicals = await (0, database_1.executeQuery)(chemicalsQuery, [...queryParams, limitNum, offset]);
            const pagination = {
                current_page: pageNum,
                total_pages: totalPages,
                total_chemicals: totalChemicals,
                per_page: limitNum,
                has_next: pageNum < totalPages,
                has_prev: pageNum > 1
            };
            res.json({
                success: true,
                data: {
                    chemicals,
                    pagination,
                    filters: {
                        usage_type: usage_type || 'all',
                        status: status || 'all',
                        search: search || ''
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get chemical list error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve chemicals'
            });
        }
    }
    static async createChemical(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { name, active_ingredients, usage_type, quantity_unit, safety_information } = req.body;
            const existingChemical = await (0, database_1.executeQuerySingle)('SELECT id FROM chemicals WHERE name = ?', [name]);
            if (existingChemical) {
                res.status(409).json({
                    success: false,
                    message: `Chemical '${name}' already exists`
                });
                return;
            }
            const insertQuery = `
        INSERT INTO chemicals (
          name, 
          active_ingredients, 
          usage_type, 
          quantity_unit,
          safety_information,
          status
        ) VALUES (?, ?, ?, ?, ?, 'active')
      `;
            const result = await (0, database_1.executeQuery)(insertQuery, [
                name,
                active_ingredients,
                usage_type,
                quantity_unit,
                safety_information || null
            ]);
            const newChemical = await (0, database_1.executeQuerySingle)('SELECT * FROM chemicals WHERE id = ?', [result.insertId]);
            logger_1.logger.info('New chemical created', {
                chemical_id: newChemical.id,
                name,
                usage_type,
                created_by: req.user.id
            });
            res.status(201).json({
                success: true,
                message: 'Chemical created successfully',
                data: newChemical
            });
        }
        catch (error) {
            logger_1.logger.error('Create chemical error', {
                error: error instanceof Error ? error.message : error,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to create chemical'
            });
        }
    }
    static async getChemicalById(req, res) {
        try {
            const { id } = req.params;
            const chemical = await (0, database_1.executeQuerySingle)(`
        SELECT 
          c.*,
          0 as total_usage_count,
          0 as used_in_reports,
          NULL as last_used_date,
          0 as usage_last_30_days
        FROM chemicals c
        WHERE c.id = ?
      `, [id]);
            if (!chemical) {
                res.status(404).json({
                    success: false,
                    message: 'Chemical not found'
                });
                return;
            }
            const recentUsage = [];
            res.json({
                success: true,
                data: {
                    chemical,
                    recent_usage: recentUsage
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get chemical by ID error', {
                error: error instanceof Error ? error.message : error,
                chemical_id: req.params.id,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve chemical'
            });
        }
    }
    static async updateChemical(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { name, active_ingredients, usage_type, quantity_unit, safety_information } = req.body;
            const existingChemical = await (0, database_1.executeQuerySingle)('SELECT * FROM chemicals WHERE id = ?', [id]);
            if (!existingChemical) {
                res.status(404).json({
                    success: false,
                    message: 'Chemical not found'
                });
                return;
            }
            if (name && name !== existingChemical.name) {
                const nameConflict = await (0, database_1.executeQuerySingle)('SELECT id FROM chemicals WHERE name = ? AND id != ?', [name, id]);
                if (nameConflict) {
                    res.status(409).json({
                        success: false,
                        message: `Chemical name '${name}' already exists`
                    });
                    return;
                }
            }
            const updateQuery = `
        UPDATE chemicals 
        SET 
          name = ?, 
          active_ingredients = ?, 
          usage_type = ?, 
          quantity_unit = ?,
          safety_information = ?,
          updated_at = NOW()
        WHERE id = ?
      `;
            await (0, database_1.executeQuery)(updateQuery, [
                name || existingChemical.name,
                active_ingredients || existingChemical.active_ingredients,
                usage_type || existingChemical.usage_type,
                quantity_unit || existingChemical.quantity_unit,
                safety_information !== undefined ? safety_information : existingChemical.safety_information,
                id
            ]);
            const updatedChemical = await (0, database_1.executeQuerySingle)('SELECT * FROM chemicals WHERE id = ?', [id]);
            logger_1.logger.info('Chemical updated', {
                chemical_id: id,
                updated_fields: { name, active_ingredients, usage_type, quantity_unit },
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: 'Chemical updated successfully',
                data: updatedChemical
            });
        }
        catch (error) {
            logger_1.logger.error('Update chemical error', {
                error: error instanceof Error ? error.message : error,
                chemical_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update chemical'
            });
        }
    }
    static async updateChemicalStatus(req, res) {
        try {
            if (req.user?.role !== 'admin') {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
                return;
            }
            const { id } = req.params;
            const { status } = req.body;
            const chemical = await (0, database_1.executeQuerySingle)('SELECT * FROM chemicals WHERE id = ?', [id]);
            if (!chemical) {
                res.status(404).json({
                    success: false,
                    message: 'Chemical not found'
                });
                return;
            }
            const usageCount = { count: 0 };
            if (usageCount?.count > 0 && status === 'inactive') {
                logger_1.logger.warn('Attempt to deactivate chemical in use', {
                    chemical_id: id,
                    usage_count: usageCount.count,
                    attempted_by: req.user.id
                });
            }
            await (0, database_1.executeQuery)('UPDATE chemicals SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
            logger_1.logger.info('Chemical status updated', {
                chemical_id: id,
                old_status: chemical.status,
                new_status: status,
                updated_by: req.user.id,
                usage_count: usageCount?.count || 0
            });
            res.json({
                success: true,
                message: `Chemical ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
                data: {
                    usage_warning: usageCount?.count > 0 ? `This chemical has been used in ${usageCount.count} report entries` : null
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Update chemical status error', {
                error: error instanceof Error ? error.message : error,
                chemical_id: req.params.id,
                admin_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to update chemical status'
            });
        }
    }
    static async getChemicalsByType(req, res) {
        try {
            const { usage_type } = req.params;
            const { status = 'active' } = req.query;
            const validTypes = ['bait_inspection', 'fumigation', 'multi_purpose'];
            if (!validTypes.includes(usage_type)) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid usage type. Must be: bait_inspection, fumigation, or multi_purpose'
                });
                return;
            }
            let query = `
        SELECT 
          id,
          name,
          active_ingredients,
          usage_type,
          quantity_unit,
          safety_information,
          status,
          0 as usage_count
        FROM chemicals
        WHERE usage_type = ? OR usage_type = 'multi_purpose'
      `;
            const queryParams = [usage_type];
            if (status !== 'all') {
                query += ' AND status = ?';
                queryParams.push(status);
            }
            query += ' ORDER BY name ASC';
            const chemicals = await (0, database_1.executeQuery)(query, queryParams);
            res.json({
                success: true,
                data: {
                    usage_type,
                    chemicals,
                    total: chemicals.length
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get chemicals by type error', {
                error: error instanceof Error ? error.message : error,
                usage_type: req.params.usage_type,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve chemicals'
            });
        }
    }
    static async searchChemicals(req, res) {
        try {
            const { q, usage_type, status, limit = 20 } = req.query;
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
          name,
          active_ingredients,
          usage_type,
          quantity_unit,
          status,
          0 as usage_count
        FROM chemicals
        WHERE (name LIKE ? OR active_ingredients LIKE ?)
      `;
            const searchTerm = `%${q}%`;
            let queryParams = [searchTerm, searchTerm];
            if (usage_type && usage_type !== 'all') {
                query += ' AND (usage_type = ? OR usage_type = "multi_purpose")';
                queryParams.push(usage_type);
            }
            if (status && status !== 'all') {
                query += ' AND status = ?';
                queryParams.push(status);
            }
            query += ' ORDER BY name ASC LIMIT ?';
            queryParams.push(limit);
            const chemicals = await (0, database_1.executeQuery)(query, queryParams);
            res.json({
                success: true,
                data: {
                    chemicals,
                    query: q,
                    total_results: chemicals.length,
                    filters: {
                        usage_type: usage_type || 'all',
                        status: status || 'all'
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Search chemicals error', {
                error: error instanceof Error ? error.message : error,
                search_query: req.query.q,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to search chemicals'
            });
        }
    }
}
exports.ChemicalController = ChemicalController;
exports.default = ChemicalController;
//# sourceMappingURL=chemicalController.js.map