import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export async function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Faltan las credenciales de Google Drive en .env.local');
  }

  // Limpiar la llave por si viene con comillas extras o problemas de formato
  const formattedKey = privateKey
    .replace(/^\"|\"$/g, '') // Quitar comillas al inicio y final si existen
    .replace(/\\n/g, '\n');  // Convertir \n literales en saltos de línea reales

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: SCOPES,
  });

  // Forzamos la obtención del token antes de retornar el cliente
  await auth.authorize();

  return google.drive({ version: 'v3', auth });
}

/**
 * Lista archivos de una carpeta (fotos/videos de modelos)
 */
export async function getFilesFromFolder(folderId: string) {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
    });
    return response.data.files || [];
  } catch (error) {
    console.error('Error al acceder a Google Drive:', error);
    throw error;
  }
}

/**
 * Obtener detalles de un archivo específico por ID
 */
export async function getFileDetails(fileId: string) {
  try {
    const drive = await getDriveClient();
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, thumbnailLink, size',
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener detalles del archivo:', error);
    throw error;
  }
}
