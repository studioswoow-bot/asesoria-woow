import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helper para verificar que el request viene de un usuario con rol permitido.
 */
async function verifyAuthToken(req: Request) {
  if (!adminAuth || !adminDb) {
    throw new Error("Firebase Admin SDK no está inicializado.");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No autorizado: Falta el token de autenticación.");
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await adminAuth.verifyIdToken(token);

  // Verificar el rol en Firestore
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  const role = userDoc.data()?.role;
  const allowedRoles = ["admin", "monitor", "coordinador"];
  
  if (!userDoc.exists || !allowedRoles.includes(role)) {
    throw new Error("Acceso denegado: Rol insuficiente.");
  }

  return decodedToken;
}

/**
 * API para obtener métricas diarias y horas de trabajo de forma segura (Solo Lectura)
 * GET /api/action-plans/metrics?modelId=...&start=...&end=...
 */
export async function GET(req: NextRequest) {
  try {
    await verifyAuthToken(req);

    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("modelId");
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!modelId || !startDate || !endDate) {
      return NextResponse.json({ error: "Faltan parámetros requeridos" }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Firebase Admin no configurado" }, { status: 500 });
    }

    // 1. Obtener métricas de tokens (daily_metrics)
    const metricsSnap = await adminDb
      .collection("daily_metrics")
      .where("model_id", "==", modelId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    // 2. Obtener horas de trabajo (work_hours)
    const hoursSnap = await adminDb
      .collection("work_hours")
      .where("model_id", "==", modelId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get();

    const metricsMap = new Map();

    // Procesar métricas (tokens/moneda)
    metricsSnap.forEach((doc) => {
      const data = doc.data();
      const date = data.date;
      const existing = metricsMap.get(date) || { tokens: 0, hours: 0, minutes: 0 };

      let tokenValue = Number(data.tokens || 0);
      // Conversión USD a Tokens (1 USD = 20 Tokens) si aplica
      if (data.currency?.toLowerCase() === "usd") {
        tokenValue = tokenValue * 20;
      }

      metricsMap.set(date, {
        ...existing,
        tokens: existing.tokens + tokenValue,
      });
    });

    // Procesar horas de trabajo
    hoursSnap.forEach((doc) => {
      const data = doc.data();
      const date = data.date;
      const existing = metricsMap.get(date) || { tokens: 0, hours: 0, minutes: 0 };

      metricsMap.set(date, {
        ...existing,
        hours: existing.hours + (Number(data.hours) || 0),
        minutes: existing.minutes + (Number(data.minutes) || 0),
      });
    });

    // Generar array de resultados para el periodo (14 días garantizados)
    const results = [];
    const start = new Date(startDate);
    
    for (let i = 0; i < 14; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dateStr = current.toISOString().split("T")[0];
      
      const metric = metricsMap.get(dateStr) || { tokens: 0, hours: 0, minutes: 0 };
      const hoursReal = metric.hours + (metric.minutes / 60);

      results.push({
        day: i + 1,
        date: dateStr,
        tokens: Math.round(metric.tokens),
        hours: Number(hoursReal.toFixed(2)),
        dcm: metric.tokens * 0.05, // Valor DCM según lógica de negocio
      });
    }

    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error("Error en API Metrics:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
