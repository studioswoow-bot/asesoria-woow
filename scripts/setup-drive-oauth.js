/**
 * Script de configuración OAuth para Google Drive
 * 
 * INSTRUCCIONES:
 * 1. Ve a Google Cloud Console > APIs & Services > Credentials
 *    (para el proyecto "gmail-woow-estudios-wordpress")
 * 2. Crea un "OAuth 2.0 Client ID" de tipo "Desktop application"
 * 3. Descarga el archivo JSON y copia el client_id y client_secret
 * 4. Ejecuta este script: node scripts/setup-drive-oauth.js
 * 5. Copia el refresh_token generado a tu .env.local
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Manual parse .env.local
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

const CLIENT_ID = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('');
  console.log('=================================================');
  console.log('  CONFIGURACIÓN OAUTH PARA GOOGLE DRIVE');
  console.log('=================================================');
  console.log('');
  console.log('Para subir archivos a Google Drive desde una cuenta personal,');
  console.log('necesitas configurar OAuth 2.0 (las cuentas de servicio ya no');
  console.log('tienen cuota de almacenamiento en Drive personal).');
  console.log('');
  console.log('PASOS:');
  console.log('');
  console.log('1. Ve a: https://console.cloud.google.com/apis/credentials');
  console.log('   Proyecto: gmail-woow-estudios-wordpress');
  console.log('');
  console.log('2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"');
  console.log('   - Application type: "Desktop app"');
  console.log('   - Name: "WooW Drive Upload"');
  console.log('');
  console.log('3. Copia el Client ID y Client Secret');
  console.log('');
  console.log('4. Agrega estas líneas a tu .env.local:');
  console.log('   GOOGLE_DRIVE_OAUTH_CLIENT_ID="tu_client_id"');
  console.log('   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET="tu_client_secret"');
  console.log('');
  console.log('5. Ejecuta este script otra vez:');
  console.log('   node scripts/setup-drive-oauth.js');
  console.log('');
  console.log('NOTA: Asegúrate de que la Google Drive API esté habilitada');
  console.log('en el proyecto de Google Cloud Console.');
  console.log('');
  process.exit(0);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent', // Forzar para obtener refresh_token
});

// Crear servidor temporal para recibir el callback
const server = http.createServer(async (req, res) => {
  const queryObject = url.parse(req.url, true).query;
  
  if (queryObject.code) {
    try {
      const { tokens } = await oauth2Client.getToken(queryObject.code);
      
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center; background: #1a1a2e; color: white;">
            <h1 style="color: #00d4aa;">✅ Autorización exitosa!</h1>
            <p>Puedes cerrar esta ventana y volver a la terminal.</p>
          </body>
        </html>
      `);

      console.log('');
      console.log('✅ ¡Autorización exitosa!');
      console.log('');
      console.log('Agrega esta línea a tu .env.local:');
      console.log('');
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log('');

      server.close();
      process.exit(0);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error obteniendo token: ' + error.message);
      console.error('❌ Error:', error.message);
    }
  }
});

server.listen(3333, () => {
  console.log('');
  console.log('🔑 Abre este enlace en tu navegador para autorizar la app:');
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log('Esperando autorización...');
});
