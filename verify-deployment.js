#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Run this after deploying to ensure version consistency
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Deployment...\n');

// 1. Check package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pkgVersion = packageJson.version;
console.log(`✅ package.json version: ${pkgVersion}`);

// 2. Check public/version.json  
const versionJsonPath = path.join('public', 'version.json');
if (fs.existsSync(versionJsonPath)) {
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  console.log(`✅ public/version.json version: ${versionJson.version}`);
  
  if (pkgVersion !== versionJson.version) {
    console.error(`❌ VERSION MISMATCH! package.json (${pkgVersion}) !== version.json (${versionJson.version})`);
    console.error('   Run: npm run build');
    process.exit(1);
  }
} else {
  console.error('❌ public/version.json NOT FOUND');
  console.error('   Run: npm run build');
  process.exit(1);
}

// 3. Check if .next folder exists (built)
const nextDir = path.join('.next');
if (fs.existsSync(nextDir)) {
  const buildId = fs.readFileSync(path.join(nextDir, 'BUILD_ID'), 'utf8').trim();
  console.log(`✅ .next/ folder exists (BUILD_ID: ${buildId})`);
  
  const stats = fs.statSync(nextDir);
  const buildTime = stats.mtime;
  const timeSinceBuild = Date.now() - buildTime.getTime();
  const minutesSinceBuild = Math.floor(timeSinceBuild / 60000);
  
  console.log(`   Built: ${buildTime.toLocaleString()} (${minutesSinceBuild} minutes ago)`);
  
  if (minutesSinceBuild > 60) {
    console.warn(`⚠️  Build is ${minutesSinceBuild} minutes old. Consider rebuilding.`);
  }
} else {
  console.error('❌ .next/ folder NOT FOUND - App not built!');
  console.error('   Run: npm run build');
  process.exit(1);
}

// 4. Check api package.json
const apiPackageJsonPath = path.join('api', 'package.json');
if (fs.existsSync(apiPackageJsonPath)) {
  const apiPackageJson = JSON.parse(fs.readFileSync(apiPackageJsonPath, 'utf8'));
  console.log(`✅ api/package.json version: ${apiPackageJson.version}`);
  
  if (pkgVersion !== apiPackageJson.version) {
    console.error(`❌ VERSION MISMATCH! Root (${pkgVersion}) !== API (${apiPackageJson.version})`);
    console.error('   Run: npm run build');
    process.exit(1);
  }
}

// 5. Check changelog
const changelogPath = path.join('public', 'changelog.json');
if (fs.existsSync(changelogPath)) {
  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const latestVersion = changelog.versions[0]?.version;
  console.log(`✅ Latest changelog entry: ${latestVersion}`);
  
  if (pkgVersion !== latestVersion) {
    console.warn(`⚠️  Changelog might be outdated (${latestVersion} vs ${pkgVersion})`);
  }
}

console.log('\n✅ Deployment verification PASSED!');
console.log('\n📦 Ready to deploy:');
console.log('   1. Upload .next/ folder to production');
console.log('   2. Upload public/version.json');
console.log('   3. Upload public/changelog.json');
console.log('   4. Restart Node.js server (pm2 restart kps-next)');
console.log('\n🔗 Version:', pkgVersion);
