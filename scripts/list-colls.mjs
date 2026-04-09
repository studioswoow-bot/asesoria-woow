import fs from 'fs';
import admin from 'firebase-admin';

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
    console.log("Fetching collections...");
    const cols = await db.listCollections();
    
    // First print all to console to ensure we know the exact name
    console.log("All collections:", cols.map(c => c.id).join(', '));
    
    for (const c of cols) {
       if (c.id.includes('festiv') || c.id.includes('holi') || c.id.includes('conf') || c.id.includes('feriad')) {
           console.log("\nFound Collection: " + c.id);
           const docs = (await db.collection(c.id).get()).docs;
           docs.forEach(d => console.log(" - ", d.id, d.data()));
       }
    }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
