import { NextResponse } from 'next/server';
import { getFilesFromFolder, uploadFileToFolder } from '@/lib/google-drive';

export async function GET() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    
    if (!folderId) {
      return NextResponse.json({ 
        success: false, 
        error: "No se encontró GOOGLE_DRIVE_ROOT_FOLDER_ID en .env.local" 
      }, { status: 400 });
    }

    // Probar listar archivos
    const files = await getFilesFromFolder(folderId);
    
    // Probar subida de archivo de prueba
    const testFileName = `CONEXION_ESTUDIOS_${new Date().getTime()}.json`;
    const uploadResult = await uploadFileToFolder(folderId, testFileName, {
      status: "success",
      message: "Prueba de conexión desde API",
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: "Conexión y subida a Estudios Drive exitosa",
      upload: {
        id: uploadResult.id,
        name: uploadResult.name
      },
      filesCount: files.length,
      recentFiles: files.slice(0, 5)
    });
  } catch (error: any) {
    console.error("API Test Drive Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      details: "Asegúrate de que la cuenta de servicio tenga acceso de EDITOR a la carpeta de Drive."
    }, { status: 500 });
  }
}
