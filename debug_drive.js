const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function run() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(process.cwd(), 'drive-credentials.json'),
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
        const drive = google.drive({ version: 'v3', auth });

        console.log('Buscando archivos natalia_kiss01...');
        const res = await drive.files.list({
            q: "name contains 'natalia_kiss01' and trashed = false",
            fields: 'files(id, name, mimeType, createdTime)',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        console.log(`Found ${res.data.files.length} files:`);
        res.data.files.forEach(f => {
            console.log(`- ${f.name} (${f.mimeType})`);
        });
    } catch (err) {
        console.error(err);
    }
}

run();
