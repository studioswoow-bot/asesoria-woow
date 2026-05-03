const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const envFile = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
envFile.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[match[1].trim()] = val;
    }
});

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
}
const db = admin.firestore();

async function run() {
    const snap = await db.collection("modelos_analytics_cache_v2").get();
    console.log(`Total cache docs: ${snap.size}`);
    let found = 0;
    snap.forEach(doc => {
        if (doc.id.includes('2026-04-16_to_2026-04-30_Stripchat')) {
            console.log(doc.id);
            found++;
        }
    });
    console.log(`Found ${found} docs for 2026-04-16_to_2026-04-30_Stripchat`);
    process.exit(0);
}
run().catch(console.error);
