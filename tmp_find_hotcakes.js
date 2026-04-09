const fs = require('fs');
const { google } = require('googleapis');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
});

async function getDriveClient() {
  const clientEmail = env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    if (env.GOOGLE_DRIVE_OAUTH_CLIENT_ID) {
      const oauth2Client = new google.auth.OAuth2(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID, env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN });
      return google.drive({ version: 'v3', auth: oauth2Client });
    }
  }

  const rawKey = privateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
  const keyLines = rawKey.split('\n');
  const formattedKey = keyLines.map(line => {
    if (line.startsWith('-----')) return line;
    return line.replace(/\s/g, '');
  }).join('\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  await auth.authorize();
  return google.drive({ version: 'v3', auth });
}

async function searchFolders() {
  const drive = await getDriveClient();
  console.log('Searching for Hotcakes folders...');
  // Search for any folder with hotcakes (or Valentina) in the name
  const res = await drive.files.list({
    q: "(name contains 'hotcakes' or name contains 'Hotcakes' or name contains 'Valentina') and trashed = false and mimeType = 'application/vnd.google-apps.folder'",
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  console.log(`Found ${res.data.files.length} folders:`);
  res.data.files.forEach(f => {
    console.log(`- ID: ${f.id} | Name: "${f.name}" | Parents: ${JSON.stringify(f.parents)}`);
  });

  for(let folder of res.data.files) {
    if(!folder.id) continue;
    const subRes = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });
    console.log(`  Subfolders in "${folder.name}":`);
    subRes.data.files.forEach(sub => {
        console.log(`    - ID: ${sub.id} | Name: "${sub.name}"`);
    });
  }

  const csvRes = await drive.files.list({
    q: "(name contains 'hotcakes' or name contains 'Hotcakes' or name contains 'valentina_lopez') and trashed = false and (mimeType = 'text/csv' or mimeType = 'text/plain' or mimeType = 'application/csv' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')",
    fields: 'files(id, name, parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  console.log(`\nFound ${csvRes.data.files.length} docs matching:`);
  csvRes.data.files.forEach(f => {
    console.log(`- ID: ${f.id} | Name: "${f.name}" | Parents: ${JSON.stringify(f.parents)}`);
  });
}

searchFolders().catch(console.error);
