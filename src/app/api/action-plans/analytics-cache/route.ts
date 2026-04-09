import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helper para verificar autenticación y roles permitidos.
 */
async function verifyAuthToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Token de autenticación no proporcionado.");
  }

  const token = authHeader.substring(7);
  if (!adminAuth || !adminDb) {
    throw new Error("Firebase Admin SDK no está inicializado.");
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  
  if (!userDoc.exists) {
    throw new Error("Usuario no encontrado.");
  }

  const role = userDoc.data()?.role;
  const allowedRoles = ["admin", "monitor", "coordinador"];
  
  if (!allowedRoles.includes(role)) {
    throw new Error("Acceso denegado: Rol insuficiente.");
  }

  return { uid: decodedToken.uid, role };
}

/**
 * GET: Obtener el historial procesado (Caché de 1 año)
 * Costo optimizado: 1 sola lectura a la BD sin importar cuántos días (hasta 365) traiga.
 */
export async function GET(req: NextRequest) {
  try {
    await verifyAuthToken(req);

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json({ error: "Faltan parámetros: modelId" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin no configurado" }, { status: 500 });
    }

    // Leemos el documento de caché entero (Costo: 1 Read)
    const cacheRef = adminDb.collection("modelos_analytics_cache_v2").doc(modelId);
    const cacheDoc = await cacheRef.get();

    if (!cacheDoc.exists) {
      // Si no hay caché aún, devolvemos un array vacío para que el Frontend/IA sepa que toca armarla
      return NextResponse.json({ 
        modelId, 
        lastUpdated: null, 
        history: [],
        message: "No hay caché generada aún para este modelo."
      });
    }

    const data = cacheDoc.data();

    return NextResponse.json({
      modelId,
      lastUpdated: data?.lastUpdated || null,
      history: data?.history || [],
      // Podríamos agregar métricas globales precalculadas del año (totalTokens, AVG ICR, etc.)
      globalMetrics: data?.globalMetrics || null 
    });

  } catch (error: any) {
    console.error("Error en API Analytics Cache (GET):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Actualizar/Alimentar la Caché (Rolling Window de 365 días)
 * Recibe un array de días o un solo día para agregar a la caché, eliminando lo que sea mayor a 1 año.
 * Costo optimizado: 1 Read (Caché actual) + 1 Write (Módulo actualizado). 
 * NOTA: La extracción masiva de Drive o daily_metrics debe hacerse por fuera (ej. un cron job) y enviar aquí el resultado procesado.
 */
export async function POST(req: NextRequest) {
  try {
    await verifyAuthToken(req);

    const body = await req.json();
    const { modelId, newRecords } = body; 
    // newRecords debe ser un array de objetos con { date, tokens, hours, tph, icj, zscore, etc }

    if (!modelId || !newRecords || !Array.isArray(newRecords)) {
      return NextResponse.json({ error: "Payload inválido. Se requiere modelId y newRecords (array)" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin no confg" }, { status: 500 });
    }

    const cacheRef = adminDb.collection("modelos_analytics_cache_v2").doc(modelId);
    
    // Transacción para asegurar consistencia
    await adminDb.runTransaction(async (transaction) => {
      const cacheDoc = await transaction.get(cacheRef);
      
      let history: any[] = [];
      if (cacheDoc.exists) {
        history = cacheDoc.data()?.history || [];
      }

      // Convertimos history actual a Map para facilitar updates por fecha
      const historyMap = new Map();
      history.forEach(record => {
        historyMap.set(record.date, record);
      });

      // Insertar o actualizar nuevos registros
      newRecords.forEach(newRecord => {
        if (newRecord.date) {
            historyMap.set(newRecord.date, newRecord);
        }
      });

      // Volver a array y ordenar por fecha descendente (más reciente primero)
      let updatedHistory = Array.from(historyMap.values());
      updatedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Lógica de "Rolling Window": Mantener solo los últimos 365 días
      if (updatedHistory.length > 365) {
        updatedHistory = updatedHistory.slice(0, 365);
      }

      // Calcular algunas métricas globales del año para facilidad de la IA
      const totalTokens = updatedHistory.reduce((acc, curr) => acc + (Number(curr.tokens) || 0), 0);
      const totalHours = updatedHistory.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
      const avgTph = totalHours > 0 ? (totalTokens / totalHours) : 0;

      const cacheData = {
        modelId,
        lastUpdated: new Date().toISOString(),
        globalMetrics: {
           daysTracked: updatedHistory.length,
           totalTokensYear: totalTokens,
           totalHoursYear: totalHours,
           avgTphYear: Number(avgTph.toFixed(2))
        },
        history: updatedHistory
      };

      if (cacheDoc.exists) {
        transaction.update(cacheRef, cacheData);
      } else {
        transaction.set(cacheRef, cacheData);
      }
    });

    return NextResponse.json({ success: true, message: "Caché analítica actualizada correctamente." });

  } catch (error: any) {
    console.error("Error en API Analytics Cache (POST):", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
