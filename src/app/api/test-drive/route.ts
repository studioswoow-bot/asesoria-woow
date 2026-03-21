import { NextResponse } from 'next/server';
import { getFilesFromFolder } from '@/lib/google-drive';

export async function GET() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    
    if (!folderId) {
      return NextResponse.json({ 
        success: false, 
        error: "No se encontró GOOGLE_DRIVE_ROOT_FOLDER_ID en .env.local" 
      }, { status: 400 });
    }

    const files = await getFilesFromFolder(folderId);
    
    return NextResponse.json({ 
      success: true, 
      message: "Conexión a Estudios Drive exitosa",
      count: files.length,
      files: files.slice(0, 10) // Mostrar solo los primeros 10 por seguridad
    });
  } catch (error: any) {
    console.error("API Test Drive Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      details: "Revisa que el correo de la cuenta de servicio tenga acceso de EDITOR a la carpeta de Drive."
    }, { status: 500 });
  }
}
