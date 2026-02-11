#!/usr/bin/env node

/**
 * Version Sync Script
 * Syncs API package.json version with root package.json
 * Used during API-only builds to keep versions consistent
 * Does NOT increment - just syncs to existing version
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const apiPkgPath = path.join(__dirname, '../api/package.json');

try {
  // Read root package.json to get current version
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  
  // Read API package.json
  const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
  const apiCurrentVersion = apiPkg.version;
  
  // Check if sync is needed
  if (apiCurrentVersion === currentVersion) {
    console.log(`✓ API version already in sync: ${currentVersion}`);
    process.exit(0);
  }
  
  // Update API package.json
  apiPkg.version = currentVersion;
  fs.writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2) + '\n');
  
  console.log(`✓ Synced API version: ${apiCurrentVersion} → ${currentVersion}`);
  
  process.exit(0);
} catch (error) {
  console.error('✗ Version sync failed:', error.message);
  process.exit(1);
}
