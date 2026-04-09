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

async function resetAlia() {
  const snap = await db.collection('modelos_profile_v2').where('generalInfo.artisticName', '==', 'Aliaandadara').get();
  if (!snap.empty) {
     const doc = snap.docs[0];
     // Set to empty string to force baseline fetch
     await doc.ref.update({
        "credentials.Chaturbate.lastNextUrl": ""
     });
     console.log('Alia lastNextUrl RESET to force baseline sync.');
  }
}

resetAlia().catch(console.error);
