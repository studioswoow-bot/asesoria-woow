import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const usernames = searchParams.get('usernames');

  if (!action || !usernames) {
    return NextResponse.json({ status: 'error', message: 'Missing parameters' }, { status: 400 });
  }

  const targetUrl = `https://www.cbhours.com/api.php?action=${action}&usernames=${encodeURIComponent(usernames)}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 0 } // Ensure no-cache for real-time data
    });

    if (!response.ok) {
      throw new Error(`External API responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Monitoring Proxy Error:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: error.message || 'Failed to fetch monitoring data' 
    }, { status: 502 });
  }
}
