import { Request, Response } from 'express';
import { executeQuery } from '../config/database';
import { logger } from '../utils/logger';

interface SearchResult {
  type: 'user' | 'client' | 'report' | 'chemical';
  id: number;
  title: string;
  subtitle?: string;
  relevance: number;
}

/**
 * Global search across all entities
 * Searches users, clients, reports, and chemicals
 */
export const globalSearch = async (req: Request, res: Response): Promise<void> => {
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
    const maxLimit = Math.min(parseInt(limit as string) || 20, 50);

    // Search all entities in parallel
    const [users, clients, reports, chemicals] = await Promise.all([
      // Search users
      executeQuery(
        `SELECT id, full_name, pco_number, email, role
         FROM users
         WHERE (full_name LIKE ? OR pco_number LIKE ? OR email LIKE ?)
         AND is_active = 1
         LIMIT ?`,
        [searchPattern, searchPattern, searchPattern, Math.floor(maxLimit / 4)]
      ),
      // Search clients
      executeQuery(
        `SELECT id, company_name, contact_person, contact_number, address
         FROM clients
         WHERE (company_name LIKE ? OR contact_person LIKE ? OR contact_number LIKE ?)
         AND is_active = 1
         LIMIT ?`,
        [searchPattern, searchPattern, searchPattern, Math.floor(maxLimit / 4)]
      ),
      // Search reports
      executeQuery(
        `SELECT r.id, r.report_number, r.service_date, c.company_name, u.full_name as pco_name
         FROM reports r
         JOIN clients c ON r.client_id = c.id
         JOIN users u ON r.pco_id = u.id
         WHERE (r.report_number LIKE ? OR c.company_name LIKE ?)
         LIMIT ?`,
        [searchPattern, searchPattern, Math.floor(maxLimit / 4)]
      ),
      // Search chemicals
      executeQuery(
        `SELECT id, product_name, active_ingredient, pest_type
         FROM chemicals
         WHERE (product_name LIKE ? OR active_ingredient LIKE ? OR pest_type LIKE ?)
         AND is_active = 1
         LIMIT ?`,
        [searchPattern, searchPattern, searchPattern, Math.floor(maxLimit / 4)]
      )
    ]);

    // Transform results with relevance scoring
    const results: SearchResult[] = [];

    // Process users
    (users as any[]).forEach((user: any) => {
      let relevance = 0;
      const searchLower = searchTerm.toLowerCase();
      
      if (user.full_name.toLowerCase().includes(searchLower)) relevance += 10;
      if (user.pco_number && user.pco_number.toLowerCase().includes(searchLower)) relevance += 8;
      if (user.email && user.email.toLowerCase().includes(searchLower)) relevance += 6;

      results.push({
        type: 'user',
        id: user.id,
        title: user.full_name,
        subtitle: `${user.role} - ${user.pco_number || user.email}`,
        relevance
      });
    });

    // Process clients
    (clients as any[]).forEach((client: any) => {
      let relevance = 0;
      const searchLower = searchTerm.toLowerCase();
      
      if (client.company_name.toLowerCase().includes(searchLower)) relevance += 10;
      if (client.contact_person && client.contact_person.toLowerCase().includes(searchLower)) relevance += 7;
      if (client.contact_number && client.contact_number.includes(searchTerm)) relevance += 5;

      results.push({
        type: 'client',
        id: client.id,
        title: client.company_name,
        subtitle: client.contact_person || client.address,
        relevance
      });
    });

    // Process reports
    (reports as any[]).forEach((report: any) => {
      let relevance = 0;
      const searchLower = searchTerm.toLowerCase();
      
      if (report.report_number.toLowerCase().includes(searchLower)) relevance += 10;
      if (report.company_name.toLowerCase().includes(searchLower)) relevance += 6;

      results.push({
        type: 'report',
        id: report.id,
        title: report.report_number,
        subtitle: `${report.company_name} - ${report.service_date}`,
        relevance
      });
    });

    // Process chemicals
    (chemicals as any[]).forEach((chemical: any) => {
      let relevance = 0;
      const searchLower = searchTerm.toLowerCase();
      
      if (chemical.product_name.toLowerCase().includes(searchLower)) relevance += 10;
      if (chemical.active_ingredient && chemical.active_ingredient.toLowerCase().includes(searchLower)) relevance += 7;
      if (chemical.pest_type && chemical.pest_type.toLowerCase().includes(searchLower)) relevance += 5;

      results.push({
        type: 'chemical',
        id: chemical.id,
        title: chemical.product_name,
        subtitle: `${chemical.active_ingredient || ''} - ${chemical.pest_type || ''}`,
        relevance
      });
    });

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    logger.info(`Global search completed: "${searchTerm}" (${results.length} results)`);

    res.json({
      success: true,
      data: {
        query: searchTerm,
        total: results.length,
        results: results.slice(0, maxLimit)
      }
    });

  } catch (error) {
    logger.error('Error in global search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search'
    });
  }
};

/**
 * Search reports with filters
 */
export const searchReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, status, pco_id, client_id, date_from, date_to, limit = 20 } = req.query;

    const maxLimit = Math.min(parseInt(limit as string) || 20, 100);
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    // Search query
    if (q && typeof q === 'string' && q.trim().length > 0) {
      conditions.push('(r.report_number LIKE ? OR c.company_name LIKE ? OR u.full_name LIKE ?)');
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Status filter
    if (status && typeof status === 'string') {
      conditions.push('r.status = ?');
      params.push(status);
    }

    // PCO filter
    if (pco_id) {
      conditions.push('r.pco_id = ?');
      params.push(parseInt(pco_id as string));
    }

    // Client filter
    if (client_id) {
      conditions.push('r.client_id = ?');
      params.push(parseInt(client_id as string));
    }

    // Date range filters
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
        r.report_number,
        r.service_date,
        r.status,
        r.created_at,
        c.company_name,
        u.full_name as pco_name,
        u.pco_number
      FROM reports r
      JOIN clients c ON r.client_id = c.id
      JOIN users u ON r.pco_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.service_date DESC, r.created_at DESC
      LIMIT ?
    `;

    const reports = await executeQuery(query, params);

    logger.info(`Report search completed: ${(reports as any[]).length} results`);

    res.json({
      success: true,
      data: {
        total: (reports as any[]).length,
        reports
      }
    });

  } catch (error) {
    logger.error('Error searching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search reports'
    });
  }
};

/**
 * Search users with filters
 */
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, role, is_active, limit = 20 } = req.query;

    const maxLimit = Math.min(parseInt(limit as string) || 20, 100);
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    // Search query
    if (q && typeof q === 'string' && q.trim().length > 0) {
      conditions.push('(full_name LIKE ? OR pco_number LIKE ? OR email LIKE ?)');
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Role filter
    if (role && typeof role === 'string') {
      conditions.push('role = ?');
      params.push(role);
    }

    // Active status filter
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    params.push(maxLimit);

    const query = `
      SELECT 
        id,
        full_name,
        pco_number,
        email,
        phone,
        role,
        is_active,
        created_at
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY full_name ASC
      LIMIT ?
    `;

    const users = await executeQuery(query, params);

    logger.info(`User search completed: ${(users as any[]).length} results`);

    res.json({
      success: true,
      data: {
        total: (users as any[]).length,
        users
      }
    });

  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users'
    });
  }
};

/**
 * Search clients with filters
 */
export const searchClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, is_active, has_contract, limit = 20 } = req.query;

    const maxLimit = Math.min(parseInt(limit as string) || 20, 100);
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    // Search query
    if (q && typeof q === 'string' && q.trim().length > 0) {
      conditions.push('(company_name LIKE ? OR contact_person LIKE ? OR contact_number LIKE ? OR address LIKE ?)');
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Active status filter
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    // Contract filter
    if (has_contract !== undefined) {
      if (has_contract === 'true' || has_contract === '1') {
        conditions.push('contract_start_date IS NOT NULL');
      } else {
        conditions.push('contract_start_date IS NULL');
      }
    }

    params.push(maxLimit);

    const query = `
      SELECT 
        id,
        company_name,
        contact_person,
        contact_number,
        email,
        address,
        is_active,
        contract_start_date,
        contract_end_date,
        created_at
      FROM clients
      WHERE ${conditions.join(' AND ')}
      ORDER BY company_name ASC
      LIMIT ?
    `;

    const clients = await executeQuery(query, params);

    logger.info(`Client search completed: ${(clients as any[]).length} results`);

    res.json({
      success: true,
      data: {
        total: (clients as any[]).length,
        clients
      }
    });

  } catch (error) {
    logger.error('Error searching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search clients'
    });
  }
};

/**
 * Search chemicals with filters
 */
export const searchChemicals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, pest_type, is_active, limit = 20 } = req.query;

    const maxLimit = Math.min(parseInt(limit as string) || 20, 100);
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    // Search query
    if (q && typeof q === 'string' && q.trim().length > 0) {
      conditions.push('(product_name LIKE ? OR active_ingredient LIKE ? OR manufacturer LIKE ?)');
      const searchPattern = `%${q.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Pest type filter
    if (pest_type && typeof pest_type === 'string') {
      conditions.push('pest_type = ?');
      params.push(pest_type);
    }

    // Active status filter
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    params.push(maxLimit);

    const query = `
      SELECT 
        id,
        product_name,
        active_ingredient,
        manufacturer,
        pest_type,
        registration_number,
        is_active,
        created_at
      FROM chemicals
      WHERE ${conditions.join(' AND ')}
      ORDER BY product_name ASC
      LIMIT ?
    `;

    const chemicals = await executeQuery(query, params);

    logger.info(`Chemical search completed: ${(chemicals as any[]).length} results`);

    res.json({
      success: true,
      data: {
        total: (chemicals as any[]).length,
        chemicals
      }
    });

  } catch (error) {
    logger.error('Error searching chemicals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search chemicals'
    });
  }
};
