import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pcoId: string }> }
) {
  try {
    const params = await context.params;
    const { pcoId } = params;
    const { searchParams } = new URL(request.url);
    
    // Build the backend API URL
    let backendUrl = `${API_URL}/api/calendar/pco/${pcoId}/calendar/summary`;
    
    // Add search params if any
    const searchString = searchParams.toString();
    if (searchString) {
      backendUrl += '?' + searchString;
    }

    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authorization header required' },
        { status: 401 }
      );
    }

    // Forward the request to the backend API
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Summary API proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}