const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve('.env.local');
let adminSecret = '';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key?.trim() === 'ADMIN_SECRET') {
      adminSecret = value.join('=').trim().replace(/^"|"$/g, '');
    }
  });
}

async function triggerSync() {
  const url = `http://localhost:3000/api/sync-chaturbate?secret=${adminSecret}`;
  console.log('Triggering sync via:', url);
  
  // Hit localhost (assuming dev server is running)
  // Or hit the public URL if it's there
  try {
     const lib = url.startsWith('https') ? https : http;
     lib.get(url, (res) => {
        console.log('Status:', res.statusCode);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
           console.log('Response:', data);
           // After triggering, check the log
           if (fs.existsSync('/tmp/sync_debug.log')) {
              console.log('--- LOG ENTRIES ---');
              console.log(fs.readFileSync('/tmp/sync_debug.log', 'utf8'));
           } else {
              console.log('No debug log found after sync.');
           }
        });
     }).on('error', e => console.error('Error:', e));
  } catch (e) {
    console.error('Catch Error:', e);
  }
}

triggerSync();
