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

async function monitorAlia() {
  const aliaDoc = await db.collection('modelos_profile_v2').where('generalInfo.artisticName', '==', 'Aliaandadara').get();
  const apiKey = aliaDoc.docs[0].data().credentials.Chaturbate.apiKey;
  const modelDocId = 'DeiTLV7w6nCoP0ZmoDRU';
  
  console.log('Monitoring Alia for 30s starting from baseline...');
  
  let currentUrl = apiKey.trim() + '?timeout=5';
  let totalFound = 0;
  let start = Date.now();
  
  while (Date.now() - start < 30000) {
    const res = await fetch(currentUrl);
    const raw = await res.json();
    const evs = raw.events || [];
    console.log(`- Fetch: ${evs.length} events found.`);
    for (const e of evs) {
       const body = e.body || {};
       const tks = Number(body.tokens || body.amount || body.token_amount || 0);
       const user = body.user || body.username || null;
       if (tks > 0) {
          totalFound += tks;
          console.log(`[LIVE] Found ${tks} tk from ${user} (${e.method})`);
       }
    }
    if (raw.nextUrl) currentUrl = raw.nextUrl.replace('timeout=10', 'timeout=5');
    else break;
  }
  
  console.log(`Monitoring finished. Total new tokens: ${totalFound}`);
}

monitorAlia().catch(console.error);
