const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function listAliaDrive() {
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

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // 1. Find the folder for Alia
  const res = await drive.files.list({
    q: "name = 'aliaandadara' and mimeType = 'application/vnd.google-apps.folder'",
    fields: 'files(id, name)',
  });

  if (res.data.files.length === 0) {
    console.log('No folder found for aliaandadara in Drive.');
    return;
  }

  const folderId = res.data.files[0].id;
  console.log(`Folder ID: ${folderId}`);

  // 2. List recent files
  const filesRes = await drive.files.list({
    q: `'${folderId}' in parents`,
    orderBy: 'createdTime desc',
    pageSize: 5,
    fields: 'files(id, name, createdTime)',
  });

  console.log('Recent sync files for Alia:');
  filesRes.data.files.forEach(f => {
    console.log(`- ${f.name} (${f.createdTime})`);
  });
}

listAliaDrive().catch(console.error);
