#!/usr/bin/env node

/**
 * Version Increment Script
 * Automatically increments patch version on each build
 * Writes version to public/version.json for frontend access
 * Updates changelog.json latest version
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../package.json');
const pkgLockPath = path.join(__dirname, '../package-lock.json');
const apiPkgPath = path.join(__dirname, '../api/package.json');
const versionJsonPath = path.join(__dirname, '../public/version.json');
const changelogPath = path.join(__dirname, '../public/changelog.json');

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
  
  // Update package-lock.json
  try {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = newVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
      pkgLock.packages[''].version = newVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');
    console.log(`✓ Updated package-lock.json`);
  } catch (error) {
    console.warn(`⚠ Could not update package-lock.json: ${error.message}`);
  }
  
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
  
  // Update changelog.json "latest" field
  try {
    const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
    changelog.latest = newVersion;
    fs.writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + '\n');
    console.log(`✓ Updated changelog.json latest version`);
  } catch (error) {
    console.warn(`⚠ Could not update changelog.json: ${error.message}`);
  }
  
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
