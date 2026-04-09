const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
    }
  });
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}
const db = admin.firestore();

async function catchUpAlia() {
  const aliaDoc = await db.collection('modelos_profile_v2').where('generalInfo.artisticName', '==', 'Aliaandadara').get();
  if (aliaDoc.empty) {
     console.log('Alia V2 Doc not found');
     return;
  }
  const data = aliaDoc.docs[0].data();
  const lastNextUrl = data.credentials.Chaturbate.lastNextUrl;
  const apiKey = data.credentials.Chaturbate.apiKey;
  const modelDocId = 'DeiTLV7w6nCoP0ZmoDRU';
  
  console.log(`Starting catch-up for Alia from: ${lastNextUrl}`);
  
  let currentUrl = lastNextUrl.replace('timeout=10', 'timeout=0');
  let totalFound = 0;
  let loops = 0;
  const tippers = {};
  
  // We'll loop up to 50 times to catch up FAST
  while (currentUrl && loops < 50) {
    loops++;
    const res = await fetch(currentUrl);
    if (!res.ok) {
       console.log(`Fetch failed: ${res.status}`);
       break;
    }
    const raw = await res.json();
    const evs = raw.events || [];
    console.log(`Loop ${loops}: ${evs.length} events (nextUrl exists: ${!!raw.nextUrl})`);
    
    for (const e of evs) {
       const body = e.body || {};
       const tks = Number(body.tokens || body.amount || body.token_count || e.tokens || 0);
       const user = body.user || body.username || body.from_user || e.user || null;
       if (tks > 0) {
          totalFound += tks;
          if (user) tippers[user] = (tippers[user] || 0) + tks;
          console.log(`[CATCHUP] Found ${tks} tokens from ${user} (${e.method})`);
       }
    }
    
    if (raw.nextUrl && evs.length > 0) {
       currentUrl = raw.nextUrl.includes('timeout') ? raw.nextUrl : raw.nextUrl + '&timeout=0';
    } else {
       console.log('Reached current head of Events API.');
       if (raw.nextUrl) {
          // Final nextUrl reached
          await aliaDoc.docs[0].ref.update({
             "credentials.Chaturbate.lastNextUrl": raw.nextUrl
          });
          console.log(`Saved lastNextUrl to DB: ${raw.nextUrl}`);
       }
       break;
    }
  }
  
  console.log(`Catch-up finished. New tokens found: ${totalFound}`);
  
  if (totalFound > 0) {
     const dateStr = new Date().toISOString().split('T')[0];
     const metricsQuery = await db.collection('daily_metrics')
        .where('model_id', '==', modelDocId)
        .where('date', '==', dateStr)
        .where('source', '==', 'chaturbate_sync')
        .get();
        
      if (!metricsQuery.empty) {
         const mDoc = metricsQuery.docs[0];
         const mData = mDoc.data();
         const newTotal = (mData.tokens || 0) + totalFound;
         const newTippers = mData.tippers || {};
         for (const [u, t] of Object.entries(tippers)) {
            newTippers[u] = (newTippers[u] || 0) + t;
         }
         
         // Re-calculate top fan
         let bestU = mData.top_fan_name;
         let bestT = mData.top_fan_tokens || 0;
         for (const [u, t] of Object.entries(newTippers)) {
            if (t > bestT) {
               bestT = t;
               bestU = u;
            }
         }
         
         await mDoc.ref.update({
            tokens: newTotal,
            tippers: newTippers,
            top_fan_name: bestU,
            top_fan_tokens: bestT
         });
         console.log(`Daily metrics updated for Alia on ${dateStr}. New total: ${newTotal}`);
      }
  }
}

catchUpAlia().catch(console.error);
