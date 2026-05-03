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
       const fresaId = '0U3YsDujbOyW4jlZEZSW'; // from previous run
       
       const metrics = await db.collection('daily_metrics')
           .where('model_id', '==', fresaId)
           .where('date', '>=', '2026-04-16')
           .where('date', '<=', '2026-04-30')
           .get();
           
       console.log("Daily Metrics count (16-30):", metrics.size);
       metrics.forEach(doc => console.log(doc.id, doc.data()));

   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
