import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helper para verificar que el request viene de un usuario con rol permitido.
 */
async function verifyAuthToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Token de autenticación no proporcionado.");
  }

  const token = authHeader.substring(7);
  
  if (!adminAuth || !adminDb) {
    throw new Error("Firebase Admin SDK no está inicializado en el servidor.");
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
  
  if (!userDoc.exists) {
    throw new Error("Usuario no encontrado en la base de datos.");
  }

  const role = userDoc.data()?.role;
  const allowedRoles = ["admin", "monitor", "coordinador"];
  
  if (!allowedRoles.includes(role)) {
    throw new Error("Acceso denegado: Rol insuficiente.");
  }

  return { uid: decodedToken.uid, role, token };
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

    console.log(`[MetricsAPI] Consultando métricas para ModelID: ${modelId} entre ${startDate} y ${endDate}`);

    // 1. Obtener métricas de tokens (daily_metrics) - Filtramos en memoria para evitar error de índice compuesto
    const metricsSnap = await adminDb
      .collection("daily_metrics")
      .where("model_id", "==", modelId)
      .get();

    // 2. Obtener horas de trabajo (work_hours) - Filtramos en memoria para evitar error de índice compuesto
    const hoursSnap = await adminDb
      .collection("work_hours")
      .where("model_id", "==", modelId)
      .get();

    console.log(`[MetricsAPI] Docs crudos: ${metricsSnap.size} métricas, ${hoursSnap.size} horas.`);

    const metricsMap = new Map();

    // Procesar métricas (tokens/moneda) - Aplicando filtro de fecha manual
    metricsSnap.forEach((doc) => {
      const data = doc.data();
      const date = data.date;
      
      // Filtro manual de fechas
      if (date < startDate || date > endDate) return;

      const existing = metricsMap.get(date) || { tokens: 0, hours: 0 };

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

    // Procesar horas de trabajo - Usando campo 'hours' e in-memory filter
    hoursSnap.forEach((doc) => {
      const data = doc.data();
      const date = data.date;
      
      // Filtro manual de fechas
      if (date < startDate || date > endDate) return;

      const existing = metricsMap.get(date) || { tokens: 0, hours: 0 };

      // En el proyecto 7288e, 'hours' es el total decimal (6.2h = 6h 12m)
      const hoursVal = Number(data.hours || 0);

      metricsMap.set(date, {
        ...existing,
        hours: existing.hours + hoursVal,
      });
    });

    console.log(`[MetricsAPI] Mapa de métricas generado: ${metricsMap.size} días con datos en el rango.`);

    try {
      // Generar array de resultados dinámico para el periodo seleccionado
      const results = [];
      const startObj = new Date(startDate + "T00:00:00");
      const endObj = new Date(endDate + "T00:00:00");
      
      // Cálculo seguro de la diferencia de días
      const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      // Límite de seguridad para permitir periodos amplios (hasta un año)
      const safetyLimit = Math.min(diffDays, 366);

      console.log(`[MetricsAPI] Procesando ${safetyLimit} días para el periodo ${startDate} - ${endDate}`);
      
      // 3. Buscar Días Festivos con antelación
      let festivosPeriod: string[] = [];
      const HOLIDAYS_2026 = [
        "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
        "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
        "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
        "2026-11-16", "2026-12-08", "2026-12-25"
      ];
      
      try {
        const festivosSnap = await adminDb.collection("festivos").get();
        festivosSnap.forEach(doc => {
           if (doc.id >= startDate && doc.id <= endDate) {
              festivosPeriod.push(doc.id);
           }
        });
        
        // Si la colección está vacía o no existe en este proyecto, usar fallback de 2026
        if (festivosPeriod.length === 0) {
           festivosPeriod = HOLIDAYS_2026.filter(h => h >= startDate && h <= endDate);
        }
      } catch (e) {
        console.error("No se pudo consultar la colección festivos, usando fallback 2026", e);
        festivosPeriod = HOLIDAYS_2026.filter(h => h >= startDate && h <= endDate);
      }
      
      let totalTokens = 0;
      let totalHours = 0;
      let avgZscore = 0;
      let daysWithWork = 0;
      
      const sundays: string[] = [];
      const uniqueFestivos: string[] = [];

      for (let i = 0; i < safetyLimit; i++) {
        const current = new Date(startObj);
        current.setDate(startObj.getDate() + i);
        
        // Formato YYYY-MM-DD seguro sin desfase de zona horaria
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayOfMonth}`;
        
        let isHoliday = false;

        // Registrar domingos (0 en JS Date)
        if (current.getDay() === 0) {
           sundays.push(dateStr);
           isHoliday = true;
        }

        // Registrar festivos que NO caigan en domingo
        if (festivosPeriod.includes(dateStr)) {
           if (!sundays.includes(dateStr) && !uniqueFestivos.includes(dateStr)) {
               uniqueFestivos.push(dateStr);
           }
           isHoliday = true;
        }
        
        const metric = metricsMap.get(dateStr) || { tokens: 0, hours: 0 };
        const hoursReal = Number(metric.hours) || 0;
        const tph = hoursReal > 0 ? metric.tokens / hoursReal : 0;

        // Z-Score calculation (Benchmark: Avg 1200 TPH, Std Dev 450)
        const studioAvg = 1200;
        const studioStdDev = 450;
        let zscore = hoursReal > 0 ? (tph - studioAvg) / studioStdDev : 0;
        
        // Sanitizar valores numéricos para Firestore
        if (isNaN(zscore) || !isFinite(zscore)) zscore = 0;

        totalTokens += metric.tokens;
        totalHours += hoursReal;
        if (hoursReal > 0) daysWithWork++;
        avgZscore += zscore;

        results.push({
          day: i + 1,
          date: dateStr,
          tokens: Math.round(metric.tokens) || 0,
          hours: Number(hoursReal.toFixed(2)) || 0,
          dcm: Number((metric.tokens * 0.05).toFixed(2)) || 0,
          zscore: Number(zscore.toFixed(2)),
          isHoliday: isHoliday
        });
      }

      const festivosCount = uniqueFestivos.length;

      const sundaysCount = sundays.length;
      const businessDays = Math.max(0, safetyLimit - sundaysCount - festivosCount);
      const expectedHoursMensual = businessDays * 6; // 6 horas obligatorias por día hábil

      const finalZscore = daysWithWork > 0 ? (avgZscore / daysWithWork) : 0;
      const finalTph = totalHours > 0 ? (totalTokens / totalHours) : 0;
      const finalIcj = expectedHoursMensual > 0 ? (totalHours / expectedHoursMensual) * 100 : 0;
      const finalIcr = finalTph * (finalIcj / 100);

      const calculatedGlobalMetrics = {
        tph: finalTph.toFixed(2),
        icj: finalIcj.toFixed(1),
        icr: finalIcr.toFixed(2),
        zscore: finalZscore.toFixed(2),
        totalHours: totalHours.toFixed(2),
        totalTokens: Math.round(totalTokens),
        businessDays: businessDays,
        sundaysCount: sundaysCount,
        festivosCount: festivosCount,
        expectedHoursMensual: expectedHoursMensual
      };

      console.log(`[MetricsAPI] Sincronización exitosa. Registros devueltos: ${results.length}`);
      return NextResponse.json({ 
          data: results,
          globalMetrics: calculatedGlobalMetrics
      });
    } catch (loopError: any) {
      console.error("Error en loop de procesamiento de métricas:", loopError);
      return NextResponse.json({ error: `Error procesando días: ${loopError.message}` }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error crítico en API Metrics:", error);
    return NextResponse.json({ 
      error: error.message || "Error interno del servidor",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 });
  }
}
