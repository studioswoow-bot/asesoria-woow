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

async function checkJsonFiles(folderId) {
  try {
    const drive = getDriveClient();
    
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    
    console.log(`Checking ${res.data.files.length} JSON files...`);
    
    for (const file of res.data.files.slice(0, 20)) { // Check last 20 JSONs
      const contentRes = await drive.files.get({
        fileId: file.id,
        alt: 'media'
      });
      
      const content = contentRes.data;
      if (content.totalTokensFound > 0) {
        console.log(`- File ${file.name} HAS tokens: ${content.totalTokensFound}`);
      } else {
        console.log(`- File ${file.name} has 0 tokens.`);
      }
    }
  } catch (err) {
    console.error("Error checking JSON files:", err.message);
  }
}

const folderId = "19h3KOpoCxF8plCPerkPdghRFNcjjpTHH"; // silacitex_effys folder
checkJsonFiles(folderId).catch(console.error);
