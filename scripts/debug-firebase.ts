import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        let serviceAccountParams;
        try {
            serviceAccountParams = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountParams)
            });
        } catch (e) {
            console.error("error init", e);
        }
    }
}

const db = admin.firestore();

async function main() {
    console.log("Fetching collections...");
    try {
        const collections = await db.listCollections();
        const names = collections.map(c => c.id);
        console.log("Cols:", names.join(", "));
        
        for (const name of names) {
            if (name.includes("festiv") || name.includes("holi") || name.includes("feriad") || name.includes("config")) {
                const snap = await db.collection(name).limit(2).get();
                console.log(`\nCollection ${name}:`);
                snap.forEach(d => console.log(d.id, "=>", JSON.stringify(d.data())));
            }
        }
    } catch(e) {
        console.error("Crashed:", e);
    }
}
main().then(() => process.exit(0));
