import { Router } from 'express';
import { getMonitorData } from '../controllers/monitorController';

const router = Router();

/**
 * GET /api/monitor?key=dannel_monitor_kps_2026
 * Developer health/status portal — secured by key only (no auth middleware)
 */
router.get('/', getMonitorData);

export default router;
