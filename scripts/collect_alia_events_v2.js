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

async function collectEvents() {
  let url = 'https://eventsapi.chaturbate.com/events/aliaandadara/v4v6jnJnuinXNGgdOp8QtaCg/';
  console.log('Collecting events starting from baseline...');
  
  try {
    let loops = 0;
    while (loops < 10) {
        loops++;
        const data = await fetchUrl(url);
        console.log(`[Loop ${loops}] Events: ${data.events.length}`);
        
        data.events.forEach(e => {
            const json = JSON.stringify(e);
            console.log(` - EVENT: ${e.method} from ${e.body?.user || e.body?.username || 'unknown'}`);
            if (json.toLowerCase().includes('santi') || json.toLowerCase().includes('140')) {
                console.log('--- MATCH FOUND ---');
                console.log(JSON.stringify(e, null, 2));
            }
        });

        if (data.nextUrl) {
            url = data.nextUrl;
        } else {
            break;
        }
        
        // Don't loop too fast if 0 events
        if (data.events.length === 0) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

collectEvents();
