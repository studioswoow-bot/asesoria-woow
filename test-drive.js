const fs = require('fs');
const { google } = require('googleapis');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
});

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID, env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function run() {
  try {
    const drive = getDriveClient();
    const fileId = '1_EUROACC0NAqWjQw32cmoaIlC3Nr7uad'; // latest run file
    
    const res = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Drive Error:", err.message);
  }
}

run().catch(console.error);
