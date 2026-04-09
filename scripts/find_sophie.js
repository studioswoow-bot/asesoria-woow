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

async function checkSophie() {
  const collections = ['models', 'modelos_profile_v2'];
  for (const cName of collections) {
     const snap = await db.collection(cName).get();
     for (const doc of snap.docs) {
        const d = doc.data();
        const nameMatch = (d.nickname || d.generalInfo?.artisticName || '').toLowerCase().includes('sophie');
        if (nameMatch) {
           console.log(`Found Sophie in ${cName}:`, { id: doc.id, status: d.status || d.generalInfo?.status, nickname: d.nickname || d.generalInfo?.artisticName });
        }
     }
  }
}

checkSophie().catch(console.error);
