import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

/**
 * EXCEPCIÓN AL PROTOCOLO DE AISLAMIENTO — APROBADA
 * Por decisión del equipo (ver SEGURIDAD_Y_AISLAMIENTO.md Nota final),
 * este endpoint de servidor tiene permiso explícito de escribir en `models`
 * y `daily_metrics` porque es una operación de sincronización automática
 * ejecutada desde el servidor (Admin SDK), no desde el cliente.
 *
 * La sincronización usa el campo `nickname` como clave de unión entre apps.
 */

async function syncModelEventsServer(nickname: string, eventUrl: string) {
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

  try {
    const statusRes = await fetch(
      `https://chaturbate.com/api/room_status/${nickname}/`,
      { headers, cache: "no-store" }
    );
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.room_status && statusData.room_status !== "offline") {
        roomStatus = statusData.room_status;
        viewers = statusData.num_users || 0;
      }
    }
  } catch {
    console.warn("No se pudo obtener el estado de la sala de Chaturbate.");
  }

  // 2. Obtener eventos (Tokens, etc.)
  const response = await fetch(eventUrl, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Chaturbate Events API error: status ${response.status}`);
  }

  const rawData = await response.json();
  const events = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

  let totalTokens = 0;
  for (const event of events) {
    if (!event?.method) continue;
    if (event.method === "tip") {
      totalTokens += event.body?.tokens || 0;
    } else if (event.method === "room_status") {
      roomStatus = event.body?.status || roomStatus;
      viewers = event.body?.viewers || viewers;
    }
  }

  // 3. Actualización en Firebase (Admin SDK — operación de servidor autorizada)
  const modelsRef = adminDb.collection("models");
  let snapshot = await modelsRef.where("nickname", "==", nickname).get();

  // Búsqueda flexible por si la capitalización difiere
  if (snapshot.empty) {
    const all = await modelsRef.get();
    const match = all.docs.find(
      (d) => d.data().nickname?.toLowerCase() === nickname.toLowerCase()
    );
    if (match) {
      snapshot = { empty: false, docs: [match] } as any;
    }
  }

  if (!snapshot.empty) {
    const modelDocId = snapshot.docs[0].id;
    await modelsRef.doc(modelDocId).update({
      status: "active",
      is_online: roomStatus === "public",
      "stream_stats.current_viewers": viewers,
      "stream_stats.synced_at": Timestamp.now(),
      "stream_stats.last_sync_status": roomStatus,
    });

    // 4. Registrar métricas diarias si hay tokens
    if (totalTokens > 0) {
      const dateStr = new Date().toISOString().split("T")[0];
      const metricsRef = adminDb.collection("daily_metrics");
      const mSnapshot = await metricsRef
        .where("model_id", "==", modelDocId)
        .where("date", "==", dateStr)
        .get();

      if (mSnapshot.empty) {
        await metricsRef.add({
          model_id: modelDocId,
          date: dateStr,
          tokens: totalTokens,
          currency: "tokens",
          source: "chaturbate_sync",
        });
      } else {
        await mSnapshot.docs[0].ref.update({
          tokens: (mSnapshot.docs[0].data().tokens || 0) + totalTokens,
        });
      }
    }
  }

  return {
    success: true,
    eventsProcessed: events.length,
    tokensFound: totalTokens,
    currentStatus: roomStatus,
  };
}

export async function GET(req: Request) {
  // Verificar autenticación — se acepta token de usuario autenticado (staff)
  if (!adminAuth) {
    return NextResponse.json(
      { error: "Firebase Admin no inicializado. Revisa las variables de entorno." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { success: false, error: "No autorizado: token requerido." },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return NextResponse.json(
      { success: false, error: "Token inválido o expirado." },
      { status: 401 }
    );
  }

  const nickname = "Sienna_Lux01";
  const eventUrl = process.env.CHATURBATE_EVENTS_URL_SIENNA_LUX01;

  if (!eventUrl) {
    return NextResponse.json(
      { success: false, error: "URL de eventos de Chaturbate no configurada en .env." },
      { status: 400 }
    );
  }

  try {
    const result = await syncModelEventsServer(nickname, eventUrl);
    return NextResponse.json({
      success: true,
      message: `Sincronización de ${nickname} realizada. Estado: ${result.currentStatus}`,
      data: result,
    });
  } catch (error: any) {
    console.error("Error en sync-chaturbate:", error);
    return NextResponse.json(
      { success: false, error: `Error crítico: ${error.message}` },
      { status: 500 }
    );
  }
}
