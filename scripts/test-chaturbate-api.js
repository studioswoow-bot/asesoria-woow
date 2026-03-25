const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Set up env
const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
    }
  });
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

async function checkModelEvents() {
  try {
    const snap = await db.collection("modelos_profile_v2").where("generalInfo.artisticName", "==", "silacitex_effys").get();
    if (snap.empty) {
      console.log("Model not found by artisticName, checking nickname...");
      const allSnap = await db.collection("modelos_profile_v2").get();
      let found = false;
      for (const doc of allSnap.docs) {
        const d = doc.data();
        const creds = d.credentials?.Chaturbate || {};
        if (creds.username?.toLowerCase() === "silacitex_effys" || d.generalInfo?.artisticName?.toLowerCase() === "silacitex_effys") {
          console.log("Found model:", doc.id);
          console.log("Chaturbate Credentials:", creds);
          await testFetch(creds.username || "silacitex_effys", creds.apiKey);
          found = true;
          break;
        }
      }
      if (!found) console.log("Model silacitex_effys not found at all.");
    } else {
       const d = snap.docs[0].data();
       const creds = d.credentials?.Chaturbate || {};
       console.log("Found model:", snap.docs[0].id);
       console.log("Chaturbate Credentials:", creds);
       await testFetch(creds.username || "silacitex_effys", creds.apiKey);
    }
    
  } catch (e) {
    console.error(e);
  }
}

async function testFetch(username, apiKey) {
  if (!apiKey) {
    console.log("No API key available to test.");
    process.exit(0);
  }
  
  // Is it a URL or a token?
  let fetchUrl = apiKey;
  if (!apiKey.startsWith("http")) {
    fetchUrl = `https://events.chaturbate.com/api/events/?username=${username}&token=${apiKey}`;
  }
  
  console.log(`\nFetching from: ${fetchUrl}`);
  
  try {
     const res = await fetch(fetchUrl);
     console.log("Status:", res.status);
     const data = await res.json();
     console.log("Response Data Preview:", JSON.stringify(data).substring(0, 500));
     
     const events = Array.isArray(data.events) ? data.events : (Array.isArray(data) ? data : []);
     console.log(`Found ${events.length} events in payload.`);
     
     if (events.length > 0) {
       console.log("Sample Event:", JSON.stringify(events[0], null, 2));
     }
  } catch(e) {
     console.error("Fetch failed:", e.message);
  }
  process.exit(0);
}

checkModelEvents();
