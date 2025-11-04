import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Try environment var first (useful in CI/CD)
    const envVersion = process.env.APP_VERSION || process.env.npm_package_version;
    if (envVersion) {
      return NextResponse.json({ version: envVersion });
    }

    // Fallback: read package.json
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = pkg?.version || 'dev';
    return NextResponse.json({ version });
  } catch (err) {
    return NextResponse.json({ version: 'dev' });
  }
}
