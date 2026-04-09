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

async function listFiles(folderId) {
  try {
    const drive = getDriveClient();
    
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    
    console.log(JSON.stringify(res.data.files, null, 2));
  } catch (err) {
    console.error("Drive Error:", err.message);
  }
}

const folderId = process.argv[2] || env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
listFiles(folderId).catch(console.error);
