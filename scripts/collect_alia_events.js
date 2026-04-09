const https = require('https');
const fs = require('fs');

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
  // Try baseline and follow for 50 jumps or until empty
  let url = 'https://eventsapi.chaturbate.com/events/aliaandadara/v4v6jnJnuinXNGgdOp8QtaCg/';
  console.log('Collecting events starting from baseline...');
  
  const allEvents = [];
  try {
    let loops = 0;
    while (loops < 50) {
        loops++;
        const data = await fetchUrl(url);
        if (data.events && data.events.length > 0) {
            allEvents.push(...data.events);
            console.log(`[Loop ${loops}] Saved ${data.events.length} events. Total: ${allEvents.length}`);
            url = data.nextUrl;
        } else if (data.nextUrl) {
            console.log(`[Loop ${loops}] 0 events, trying nextUrl once.`);
            // Only try nextUrl once more if it was already 0
            const checkData = await fetchUrl(data.nextUrl);
            if (checkData.events && checkData.events.length > 0) {
                 allEvents.push(...checkData.events);
                 console.log(`[Follow-up] Found ${checkData.events.length} events.`);
                 url = checkData.nextUrl;
            } else {
                 console.log('Definitely reached end.');
                 break;
            }
        } else {
            break;
        }
    }
  } catch (e) {
    console.error('Error during collection:', e);
  }

  fs.writeFileSync('c:\\tmp\\alia_events.json', JSON.stringify(allEvents, null, 2));
  console.log(`Total events collected: ${allEvents.length}`);
  
  // Search for 140 or santi in the collected ones
  const matches = allEvents.filter(e => JSON.stringify(e).toLowerCase().includes('santi') || JSON.stringify(e).includes('140'));
  console.log(`Matches found in file: ${matches.length}`);
  console.log('Matches:', JSON.stringify(matches, null, 2));
}

collectEvents();
