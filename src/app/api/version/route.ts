import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getBackendBaseUrl(request: Request): string {
  const host = request.headers.get('host') || '';
  if (host.includes('kpspestcontrol.co.za') || host.includes('app.kpspestcontrol')) {
    return 'https://app.kpspestcontrol.co.za';
  }
  return 'http://localhost:3001';
}

function readLocalVersion(): string {
  try {
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      if (versionData?.version) {
        return versionData.version;
      }
    }
  } catch {
    // Ignore and fall back to package.json
  }

  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg?.version || 'dev';
  } catch {
    return 'dev';
  }
}

export async function GET(request: NextRequest) {
  const localVersion = readLocalVersion();

  try {
    const backendBaseUrl = getBackendBaseUrl(request);
    const versionUrl = `${backendBaseUrl}/api/version/current?platform=web&current_version=${encodeURIComponent(localVersion)}&_t=${Date.now()}`;
    const response = await fetch(versionUrl, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ version: localVersion });
    }

    const data = await response.json();
    const latestVersion = data?.data?.latest_version;
    const updateAvailable = data?.data?.update_available;
    const forceUpdate = data?.data?.force_update;

    return NextResponse.json({
      version: localVersion,
      latestVersion: latestVersion || null,
      updateAvailable: Boolean(updateAvailable),
      forceUpdate: Boolean(forceUpdate)
    });
  } catch {
    return NextResponse.json({ version: localVersion });
  }
}
