const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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

const auth = new google.auth.GoogleAuth({
  credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

const drive = google.drive({ version: 'v3', auth });

async function exploreDrive() {
  try {
    console.log("Searching for 'Batch_mensual' folder...");
    const res = await drive.files.list({
      q: "name = 'Batch_mensual' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name, parents)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    console.log("Found folders:", res.data.files);
    
    if (res.data.files && res.data.files.length > 0) {
      const parentId = res.data.files[0].id;
      console.log(`\nListing contents of Batch_mensual (${parentId}):`);
      
      const contents = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      console.log(contents.data.files);
    }

    console.log("\nSearching for files containing 'ALL_MODELS'...");
    const files = await drive.files.list({
      q: "name contains 'ALL_MODELS' and trashed = false",
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log(files.data.files);
    
    if (files.data.files && files.data.files.length > 0) {
        const fileId = files.data.files[0].id;
        console.log(`\nDownloading ${files.data.files[0].name}...`);
        const dl = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        
        let data = '';
        dl.data.on('data', chunk => data += chunk);
        dl.data.on('end', () => {
            console.log("First 1500 characters of file:");
            console.log(data.substring(0, 1500));
        });
    }
  } catch (error) {
    console.error("Error exploring Drive:", error.message);
  }
}

exploreDrive();
