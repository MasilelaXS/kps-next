/**
 * KPS Pest Control Management System - Chemical Controller
 * 
 * Handles chemical management operations for admin portal
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';

// Chemical types
type ChemicalUsageType = 'bait_inspection' | 'fumigation' | 'multi_purpose';
type ChemicalStatus = 'active' | 'inactive';

export class ChemicalController {
  /**
   * Get paginated chemical list with filtering
   * GET /api/admin/chemicals
   */
  static async getChemicalList(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const {
        page = 1,
        limit = 25,
        usage_type,
        status,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Build query conditions
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Filter by usage type
      if (usage_type && usage_type !== 'all') {
        whereConditions.push('usage_type = ?');
        queryParams.push(usage_type as string);
      }

      // Filter by status
      if (status && status !== 'all') {
        whereConditions.push('status = ?');
        queryParams.push(status as string);
      }

      // Search functionality
      if (search) {
        whereConditions.push('(name LIKE ? OR active_ingredients LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM chemicals
        ${whereClause}
      `;
      
      const countResult = await executeQuerySingle(countQuery, queryParams);
      const totalChemicals = countResult?.total || 0;
      const totalPages = Math.ceil(totalChemicals / limitNum);

      // Get chemicals with basic info (usage statistics will be available in Phase 3)
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

      const chemicals = await executeQuery(chemicalsQuery, [...queryParams, limitNum, offset]);

      // Calculate pagination metadata
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

    } catch (error) {
      logger.error('Get chemical list error', { 
        error: error instanceof Error ? error.message : error,
        user_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve chemicals'
      });
    }
  }

  /**
   * Create new chemical
   * POST /api/admin/chemicals
   */
  static async createChemical(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { 
        name, 
        active_ingredients, 
        usage_type, 
        quantity_unit,
        l_number,
        batch_number,
        safety_information
      } = req.body;

      // Convert L number and batch number to uppercase
      const normalizedLNumber = l_number ? l_number.trim().toUpperCase() : null;
      const normalizedBatchNumber = batch_number ? batch_number.trim().toUpperCase() : null;

      // Check for duplicate chemical name
      const existingChemical = await executeQuerySingle(
        'SELECT id FROM chemicals WHERE name = ?',
        [name]
      );

      if (existingChemical) {
        res.status(409).json({
          success: false,
          message: `Chemical '${name}' already exists`
        });
        return;
      }

      // Insert new chemical
      const insertQuery = `
        INSERT INTO chemicals (
          name, 
          active_ingredients, 
          usage_type, 
          quantity_unit,
          l_number,
          batch_number,
          safety_information,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `;

      const result = await executeQuery(insertQuery, [
        name,
        active_ingredients,
        usage_type,
        quantity_unit,
        normalizedLNumber,
        normalizedBatchNumber,
        safety_information || null
      ]);

      // Get the created chemical
      const newChemical = await executeQuerySingle(
        'SELECT * FROM chemicals WHERE id = ?',
        [(result as any).insertId]
      );

      logger.info('New chemical created', {
        chemical_id: newChemical.id,
        name,
        usage_type,
        created_by: req.user!.id
      });

      res.status(201).json({
        success: true,
        message: 'Chemical created successfully',
        data: newChemical
      });

    } catch (error) {
      logger.error('Create chemical error', { 
        error: error instanceof Error ? error.message : error,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create chemical'
      });
    }
  }

  /**
   * Get specific chemical by ID
   * GET /api/admin/chemicals/:id
   */
  static async getChemicalById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Get chemical (usage statistics will be available when Reports are implemented in Phase 3)
      const chemical = await executeQuerySingle(`
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

      // Get recent usage history (will be available in Phase 3 when Reports are implemented)
      const recentUsage: any[] = [];

      res.json({
        success: true,
        data: {
          chemical,
          recent_usage: recentUsage
        }
      });

    } catch (error) {
      logger.error('Get chemical by ID error', { 
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

  /**
   * Update chemical information
   * PUT /api/admin/chemicals/:id
   */
  static async updateChemical(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { 
        name, 
        active_ingredients, 
        usage_type, 
        quantity_unit,
        l_number,
        batch_number,
        safety_information
      } = req.body;

      // Convert L number and batch number to uppercase
      const normalizedLNumber = l_number !== undefined 
        ? (l_number ? l_number.trim().toUpperCase() : null)
        : undefined;
      const normalizedBatchNumber = batch_number !== undefined
        ? (batch_number ? batch_number.trim().toUpperCase() : null)
        : undefined;

      // Check if chemical exists
      const existingChemical = await executeQuerySingle(
        'SELECT * FROM chemicals WHERE id = ?',
        [id]
      );

      if (!existingChemical) {
        res.status(404).json({
          success: false,
          message: 'Chemical not found'
        });
        return;
      }

      // Check for name conflicts (excluding current chemical)
      if (name && name !== existingChemical.name) {
        const nameConflict = await executeQuerySingle(
          'SELECT id FROM chemicals WHERE name = ? AND id != ?',
          [name, id]
        );

        if (nameConflict) {
          res.status(409).json({
            success: false,
            message: `Chemical name '${name}' already exists`
          });
          return;
        }
      }

      // Update chemical
      const updateQuery = `
        UPDATE chemicals 
        SET 
          name = ?, 
          active_ingredients = ?, 
          usage_type = ?, 
          quantity_unit = ?,
          l_number = ?,
          batch_number = ?,
          safety_information = ?,
          updated_at = NOW()
        WHERE id = ?
      `;

      await executeQuery(updateQuery, [
        name || existingChemical.name,
        active_ingredients || existingChemical.active_ingredients,
        usage_type || existingChemical.usage_type,
        quantity_unit || existingChemical.quantity_unit,
        normalizedLNumber !== undefined ? normalizedLNumber : existingChemical.l_number,
        normalizedBatchNumber !== undefined ? normalizedBatchNumber : existingChemical.batch_number,
        safety_information !== undefined ? safety_information : existingChemical.safety_information,
        id
      ]);

      // Get updated chemical
      const updatedChemical = await executeQuerySingle(
        'SELECT * FROM chemicals WHERE id = ?',
        [id]
      );

      logger.info('Chemical updated', {
        chemical_id: id,
        updated_fields: { name, active_ingredients, usage_type, quantity_unit },
        updated_by: req.user!.id
      });

      res.json({
        success: true,
        message: 'Chemical updated successfully',
        data: updatedChemical
      });

    } catch (error) {
      logger.error('Update chemical error', { 
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

  /**
   * Update chemical status (active/inactive)
   * PUT /api/admin/chemicals/:id/status
   * Note: Cannot delete chemicals used in reports - can only deactivate
   */
  static async updateChemicalStatus(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      // Check if chemical exists
      const chemical = await executeQuerySingle(
        'SELECT * FROM chemicals WHERE id = ?',
        [id]
      );

      if (!chemical) {
        res.status(404).json({
          success: false,
          message: 'Chemical not found'
        });
        return;
      }

      // Check if chemical is used in any reports (will check report_chemicals table in Phase 3)
      const usageCount = { count: 0 };

      if (usageCount?.count > 0 && status === 'inactive') {
        logger.warn('Attempt to deactivate chemical in use', {
          chemical_id: id,
          usage_count: usageCount.count,
          attempted_by: req.user!.id
        });
      }

      // Update chemical status
      await executeQuery(
        'UPDATE chemicals SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, id]
      );

      logger.info('Chemical status updated', {
        chemical_id: id,
        old_status: chemical.status,
        new_status: status,
        updated_by: req.user!.id,
        usage_count: usageCount?.count || 0
      });

      res.json({
        success: true,
        message: `Chemical ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: {
          usage_warning: usageCount?.count > 0 ? `This chemical has been used in ${usageCount.count} report entries` : null
        }
      });

    } catch (error) {
      logger.error('Update chemical status error', { 
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

  /**
   * Get chemicals by usage type
   * GET /api/chemicals/type/:usage_type
   */
  static async getChemicalsByType(req: Request, res: Response): Promise<void> {
    try {
      const { usage_type } = req.params;
      const { status = 'active' } = req.query;

      // Validate usage type
      const validTypes = ['bait_inspection', 'fumigation', 'multi_purpose'];
      if (!validTypes.includes(usage_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid usage type. Must be: bait_inspection, fumigation, or multi_purpose'
        });
        return;
      }

      // Build query
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

      const queryParams: any[] = [usage_type];

      // Filter by status
      if (status !== 'all') {
        query += ' AND status = ?';
        queryParams.push(status as string);
      }

      query += ' ORDER BY name ASC';

      const chemicals = await executeQuery(query, queryParams);

      res.json({
        success: true,
        data: {
          usage_type,
          chemicals,
          total: chemicals.length
        }
      });

    } catch (error) {
      logger.error('Get chemicals by type error', { 
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

  /**
   * Get chemicals for PCO (active only) by usage type
   * GET /api/pco/chemicals/:usage_type
   * Returns a flat array of chemicals for easier consumption by mobile app
   */
  static async getChemicalsForPco(req: Request, res: Response): Promise<void> {
    try {
      const { usage_type } = req.params;

      console.log('getChemicalsForPco called with usage_type:', usage_type);

      // Validate usage type
      const validTypes = ['bait_inspection', 'fumigation', 'multi_purpose'];
      if (!validTypes.includes(usage_type)) {
        console.log('Invalid usage_type:', usage_type);
        res.status(400).json({
          success: false,
          message: 'Invalid usage type. Must be: bait_inspection, fumigation, or multi_purpose'
        });
        return;
      }

      // Build query - only active chemicals for PCO
      let query = `
        SELECT 
          id,
          name,
          active_ingredients,
          usage_type,
          quantity_unit,
          safety_information
        FROM chemicals
        WHERE (usage_type = ? OR usage_type = 'multi_purpose') AND status = 'active'
        ORDER BY name ASC
      `;

      console.log('Executing query with param:', usage_type);
      const chemicals = await executeQuery(query, [usage_type]);
      console.log('Query result count:', chemicals.length);

      res.json({
        success: true,
        data: chemicals
      });
    } catch (error) {
      console.error('Get chemicals for PCO error:', error);
      logger.error('Get chemicals for PCO error', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        usage_type: req.params.usage_type,
        user_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve chemicals'
      });
    }
  }

  /**
   * Search chemicals
   * GET /api/chemicals/search
   */
  static async searchChemicals(req: Request, res: Response): Promise<void> {
    try {
      const { q, usage_type, status, limit = 20 } = req.query;

      if (!q || (q as string).length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters'
        });
        return;
      }

      // Build search query
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
        queryParams.push(usage_type as string);
      }

      if (status && status !== 'all') {
        query += ' AND status = ?';
        queryParams.push(status as string);
      }

      query += ' ORDER BY name ASC LIMIT ?';
      queryParams.push(limit as string);

      const chemicals = await executeQuery(query, queryParams);

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

    } catch (error) {
      logger.error('Search chemicals error', { 
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

  /**
   * Delete chemical (soft delete if used in reports, hard delete otherwise)
   * DELETE /api/admin/chemicals/:id
   */
  static async deleteChemical(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { id } = req.params;

      // Check if chemical exists
      const chemical = await executeQuerySingle(
        'SELECT * FROM chemicals WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (!chemical) {
        res.status(404).json({
          success: false,
          message: 'Chemical not found'
        });
        return;
      }

      // Check if chemical is used in any reports
      const stationUsage = await executeQuerySingle(
        'SELECT COUNT(*) as count FROM station_chemicals WHERE chemical_id = ?',
        [id]
      );

      const fumigationUsage = await executeQuerySingle(
        'SELECT COUNT(*) as count FROM fumigation_chemicals WHERE chemical_id = ?',
        [id]
      );

      const totalUsage = (stationUsage?.count || 0) + (fumigationUsage?.count || 0);

      if (totalUsage > 0) {
        // Soft delete: Chemical is used in reports
        await executeQuery(
          'UPDATE chemicals SET deleted_at = NOW(), status = "inactive", updated_at = NOW() WHERE id = ?',
          [id]
        );

        logger.info('Chemical soft deleted (used in reports)', {
          chemical_id: id,
          chemical_name: chemical.name,
          usage_count: totalUsage,
          deleted_by: req.user!.id
        });

        res.json({
          success: true,
          message: `Chemical "${chemical.name}" has been deactivated`,
          data: {
            delete_type: 'soft',
            reason: 'Chemical is linked to existing reports',
            usage_count: totalUsage,
            note: 'Chemical data preserved for report history'
          }
        });
      } else {
        // Hard delete: Chemical not used in any reports
        await executeQuery(
          'DELETE FROM chemicals WHERE id = ?',
          [id]
        );

        logger.info('Chemical hard deleted (no report associations)', {
          chemical_id: id,
          chemical_name: chemical.name,
          deleted_by: req.user!.id
        });

        res.json({
          success: true,
          message: `Chemical "${chemical.name}" has been permanently deleted`,
          data: {
            delete_type: 'hard',
            reason: 'No report associations found'
          }
        });
      }

    } catch (error) {
      logger.error('Delete chemical error', { 
        error: error instanceof Error ? error.message : error,
        chemical_id: req.params.id,
        admin_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete chemical'
      });
    }
  }
}

export default ChemicalController;
