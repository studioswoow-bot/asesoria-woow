import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { findOrCreateFolder, uploadFileToFolder } from "@/lib/google-drive";

/**
 * EXCEPCIÓN AL PROTOCOLO DE AISLAMIENTO — APROBADA
 * Por decisión del equipo (ver SEGURIDAD_Y_AISLAMIENTO.md Nota final),
 * este endpoint de servidor tiene permiso explícito de escribir en `models`
 * y `daily_metrics` porque es una operación de sincronización automática
 * ejecutada desde el servidor (Admin SDK), no desde el cliente.
 *
 * La sincronización usa el campo `nickname` como clave de unión entre apps.
 */

async function syncModelEventsServer(nickname: string, eventUrl: string, modelId?: string, lastNextUrl?: string) {
  if (!adminDb) {
    throw new Error("Firebase Admin DB no disponible.");
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  // 1. Verificar estado en vivo
  let roomStatus = "offline";
  let viewers = 0;
  let totalTokens = 0;
  let eventsProcessed = 0;
  let tippers: Record<string, number> = {};
  let events: any[] = [];

  const lowNickname = nickname.toLowerCase();

  try {
    const statusRes = await fetch(
      `https://chaturbate.com/${lowNickname}/`,
      { headers, cache: "no-store" }
    );
    if (statusRes.ok) {
      const html = await statusRes.text();
      // Detección mejorada: flexible para manejar encodings de Chaturbate (\u0022 o ")
      // Busca room_status en el JSON incrustado
      const statusRegex = /room_status(?:\\u0022|"):\s*(?:\\u0022|")([^"\\]+)/i;
      const match = html.match(statusRegex);
      
      if (match) {
        roomStatus = match[1].toLowerCase();
      } else if (html.includes(".m3u8") || html.includes('"hls_source": "http')) {
        roomStatus = "public";
      }

      // Intentar obtener viewers del HTML (flexible con encoding)
      const viewerMatch = html.match(/num_(?:users|viewers)(?:\\u0022|"):\s*(\d+)/i);
      if (viewerMatch) viewers = parseInt(viewerMatch[1], 10);
    }
  } catch (err: any) {
    console.warn(`[Sync] No se pudo obtener estado de sala para ${nickname}:`, err.message);
  }

  // 2. Obtener eventos (Tokens, etc.) con Cursors (nextUrl)
  let fetchUrl = lastNextUrl || eventUrl;
  let hasMoreEvents = true;
  let loopCount = 0;
  let finalNextUrl = lastNextUrl || "";

  try {
    while (hasMoreEvents && loopCount < 15) { // Límite de seguridad
      loopCount++;
      const response = await fetch(fetchUrl, { headers, cache: "no-store" });
      
      if (!response.ok) {
        // Chaturbate invalida los nextUrl después de varias horas. Si el cursor falló, reiniciamos a la base.
        if (lastNextUrl && fetchUrl === lastNextUrl) {
          console.warn(`[Sync] Cursor nextUrl expirado para ${nickname}. Reiniciando a URL base.`);
          fetchUrl = eventUrl;
          lastNextUrl = ""; // Limpiamos la bandera para no re-entrar aquí
          continue;
        }
        console.error(`[Sync] Error API Chaturbate (${response.status}): ${fetchUrl}`);
        break;
      }

      const rawData = await response.json();
      const batchEvents = Array.isArray(rawData.events) ? rawData.events : [];
      eventsProcessed += batchEvents.length;
      events.push(...batchEvents);

      for (const event of batchEvents) {
        if (!event?.method) continue;
        
        // Detección universal de tokens y usuarios en cualquier evento
        const body = event.body || {};
        const tokens = Number(body.tokens || body.amount || body.token_amount || 0);
        const user = body.user || body.username || body.from_user || body.from_username || body.partner || body.user_paying || null;
        
        if (tokens > 0) {
          console.log(`[Sync] Tokens detectados: ${tokens} de ${user || 'Anónimo'} (Evento: ${event.method})`);
          totalTokens += tokens;
          if (user)tippers[user] = (tippers[user] || 0) + tokens;
        }

        if (event.method === "room_status") {
          roomStatus = body.status || roomStatus;
          viewers = body.viewers || viewers;
          
          const partner = body.partner || body.user || body.user_paying;
          if (roomStatus === "private" && partner) {
            tippers[partner] = (tippers[partner] || 0); 
          }
        }
      }

      // Si encontramos nuevos tokens en CUALQUIER batch, la modelo está pública/activa
      if (totalTokens > 0) roomStatus = "public";

      // Paginación "nextUrl" de Chaturbate
      if (rawData.nextUrl && batchEvents.length > 0) {
        // Hay mas eventos encolados en este instante histórico, seguir jalando
        fetchUrl = rawData.nextUrl;
        finalNextUrl = rawData.nextUrl;
      } else if (rawData.nextUrl && batchEvents.length === 0) {
        // Ya atrapamos todos los eventos hasta el momento actual. Guardar cursor para la próxima!
        finalNextUrl = rawData.nextUrl;
        hasMoreEvents = false;
      } else {
        hasMoreEvents = false;
      }
    }
  } catch (e: any) {
    console.error(`[Sync] Error crítico fetch API en loop: ${e.message}`);
  }

  // 3. Actualizar Firestore
  const modelsRef = adminDb.collection("models");
  const metricsRef = adminDb.collection("daily_metrics");
  const onlineStatuses = ["public", "private", "away", "hidden"];

  let modelDocId = modelId;

  // Si no tenemos ID, buscamos por nickname (fallback)
  if (!modelDocId) {
    const snapshot = await modelsRef.where("nickname", "==", nickname).get();
    if (!snapshot.empty) {
      modelDocId = snapshot.docs[0].id;
    }
  }

  if (modelDocId) {
    // Detectar si hay un usuario específico en privado
    const privateUser = (roomStatus === "private") ? 
      (events.find((e: any) => e.method === "room_status")?.body?.user || 
       events.find((e: any) => e.method === "room_status")?.body?.partner || 
       events.find((e: any) => e.method === "room_status")?.body?.user_paying || null) 
      : null;

    await modelsRef.doc(modelDocId).update({
      status: "active",
      is_online: onlineStatuses.includes(roomStatus),
      "stream_stats.current_viewers": viewers,
      "stream_stats.synced_at": Timestamp.now(),
      "stream_stats.last_sync_status": roomStatus,
      "stream_stats.current_private_user": privateUser,
    });

    // 4. Registrar métricas diarias si hay tokens
    if (totalTokens >= 0) {
      const dateStr = new Date().toISOString().split("T")[0];
      const qMetrics = metricsRef
        .where("model_id", "==", modelDocId) 
        .where("date", "==", dateStr);
      const mSnap = await qMetrics.get();
      
      if (mSnap.empty) {
        let bestUser = "";
        let bestTokens = 0;
        for (const [u, t] of Object.entries(tippers)) {
          if (t > bestTokens) {
            bestTokens = t;
            bestUser = u;
          }
        }

        await metricsRef.add({
          model_id: modelDocId,
          date: dateStr,
          tokens: totalTokens,
          currency: "tokens",
          source: "chaturbate_sync",
          top_fan_name: bestUser,
          top_fan_tokens: bestTokens,
          tippers: tippers
        });
      } else {
        const docRef = mSnap.docs[0].ref;
        const existingData = mSnap.docs[0].data();
        const updatedTokens = (existingData.tokens || 0) + totalTokens;
        
        const tippersMap: Record<string, number> = existingData.tippers || {};
        for (const [u, t] of Object.entries(tippers)) {
          tippersMap[u] = (tippersMap[u] as number || 0) + (t as number);
        }

        let bestUser = "";
        let bestTokens = 0;
        for (const [u, t] of Object.entries(tippersMap)) {
          const val = t as number;
          if (val > bestTokens) {
            bestTokens = val;
            bestUser = u;
          }
        }

        await docRef.update({
          tokens: updatedTokens,
          tippers: tippersMap,
          top_fan_name: bestUser,
          top_fan_tokens: bestTokens
        });
      }
    }

    // 5. Histórico en Google Drive (Detallado)
    try {
      const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      if (rootFolderId && nickname) {
        // Carpeta base para históricos de sincronización
        const historyBaseFolderId = await findOrCreateFolder("Historicos_Sync", rootFolderId as string);
        // Carpeta específica de la modelo (nickname limpio)
        const cleanNickname = nickname.replace(/[^a-z0-9]/gi, '_');
        const modelFolderId = await findOrCreateFolder(cleanNickname, historyBaseFolderId);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        // Archivo JSON con toda la información detallada (Tipper nicknames, tokens por usuario, eventos de sala)
        const fileName = `sync_${cleanNickname}_${timestamp}.json`;
        
        await uploadFileToFolder(modelFolderId, fileName, {
          modelId: modelDocId,
          nickname,
          status: roomStatus,
          viewers,
          totalTokensFound: totalTokens,
          synced_at: new Date().toISOString(),
          // Incluimos el desglose de tippers y los eventos crudos para auditoría/costeo
          tippers: tippers,
          events: events,
          source: "chaturbate_api_v1"
        });
        
        console.log(`[Drive] ✅ Histórico detallado archivado: ${fileName}`);
      }
    } catch (driveErr: any) {
      console.error(`[Drive] ❌ Error al archivar histórico para ${nickname}:`, driveErr.message);
    }
  }

  return {
    success: true,
    eventsProcessed,
    tokensFound: totalTokens,
    currentStatus: roomStatus,
    finalNextUrl,
  };
}

export async function GET(req: Request) {
  // Verificar autenticación — se acepta token de usuario autenticado (staff)
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: "Firebase Admin no inicializado. Revisa las variables de entorno." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const serverSecret = process.env.CRON_SECRET;

  let isAuthorized = false;

  // Caso 1: Autenticación por Secreto de Cron (GitHub Actions)
  if (cronSecretHeader && serverSecret && cronSecretHeader === serverSecret) {
    console.log("[Sync] Autorizado via Cron Secret.");
    isAuthorized = true;
  } 
  // Caso 2: Autenticación por Firebase ID Token (Usuario Staff)
  else if (authHeader?.startsWith("Bearer ")) {
    try {
      await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      isAuthorized = true;
    } catch {
      return NextResponse.json(
        { success: false, error: "Token inválido o expirado." },
        { status: 401 }
      );
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, error: "No autorizado: se requiere token o secreto válido." },
      { status: 401 }
    );
  }

  const syncResults: any[] = [];
  const processedNicknames = new Set<string>();

  try {
    // 1. Obtener todas las modelos configuradas en V2
    const profilesSnap = await adminDb.collection("modelos_profile_v2").get();
    
    // 2. Procesar modelos con API de Chaturbate habilitada
    for (const doc of profilesSnap.docs) {
      const data = doc.data();
      const apiEnabled = data.apiEnabledPlatforms || [];
      const chaturbateCreds = data.credentials?.Chaturbate;
      
      if (apiEnabled.includes("Chaturbate") && chaturbateCreds?.apiKey) {
        const nickname = chaturbateCreds.username || data.generalInfo?.artisticName;
        
        if (nickname) {
          try {
            const lastNextUrl = chaturbateCreds.lastNextUrl || "";
            const modelDocId = doc.id;
            
            const syncResult = await syncModelEventsServer(nickname, chaturbateCreds.apiKey.trim(), modelDocId, lastNextUrl);
            
            // Si hay un nuevo cursor, guardarlo en el perfil para la próxima sincronización
            if (syncResult.finalNextUrl && syncResult.finalNextUrl !== lastNextUrl) {
              await doc.ref.update({
                "credentials.Chaturbate.lastNextUrl": syncResult.finalNextUrl
              });
              console.log(`[Sync] Nuevo cursor nextUrl guardado para ${nickname}`);
            }

            syncResults.push({
              nickname,
              status: syncResult.currentStatus,
              tokens: syncResult.tokensFound,
              events: syncResult.eventsProcessed
            });
            processedNicknames.add(nickname.toLowerCase());
          } catch (e: any) {
            console.error(`Error sincronizando ${nickname}:`, e.message);
          }
        }
      }
    }

    // 3. Mantener compatibilidad con Sienna_Lux01 (Legacy) si no se ha procesado vía V2
    const legacySiennaUrl = process.env.CHATURBATE_EVENTS_URL_SIENNA_LUX01;
    if (legacySiennaUrl && !processedNicknames.has("sienna_lux01")) {
      try {
        const syncResult = await syncModelEventsServer("Sienna_Lux01", legacySiennaUrl);
        syncResults.push({
          nickname: "Sienna_Lux01",
          status: syncResult.currentStatus,
          tokens: syncResult.tokensFound,
          events: syncResult.eventsProcessed
        });
      } catch (e: any) {
        console.error("Error en sincronización legacy de Sienna:", e.message);
      }
    }

    if (syncResults.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No se encontraron modelos con integraciones API activas para sincronizar."
      });
    }

    // Reporte descriptivo incluyendo tokens para diagnóstico
    const reportParts = syncResults.map(r => {
      let part = `${r.nickname} (${r.status})`;
      if (r.tokens > 0) part += ` [+${r.tokens} tk]`;
      else if (r.events > 0) part += ` (${r.events} evs)`;
      return part;
    });

    return NextResponse.json({
      success: true,
      message: `Sincronización masiva completada: ${reportParts.join(", ")}`,
      count: syncResults.length,
      data: syncResults
    });

  } catch (error: any) {
    console.error("Error crítico en sync-chaturbate:", error);
    return NextResponse.json(
      { success: false, error: `Error interno del servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
