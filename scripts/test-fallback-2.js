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
    const modelId = "0U3YsDujbOyW4jlZEZSW";
    const startDate = "2026-04-16";
    const endDate = "2026-04-30";
    
    const scCacheDoc = await db.collection("modelos_analytics_cache_v2").doc(`${modelId}_${startDate}_to_${endDate}_Stripchat`).get();
    if (scCacheDoc.exists) {
        console.log(scCacheDoc.data());
    } else {
        console.log("Not found");
    }
    process.exit(0);
}
run().catch(console.error);
