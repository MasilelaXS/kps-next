import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read directly from version.json first
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    
    if (fs.existsSync(versionPath)) {
      const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      
      if (versionData?.version) {
        return NextResponse.json(
          { 
            version: versionData.version,
            timestamp: versionData.timestamp,
            buildTime: versionData.buildTime
          },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
      }
    }

    // Fallback to package.json
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    
    return NextResponse.json(
      { version: pkg?.version || 'dev' },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('Error reading version:', error);
    return NextResponse.json(
      { version: 'dev' },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}
