const fs = require('fs');
const admin = require('firebase-admin');

const env = fs.readFileSync('../.env.local', 'utf-8');
const pId = env.split('FIREBASE_PROJECT_ID="')[1].split('"')[0];
const clientEmail = env.split('FIREBASE_CLIENT_EMAIL="')[1].split('"')[0];
const privateKey = env.split('FIREBASE_PRIVATE_KEY="')[1].split('"')[0].replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: pId,
    clientEmail: clientEmail,
    privateKey: privateKey,
  })
});
const db = admin.firestore();

async function run() {
   try {
       const modelId = '0U3YsDujbOyW4jlZEZSW'; // fresa
       const period = '2026-04-16_2026-04-30';

       const cbDoc = await db.collection('modelos_analytics_cache_v2').doc(`${modelId}_${period}_Chaturbate`).get();
       const scDoc = await db.collection('modelos_analytics_cache_v2').doc(`${modelId}_${period}_Stripchat`).get();

       console.log("Chaturbate cache exists:", cbDoc.exists, cbDoc.exists ? cbDoc.data().total_tokens : null);
       console.log("Stripchat cache exists:", scDoc.exists, scDoc.exists ? scDoc.data().total_tokens : null);

   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
