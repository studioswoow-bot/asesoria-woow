const admin = require('firebase-admin');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
  }),
});

const db = admin.firestore();

async function run() {
  const modelsSnap = await db.collection("models").where("nickname", "==", "aliaandadara").get();
  let modelId = null;
  if (!modelsSnap.empty) {
    modelId = modelsSnap.docs[0].id;
    console.log('Model doc:', modelsSnap.docs[0].data());
  } else {
    // Try lowercase or looking at modelos_profile_v2
    const profilesSnap = await db.collection("modelos_profile_v2").get();
    for (const doc of profilesSnap.docs) {
      const data = doc.data();
      const nickname = data.credentials?.Chaturbate?.username || data.generalInfo?.artisticName;
      if (nickname && nickname.toLowerCase() === 'aliaandadara') {
         modelId = doc.id;
         console.log('Found ID via profile v2:', modelId);
      }
    }
    
    if (modelId) {
       const directSnap = await db.collection("models").doc(modelId).get();
       if (directSnap.exists) {
         console.log('Model doc by ID:', directSnap.data());
       } else {
         console.log('Model missing in `models` collection');
       }
    }
  }

  if (modelId) {
    const today = new Date().toISOString().split("T")[0];
    console.log('Checking daily_metrics for date:', today, 'modelId:', modelId);
    const mSnap = await db.collection("daily_metrics").where("model_id", "==", modelId).where("date", "==", today).get();
    if (mSnap.empty) {
      console.log('No daily metrics found for today.');
    } else {
      mSnap.docs.forEach(doc => {
        console.log('Metric doc:', doc.data());
      });
    }
  }
}

run().catch(console.error);
