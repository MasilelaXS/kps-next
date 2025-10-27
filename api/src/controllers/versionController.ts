/**
 * KPS Pest Control Management System - Version Controller
 * 
 * Handles version management for mobile app updates and forced update checking
 * 
 * @author KPS Development Team
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { hasRole } from '../middleware/auth';
import { executeQuery, executeQuerySingle } from '../config/database';
import { logger } from '../config/logger';

// Version validation helper
const isValidSemanticVersion = (version: string): boolean => {
  const semanticVersionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  return semanticVersionRegex.test(version);
};

// Compare semantic versions (returns -1, 0, 1)
const compareVersions = (version1: string, version2: string): number => {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  return 0;
};

export class VersionController {
  /**
   * Get current version for app update checking
   * GET /api/version/current
   */
  static async getCurrentVersion(req: Request, res: Response): Promise<void> {
    try {
      const { platform, current_version } = req.query;

      // Get the latest active version for the platform
      let query = `
        SELECT 
          version,
          platform,
          force_update,
          release_notes,
          release_date,
          is_active
        FROM app_versions 
        WHERE is_active = 1
      `;
      
      const params: any[] = [];
      
      if (platform && platform !== 'all') {
        query += ` AND (platform = ? OR platform = 'all')`;
        params.push(platform);
      }
      
      query += ` ORDER BY release_date DESC LIMIT 1`;
      
      const latestVersion = await executeQuerySingle(query, params);

      if (!latestVersion) {
        res.status(404).json({
          success: false,
          message: 'No active version found'
        });
        return;
      }

      // Determine if update is needed
      let updateNeeded = false;
      let forceUpdate = false;
      
      if (current_version && typeof current_version === 'string') {
        const comparison = compareVersions(latestVersion.version, current_version);
        updateNeeded = comparison > 0;
        forceUpdate = updateNeeded && latestVersion.force_update;
      }

      // Get total version count
      const versionCount = await executeQuerySingle(`
        SELECT COUNT(*) as total_versions 
        FROM app_versions 
        WHERE is_active = 1
      `);

      res.json({
        success: true,
        data: {
          latest_version: latestVersion.version,
          current_user_version: current_version || 'unknown',
          update_available: updateNeeded,
          force_update: forceUpdate,
          release_notes: latestVersion.release_notes,
          release_date: latestVersion.release_date,
          platform: latestVersion.platform,
          total_versions: versionCount?.total_versions || 0
        },
        message: forceUpdate 
          ? 'Force update required' 
          : updateNeeded 
            ? 'Update available' 
            : 'App is up to date'
      });

      // Log version check
      logger.info('Version check performed', {
        platform: platform || 'all',
        current_version: current_version || 'unknown',
        latest_version: latestVersion.version,
        update_needed: updateNeeded,
        force_update: forceUpdate,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      });

    } catch (error) {
      logger.error('Get current version error', { 
        error: error instanceof Error ? error.message : error 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to check version'
      });
    }
  }

  /**
   * Release new version (Developer/Admin only)
   * POST /api/admin/system/release-version
   */
  static async releaseVersion(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin (developers should have admin role)
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required for version releases'
        });
        return;
      }

      const { version, platform, force_update, release_notes } = req.body;

      // Validate required fields
      if (!version) {
        res.status(400).json({
          success: false,
          message: 'Version number is required'
        });
        return;
      }

      // Validate semantic versioning
      if (!isValidSemanticVersion(version)) {
        res.status(400).json({
          success: false,
          message: 'Version must follow semantic versioning (e.g., 1.0.0, 2.1.3)'
        });
        return;
      }

      // Check if version already exists
      const existingVersion = await executeQuerySingle(
        'SELECT id FROM app_versions WHERE version = ?',
        [version]
      );

      if (existingVersion) {
        res.status(409).json({
          success: false,
          message: `Version ${version} already exists`
        });
        return;
      }

      // If this is a force update, deactivate previous versions
      if (force_update) {
        await executeQuery(
          'UPDATE app_versions SET is_active = 0 WHERE platform = ? OR platform = ?',
          [platform || 'all', 'all']
        );
      }

      // Insert new version
      await executeQuery(`
        INSERT INTO app_versions (
          version, 
          platform, 
          force_update, 
          release_notes, 
          is_active
        ) VALUES (?, ?, ?, ?, 1)
      `, [
        version,
        platform || 'all',
        force_update || false,
        release_notes || `Release version ${version}`
      ]);

      // Get the created version
      const newVersion = await executeQuerySingle(
        'SELECT * FROM app_versions WHERE version = ?',
        [version]
      );

      logger.info('New version released', {
        version,
        platform: platform || 'all',
        force_update: force_update || false,
        released_by: req.user!.id,
        admin_name: req.user!.first_name || req.user!.login_id
      });

      res.status(201).json({
        success: true,
        message: `Version ${version} released successfully`,
        data: newVersion
      });

    } catch (error) {
      logger.error('Release version error', { 
        error: error instanceof Error ? error.message : error,
        user_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to release version'
      });
    }
  }

  /**
   * Get version history (Admin only)
   * GET /api/admin/system/versions
   */
  static async getVersionHistory(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is admin
      if (!hasRole(req.user, 'admin')) {
        res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
        return;
      }

      const { platform, active_only, limit = 20 } = req.query;

      let query = `
        SELECT 
          id,
          version,
          platform,
          force_update,
          release_notes,
          release_date,
          is_active
        FROM app_versions
      `;
      
      const params: any[] = [];
      const conditions: string[] = [];
      
      if (platform && platform !== 'all') {
        conditions.push('(platform = ? OR platform = "all")');
        params.push(platform);
      }
      
      if (active_only === 'true') {
        conditions.push('is_active = 1');
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY release_date DESC';
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit as string));
      }

      const versions = await executeQuery(query, params);

      // Get statistics
      const stats = await executeQuerySingle(`
        SELECT 
          COUNT(*) as total_versions,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_versions,
          COUNT(CASE WHEN force_update = 1 THEN 1 END) as force_updates,
          MAX(release_date) as latest_release
        FROM app_versions
      `);

      res.json({
        success: true,
        data: {
          versions,
          statistics: stats,
          filters: {
            platform: platform || 'all',
            active_only: active_only === 'true',
            limit: parseInt(limit as string) || 20
          }
        }
      });

    } catch (error) {
      logger.error('Get version history error', { 
        error: error instanceof Error ? error.message : error,
        user_id: req.user?.id 
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve version history'
      });
    }
  }

  /**
   * Update version status (Admin only)
   * PUT /api/admin/system/versions/:id/status
   */
  static async updateVersionStatus(req: Request, res: Response): Promise<void> {
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
      const { is_active } = req.body;

      if (typeof is_active !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'is_active must be a boolean value'
        });
        return;
      }

      // Check if version exists
      const version = await executeQuerySingle(
        'SELECT * FROM app_versions WHERE id = ?',
        [id]
      );

      if (!version) {
        res.status(404).json({
          success: false,
          message: 'Version not found'
        });
        return;
      }

      // Update version status
      await executeQuery(
        'UPDATE app_versions SET is_active = ? WHERE id = ?',
        [is_active, id]
      );

      logger.info('Version status updated', {
        version_id: id,
        version: version.version,
        old_status: version.is_active,
        new_status: is_active,
        updated_by: req.user!.id
      });

      res.json({
        success: true,
        message: `Version ${version.version} ${is_active ? 'activated' : 'deactivated'} successfully`
      });

    } catch (error) {
      logger.error('Update version status error', { 
        error: error instanceof Error ? error.message : error,
        user_id: req.user?.id,
        version_id: req.params.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to update version status'
      });
    }
  }
}

export default VersionController;