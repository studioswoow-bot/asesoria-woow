import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function run() {
  const profilesSnap = await db.collection("modelos_profile_v2").get();
  for (const doc of profilesSnap.docs) {
    const data = doc.data();
    const chaturbateCreds = data.credentials?.Chaturbate;
    const nickname = chaturbateCreds?.username || data.generalInfo?.artisticName;
    if (nickname && nickname.toLowerCase() === 'aliaandadara') {
      console.log('Found model:', nickname);
      console.log('API Enabled Platforms:', data.apiEnabledPlatforms);
      console.log('Chaturbate Creds:', chaturbateCreds);
      
      // Let's test the endpoint directly if apiKey is available
      if (chaturbateCreds?.apiKey) {
        console.log('Testing endpoint...');
        try {
          const res = await fetch(chaturbateCreds.apiKey.trim());
          const json = await res.json();
          console.log('Event count:', json.events?.length);
          console.log('Next URL:', json.nextUrl);
          
          let tokens = 0;
          if (json.events) {
            for (const ev of json.events) {
              const body = ev.body || {};
              tokens += Number(body.tokens || body.amount || body.token_amount || 0);
            }
          }
          console.log('Tokens in current batch:', tokens);
        } catch (err: any) {
          console.error('Fetch error:', err.message);
        }
      }
    }
  }
}

run().catch(console.error);
