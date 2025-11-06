import { Router, Request, Response } from 'express';
import { deleteOldDraftReports, getOldDraftReportsCount } from '../services/cleanupService';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * GET /api/cleanup/draft-reports/count
 * Get count of draft reports older than 72 hours (Admin only)
 */
router.get('/draft-reports/count', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = await getOldDraftReportsCount();
    
    res.json({
      success: true,
      count,
      message: `Found ${count} draft report(s) older than 72 hours`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to count old draft reports',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cleanup/draft-reports/run
 * Manually trigger cleanup of draft reports older than 72 hours (Admin only)
 */
router.post('/draft-reports/run', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await deleteOldDraftReports();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully. Check server logs for details.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
