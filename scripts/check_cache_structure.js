const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function run() {
  console.log('Checking cache documents...');
  const qSnap = await db.collection('modelos_analytics_cache_v2').limit(10).get();
  qSnap.forEach(doc => {
    const data = doc.data();
    console.log(`\nDoc ID: ${doc.id}`);
    console.log(`Keys: ${Object.keys(data).join(', ')}`);
    if (data.hourly_distribution) {
      console.log(`- hourly_distribution: ${data.hourly_distribution.length} entries`);
      console.log(`- sample entry:`, JSON.stringify(data.hourly_distribution[0]));
    }
    if (data.history) {
      console.log(`- history: ${data.history.length} days`);
    }
  });
}

run();
