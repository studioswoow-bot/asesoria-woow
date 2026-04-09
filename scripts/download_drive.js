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

async function downloadFile(fileId, destPath) {
  try {
    const drive = getDriveClient();
    const dest = fs.createWriteStream(destPath);
    
    const res = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    }, { responseType: 'stream' });
    
    res.data
      .on('end', () => console.log(`Downloaded ${fileId} to ${destPath}`))
      .on('error', err => console.error('Error downloading:', err))
      .pipe(dest);
  } catch (err) {
    console.error("Drive Error:", err.message);
  }
}

const fileId = process.argv[2];
const destPath = process.argv[3] || 'downloaded_file';
downloadFile(fileId, destPath).catch(console.error);
