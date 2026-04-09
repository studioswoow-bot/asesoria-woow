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
  // Use the one stored in DB currently
  let url = 'https://eventsapi.chaturbate.com/events/aliaandadara/v4v6jnJnuinXNGgdOp8QtaCg/?i=1774710048272&timeout=10';
  console.log('Fetching starting from DB cursor:', url);
  
  try {
    let loops = 0;
    while (loops < 10) {
        loops++;
        const data = await fetchUrl(url);
        console.log(`[Loop ${loops}] Events: ${data.events.length}`);
        
        data.events.forEach(e => {
            const json = JSON.stringify(e);
            if (json.toLowerCase().includes('santi') || json.toLowerCase().includes('140')) {
                console.log('--- FOUND MATCH ---');
                console.log(JSON.stringify(e, null, 2));
            }
        });

        if (data.nextUrl && data.events.length > 0) {
            url = data.nextUrl;
        } else {
            console.log('Reached end.');
            break;
        }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testAlia();
