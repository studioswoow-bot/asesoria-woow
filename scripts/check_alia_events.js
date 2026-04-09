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

async function checkEvents() {
  const aliaDoc = await db.collection('modelos_profile_v2').where('generalInfo.artisticName', '==', 'Aliaandadara').get();
  if (aliaDoc.empty) {
     console.log('Alia V2 Doc not found');
     return;
  }
  const data = aliaDoc.docs[0].data();
  const lastNextUrl = data.credentials.Chaturbate.lastNextUrl;
  const apiKey = data.credentials.Chaturbate.apiKey;
  const nickname = 'aliaandadara';
  
  console.log(`Current NextUrl in DB: ${lastNextUrl}`);
  
  // Try fetching from baseline to see current state
  const baseline = apiKey.trim() + '?timeout=0';
  const res = await fetch(baseline);
  const raw = await res.json();
  console.log(`Baseline NextUrl: ${raw.nextUrl}`);
  
  // Compare 'i' parameter
  const getI = (url) => { if(!url) return 0; const m = url.match(/i=(\d+)/); return m ? parseInt(m[1]) : 0; };
  const dbI = getI(lastNextUrl);
  const baseI = getI(raw.nextUrl);
  
  console.log(`DB 'i': ${dbI}`);
  console.log(`Base 'i': ${baseI}`);
  console.log(`Difference: ${baseI - dbI}`);
  
  if (baseI - dbI > 0) {
     console.log('We are BEHIND. Fetching catch-up...');
     const catchUpRes = await fetch(lastNextUrl.replace('timeout=10', 'timeout=0'));
     const catchUpData = await catchUpRes.json();
     console.log(`Events found: ${catchUpData.events.length}`);
     catchUpData.events.forEach(e => {
        if (JSON.stringify(e).includes('tokens') || JSON.stringify(e).includes('santi')) {
           console.log('INTERESTING EVENT:', JSON.stringify(e));
        }
     });
  } else {
     console.log('We are UP TO DATE or AHEAD.');
  }
}

checkEvents().catch(console.error);
