"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionController = void 0;
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const isValidSemanticVersion = (version) => {
    const semanticVersionRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semanticVersionRegex.test(version);
};
const compareVersions = (version1, version2) => {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const v1part = v1parts[i] || 0;
        const v2part = v2parts[i] || 0;
        if (v1part > v2part)
            return 1;
        if (v1part < v2part)
            return -1;
    }
    return 0;
};
class VersionController {
    static async getCurrentVersion(req, res) {
        try {
            const { platform, current_version } = req.query;
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
            const params = [];
            if (platform && platform !== 'all') {
                query += ` AND (platform = ? OR platform = 'all')`;
                params.push(platform);
            }
            query += ` ORDER BY release_date DESC LIMIT 1`;
            let latestVersion = await (0, database_1.executeQuerySingle)(query, params);
            if (!latestVersion) {
                const fallbackPlatform = (platform && platform !== 'all') ? platform : 'web';
                const currentVersionValue = typeof current_version === 'string' ? current_version : null;
                if (currentVersionValue && isValidSemanticVersion(currentVersionValue)) {
                    await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = 0 WHERE platform = ? OR platform = ?', [fallbackPlatform, 'all']);
                    await (0, database_1.executeQuery)(`INSERT INTO app_versions (
              version,
              platform,
              release_date,
              force_update,
              release_notes,
              is_active
            ) VALUES (?, ?, ?, ?, ?, 1)`, [
                        currentVersionValue,
                        fallbackPlatform,
                        new Date().toISOString().slice(0, 10),
                        false,
                        `Auto-synced build version ${currentVersionValue}`
                    ]);
                    latestVersion = await (0, database_1.executeQuerySingle)(query, params);
                }
            }
            if (!latestVersion) {
                res.status(404).json({
                    success: false,
                    message: 'No active version found'
                });
                return;
            }
            let updateNeeded = false;
            let forceUpdate = false;
            if (current_version && typeof current_version === 'string') {
                const comparison = compareVersions(latestVersion.version, current_version);
                updateNeeded = comparison > 0;
                forceUpdate = updateNeeded && latestVersion.force_update;
            }
            const versionCount = await (0, database_1.executeQuerySingle)(`
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
            logger_1.logger.info('Version check performed', {
                platform: platform || 'all',
                current_version: current_version || 'unknown',
                latest_version: latestVersion.version,
                update_needed: updateNeeded,
                force_update: forceUpdate,
                ip: req.ip,
                user_agent: req.get('User-Agent')
            });
        }
        catch (error) {
            logger_1.logger.error('Get current version error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to check version'
            });
        }
    }
    static async releaseVersion(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
                res.status(403).json({
                    success: false,
                    message: 'Admin access required for version releases'
                });
                return;
            }
            const { version, platform, force_update, release_notes } = req.body;
            if (!version) {
                res.status(400).json({
                    success: false,
                    message: 'Version number is required'
                });
                return;
            }
            if (!isValidSemanticVersion(version)) {
                res.status(400).json({
                    success: false,
                    message: 'Version must follow semantic versioning (e.g., 1.0.0, 2.1.3)'
                });
                return;
            }
            const existingVersion = await (0, database_1.executeQuerySingle)('SELECT id FROM app_versions WHERE version = ?', [version]);
            if (existingVersion) {
                res.status(409).json({
                    success: false,
                    message: `Version ${version} already exists`
                });
                return;
            }
            if (force_update) {
                await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = 0 WHERE platform = ? OR platform = ?', [platform || 'all', 'all']);
            }
            await (0, database_1.executeQuery)(`
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
            const newVersion = await (0, database_1.executeQuerySingle)('SELECT * FROM app_versions WHERE version = ?', [version]);
            logger_1.logger.info('New version released', {
                version,
                platform: platform || 'all',
                force_update: force_update || false,
                released_by: req.user.id,
                admin_name: req.user.first_name || req.user.login_id
            });
            res.status(201).json({
                success: true,
                message: `Version ${version} released successfully`,
                data: newVersion
            });
        }
        catch (error) {
            logger_1.logger.error('Release version error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to release version'
            });
        }
    }
    static async getVersionHistory(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
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
            const params = [];
            const conditions = [];
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
                params.push(parseInt(limit));
            }
            const versions = await (0, database_1.executeQuery)(query, params);
            const stats = await (0, database_1.executeQuerySingle)(`
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
                        limit: parseInt(limit) || 20
                    }
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Get version history error', {
                error: error instanceof Error ? error.message : error,
                user_id: req.user?.id
            });
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve version history'
            });
        }
    }
    static async updateVersionStatus(req, res) {
        try {
            if (!(0, auth_1.hasRole)(req.user, 'admin')) {
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
            const version = await (0, database_1.executeQuerySingle)('SELECT * FROM app_versions WHERE id = ?', [id]);
            if (!version) {
                res.status(404).json({
                    success: false,
                    message: 'Version not found'
                });
                return;
            }
            await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = ? WHERE id = ?', [is_active, id]);
            logger_1.logger.info('Version status updated', {
                version_id: id,
                version: version.version,
                old_status: version.is_active,
                new_status: is_active,
                updated_by: req.user.id
            });
            res.json({
                success: true,
                message: `Version ${version.version} ${is_active ? 'activated' : 'deactivated'} successfully`
            });
        }
        catch (error) {
            logger_1.logger.error('Update version status error', {
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
    static async syncVersionToDatabase() {
        try {
            const fs = require('fs');
            const path = require('path');
            const pkgPath = path.join(__dirname, '../../package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const currentVersion = pkg.version;
            if (!isValidSemanticVersion(currentVersion)) {
                logger_1.logger.warn('Invalid version in package.json', { version: currentVersion });
                return;
            }
            const existingVersion = await (0, database_1.executeQuerySingle)('SELECT * FROM app_versions WHERE version = ? AND platform = ?', [currentVersion, 'web']);
            if (existingVersion) {
                if (!existingVersion.is_active) {
                    await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = 0 WHERE platform = ?', ['web']);
                    await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = 1 WHERE id = ?', [existingVersion.id]);
                    logger_1.logger.info('Activated existing version in database', { version: currentVersion });
                }
                else {
                    logger_1.logger.info('Database version already up to date', { version: currentVersion });
                }
                return;
            }
            await (0, database_1.executeQuery)('UPDATE app_versions SET is_active = 0 WHERE platform = ?', ['web']);
            await (0, database_1.executeQuery)(`INSERT INTO app_versions (
          version,
          platform,
          release_date,
          force_update,
          release_notes,
          is_active
        ) VALUES (?, ?, ?, ?, ?, 1)`, [
                currentVersion,
                'web',
                new Date().toISOString().slice(0, 10),
                false,
                `Production build version ${currentVersion}`
            ]);
            logger_1.logger.info('Synced new version to database', { version: currentVersion });
        }
        catch (error) {
            logger_1.logger.error('Version sync error', {
                error: error instanceof Error ? error.message : error
            });
        }
    }
    static async getDiagnosticInfo(req, res) {
        try {
            const fs = require('fs');
            const path = require('path');
            let packageVersion = 'unknown';
            let packageError = null;
            try {
                const pkgPath = path.join(__dirname, '../../package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                packageVersion = pkg.version;
            }
            catch (error) {
                packageError = error instanceof Error ? error.message : 'Failed to read package.json';
            }
            const activeVersion = await (0, database_1.executeQuerySingle)('SELECT * FROM app_versions WHERE is_active = 1 AND platform = ? ORDER BY created_at DESC LIMIT 1', ['web']);
            const allVersions = await (0, database_1.executeQuery)('SELECT version, platform, is_active, created_at FROM app_versions ORDER BY created_at DESC LIMIT 5', []);
            res.json({
                success: true,
                data: {
                    package_json_version: packageVersion,
                    package_error: packageError,
                    active_database_version: activeVersion?.version || 'none',
                    versions_match: packageVersion === activeVersion?.version,
                    database_active_version: activeVersion,
                    recent_versions: allVersions,
                    recommendation: packageVersion !== activeVersion?.version
                        ? `Version mismatch! Package.json has ${packageVersion} but database has ${activeVersion?.version || 'none'}. Restart backend to auto-sync.`
                        : 'Versions are in sync ✓'
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Diagnostic info error', {
                error: error instanceof Error ? error.message : error
            });
            res.status(500).json({
                success: false,
                message: 'Failed to get diagnostic info',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.VersionController = VersionController;
exports.default = VersionController;
//# sourceMappingURL=versionController.js.map