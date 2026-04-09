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

async function check() {
  const dateStr = new Date().toISOString().split('T')[0];
  console.log('TODAY:', dateStr);
  const qSnap = await db.collection('daily_metrics')
    .where('date', '==', dateStr)
    .get();
    
  console.log(`Checking ${qSnap.size} documents for today...`);
  
  qSnap.forEach(d => {
    const data = d.data();
    const json = JSON.stringify(data).toLowerCase();
    if (json.includes('santikdk') || (data.tokens > 0)) {
       console.log('MATCH:', d.id, JSON.stringify(data, null, 2));
    }
  });
}
check();
