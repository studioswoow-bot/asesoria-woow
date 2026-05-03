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
       const startDate = '2026-04-16';
       const endDate = '2026-04-30';

       const metricsSnap = await db.collection("daily_metrics").where("model_id", "==", modelId).get();
       const hoursSnap = await db.collection("work_hours").where("model_id", "==", modelId).get();

       const metricsMap = new Map();
       metricsSnap.forEach((doc) => {
         const data = doc.data();
         const date = data.date;
         if (date < startDate || date > endDate) return;
         
         // WAIT! I NEED TO CHECK THIS!
         // DOES metrics/route.ts filter by platform? No.
         console.log(`Metric doc: date=${date}, platform=${data.platform}, tokens=${data.tokens}`);

         const existing = metricsMap.get(date) || { tokens: 0, hours: 0 };
         let tokenValue = Number(data.tokens || 0);
         if (data.currency?.toLowerCase() === "usd") tokenValue = tokenValue * 20;

         metricsMap.set(date, {
           ...existing,
           tokens: existing.tokens + tokenValue,
         });
       });

       console.log("Tokens Map:", metricsMap);
   } catch(e) {
       console.error(e);
   }
}
run().then(() => process.exit(0));
