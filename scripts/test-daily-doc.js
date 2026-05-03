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
    const snap = await db.collection("daily_metrics")
        .where("model_id", "==", "q3d0FhN0bXXsIqZ2cW9xZ8uU3xM2")
        .limit(2)
        .get();
        
    snap.forEach(doc => {
        console.log(doc.id, doc.data());
    });
    process.exit(0);
}
run().catch(console.error);
