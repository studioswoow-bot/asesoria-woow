const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error('Status code: ' + res.statusCode));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testAlia() {
  // Use a very old i to see if we can catch anything
  let url = 'https://eventsapi.chaturbate.com/events/aliaandadara/v4v6jnJnuinXNGgdOp8QtaCg/?timeout=10';
  console.log('Fetching starting from baseline:', url);
  
  try {
    let loops = 0;
    while (loops < 20) {
        loops++;
        const data = await fetchUrl(url);
        console.log(`[Loop ${loops}] Events: ${data.events.length}`);
        
        data.events.forEach(e => {
            const json = JSON.stringify(e).toLowerCase();
            if (json.includes('santi') || json.includes('140')) {
                console.log('--- POTENTIAL MATCH FOUND ---');
                console.log(JSON.stringify(e, null, 2));
            }
        });

        if (data.nextUrl && data.events.length > 0) {
            url = data.nextUrl;
        } else if (data.nextUrl) {
            // If 0 events but nextUrl, move forward once to see if it's a silent batch
            url = data.nextUrl;
            if (loops > 2) break; // Don't loop forever if 0 events
        } else {
            break;
        }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testAlia();
