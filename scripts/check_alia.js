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

// Ensure we have correct credentials
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
  console.log("=== CHECK ALIAANDADARA ===");
  const snap1 = await db.collection('models').get();
    
  let modelsId = null;
  snap1.forEach(doc => {
    const data = doc.data();
    if (data.nickname?.toLowerCase().includes('alia') || data.name?.toLowerCase().includes('alia')) {
      console.log(`[models] Match: ${doc.id} - Nick: ${data.nickname} - Name: ${data.name}`);
      modelsId = doc.id;
    }
  });

  console.log("\n=== CHECK DAILY METRICS FOR TODAY ===");
  const dateStr = new Date().toISOString().split("T")[0];
  const qSnap = await db.collection('daily_metrics')
    .where('date', '==', dateStr)
    .get();
    
  qSnap.forEach(doc => {
    const data = doc.data();
    if (data.tokens > 0 || (data.tippers && Object.keys(data.tippers).length > 0)) {
       console.log(`[daily_metrics] ID: ${doc.id}`);
       console.log(`  model_id: ${data.model_id}`);
       console.log(`  tokens: ${data.tokens}`);
       console.log(`  source: ${data.source}`);
       console.log(`  tippers:`, JSON.stringify(data.tippers));
    }
    else {
      if (JSON.stringify(data).toLowerCase().includes('santi') || JSON.stringify(data).toLowerCase().includes('alia')) {
         console.log(`[daily_metrics] Found santi/alia in empty metric: ${doc.id}`, data);
      }
    }
  });

}

check().catch(console.error);
