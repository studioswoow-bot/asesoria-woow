const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');

function getEnvVar(content, key) {
    const match = content.match(new RegExp(`^${key}="?([^"\n]*)"?`, 'm'));
    return match ? match[1] : null;
}

function get(url) {
    return new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

async function runSyncManual() {
    try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const projectIdValue = getEnvVar(envContent, 'FIREBASE_PROJECT_ID');
        const clientEmailValue = getEnvVar(envContent, 'FIREBASE_CLIENT_EMAIL');
        const privateKeyRaw = getEnvVar(envContent, 'FIREBASE_PRIVATE_KEY');

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: projectIdValue,
                    clientEmail: clientEmailValue,
                    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
                }),
            });
        }

        const db = admin.firestore();
        const nickname = "hotcakes_uwu";
        const lowNickname = nickname.toLowerCase();
        
        console.log(`--- SINC MANUAL para ${nickname} (Regex Fix) ---`);
        
        const resHtml = await get(`https://chaturbate.com/${lowNickname}/`);
        let roomStatus = "offline";
        let viewers = 0;

        if (resHtml.status === 200) {
            const html = resHtml.body;
            // USAR LA NUEVA LÓGICA DE REGEX
            const statusRegex = /room_status(?:\\u0022|"):\s*(?:\\u0022|")([^"\\]+)/i;
            const match = html.match(statusRegex);
            
            if (match) {
                roomStatus = match[1].toLowerCase();
                console.log(`Detección por Regex: ${roomStatus}`);
            } else if (html.includes(".m3u8") || html.includes('"hls_source": "http')) {
                roomStatus = "public";
                console.log(`Detección por Substring: public`);
            }

            const viewerRegex = /num_(?:users|viewers)(?:\\u0022|"):\s*(\d+)/i;
            const vm = html.match(viewerRegex);
            if (vm) viewers = parseInt(vm[1], 10);
        }

        const onlineStatuses = ["public", "private", "away", "password", "hidden"];
        const isOnline = onlineStatuses.includes(roomStatus);
        console.log(`Estado final: ${roomStatus} -> isOnline: ${isOnline}`);

        // Actualizar
        const modelsRef = db.collection("models");
        const all = await modelsRef.get();
        const m = all.docs.find(d => (d.data().nickname || "").toLowerCase() === lowNickname);
        if (m) {
            await m.ref.update({
                is_online: isOnline,
                "stream_stats.current_viewers": viewers,
                "stream_stats.synced_at": admin.firestore.Timestamp.now(),
                "stream_stats.last_sync_status": roomStatus,
            });
            console.log("Firestore actualizado.");
        } else {
            console.log("No se encontró el modelo.");
        }

    } catch (err) {
        console.error("Error:", err);
    }
}

runSyncManual();
