/**
 * PCO Calendar Routes
 * Handles calendar view for PCO job history
 */

import express, { Request, Response } from 'express';
import { authenticateToken, hasRole, AuthenticatedUser } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { executeQuery } from '../config/database';
import { logger } from '../config/logger';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const calendarParamsSchema = Joi.object({
  pcoId: Joi.string().pattern(/^\d+$/).required(),
  year: Joi.string().pattern(/^\d{4}$/).required(),
  month: Joi.string().pattern(/^(0?[1-9]|1[0-2])$/).required()
});

const dayParamsSchema = Joi.object({
  pcoId: Joi.string().pattern(/^\d+$/).required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
});

const summaryParamsSchema = Joi.object({
  pcoId: Joi.string().pattern(/^\d+$/).required()
});

// Interfaces
interface CalendarReport {
  id: number;
  client_name: string;
  report_type: string;
  status: string;
}

interface CalendarDay {
  count: number;
  reports: CalendarReport[];
}

interface CalendarData {
  date: string;
  count: number;
  reports: string;
}

/**
 * Get detailed information for a specific day
 * Returns all reports for a given date
 */
router.get('/pco/:pcoId/calendar/day/:date',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pcoId, date } = req.params;
      const pcoIdNum = parseInt(pcoId);
      const user = req.user as AuthenticatedUser;

      // Authorization check
      if (!hasRole(user, 'admin') && user.id !== pcoIdNum) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own calendar.'
        });
        return;
      }

      const detailQuery = `
        SELECT 
          r.id,
          c.company_name as client_name,
          r.report_type,
          r.status,
          r.created_at,
          c.address_line1,
          c.city,
          c.postal_code
        FROM reports r
        JOIN clients c ON r.client_id = c.id
        WHERE r.pco_id = ?
          AND DATE(r.created_at) = ?
          AND r.status IN ('approved', 'pending')
        ORDER BY r.created_at
      `;

      const reports = await executeQuery<any>(detailQuery, [pcoIdNum, date]);

      res.json({
        success: true,
        data: {
          date,
          reports,
          count: reports.length
        }
      });
    } catch (error) {
      logger.error('Error fetching day details:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get PCO's monthly calendar data
 * Shows count of reports per day for a specific month
 */
router.get('/pco/:pcoId/calendar/:year/:month',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pcoId, year, month } = req.params;
      const pcoIdNum = parseInt(pcoId);
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const user = req.user as AuthenticatedUser;

      // Authorization check
      if (!hasRole(user, 'admin') && user.id !== pcoIdNum) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own calendar.'
        });
        return;
      }

      // Get PCO information
      const pcoQuery = `
        SELECT id, name, created_at as registration_date
        FROM users 
        WHERE id = ? AND (role = 'pco' OR role = 'both')
      `;
      const pcoResult = await executeQuery<any>(pcoQuery, [pcoIdNum]);

      if (pcoResult.length === 0) {
        res.status(404).json({
          success: false,
          message: 'PCO not found'
        });
        return;
      }

      const pco = pcoResult[0];

      // Get calendar data for the month
      const calendarQuery = `
        SELECT 
          DATE(r.created_at) as date,
          COUNT(*) as count
        FROM reports r
        JOIN clients c ON r.client_id = c.id
        WHERE r.pco_id = ?
          AND YEAR(r.created_at) = ?
          AND MONTH(r.created_at) = ?
          AND r.status IN ('approved', 'pending')
        GROUP BY DATE(r.created_at)
        ORDER BY date
      `;

      const calendarData = await executeQuery<any>(calendarQuery, [pcoIdNum, yearNum, monthNum]);

      // Transform data into calendar format
      const monthlyData: Record<string, CalendarDay> = {};

      calendarData.forEach((day: any) => {
        // Ensure consistent date formatting as YYYY-MM-DD
        const dateStr = day.date instanceof Date 
          ? day.date.toISOString().split('T')[0]
          : day.date.toString().split(' ')[0]; // Handle if it's already a string
        
        monthlyData[dateStr] = {
          count: day.count,
          reports: [] // We'll populate this with a separate query if needed
        };
      });

      logger.info(`Calendar data retrieved for PCO ${pcoIdNum} for ${yearNum}-${monthNum}`, {
        pcoId: pcoIdNum,
        year: yearNum,
        month: monthNum,
        daysWithWork: Object.keys(monthlyData).length
      });

      res.json({
        success: true,
        data: {
          pco: {
            id: pco.id,
            name: pco.name,
            registrationDate: pco.registration_date
          },
          year: yearNum,
          month: monthNum,
          calendar: monthlyData
        }
      });
    } catch (error) {
      logger.error('Error fetching calendar data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get summary statistics for PCO
 * Returns total reports, working days, etc.
 */
router.get('/pco/:pcoId/calendar/summary',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { pcoId } = req.params;
      const pcoIdNum = parseInt(pcoId);
      const user = req.user as AuthenticatedUser;

      // Authorization check
      if (!hasRole(user, 'admin') && user.id !== pcoIdNum) {
        res.status(403).json({
          success: false,
          message: 'Access denied. You can only view your own calendar.'
        });
        return;
      }

      const { year, month } = req.query;
      const params: any[] = [pcoIdNum];
      let dateFilter = '';

      if (year && month) {
        dateFilter = ' AND YEAR(r.created_at) = ? AND MONTH(r.created_at) = ?';
        params.push(year as string, month as string);
      } else if (year) {
        dateFilter = ' AND YEAR(r.created_at) = ?';
        params.push(year as string);
      }

      const summaryQuery = `
        SELECT 
          COUNT(*) as total_reports,
          COUNT(DISTINCT DATE(r.created_at)) as working_days,
          COUNT(DISTINCT r.client_id) as unique_clients,
          MIN(DATE(r.created_at)) as first_report_date,
          MAX(DATE(r.created_at)) as last_report_date
        FROM reports r
        WHERE r.pco_id = ?
          AND r.status IN ('approved', 'pending')
          ${dateFilter}
      `;

      const summaryResult = await executeQuery<any>(summaryQuery, params);
      const summary = summaryResult[0];

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error fetching calendar summary:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;