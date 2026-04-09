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

async function check() {
  console.log('--- BUSCANDO PERFIL V2 ALIA ---');
  let modelId = '';
  const snap = await db.collection('modelos_profile_v2').get();
  snap.forEach(doc => {
    const data = doc.data();
    const artistic = data.generalInfo?.artisticName || '';
    const cbNick = data.credentials?.Chaturbate?.username || '';
    if (artistic.toLowerCase().includes('alia') || cbNick.toLowerCase().includes('alia')) {
      modelId = doc.id;
      console.log('ID:', doc.id);
      console.log('Artistic:', artistic);
      console.log('CB Nick:', cbNick);
      console.log('API Enabled:', data.apiEnabledPlatforms);
      console.log('Has API Key:', !!data.credentials?.Chaturbate?.apiKey);
      console.log('LastNextUrl:', data.credentials?.Chaturbate?.lastNextUrl);
    }
  });

  if (modelId) {
    console.log('\n--- BUSCANDO DAILY METRICS PARA:', modelId, '---');
    const dateStr = new Date().toISOString().split('T')[0];
    const metricsSnap = await db.collection('daily_metrics')
      .where('model_id', '==', modelId)
      .where('date', '==', dateStr)
      .get();
    
    if (metricsSnap.empty) {
      console.log('No hay métricas hoy para este ID.');
    } else {
      metricsSnap.forEach(d => {
        console.log('Doc ID:', d.id);
        console.log('Data:', JSON.stringify(d.data(), null, 2));
      });
    }
  }

  console.log('\n--- BUSCANDO POR NICKNAME aliaandadara en metrics ---');
  const allToday = await db.collection('daily_metrics').get();
  allToday.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).toLowerCase().includes('santikdk') || JSON.stringify(data).toLowerCase().includes('aliaandadara')) {
      console.log('FOUND IN METRICS:', d.id, JSON.stringify(data, null, 2));
    }
  });
}
check();
