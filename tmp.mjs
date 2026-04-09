import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import admin from 'firebase-admin';

const envText = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

async function run() {
  const db = admin.firestore();
  console.log('Fetching dps...');
  const dps = await db.collection('work_hours').limit(5).get();
  
  const res = [];
  dps.forEach(doc => res.push(doc.data()));
  
  writeFileSync(join(process.cwd(), 'tmp_work_hours.json'), JSON.stringify(res, null, 2));
  console.log('done');
  process.exit(0);
}
run().catch(console.error);
