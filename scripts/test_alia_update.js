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

async function debugUpdate() {
   const modelId = 'DeiTLV7w6nCoP0ZmoDRU';
   const ref = db.collection('models').doc(modelId);
   console.log(`Checking if doc ${modelId} exists...`);
   const doc = await ref.get();
   if (!doc.exists) {
      console.error('Doc NOT FOUND in models collection!');
      return;
   }
   console.log('Exists! Current Data:', JSON.stringify(doc.data(), null, 2));
   
   console.log('Attempting update...');
   try {
     await ref.update({
        chaturbate_last_sync: new Date().toISOString(),
        status_chaturbate: 'public' // Simulate one
     });
     console.log('Update SUCCESSFUL!');
   } catch (e) {
     console.error('Update FAILED:', e);
   }
}

debugUpdate().catch(console.error);
