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
  const profilesSnap = await db.collection("modelos_profile_v2").get();
  for (const doc of profilesSnap.docs) {
    const data = doc.data();
    const chaturbateCreds = data.credentials?.Chaturbate;
    const nickname = chaturbateCreds?.username || data.generalInfo?.artisticName;
    if (nickname && nickname.toLowerCase() === 'aliaandadara') {
      console.log('Found model (Chaturbate):', nickname);
      console.log('API Enabled Platforms:', data.apiEnabledPlatforms);
      console.log('Chaturbate Creds:', chaturbateCreds);
      
      if (chaturbateCreds?.apiKey) {
        console.log('Testing Chaturbate endpoint...');
        try {
          // Dynamic import for node fetch
          const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => global.fetch(...args));
          const res = await fetch(chaturbateCreds.apiKey.trim());
          const json = await res.json();
          console.log('Event count:', json.events?.length);
          let tokens = 0;
          if (json.events) {
            for (const ev of json.events) {
              const body = ev.body || {};
              tokens += Number(body.tokens || body.amount || body.token_amount || 0);
            }
          }
          console.log('Tokens in current batch:', tokens);
        } catch (err) {
          console.error('Fetch error:', err.message);
        }
      }
    }

    const stripchatCreds = data.credentials?.Stripchat;
    const scNickname = stripchatCreds?.username || data.generalInfo?.artisticName;
    if (scNickname && scNickname.toLowerCase() === 'aliaandadara') {
      console.log('Found model (Stripchat):', scNickname);
      console.log('API Enabled Platforms:', data.apiEnabledPlatforms);
      console.log('Stripchat Creds:', stripchatCreds);
    }
  }
}

run().catch(console.error);
