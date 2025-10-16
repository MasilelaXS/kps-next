/**
 * KPS Pest Control Management System - Version Routes
 * 
 * API endpoints for version management and forced update checking
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import express from 'express';
import { VersionController } from '../controllers/versionController';
import { authenticateToken } from '../middleware/auth';
import { validateVersionInput } from '../middleware/validation';

const router = express.Router();

/**
 * Public Version Routes (No authentication required)
 * Used by mobile apps to check for updates
 */

// Get current app version - used by mobile apps for update checking
router.get('/current', VersionController.getCurrentVersion);

/**
 * Protected Admin Routes (Authentication required)
 * Used by developers/admins for version management
 */

// Release new version (Admin only)
router.post('/admin/release', 
  authenticateToken,
  validateVersionInput,
  VersionController.releaseVersion
);

// Get version history (Admin only)
router.get('/admin/versions', 
  authenticateToken,
  VersionController.getVersionHistory
);

// Update version status (Admin only)
router.put('/admin/versions/:id/status', 
  authenticateToken,
  VersionController.updateVersionStatus
);

export default router;