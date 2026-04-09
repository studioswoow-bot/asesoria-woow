const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function testDrive() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}="([^"]+)"`));
    return match ? match[1] : null;
  };

  const clientEmail = getEnv('GOOGLE_DRIVE_CLIENT_EMAIL');
  const privateKey = getEnv('GOOGLE_DRIVE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const rootFolderId = getEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');

  console.log('Testing Drive with:');
  console.log('Client Email:', clientEmail);
  console.log('Root Folder ID:', rootFolderId);

  try {
    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });
    
    console.log('\n--- Checking Root Folder ---');
    try {
      const res = await drive.files.get({
        fileId: rootFolderId,
        fields: 'id, name, permissions',
        supportsAllDrives: true
      });
      console.log('Root Folder Found:', res.data.name);
    } catch (e) {
      console.error('Error finding root folder:', e.message);
      if (e.code === 404) {
        console.error('CRITICAL: The Service Account does not have access or the ID is wrong.');
      }
      return;
    }

    console.log('\n--- Testing Folder Creation (Historicos_Perfiles) ---');
    try {
      const folderRes = await drive.files.create({
        requestBody: {
          name: 'TEST_FOLDER_DELETE_ME',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        },
        fields: 'id',
        supportsAllDrives: true,
      });
      console.log('Folder created successfully, ID:', folderRes.data.id);
      
      // Cleanup
      await drive.files.delete({ fileId: folderRes.data.id, supportsAllDrives: true });
      console.log('Test folder deleted.');
    } catch (e) {
      console.error('Error creating folder:', e.message);
    }

  } catch (error) {
    console.error('General Error:', error);
  }
}

testDrive();
