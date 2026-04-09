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
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
    });
}

const db = admin.firestore();

async function check() {
    const id = 'jjmth5UdzPIsqbIIpnKW';
    console.log('--- Verificando Natalia_Kiss01 (ID: jjmth5UdzPIsqbIIpnKW) ---');
    
    // 1. Verificar documento global
    const snap = await db.collection('modelos_analytics_cache_v2').doc(id).get();
    if (!snap.exists) {
        console.log('Documento GLOBAL NO EXISTE');
    } else {
        const data = snap.data();
        console.log('Documento GLOBAL existe');
        console.log('History length:', data.history?.length || 0);
        if (data.history?.length > 0) {
            console.log('Muestra historial:', JSON.stringify(data.history.slice(0, 2)));
        }
    }

    // 2. Verificar documentos de periodo
    const periodSnap = await db.collection('modelos_analytics_cache_v2')
        .where('model_id', '==', id)
        .get();
        
    console.log('\nDocumentos de PERIODO encontrados:', periodSnap.size);
    periodSnap.forEach(d => {
        const data = d.data();
        console.log(` - ID: ${d.id}`);
        console.log(`   Periodo: ${data.period} | Platform: ${data.platform}`);
        console.log(`   Tokens: ${data.total_tokens} | Sync: ${data.synced_at}`);
        if (data.hourly_distribution) {
            const hasDataHours = data.hourly_distribution.some(h => h.tokens > 0);
            console.log(`   Distribución Horaria: ${hasDataHours ? 'TIENE DATOS' : 'TODAS EN CERO'}`);
        }
    });
}

check().catch(console.error);
