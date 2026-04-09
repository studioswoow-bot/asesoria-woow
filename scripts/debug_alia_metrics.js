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
const dateStr = new Date().toISOString().split('T')[0];

async function check() {
  const snap = await db.collection('daily_metrics')
    .where('model_id', '==', 'DeiTLV7w6nCoP0ZmoDRU')
    .where('date', '==', dateStr)
    .get();
    
    console.log(`Docs found for Alia today (${dateStr}): ${snap.size}`);
    snap.forEach(d => {
       console.log('--- Doc ID:', d.id);
       const data = d.data();
       console.log('Source:', data.source);
       console.log('Tokens:', data.tokens);
       console.log('Top User:', data.top_fan_name);
       console.log('Tippers keys:', Object.keys(data.tippers || {}));
    });
}

check().catch(console.error);
