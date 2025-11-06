import { executeQuery } from '../config/database';
import logger from '../config/logger';

/**
 * Cleanup Service
 * Handles automatic deletion of old draft reports to keep database sanitized
 */

/**
 * Delete draft reports older than 72 hours
 * Runs as a scheduled job to maintain database hygiene
 */
export const deleteOldDraftReports = async (): Promise<void> => {
  try {
    logger.info('Starting cleanup: Deleting draft reports older than 72 hours...');

    // SQL query to delete draft reports older than 72 hours
    const query = `
      DELETE FROM reports 
      WHERE status = 'draft' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 72 HOUR)
    `;

    const result: any = await executeQuery(query);

    const deletedCount = result.affectedRows || 0;

    if (deletedCount > 0) {
      logger.info(`✓ Cleanup successful: Deleted ${deletedCount} draft report(s) older than 72 hours`);
    } else {
      logger.info('✓ Cleanup complete: No draft reports older than 72 hours found');
    }
  } catch (error) {
    logger.error('✗ Cleanup failed: Error deleting old draft reports', error);
    // Don't throw - we don't want to crash the server if cleanup fails
  }
};

/**
 * Get count of draft reports older than 72 hours (for monitoring)
 */
export const getOldDraftReportsCount = async (): Promise<number> => {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE status = 'draft' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 72 HOUR)
    `;

    const result: any = await executeQuery(query);
    return result[0]?.count || 0;
  } catch (error) {
    logger.error('Error counting old draft reports', error);
    return 0;
  }
};
