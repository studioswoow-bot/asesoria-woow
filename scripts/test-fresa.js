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
       // Find Fresa_wafflera
       const models = await db.collection('models').get();
       let fresa = null;
       models.forEach(doc => {
           const data = doc.data();
           if ((data.name && data.name.toLowerCase().includes('fresa')) || (data.nickname && data.nickname.toLowerCase().includes('fresa'))) {
               fresa = { id: doc.id, ...data };
           }
       });

       if (!fresa) {
           console.log("No fresa found");
           return;
       }
       console.log("Found:", fresa.nickname, fresa.id);

       const metrics = await db.collection('daily_metrics').where('model_id', '==', fresa.id).limit(10).get();
       console.log("Daily Metrics count:", metrics.size);
       metrics.forEach(doc => console.log(doc.id, doc.data()));

       const wh = await db.collection('work_hours').where('model_id', '==', fresa.id).limit(10).get();
       console.log("Work Hours count:", wh.size);
       wh.forEach(doc => console.log(doc.id, doc.data()));

   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
