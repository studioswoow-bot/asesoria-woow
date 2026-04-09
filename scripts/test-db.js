const fs = require('fs');
const admin = require('firebase-admin');

const env = fs.readFileSync('.env.local', 'utf-8');
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
       const snap = await db.collection('festivos').get();
       console.log('FESTIVOS length:', snap.docs.length);
       snap.forEach(d => console.log(d.id, d.data()));
       
       const snap2 = await db.collection('public_holidays').get();
       console.log('public_holidays length:', snap2.docs.length);
       snap2.forEach(d => console.log(d.id, d.data()));
   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
