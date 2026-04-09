const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const https = require('https');

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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}
const db = admin.firestore();

// Replication of the sync logic but for Alia specifically with massive logging
async function debugAliaSync() {
    console.log('--- DEBUG ALIA SYNC ---');
    const doc = await db.collection('modelos_profile_v2').doc('DeiTLV7w6nCoP0ZmoDRU').get();
    const data = doc.data();
    const nickname = data.credentials?.Chaturbate?.username || 'aliaandadara';
    const apiKey = data.credentials?.Chaturbate?.apiKey;
    const lastNextUrl = data.credentials?.Chaturbate?.lastNextUrl;
    
    console.log('Nickname:', nickname);
    console.log('API Key:', apiKey);
    console.log('Current lastNextUrl in DB:', lastNextUrl);
    
    let fetchUrl = lastNextUrl || apiKey;
    if (fetchUrl && !fetchUrl.includes('timeout')) {
        fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + 'timeout=10';
    }
    
    console.log('Step 1: Fetching current status...');
    const statusUrl = `https://chaturbate.com/${nickname}/`;
    // We'll skip status check for now as it's not the issue
    
    console.log('Step 2: Fetching events from:', fetchUrl);
    
    const fetchRes = await new Promise((resolve, reject) => {
        https.get(fetchUrl, {
            headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ok: res.statusCode < 400, status: res.statusCode, body}));
        }).on('error', reject);
    });

    console.log('Fetch Result Status:', fetchRes.status);
    if (!fetchRes.ok) {
        console.error('Fetch failed! If 400, it means cursor expired. Logic should reset to baseline.');
        if (lastNextUrl) {
            console.log('Retrying from baseline...');
            // In real logic, it would retry baseline.
        }
        return;
    }

    const payload = JSON.parse(fetchRes.body);
    console.log('Events in batch:', payload.events.length);
    console.log('New NextUrl:', payload.nextUrl);
    
    let totalFound = 0;
    payload.events.forEach(e => {
        const body = e.body || {};
        const t = Number(body.tokens || body.amount || body.token_amount || 0);
        const u = body.user || body.username || 'anon';
        if (t > 0 || JSON.stringify(e).includes('santi')) {
            console.log('MATCH EVENT:', t, 'tokens from', u, 'Method:', e.method);
            totalFound += t;
        }
    });
    
    console.log('Total tokens found in this batch:', totalFound);
}

debugAliaSync().catch(console.error);
