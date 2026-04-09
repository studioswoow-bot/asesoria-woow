const fetch = require('node-fetch');

async function testAlia() {
  const url = 'https://eventsapi.chaturbate.com/events/aliaandadara/v4v6jnJnuinXNGgdOp8QtaCg/?timeout=10';
  console.log('Fetching from baseline:', url);
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) {
        console.error('Error status:', res.status);
        return;
    }
    
    const data = await res.json();
    console.log('Events returned:', data.events.length);
    console.log('Next URL:', data.nextUrl);
    
    data.events.forEach(e => {
        const body = e.body || {};
        const json = JSON.stringify(e);
        if (json.toLowerCase().includes('santi') || json.toLowerCase().includes('140')) {
            console.log('MATCH EVENT:', JSON.stringify(e, null, 2));
        }
    });

    // Check types of events
    const methods = data.events.map(e => e.method);
    const counts = {};
    methods.forEach(m => counts[m] = (counts[m] || 0) + 1);
    console.log('Event types:', counts);

  } catch (e) {
    console.error('Error:', e);
  }
}

testAlia();
