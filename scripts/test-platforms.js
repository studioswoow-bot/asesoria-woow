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
       const modelId = 'Q3d1FpYmDrdE7Bw9B9Yd'; // I need Alia's ID. Let's just find ANY model with Chaturbate and Stripchat in daily_metrics.
       const metricsSnap = await db.collection("daily_metrics").limit(50).get();
       
       const platforms = new Set();
       metricsSnap.forEach(doc => platforms.add(doc.data().platform));
       console.log("Platforms in daily_metrics:", Array.from(platforms));

       const stripchatDocs = await db.collection("daily_metrics").where("platform", "==", "Stripchat").limit(5).get();
       console.log("Stripchat docs found:", stripchatDocs.size);
   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
