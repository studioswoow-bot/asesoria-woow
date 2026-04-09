import { NextResponse } from 'next/server';
import { findOrCreateFolder, uploadFileToFolder } from '@/lib/google-drive';
import { adminDb } from '@/lib/firebase-admin';

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

    // 2. Archivar en Google Drive (Prioridad 1)
    let driveSaved = false;
    let driveErrorMsg = "";
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const artisticName = sanitizedData.generalInfo?.artisticName || modelId;

    if (rootFolderId) {
      try {
        const historyBaseFolderId = await findOrCreateFolder("Historicos_Perfiles", rootFolderId);
        const nickname = String(artisticName).replace(/[^a-z0-9]/gi, '_');
        const modelFolderId = await findOrCreateFolder(nickname, historyBaseFolderId as string);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `profile_${nickname}_${timestamp}.json`;
        
        await uploadFileToFolder(modelFolderId as string, fileName, sanitizedData);
        console.log(`✅ Histórico en Drive: ${fileName}`);
        driveSaved = true;
      } catch (driveError: any) {
        console.error("⚠️ Error al guardar en Drive (intentando fallback):", driveError.message);
        driveErrorMsg = driveError.message;
      }
    }

    // 3. Fallback/Espejo en Firestore (Colección 'profile_history_snapshots')
    let firestoreSaved = false;
    if (adminDb) {
      try {
        await adminDb.collection('profile_history_snapshots').add({
          ...sanitizedData,
          archivedAt: new Date().toISOString()
        });
        console.log(`✅ Snaphot guardado en Firestore para modelo: ${modelId}`);
        firestoreSaved = true;
      } catch (fsError: any) {
        console.error("❌ Error al guardar backup en Firestore:", fsError.message);
      }
    }

    if (!driveSaved && !firestoreSaved) {
        throw new Error(`No se pudo archivar en ningún destino. Error Drive: ${driveErrorMsg}`);
    }

    return NextResponse.json({ 
      success: true, 
      drive: driveSaved,
      firestore: firestoreSaved,
      message: driveSaved ? "Histórico archivado en Google Drive." : "Archivado en Firestore (Drive falló)."
    });

  } catch (error: any) {
    console.error("❌ Error CRÍTICO en History Archive API:", error);
    return NextResponse.json({ 
      error: error.message || "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
