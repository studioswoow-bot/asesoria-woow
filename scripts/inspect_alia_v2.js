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

db.collection('modelos_profile_v2').where('generalInfo.artisticName', '==', 'Aliaandadara').get().then(snap => {
   console.log('Alia V2 Data:', JSON.stringify(snap.docs[0].data().credentials.Chaturbate, null, 2));
});
