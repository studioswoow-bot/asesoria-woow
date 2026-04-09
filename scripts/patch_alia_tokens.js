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

async function patch() {
  const docId = 'MLXLqRcCdWqsF8DIXNKz';
  const ref = db.collection('daily_metrics').doc(docId);
  
  console.log(`Patching doc ${docId} with Santikdk 140 tokens...`);
  
  await ref.update({
    tokens: 140,
    top_fan_name: 'santikdk',
    top_fan_tokens: 140,
    tippers: {
      santikdk: 140
    }
  });
  
  console.log('Patch Applied!');
}

patch().catch(console.error);
