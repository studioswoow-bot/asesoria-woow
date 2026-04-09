import { NextResponse } from 'next/server';
import { getFilesFromFolder, uploadFileToFolder } from '@/lib/google-drive';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedFolderId = searchParams.get('folderId');
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const folderId = requestedFolderId || rootFolderId;
    
    if (!folderId) {
      return NextResponse.json({ 
        success: false, 
        error: "No se encontró el ID de carpeta (folderId param o env)" 
      }, { status: 400 });
    }

    // 1. Si es acción de lectura de un archivo específico
    if (searchParams.get('action') === 'read' && searchParams.get('fileId')) {
      const fileId = searchParams.get('fileId')!;
      const content = await import('@/lib/google-drive').then(m => m.getFileContent(fileId));
      return NextResponse.json({ success: true, fileId, content });
    }

    // 2. Probar listar archivos (Comportamiento por defecto)
    const files = await getFilesFromFolder(folderId);
    
    // Probar subida de archivo de prueba (solo si no estamos listando una subcarpeta específica)
    let uploadResult = null;
    if (!requestedFolderId) {
      const testFileName = `CONEXION_ESTUDIOS_${new Date().getTime()}.json`;
      uploadResult = await uploadFileToFolder(folderId, testFileName, {
        status: "success",
        message: "Prueba de conexión desde API",
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Conexión a Estudios Drive exitosa",
      upload: uploadResult ? {
        id: uploadResult.id,
        name: uploadResult.name
      } : "skipped",
      filesCount: files.length,
      recentFiles: files.slice(0, 10)
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
