const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const https = require('https');

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

async function checkSyncProgress() {
  console.log('--- CHECKING GLOBAL SYNC PROGRESS ---');
  const snap = await db.collection('modelos_profile_v2').get();
  console.log(`Total models in V2: ${snap.size}`);
  
  const modelsProcessed = [];
  const modelsFailed = [];
  
  for (const doc of snap.docs) {
     const data = doc.data();
     const nickname = data.credentials?.Chaturbate?.username || data.generalInfo?.artisticName;
     if (data.apiEnabledPlatforms?.includes('Chaturbate')) {
        // Check if the corresponding V1 model was updated recently
        const v1Doc = await db.collection('models').doc(doc.id).get();
        if (v1Doc.exists) {
           const v1Data = v1Doc.data();
           if (v1Data.chaturbate_last_sync) {
              modelsProcessed.push({nick: nickname, lastSync: v1Data.chaturbate_last_sync});
           } else {
              modelsFailed.push(nickname);
           }
        } else {
           modelsFailed.push(`${nickname} (V1 MISSING)`);
        }
     }
  }
  
  console.log('Processed Models:', modelsProcessed.length);
  console.log('Failed/Never Synced Models:', modelsFailed.length);
  console.log('Failed names:', modelsFailed);
  
  const alia = modelsProcessed.find(m => m.nick?.toLowerCase().includes('alia'));
  console.log('Alia sync state:', alia);
}

checkSyncProgress().catch(console.error);
