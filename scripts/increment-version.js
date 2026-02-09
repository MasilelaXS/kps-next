#!/usr/bin/env node

/**
 * Version Increment Script
 * Automatically increments patch version on each build
 * Writes version to public/version.json for frontend access
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const apiPkgPath = path.join(__dirname, '../api/package.json');
const versionJsonPath = path.join(__dirname, '../public/version.json');

try {
  // Read current package.json
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;

  // Parse semantic version
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // Increment patch version
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  // Update frontend package.json
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  
  // Update API package.json
  const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8'));
  apiPkg.version = newVersion;
  fs.writeFileSync(apiPkgPath, JSON.stringify(apiPkg, null, 2) + '\n');
  
  // Create version.json for frontend access
  const versionData = {
    version: newVersion,
    timestamp: new Date().toISOString(),
    buildTime: Date.now()
  };
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n');
  
  console.log(`✓ Version incremented: ${currentVersion} → ${newVersion}`);
  console.log(`✓ Updated package.json (frontend)`);
  console.log(`✓ Updated api/package.json (backend)`);
  console.log(`✓ Written to public/version.json`);
  
  // Also update environment variable for Next.js
  process.env.APP_VERSION = newVersion;
  
  process.exit(0);
} catch (error) {
  console.error('✗ Version increment failed:', error.message);
  process.exit(1);
}
