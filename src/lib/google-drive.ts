import { google } from 'googleapis';

export async function getDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  // Si tenemos las credenciales OAuth (recomendado para Drive personal)
  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  // Fallback a Service Account (solo funciona si la carpeta está en un Shared Drive de Google Workspace)
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Faltan credenciales de Google Drive (ni OAuth ni Service Account) en variables de entorno');
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

/**
 * Lista archivos de una carpeta
 */
export async function getFilesFromFolder(folderId: string) {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return response.data.files || [];
  } catch (error) {
    console.error('Error al acceder a Google Drive:', error);
    throw error;
  }
}

export async function getFileDetails(fileId: string) {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, thumbnailLink, size',
      supportsAllDrives: true, // Siempre es bueno incluirlo por si se usa Shared Drive
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener detalles del archivo:', error);
    throw error;
  }
}

/**
 * Sube un archivo (contenido buffer o string) a una carpeta específica.
 */
export async function uploadFileToFolder(folderId: string, fileName: string, content: any, mimeType: string = 'application/json') {
  try {
    const drive = await getDriveClient();
    
    // Si el contenido es un objeto, lo convertimos a JSON
    const body = typeof content === 'object' && !(content instanceof Buffer) 
      ? JSON.stringify(content, null, 2) 
      : content;

    const stream = new (require('stream').Readable)();
    stream.push(body);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType,
        body: stream,
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    console.log(`✅ Archivo subido a Drive: ${response.data.name} (${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error('Error al subir archivo a Google Drive:', error);
    throw error;
  }
}

/**
 * Busca una carpeta por nombre dentro de un padre, o la crea si no existe
 */
export async function findOrCreateFolder(folderName: string, parentId?: string) {
  try {
    const drive = await getDriveClient();
    const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
    
    const searchResponse = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentQuery}`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id as string;
    }

    // Si no existe, crearla
    const createResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : [],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    const newId = createResponse.data.id;
    if (!newId) throw new Error("No se pudo crear la carpeta en Drive");

    console.log(`📂 Carpeta creada en Drive: ${folderName} (${newId})`);
    return newId;
  } catch (error) {
    console.error(`Error al buscar/crear carpeta ${folderName}:`, error);
    throw error;
  }
}
