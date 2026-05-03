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
       const modelDoc = await db.collection("models").doc(modelId).get();
       console.log("Model:", modelDoc.data().name);
       console.log("Aliases:", modelDoc.data().aliases);
   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
