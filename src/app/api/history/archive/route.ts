import { NextResponse } from 'next/server';
import { findOrCreateFolder, uploadFileToFolder } from '@/lib/google-drive';

export async function POST(req: Request) {
  try {
    // 1. Verificar autenticación básica (opcional si es interno, pero recomendado)
    // Para simplificar, asumiremos que quien llama tiene un token válido si viene del frontend
    const body = await req.json();
    const { modelId, profileData } = body;

    if (!modelId || !profileData) {
      return NextResponse.json({ error: "Faltan datos requeridos (modelId o profileData)" }, { status: 400 });
    }

    // Sanatizar datos para JSON (evitar 'undefined')
    const sanitizedData = JSON.parse(JSON.stringify(profileData));
    sanitizedData.snapshotDate = new Date().toISOString();
    sanitizedData.source = "manual_registration";
    sanitizedData.modelId = modelId;

    // 2. Archivar en Google Drive (Almacenamiento Único)
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const artisticName = sanitizedData.generalInfo?.artisticName;

    if (rootFolderId && artisticName) {
      try {
        const historyBaseFolderId = await findOrCreateFolder("Historicos_Perfiles", rootFolderId);
        const nickname = (artisticName || modelId).replace(/[^a-z0-9]/gi, '_');
        const modelFolderId = await findOrCreateFolder(nickname, historyBaseFolderId as string);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `profile_${nickname}_${timestamp}.json`;
        
        await uploadFileToFolder(modelFolderId as string, fileName, sanitizedData);
          console.log(`✅ Histórico en Drive: ${fileName}`);
      } catch (driveError) {
        console.error("❌ Error CRÍTICO al guardar en Drive:", driveError);
        throw new Error("No se pudo guardar el histórico en Google Drive");
      }
    } else {
        throw new Error("No hay carpeta raíz de Drive configurada o falta el nombre artístico");
    }

    return NextResponse.json({ 
      success: true, 
      message: "Histórico archivado correctamente en Google Drive." 
    });

  } catch (error: any) {
    console.error("❌ Error CRÍTICO en History Archive API:", error);
    return NextResponse.json({ 
      error: error.message || "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
