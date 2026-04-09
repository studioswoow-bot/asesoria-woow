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

async function inspectCollections() {
  const collections = ['hourly_stream_stats', 'stream_snapshots', 'daily_metrics', 'modelos_profile_v2', 'profile_history_snapshots'];
  
  for (const colName of collections) {
    console.log(`\n--- Inspecting [${colName}] ---`);
    const qSnap = await db.collection(colName).limit(1).get();
    if (qSnap.empty) {
      console.log(`Collection ${colName} is EMPTY.`);
    } else {
      console.log(`Document example from ${colName}:`, JSON.stringify(qSnap.docs[0].data(), null, 2));
    }
  }
}

inspectCollections();
