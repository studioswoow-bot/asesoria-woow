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

async function search() {
  console.log("=== BUSCANDO 'NOAH' EN LA DB ===");
  const snap = await db.collection('models').get();
  let count = 0;
  snap.docs.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('noah') || str.includes('bunny')) {
      count++;
      console.log(`[V1] ID: ${d.id}`);
      console.log(`     Nombre: ${data.name}`);
      console.log(`     Nickname: ${data.nickname}`);
      console.log(`     IsOnline: ${data.is_online}`);
      console.log(`     Status: ${data.status}`);
      console.log(`     LastSync: ${data.stream_stats?.last_sync_status}`);
      console.log("-----------------------");
    }
  });
  
  const snap2 = await db.collection('modelos_profile_v2').get();
  snap2.docs.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('noah') || str.includes('bunny')) {
      console.log(`[V2-Profiles] ID: ${d.id}`);
      console.log(`     Artistic: ${data.generalInfo?.artisticName}`);
      console.log(`     Nick: ${data.credentials?.Chaturbate?.username}`);
      console.log("-----------------------");
    }
  });
  
  if (count === 0) console.log("No se encontró nada con 'noah' o 'bunny'.");
}

search();
