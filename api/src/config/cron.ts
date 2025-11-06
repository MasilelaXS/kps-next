import cron from 'node-cron';
import { deleteOldDraftReports } from '../services/cleanupService';
import logger from '../config/logger';

/**
 * Database Cleanup Cron Jobs
 * Scheduled tasks to maintain database hygiene
 */

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = (): void => {
  logger.info('Initializing cron jobs...');

  // Schedule: Delete old draft reports every day at 2:00 AM
  // Cron pattern: '0 2 * * *' = minute 0, hour 2, every day, every month, every day of week
  cron.schedule('0 2 * * *', async () => {
    logger.info('=== Cron Job: Draft Report Cleanup Started ===');
    await deleteOldDraftReports();
    logger.info('=== Cron Job: Draft Report Cleanup Completed ===');
  }, {
    timezone: "Africa/Johannesburg" // Set your timezone
  });

  logger.info('✓ Cron jobs initialized successfully');
  logger.info('  - Draft report cleanup: Daily at 2:00 AM (Africa/Johannesburg)');
};

/**
 * Run cleanup immediately (useful for testing or manual triggers)
 */
export const runCleanupNow = async (): Promise<void> => {
  logger.info('Manual cleanup triggered');
  await deleteOldDraftReports();
};
